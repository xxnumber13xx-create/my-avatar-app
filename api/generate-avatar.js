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
//
// 【画像サイズ指定について】
//   generateContent エンドポイントでの正式なフィールド名がドキュメント上明確でないため、
//   下の候補（camelCase / snake_case、ネスト位置違い）を複数試すフォールバック実装にしています。
//   400 で "unknown field" 系のエラーが返ってきたらフィールド候補を落として再試行します。
//   最終的にどの形が通ったかは Vercel のログに出るので、確定したら SIZE_CONFIG_CANDIDATES を
//   通ったもの1つだけに絞ってください。

const MODEL = 'gemini-3.1-flash-image';
const TARGET_IMAGE_SIZE = '0.5K'; // 料金: 0.5K = $0.045/枚 (2026-07時点、標準ティア)
const TARGET_ASPECT_RATIO = '1:1'; // キャンバスが 480x480 の正方形なので 1:1

// generationConfig に差し込む「解像度指定ブロック」の候補
// 上から順に試して、400エラーになったら次を試す。全部ダメなら解像度指定なしで叩く。
const SIZE_CONFIG_CANDIDATES = [
  { imageConfig: { imageSize: TARGET_IMAGE_SIZE, aspectRatio: TARGET_ASPECT_RATIO } },
  { image_config: { image_size: TARGET_IMAGE_SIZE, aspect_ratio: TARGET_ASPECT_RATIO } },
  { imageConfig: { imageSize: TARGET_IMAGE_SIZE } },
  { image_config: { image_size: TARGET_IMAGE_SIZE } },
];

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

  // 候補を順に試す。null は「解像度指定なし」の最終フォールバック。
  const attempts = [...SIZE_CONFIG_CANDIDATES, null];

  for (let i = 0; i < attempts.length; i++) {
    const sizeConfig = attempts[i];
    const generationConfig = sizeConfig ? { ...sizeConfig } : {};
    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }
      ],
      ...(Object.keys(generationConfig).length ? { generationConfig } : {})
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        const isLast = i === attempts.length - 1;
        // 400 で "unknown field" / "Invalid JSON" 系なら、次の候補にフォールバック
        const shouldFallback = response.status === 400 && !isLast && (
          /unknown\s*name|unknown\s*field|Invalid\s*JSON|Cannot find field|proto|invalid_argument/i.test(errText)
        );
        if (shouldFallback) {
          console.warn(`[generate-avatar] size config candidate #${i} rejected, trying next. status=${response.status}, body=${errText.slice(0, 300)}`);
          continue;
        }
        // フォールバックしないエラーはそのまま返す
        console.error('Gemini API error:', response.status, errText);
        // 429 (クォータ) は分かりやすい日本語にする
        if (response.status === 429) {
          res.status(429).json({ error: 'いま こみあってるよ。すこし じかんを おいてから、もういちど おしてね。' });
          return;
        }
        res.status(502).json({ error: 'Gemini API の呼び出しに失敗しました。MODEL名やAPIキー、課金設定を確認してください。' });
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

      // どの候補で通ったかログに残す（確定したら SIZE_CONFIG_CANDIDATES を絞る参考に）
      if (sizeConfig) {
        console.log(`[generate-avatar] size config candidate #${i} accepted: ${JSON.stringify(sizeConfig)}`);
      } else {
        console.log('[generate-avatar] no size config used (all candidates rejected)');
      }

      const outMime = inline.mimeType || inline.mime_type || 'image/png';
      res.status(200).json({ imageData: `data:${outMime};base64,${inline.data}` });
      return;
    } catch (err) {
      console.error('generate-avatar handler error:', err);
      res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
      return;
    }
  }
}
