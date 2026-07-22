// api/socrates.js
// フェーズ6: ソクラテス先生 - Gemini を使って「答えを言わずヒントで導く」対話。
//
// 期待するリクエスト:
//   POST /api/socrates
//   { question: string, hints: string[], mode: 'hint' | 'answer' | 'reflection' }
//
// mode:
//   'hint'       ヒントを1つ返す。hints.length で 1〜3 回目を判定
//   'answer'     ぼんやりとした答えを返す（10G 支払い後）
//   'reflection' 子供の説明を評価。okなら { correct: true, feedback: '...' }
//
// レスポンス:
//   { text: string, usageToday?: number }
//   { error: string, code: 'rate_limited'|'no_key'|... }

// Vercel の環境変数から Gemini API キーを取得
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// リクエスト元の簡易チェック（同一オリジンのみ許可）
const ALLOWED_ORIGINS = [
  'https://dressupavatars.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// ============================================================
// コスト制御: 日次カウンター (in-memory, サーバレス関数ウォーム中のみ持続)
// ============================================================
// 注意: これは MVP レベルの制御。関数インスタンスが複数動くと合算されないため
// 上限をやや厳しめに設定。厳密な制御が必要なら Vercel KV や Firestore admin に置換。
const DAILY_TEXT_LIMIT = 30;      // 全リクエストタイプ合算の 1 日上限
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 8;  // IP ごとに 5 分で 8 回まで

const rateBucket = new Map();     // ip -> { count, resetAt }
let dailyCounter = { date: '', text: 0, blocked: 0 };

function ymdUtc() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function bumpDaily() {
  const today = ymdUtc();
  if (dailyCounter.date !== today) {
    dailyCounter = { date: today, text: 0, blocked: 0 };
  }
  dailyCounter.text += 1;
  return dailyCounter;
}
function bumpBlocked() {
  const today = ymdUtc();
  if (dailyCounter.date !== today) {
    dailyCounter = { date: today, text: 0, blocked: 0 };
  }
  dailyCounter.blocked += 1;
}

function checkDailyLimit() {
  const today = ymdUtc();
  if (dailyCounter.date !== today) return true;
  return dailyCounter.text < DAILY_TEXT_LIMIT;
}

function checkRate(ip) {
  const now = Date.now();
  const b = rateBucket.get(ip);
  if (!b || b.resetAt < now) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT_PER_WINDOW) return false;
  b.count += 1;
  return true;
}

function buildHintPrompt(question, hints, hintCount) {
  const specificity =
    hintCount === 1 ? '大きな方向を示す、ざっくりした ヒント。まだ答えに近くていい。' :
    hintCount === 2 ? 'もうすこし しぼった ヒント。共通点や 手がかりを 1つ 具体的に。' :
                      'ほぼ 答えに近い ヒント。でも 答えそのものは 言わない。';
  const past = hints.length === 0 ? '（まだ）' : hints.map((h, i) => `【${i + 1}回目】${h}`).join('\n');
  return `あなたは 6〜10さいの こどもと たいわする、やさしい 先生です。

こどもの しつもん:
「${question}」

これまで だした ヒント:
${past}

いま ${hintCount}回目 の ヒントを 出します（ぜんぶで 3回まで）。

まもって ほしい ルール:
- ぜったいに 答えそのものは いわない
- ひらがな中心（むずかしい漢字はさける）
- 絵文字を 1〜2個 だけ 使う
- 60文字いない、1〜2文で みじかく
- こんかいの ヒントの こまかさ: ${specificity}
- さいごは 「なんでだと おもう？」「どこが きになる？」「ちがう みかたも できるかな？」など、こどもに 考えさせる 問いかけで しめる

ヒントの 本文だけ 返してください（「ヒント:」などの ラベルなし）。`;
}

function buildAnswerPrompt(question, hints) {
  return `6〜10さいの こどもに、しつもんの こたえを ていねいに 教えます。
これまで ヒントを ${hints.length}回 出しましたが、こどもは 分からなかったので 答えを 買いました。

しつもん: 「${question}」

ルール:
- 答えを 1〜2文で わかりやすく
- ひらがな中心
- 絵文字を 1〜2個
- 「じつはね、〜だよ」の やさしい 口調
- さいごに「もう1回 じぶんの ことばで せつめい できるかな？」と さそう

答え本文だけ 返してください。`;
}

function buildReflectionPrompt(question, answer, childExplanation) {
  return `6〜10さいの こどもが、じぶんの ことばで 説明できたか 判定します。

しつもん: 「${question}」
先生が おしえた こたえ: 「${answer}」
こどもの せつめい: 「${childExplanation}」

JSON形式で 返してください（他のテキストなし）:
{
  "correct": true か false（要点を つかんで説明できてれば true、ぜんぜん違えば false）,
  "feedback": "ひらがな中心、40文字いない、褒める or もう少し という 一言"
}`;
}

async function callGemini(prompt, opts = {}) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.75,
        maxOutputTokens: opts.maxOutputTokens ?? 220,
        topP: 0.95
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

module.exports = async function handler(req, res) {
  // CORS プリフライト
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY 未設定', code: 'no_key' });
    return;
  }

  // レート制限
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  if (!checkRate(ip)) {
    bumpBlocked();
    res.status(429).json({ error: 'ちょっと まってね（5ふん あとに もういちど）', code: 'rate_limited' });
    return;
  }
  // 日次上限（in-memory、関数ウォーム中のみ有効）
  if (!checkDailyLimit()) {
    bumpBlocked();
    res.status(429).json({
      error: 'きょうは たくさん おはなし したね！ また あした つづきしよう 🌙',
      code: 'daily_limit'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { question = '', hints = [], mode = 'hint', answer = '', explanation = '' } = body;

  if (!question || question.length > 300) {
    res.status(400).json({ error: 'しつもんが みじかすぎ or ながすぎるよ', code: 'bad_input' });
    return;
  }

  try {
    if (mode === 'hint') {
      const hintCount = Math.min(3, Math.max(1, hints.length + 1));
      const text = await callGemini(buildHintPrompt(question, hints, hintCount));
      const usage = bumpDaily();
      res.json({ text, hintCount, usageToday: usage.text, dailyLimit: DAILY_TEXT_LIMIT });
      return;
    }
    if (mode === 'answer') {
      const text = await callGemini(buildAnswerPrompt(question, hints), { temperature: 0.5 });
      const usage = bumpDaily();
      res.json({ text, usageToday: usage.text, dailyLimit: DAILY_TEXT_LIMIT });
      return;
    }
    if (mode === 'reflection') {
      if (!answer || !explanation) {
        res.status(400).json({ error: 'answer と explanation が必要', code: 'bad_input' });
        return;
      }
      const raw = await callGemini(buildReflectionPrompt(question, answer, explanation), { temperature: 0.3 });
      // JSON 抽出（マークダウンで囲まれてる場合を吸収）
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = { correct: explanation.length >= 8, feedback: 'よく かんがえたね！ ✨' };
      }
      const usage = bumpDaily();
      res.json({ ...parsed, usageToday: usage.text, dailyLimit: DAILY_TEXT_LIMIT });
      return;
    }
    res.status(400).json({ error: 'mode が不正', code: 'bad_input' });
  } catch (err) {
    console.error('[socrates] Gemini error:', err);
    res.status(500).json({ error: 'せんせいが おやすみちゅう…', code: 'gemini_error', detail: err.message });
  }
}
