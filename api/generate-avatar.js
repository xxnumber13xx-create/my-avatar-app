// api/generate-avatar.js
// Vercel サーバーレス関数。
// 子どもが描いた絵(dataURL)を受け取り、Gemini API で「リアルな見た目」に変換して返します。
//
// 【重要】GEMINI_API_KEY は Vercel プロジェクトの環境変数として設定してください。
//   Vercelダッシュボード → プロジェクト → Settings → Environment Variables
//   ここに書いたりフロントエンド(HTML)に書いたりは絶対にしないでください。
//
// 【要確認】MODEL の値は Google 側の仕様変更で変わることがあります。
//   デプロイ前に Google AI Studio / Gemini API の最新ドキュメントで
//   「画像を入力として受け取り、画像を生成できるモデル名」を確認し、
//   必要であれば下の MODEL 定数を書き換えてください。

const MODEL = 'gemini-3.1-flash-lite-image';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このAPIはPOSTのみ対応しています' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'サーバーに GEMINI_API_KEY が設定されていません（Vercelの環境変数を確認してください）' });
    return;
  }

  const { imageData } = req.body || {};
  if (!imageData || typeof imageData !== 'string') {
    res.status(400).json({ error: 'imageData（画像のdataURL）が必要です' });
    return;
  }

  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'imageData の形式が正しくありません（PNG/JPEGのdataURLを渡してください）' });
    return;
  }
  const mimeType = match[1];
  const base64 = match[2];

  const prompt =
    '添付した、子どもが描いた絵をもとに、キャラクターのデザイン・色使い・形はできるだけ忠実に保ちながら、' +
    '写真のようにリアルな質感で描き直してください。背景はシンプルな単色にしてください。';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      res.status(502).json({ error: 'Gemini API の呼び出しに失敗しました。MODEL名やAPIキーを確認してください。' });
      return;
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline?.data) {
      console.error('Gemini response has no image data:', JSON.stringify(data).slice(0, 800));
      res.status(502).json({ error: '画像が生成されませんでした。プロンプトやモデル設定を見直してください。' });
      return;
    }

    const outMime = inline.mimeType || inline.mime_type || 'image/png';
    res.status(200).json({ imageData: `data:${outMime};base64,${inline.data}` });
  } catch (err) {
    console.error('generate-avatar handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
}
