// shared/utils.js - 画像処理・トースト・色計算・パーツライブラリ

/**
 * 紙色に近いピクセルを透明化し、描画部分の外接矩形＋padding で切り抜いたPNG dataURLを返す。
 * 描画が無ければ null。
 */
export function extractOpaqueImageDataURL(sourceCanvas, opts = {}) {
  const paper = opts.paper || '#FFFDF7';
  const tolerance = opts.tolerance ?? 22;
  const padding = opts.padding ?? 6;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext('2d');
  const src = srcCtx.getImageData(0, 0, w, h);
  const data = src.data;
  const paperRgb = hexToRgb(paper);
  const t2 = tolerance * tolerance * 3;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = data[i]     - paperRgb.r;
      const dg = data[i + 1] - paperRgb.g;
      const db = data[i + 2] - paperRgb.b;
      const isPaper = (dr * dr + dg * dg + db * db) < t2;
      if (isPaper || data[i + 3] === 0) {
        data[i + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const alphaC = document.createElement('canvas');
  alphaC.width = w; alphaC.height = h;
  alphaC.getContext('2d').putImageData(src, 0, 0);

  const px = Math.max(0, minX - padding);
  const py = Math.max(0, minY - padding);
  const pw = Math.min(w, maxX + padding) - px;
  const ph = Math.min(h, maxY + padding) - py;

  const out = document.createElement('canvas');
  out.width = pw; out.height = ph;
  out.getContext('2d').drawImage(alphaC, px, py, pw, ph, 0, 0, pw, ph);
  return out.toDataURL('image/png');
}

export function hexToRgb(hex) {
  const s = hex.replace('#', '');
  const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  const int = parseInt(n, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex(r, g, b) {
  const to = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** トースト表示（自動で.toastを作成） */
export function showToast(message, duration = 1600) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

/** dataURL / URL を Image として読み込む */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 画像を読み込み、紙色（既定は #FFFDF7 近辺）を透明化した Image オブジェクトを返す。
 * 保存済み PNG は draw 時点で透明化されているため大半のピクセルはスキップされるが、
 * 半透明の紙色残りや、透明化されていない古いデータへの保険。
 */
export async function loadImageTransparent(src, opts = {}) {
  const img = await loadImage(src);
  const paper = opts.paper || '#FFFDF7';
  const tolerance = opts.tolerance ?? 22;
  const paperRgb = hexToRgb(paper);
  const t2 = tolerance * tolerance * 3;

  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  let changed = false;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const dr = d[i]     - paperRgb.r;
    const dg = d[i + 1] - paperRgb.g;
    const db = d[i + 2] - paperRgb.b;
    if ((dr * dr + dg * dg + db * db) < t2) {
      d[i + 3] = 0;
      changed = true;
    }
  }
  if (!changed) return img; // 変化なしなら元の Image をそのまま返す
  ctx.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => {
    const out = new Image();
    out.onload = () => resolve(out);
    out.onerror = reject;
    out.src = c.toDataURL('image/png');
  });
}

/**
 * 紙色に近いピクセルを透明化して、同じサイズの dataURL を返す。
 * extractOpaqueImageDataURL の「切り抜き無し版」。draw の avatar-body / avatar-face 保存で使用。
 */
export function stripPaperToTransparent(sourceCanvas, opts = {}) {
  const paper = opts.paper || '#FFFDF7';
  const tolerance = opts.tolerance ?? 22;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const paperRgb = hexToRgb(paper);
  const t2 = tolerance * tolerance * 3;

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const outCtx = out.getContext('2d');
  outCtx.drawImage(sourceCanvas, 0, 0);
  const img = outCtx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const dr = d[i]     - paperRgb.r;
    const dg = d[i + 1] - paperRgb.g;
    const db = d[i + 2] - paperRgb.b;
    if ((dr * dr + dg * dg + db * db) < t2) {
      d[i + 3] = 0;
    }
  }
  outCtx.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}

/** SVG文字列内の currentColor を指定色に置換して新しいSVG文字列を返す */
export function tintSvg(svgString, color) {
  return svgString.replace(/currentColor/g, color);
}

/** SVG文字列を Image オブジェクトに変換する */
export function svgToImage(svgString) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return loadImage(url).then(img => {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return img;
  });
}

/**
 * 顔パーツのSVGライブラリ（お絵かき画面のスタンプ用）
 */
export const PART_LIBRARY = {
  face: [
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><ellipse cx="70" cy="75" rx="58" ry="58" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'たまご', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="160" viewBox="0 0 140 160"><path d="M70 8 C104 8 128 42 128 82 C128 122 104 152 70 152 C36 152 12 122 12 82 C12 42 36 8 70 8 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'ほっそり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="170" viewBox="0 0 120 170"><path d="M60 8 C90 8 104 40 104 78 C104 118 88 158 60 162 C32 158 16 118 16 78 C16 40 30 8 60 8 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'まる丸', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'シャープ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="160" viewBox="0 0 130 160"><path d="M65 8 C96 8 112 36 112 70 C112 100 100 130 65 154 C30 130 18 100 18 70 C18 36 34 8 65 8 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'エラ張り', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><path d="M70 8 C102 8 122 34 122 66 C122 96 116 118 96 136 C86 144 78 148 70 148 C62 148 54 144 44 136 C24 118 18 96 18 66 C18 34 38 8 70 8 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'こども', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="145" viewBox="0 0 150 145"><ellipse cx="75" cy="72" rx="62" ry="60" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'ハート型', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><path d="M70 10 C104 10 124 32 124 62 C124 96 100 128 70 146 C40 128 16 96 16 62 C16 32 36 10 70 10 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/><path d="M40 30 Q70 6 100 30" stroke="#2E2A47" stroke-width="3" fill="none"/></svg>` },
    { label: 'ふっくら', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><ellipse cx="75" cy="76" rx="62" ry="60" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/><ellipse cx="35" cy="86" rx="14" ry="10" fill="#FFCFB8" opacity="0.5"/><ellipse cx="115" cy="86" rx="14" ry="10" fill="#FFCFB8" opacity="0.5"/></svg>` },
    { label: '色白', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><ellipse cx="70" cy="75" rx="58" ry="58" fill="#FFF1E4" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: '小麦いろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><ellipse cx="70" cy="75" rx="58" ry="58" fill="#E8B888" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'ぷにぷに', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><path d="M75 10 C110 10 130 40 130 76 C130 112 108 138 75 140 C42 138 20 112 20 76 C20 40 40 10 75 10 Z" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'ロボット顔', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect x="20" y="20" width="110" height="110" rx="24" fill="#D8D8E8" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'どうぶつ丸', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="60" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/><circle cx="24" cy="35" r="20" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/><circle cx="126" cy="35" r="20" fill="#FFDDBE" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'なし（げんが優先）', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"></svg>` }
  ],
  eye: [
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="20" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="12" fill="#2E2A47"/><circle cx="44" cy="36" r="4" fill="#fff"/></svg>` },
    { label: 'キラ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="26" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="40" rx="14" ry="16" fill="#7C6FF2"/><circle cx="40" cy="40" r="7" fill="#2E2A47"/><circle cx="44" cy="34" r="5" fill="#fff"/><circle cx="34" cy="45" r="2" fill="#fff"/></svg>` },
    { label: 'ねむ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M12 42 Q40 22 68 42" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M18 40 L14 34 M28 30 L26 24 M40 26 L40 20 M52 30 L54 24 M62 40 L66 34" stroke="#2E2A47" stroke-width="3" stroke-linecap="round"/></svg>` },
    { label: 'ハート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M40 52 C24 42 24 26 32 26 C36 26 40 30 40 34 C40 30 44 26 48 26 C56 26 56 42 40 52 Z" fill="#FF6B9D"/></svg>` },
    { label: 'ほし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M40 26 L44 36 L54 36 L46 42 L50 52 L40 46 L30 52 L34 42 L26 36 L36 36 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'うるうる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="30" ry="26" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="42" rx="20" ry="20" fill="#5AB8FF"/><circle cx="40" cy="42" r="10" fill="#2E2A47"/><circle cx="46" cy="34" r="7" fill="#fff"/><circle cx="30" cy="48" r="4" fill="#fff"/></svg>` },
    { label: 'にらみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M8 46 Q40 30 72 46 Q40 40 8 46 Z" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="42" rx="8" ry="6" fill="#2E2A47"/></svg>` },
    { label: 'ぐるぐる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M40 40 m-14 0 a14 14 0 1 1 20 10 a10 10 0 1 1 -12 -8 a6 6 0 1 1 8 4" stroke="#2E2A47" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'たれめ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M12 34 Q40 24 68 34 Q68 48 40 52 Q12 48 12 34 Z" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="38" cy="42" r="10" fill="#2E2A47"/><circle cx="42" cy="38" r="4" fill="#fff"/></svg>` },
    { label: 'つりめ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M12 46 Q40 50 68 32 Q68 22 40 30 Q12 34 12 46 Z" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="42" cy="38" r="10" fill="#2E2A47"/><circle cx="46" cy="34" r="4" fill="#fff"/></svg>` },
    { label: 'まんまる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="26" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="16" fill="#2E2A47"/><circle cx="46" cy="33" r="6" fill="#fff"/><circle cx="32" cy="46" r="3" fill="#fff"/></svg>` },
    { label: 'ウインク', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="20" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="12" fill="#2E2A47"/><circle cx="44" cy="36" r="4" fill="#fff"/><path d="M4 40 Q10 34 16 40" stroke="#2E2A47" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ながまつげ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="27" ry="19" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="42" r="11" fill="#3E2A18"/><circle cx="44" cy="38" r="4" fill="#fff"/><path d="M14 26 L6 18 M22 20 L16 10 M34 16 L32 6 M46 16 L48 6 M58 20 L64 10 M66 26 L74 18" stroke="#2E2A47" stroke-width="2.5" stroke-linecap="round"/></svg>` },
    { label: 'クール', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M10 40 L70 40" stroke="#2E2A47" stroke-width="4" stroke-linecap="round"/><path d="M20 40 Q26 34 32 40" stroke="#2E2A47" stroke-width="2.5" fill="none"/><path d="M48 40 Q54 34 60 40" stroke="#2E2A47" stroke-width="2.5" fill="none"/></svg>` },
    { label: 'びっくり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="9" fill="#2E2A47"/><circle cx="44" cy="35" r="3" fill="#fff"/></svg>` },
    { label: 'なき', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="38" rx="26" ry="20" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="11" fill="#2E2A47"/><circle cx="44" cy="35" r="4" fill="#fff"/><path d="M24 54 Q20 66 14 72" stroke="#5AB8FF" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 54 Q60 66 66 72" stroke="#5AB8FF" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ジト目', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M8 42 Q40 36 72 42 Q40 46 8 42 Z" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="42" rx="7" ry="5" fill="#2E2A47"/></svg>` },
    { label: 'キツネ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M8 46 Q26 24 44 40 Q26 42 8 46 Z" fill="#fff" stroke="#2E2A47" stroke-width="2.5"/><path d="M36 40 Q54 24 72 46 Q54 42 36 40 Z" fill="#fff" stroke="#2E2A47" stroke-width="2.5"/><circle cx="26" cy="36" r="4" fill="#2E2A47"/><circle cx="54" cy="36" r="4" fill="#2E2A47"/></svg>` },
    { label: 'ふたえ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="27" ry="19" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M15 32 Q40 20 65 32" stroke="#2E2A47" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="40" cy="43" r="11" fill="#2E2A47"/><circle cx="45" cy="38" r="4" fill="#fff"/></svg>` },
    { label: 'ハピネス', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M10 44 Q40 18 70 44" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M18 40 Q24 44 30 40" stroke="#2E2A47" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 40 Q56 44 62 40" stroke="#2E2A47" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ロボ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect x="14" y="24" width="52" height="32" rx="6" fill="#2E2A47"/><circle cx="34" cy="40" r="9" fill="#5AB8FF"/><circle cx="58" cy="40" r="9" fill="#5AB8FF"/></svg>` },
    { label: 'ダイヤ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="27" ry="21" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M40 24 L52 40 L40 56 L28 40 Z" fill="#4CD4B0" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'ふあん', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="26" ry="18" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="34" cy="44" r="7" fill="#2E2A47"/><path d="M12 30 Q20 22 30 26" stroke="#2E2A47" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ハーフ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M10 40 Q40 22 70 40" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M10 40 Q40 46 70 40" stroke="#2E2A47" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/></svg>` },
    { label: 'ぱっちり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="29" ry="24" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="40" rx="17" ry="18" fill="#FF9EBB"/><circle cx="40" cy="40" r="9" fill="#2E2A47"/><circle cx="46" cy="32" r="6" fill="#fff"/><circle cx="30" cy="48" r="3" fill="#fff"/></svg>` }
  ],
  mouth: [
    { label: 'にこ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M10 20 Q40 55 70 20" stroke="#2E2A47" stroke-width="4" fill="#FF9EBB" stroke-linecap="round"/></svg>` },
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="30" rx="14" ry="18" fill="#E14E7F" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'すま', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M14 24 Q40 44 66 24" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ぺろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M14 20 Q40 45 66 20" stroke="#2E2A47" stroke-width="4" fill="#FF9EBB" stroke-linecap="round"/><path d="M46 38 Q52 50 46 52" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'あ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="34" rx="18" ry="22" fill="#8B3A5C" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="42" rx="10" ry="8" fill="#E14E7F"/></svg>` },
    { label: 'へ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M14 34 L40 22 L66 34" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { label: 'ちゅ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="30" rx="10" ry="14" fill="#E14E7F" stroke="#2E2A47" stroke-width="2.5"/><path d="M30 30 Q22 30 22 24 M50 30 Q58 30 58 24" stroke="#2E2A47" stroke-width="2" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'にっ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M12 22 Q40 46 68 22 Z" fill="#fff" stroke="#2E2A47" stroke-width="3" stroke-linejoin="round"/><line x1="24" y1="30" x2="24" y2="42" stroke="#2E2A47" stroke-width="1.5"/><line x1="34" y1="34" x2="34" y2="46" stroke="#2E2A47" stroke-width="1.5"/><line x1="46" y1="34" x2="46" y2="46" stroke="#2E2A47" stroke-width="1.5"/><line x1="56" y1="30" x2="56" y2="42" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'なみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M12 30 Q22 22 32 30 Q42 38 52 30 Q62 22 68 30" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { label: 'あくび', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="32" rx="20" ry="24" fill="#8B3A5C" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="42" rx="12" ry="9" fill="#E14E7F"/></svg>` },
    { label: 'いー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M10 26 Q40 26 70 26 Q40 40 10 26 Z" fill="#fff" stroke="#2E2A47" stroke-width="3" stroke-linejoin="round"/><line x1="22" y1="28" x2="22" y2="35" stroke="#2E2A47" stroke-width="1.5"/><line x1="32" y1="28" x2="32" y2="37" stroke="#2E2A47" stroke-width="1.5"/><line x1="48" y1="28" x2="48" y2="37" stroke="#2E2A47" stroke-width="1.5"/><line x1="58" y1="28" x2="58" y2="35" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'むっ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M16 30 Q40 22 64 30" stroke="#2E2A47" stroke-width="5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ぎざぎざ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M12 22 L22 32 L32 22 L42 32 L52 22 L62 32 L68 22 Q68 42 40 46 Q12 42 12 22 Z" fill="#8B3A5C" stroke="#2E2A47" stroke-width="2.5" stroke-linejoin="round"/></svg>` },
    { label: 'ハート口', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M40 42 C24 30 24 16 33 16 C37 16 40 20 40 24 C40 20 43 16 47 16 C56 16 56 30 40 42 Z" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'まんぞく', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M12 18 Q40 50 68 18" stroke="#2E2A47" stroke-width="4" fill="#FF9EBB" stroke-linecap="round"/><path d="M28 32 Q40 42 52 32" stroke="#8B3A5C" stroke-width="2" fill="none"/></svg>` },
    { label: 'とがり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M16 24 Q40 20 64 24 Q54 40 40 40 Q26 40 16 24 Z" fill="#E14E7F" stroke="#2E2A47" stroke-width="2.5"/></svg>` },
    { label: 'いたずら', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M12 22 Q30 40 46 30 Q58 22 68 26" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'モグモグ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="32" rx="22" ry="16" fill="#FF9EBB" stroke="#2E2A47" stroke-width="3"/><path d="M20 32 L60 32" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'こまり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M16 34 Q28 24 40 30 Q52 36 64 26" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'びっくり口', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="30" rx="9" ry="12" fill="#8B3A5C" stroke="#2E2A47" stroke-width="2.5"/></svg>` }
  ],
  nose: [
    { label: 'ちい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 15 Q35 40 30 45 Q25 40 30 15 Z" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: '・', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="24" cy="30" r="3" fill="#2E2A47"/><circle cx="36" cy="30" r="3" fill="#2E2A47"/></svg>` },
    { label: 'v', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M22 20 Q30 40 38 20" stroke="#2E2A47" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'さんかく', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 20 L38 38 L22 38 Z" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2" stroke-linejoin="round"/></svg>` },
    { label: 'なみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M20 30 Q26 24 30 30 Q34 36 40 30" stroke="#2E2A47" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ぶた', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><ellipse cx="30" cy="30" rx="14" ry="10" fill="#FFB8D0" stroke="#2E2A47" stroke-width="2"/><ellipse cx="24" cy="30" rx="2.5" ry="4" fill="#2E2A47"/><ellipse cx="36" cy="30" rx="2.5" ry="4" fill="#2E2A47"/></svg>` },
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="6" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'ほそい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><line x1="30" y1="16" x2="30" y2="42" stroke="#2E2A47" stroke-width="2.5" stroke-linecap="round"/></svg>` },
    { label: 'まがり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M28 16 Q34 30 26 42" stroke="#2E2A47" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'とがり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 14 L38 42 L22 42 Z" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2" stroke-linejoin="round"/></svg>` },
    { label: 'そばかす', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="20" cy="26" r="1.5" fill="#C88B5A"/><circle cx="26" cy="22" r="1.5" fill="#C88B5A"/><circle cx="34" cy="22" r="1.5" fill="#C88B5A"/><circle cx="40" cy="26" r="1.5" fill="#C88B5A"/><circle cx="23" cy="32" r="1.5" fill="#C88B5A"/><circle cx="37" cy="32" r="1.5" fill="#C88B5A"/><circle cx="30" cy="36" r="1.5" fill="#C88B5A"/></svg>` },
    { label: 'くま', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><ellipse cx="30" cy="30" rx="10" ry="7" fill="#2E2A47"/></svg>` },
    { label: 'ハート鼻', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 40 C20 32 20 22 26 22 C28 22 30 25 30 27 C30 25 32 22 34 22 C40 22 40 32 30 40 Z" fill="#FFB8D0" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'ワイド', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><ellipse cx="30" cy="30" rx="18" ry="10" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2"/><circle cx="22" cy="30" r="2" fill="#2E2A47"/><circle cx="38" cy="30" r="2" fill="#2E2A47"/></svg>` },
    { label: 'こぶた', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><ellipse cx="30" cy="30" rx="10" ry="8" fill="#FFA5C2" stroke="#2E2A47" stroke-width="2"/><circle cx="26" cy="30" r="2" fill="#2E2A47"/><circle cx="34" cy="30" r="2" fill="#2E2A47"/></svg>` },
    { label: 'ちょんちょん', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="24" cy="30" r="2" fill="#2E2A47"/><circle cx="30" cy="34" r="2" fill="#2E2A47"/><circle cx="36" cy="30" r="2" fill="#2E2A47"/></svg>` },
    { label: 'キラ鼻', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 15 Q35 40 30 45 Q25 40 30 15 Z" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2"/><circle cx="34" cy="24" r="2" fill="#fff"/></svg>` },
    { label: 'なし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"></svg>` }
  ],
  brow: [
    { label: 'アーチ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 Q40 4 70 20" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'まっすぐ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 18 L70 18" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ななめ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 8 L70 22" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'やま', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 L30 8 L50 8 L70 20" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { label: 'たれ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 10 Q40 22 70 10" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ハ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 22 L34 8" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M70 22 L46 8" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ふとい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M8 22 Q40 2 72 22" stroke="#6B4E2E" stroke-width="10" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ほそい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M12 18 Q40 8 68 18" stroke="#6B4E2E" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'おこり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 10 L36 20" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M70 10 L44 20" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'こまり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 12 Q40 26 70 12" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'キリッ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 22 L70 8" stroke="#6B4E2E" stroke-width="7" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ふわげ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 18 Q20 8 30 16 Q40 6 50 16 Q60 8 70 18" stroke="#6B4E2E" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'きんいろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 Q40 4 70 20" stroke="#D9A441" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'くろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 Q40 4 70 20" stroke="#2E2A47" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'あかげ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 Q40 4 70 20" stroke="#B5502E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'みじかめ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M22 18 Q40 6 58 18" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` }
  ],
  cheek: [
    { label: 'ほお', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="22" ry="14" fill="#FF9EBB" opacity="0.55"/></svg>` },
    { label: 'キラ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="22" ry="14" fill="#FF9EBB" opacity="0.55"/><path d="M30 40 L32 44 L36 46 L32 48 L30 52 L28 48 L24 46 L28 44 Z" fill="#fff"/><circle cx="50" cy="36" r="2.5" fill="#fff"/></svg>` },
    { label: 'しずく', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80"><path d="M30 15 Q40 30 40 45 Q40 60 30 60 Q20 60 20 45 Q20 30 30 15 Z" fill="#5AB8FF" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'うずまき', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 40 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -6 -2 a6 6 0 1 1 8 4 a10 10 0 1 1 -14 -8" stroke="#E14E7F" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'そばかす', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="26" cy="34" r="2" fill="#C88B5A"/><circle cx="34" cy="30" r="2" fill="#C88B5A"/><circle cx="42" cy="34" r="2" fill="#C88B5A"/><circle cx="30" cy="42" r="2" fill="#C88B5A"/><circle cx="38" cy="44" r="2" fill="#C88B5A"/><circle cx="46" cy="40" r="2" fill="#C88B5A"/></svg>` },
    { label: 'バツ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M28 30 L52 50 M52 30 L28 50" stroke="#FF6B9D" stroke-width="4" stroke-linecap="round"/></svg>` },
    { label: 'ほし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 26 L44 36 L54 36 L46 42 L50 52 L40 46 L30 52 L34 42 L26 36 L36 36 Z" fill="#FFC93C" opacity="0.85"/></svg>` },
    { label: 'ハート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 52 C24 42 24 26 32 26 C36 26 40 30 40 34 C40 30 44 26 48 26 C56 26 56 42 40 52 Z" fill="#FF6B9D" opacity="0.7"/></svg>` },
    { label: 'なみだぼくろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="48" cy="48" r="2.5" fill="#3E2A18"/></svg>` },
    { label: 'ぼかしピンク', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><radialGradient id="pcheek1"><stop offset="0%" stop-color="#FFB8D0" stop-opacity="0.8"/><stop offset="100%" stop-color="#FFB8D0" stop-opacity="0"/></radialGradient></defs><circle cx="40" cy="40" r="30" fill="url(#pcheek1)"/></svg>` },
    { label: 'ばつじるし2', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M30 32 L36 38 M36 32 L30 38" stroke="#FF6B9D" stroke-width="3" stroke-linecap="round"/><path d="M44 42 L50 48 M50 42 L44 48" stroke="#FF6B9D" stroke-width="3" stroke-linecap="round"/></svg>` },
    { label: 'ひっかき', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M30 28 L34 46 M38 26 L42 44 M46 28 L50 46" stroke="#FF9EBB" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>` },
    { label: 'まる連なり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="30" cy="36" r="4" fill="#FF9EBB" opacity="0.7"/><circle cx="42" cy="32" r="3" fill="#FF9EBB" opacity="0.6"/><circle cx="50" cy="40" r="2" fill="#FF9EBB" opacity="0.5"/></svg>` },
    { label: 'キズテープ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect x="24" y="34" width="32" height="10" rx="3" fill="#FFEAD2" stroke="#2E2A47" stroke-width="1.5" transform="rotate(-10 40 40)"/></svg>` },
    { label: 'ぷく', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="26" ry="18" fill="#FFA5C2" opacity="0.5"/></svg>` }
  ],
  hair: [
    { label: 'ながい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M100 20 C60 20 30 60 30 110 C30 130 34 150 40 170 L60 175 L60 100 Q65 60 100 55 Q135 60 140 100 L140 175 L160 170 C166 150 170 130 170 110 C170 60 140 20 100 20 Z" fill="#6B4E2E"/></svg>` },
    { label: 'ボブ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><path d="M100 15 C55 15 30 50 30 90 C30 105 34 120 40 130 L50 130 L50 80 Q60 55 100 50 Q140 55 150 80 L150 130 L160 130 C166 120 170 105 170 90 C170 50 145 15 100 15 Z" fill="#3E2A18"/></svg>` },
    { label: 'ツイン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200"><path d="M120 20 C80 20 55 55 55 95 C55 105 58 115 62 122 L70 122 L70 90 Q75 55 120 50 Q165 55 170 90 L170 122 L178 122 C182 115 185 105 185 95 C185 55 160 20 120 20 Z" fill="#A26B3A"/><ellipse cx="45" cy="140" rx="30" ry="55" fill="#A26B3A"/><ellipse cx="195" cy="140" rx="30" ry="55" fill="#A26B3A"/></svg>` },
    { label: 'ショート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><path d="M100 15 C60 15 35 45 35 80 C35 90 38 100 42 108 L58 108 L58 78 Q65 55 100 50 Q135 55 142 78 L142 108 L158 108 C162 100 165 90 165 80 C165 45 140 15 100 15 Z" fill="#2E2A47"/></svg>` },
    { label: 'ポニテ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200"><path d="M110 20 C70 20 45 55 45 95 C45 105 48 115 52 122 L60 122 L60 90 Q65 55 110 50 Q155 55 160 90 L160 122 L168 122 C172 115 175 105 175 95 C175 55 150 20 110 20 Z" fill="#FFA34D"/><path d="M155 60 Q210 90 210 150 Q195 165 175 155 Q160 130 150 100 Z" fill="#FFA34D" stroke="#2E2A47" stroke-width="1"/></svg>` },
    { label: 'おだんご', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180"><circle cx="100" cy="30" r="25" fill="#6B4E2E"/><path d="M100 55 C60 55 35 90 35 130 C35 140 38 150 42 158 L58 158 L58 125 Q65 100 100 95 Q135 100 142 125 L142 158 L158 158 C162 150 165 140 165 130 C165 90 140 55 100 55 Z" fill="#6B4E2E"/></svg>` },
    { label: 'ふわり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="180" viewBox="0 0 220 180"><path d="M110 15 C60 15 25 55 25 100 C25 120 30 140 40 155 L60 160 L60 100 Q68 65 110 60 Q152 65 160 100 L160 160 L180 155 C190 140 195 120 195 100 C195 55 160 15 110 15 Z" fill="#F296B5"/><circle cx="40" cy="60" r="15" fill="#F296B5"/><circle cx="180" cy="60" r="15" fill="#F296B5"/><circle cx="55" cy="45" r="10" fill="#F296B5"/><circle cx="165" cy="45" r="10" fill="#F296B5"/></svg>` },
    { label: 'みつあみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="220" viewBox="0 0 200 220"><path d="M100 20 C60 20 35 55 35 95 C35 105 38 115 42 122 L60 125 L60 95 Q65 60 100 55 Q135 60 140 95 L140 125 L158 122 C162 115 165 105 165 95 C165 55 140 20 100 20 Z" fill="#8B6B3F"/><g fill="#8B6B3F" stroke="#2E2A47" stroke-width="1"><ellipse cx="60" cy="140" rx="10" ry="12"/><ellipse cx="60" cy="160" rx="12" ry="12"/><ellipse cx="60" cy="180" rx="10" ry="12"/><ellipse cx="60" cy="200" rx="8" ry="10"/></g><g fill="#8B6B3F" stroke="#2E2A47" stroke-width="1"><ellipse cx="140" cy="140" rx="10" ry="12"/><ellipse cx="140" cy="160" rx="12" ry="12"/><ellipse cx="140" cy="180" rx="10" ry="12"/><ellipse cx="140" cy="200" rx="8" ry="10"/></g></svg>` },
    { label: 'ソバージュ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="200" viewBox="0 0 220 200"><path d="M110 15 C65 15 30 50 30 95 C30 110 34 125 42 138 L58 135 Q50 110 55 90 Q60 60 110 55 Q160 60 165 90 Q170 110 162 135 L178 138 C186 125 190 110 190 95 C190 50 155 15 110 15 Z" fill="#C48A4A"/><path d="M35 100 Q25 115 30 130 M185 100 Q195 115 190 130 M45 130 Q40 148 48 160 M175 130 Q180 148 172 160" stroke="#C48A4A" stroke-width="10" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'くせ毛', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180"><path d="M100 15 C60 15 32 45 32 85 C32 98 36 110 42 120 L58 118 L58 88 Q64 55 100 50 Q136 55 142 88 L142 118 L158 120 C164 110 168 98 168 85 C168 45 140 15 100 15 Z" fill="#8B5A3C"/><path d="M28 70 Q18 78 24 90 Q14 96 22 108" stroke="#8B5A3C" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M172 70 Q182 78 176 90 Q186 96 178 108" stroke="#8B5A3C" stroke-width="8" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ぱっつん', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><path d="M100 15 C58 15 32 50 32 90 C32 102 35 114 40 124 L58 124 L58 62 L142 62 L142 124 L160 124 C165 114 168 102 168 90 C168 50 142 15 100 15 Z" fill="#2E2A47"/><rect x="55" y="55" width="90" height="10" fill="#2E2A47"/></svg>` },
    { label: 'エアリー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="170" viewBox="0 0 210 170"><path d="M105 15 C62 15 34 48 34 88 C34 100 38 112 46 122 L60 118 L58 85 Q65 58 105 54 Q145 58 152 85 L150 118 L164 122 C172 112 176 100 176 88 C176 48 148 15 105 15 Z" fill="#E8C89A" opacity="0.9"/><path d="M40 60 Q30 70 36 82 M170 60 Q180 70 174 82" stroke="#E8C89A" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ロング巻き髪', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="230" viewBox="0 0 220 230"><path d="M110 15 C65 15 35 50 35 95 C35 108 39 120 45 130 L62 127 L60 95 Q65 60 110 55 Q155 60 160 95 L158 127 L175 130 C181 120 185 108 185 95 C185 50 155 15 110 15 Z" fill="#5D3A26"/><path d="M45 130 Q30 150 42 168 Q28 182 42 200 M175 130 Q190 150 178 168 Q192 182 178 200" stroke="#5D3A26" stroke-width="14" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ハーフアップ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="190" viewBox="0 0 200 190"><path d="M100 15 C60 15 35 50 35 90 C35 105 39 120 46 132 L62 128 L60 92 Q66 58 100 53 Q134 58 140 92 L138 128 L154 132 C161 120 165 105 165 90 C165 50 140 15 100 15 Z" fill="#7A4A2E"/><ellipse cx="100" cy="35" rx="18" ry="12" fill="#7A4A2E"/><path d="M92 35 Q100 25 108 35" stroke="#FF6B9D" stroke-width="3" fill="none"/></svg>` },
    { label: 'アフロ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><circle cx="110" cy="100" r="90" fill="#2E2A47"/><circle cx="60" cy="60" r="8" fill="#2E2A47"/><circle cx="160" cy="60" r="8" fill="#2E2A47"/><circle cx="40" cy="110" r="8" fill="#2E2A47"/><circle cx="180" cy="110" r="8" fill="#2E2A47"/></svg>` },
    { label: 'ウルフ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="180" viewBox="0 0 210 180"><path d="M105 15 C62 15 34 48 34 90 C34 105 38 118 46 130 L62 126 L58 85 Q65 55 105 50 Q145 55 152 85 L148 126 L164 130 C172 118 176 105 176 90 C176 48 148 15 105 15 Z" fill="#4A3A2E"/><path d="M40 90 Q28 105 34 122 M170 90 Q182 105 176 122" stroke="#4A3A2E" stroke-width="9" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'たかいポニテ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M100 20 C60 20 35 55 35 95 C35 105 38 115 42 122 L60 125 L60 95 Q65 60 100 55 Q135 60 140 95 L140 125 L158 122 C162 115 165 105 165 95 C165 55 140 20 100 20 Z" fill="#3E2A18"/><path d="M100 20 Q108 5 118 8 Q160 20 165 70 Q168 110 150 140" fill="none" stroke="#3E2A18" stroke-width="12" stroke-linecap="round"/><circle cx="108" cy="14" r="6" fill="#FF6B9D"/></svg>` },
    { label: 'カラフルメッシュ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M100 20 C60 20 30 60 30 110 C30 130 34 150 40 170 L60 175 L60 100 Q65 60 100 55 Q135 60 140 100 L140 175 L160 170 C166 150 170 130 170 110 C170 60 140 20 100 20 Z" fill="#2E2A47"/><path d="M60 100 L58 175" stroke="#7C6FF2" stroke-width="6" stroke-linecap="round"/><path d="M140 100 L142 175" stroke="#4CD4B0" stroke-width="6" stroke-linecap="round"/></svg>` },
    { label: 'シースルー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><path d="M100 15 C60 15 35 45 35 80 C35 90 38 100 42 108 L58 108 L58 78 Q65 55 100 50 Q135 55 142 78 L142 108 L158 108 C162 100 165 90 165 80 C165 45 140 15 100 15 Z" fill="#3E2A18"/><path d="M78 50 L72 90 M90 48 L86 92 M110 48 L114 92 M122 50 L128 90" stroke="#5D3A26" stroke-width="2" opacity="0.6"/></svg>` },
    { label: 'ロングストレート銀', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="220" viewBox="0 0 200 220"><path d="M100 20 C60 20 30 60 30 110 C30 130 34 150 40 170 L60 175 L60 100 Q65 60 100 55 Q135 60 140 100 L140 175 L160 170 C166 150 170 130 170 110 C170 60 140 20 100 20 Z" fill="#D8D8E8"/></svg>` },
    { label: 'かりあげ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="110" viewBox="0 0 180 110"><path d="M90 12 C55 12 32 35 32 62 C32 74 36 85 42 94 L58 94 L58 60 Q65 42 90 38 Q115 42 122 60 L122 94 L138 94 C144 85 148 74 148 62 C148 35 125 12 90 12 Z" fill="#2E2A47"/></svg>` },
    { label: 'カチューシャ髪', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180"><path d="M100 25 C60 25 35 58 35 96 C35 106 38 116 42 123 L60 126 L60 96 Q65 62 100 57 Q135 62 140 96 L140 126 L158 123 C162 116 165 106 165 96 C165 58 140 25 100 25 Z" fill="#8B6B4A"/><path d="M25 55 Q100 5 175 55" stroke="#FF6B9D" stroke-width="10" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'つのツイン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><path d="M120 25 C82 25 58 55 58 90 C58 100 61 108 65 115 L74 115 L74 88 Q78 58 120 54 Q162 58 166 88 L166 115 L175 115 C179 108 182 100 182 90 C182 55 158 25 120 25 Z" fill="#F296B5"/><circle cx="55" cy="50" r="24" fill="#F296B5"/><circle cx="185" cy="50" r="24" fill="#F296B5"/></svg>` },
    { label: 'ながい前髪', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160"><path d="M100 15 C58 15 32 50 32 90 C32 102 35 114 40 124 L58 122 L58 55 Q65 45 100 45 Q135 45 142 55 L142 122 L160 124 C165 114 168 102 168 90 C168 50 142 15 100 15 Z" fill="#3E2A18"/></svg>` }
  ],
  accessory: [
    { label: 'リボン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M60 40 L20 20 L20 60 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><path d="M60 40 L100 20 L100 60 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><circle cx="60" cy="40" r="10" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'かんむり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80"><path d="M20 60 L20 30 L40 45 L70 15 L100 45 L120 30 L120 60 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="45" r="5" fill="#FF6B9D"/><circle cx="70" cy="30" r="5" fill="#7C6FF2"/><circle cx="100" cy="45" r="5" fill="#4CD4B0"/></svg>` },
    { label: 'ほし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 8 L48 30 L72 30 L52 44 L60 68 L40 54 L20 68 L28 44 L8 30 L32 30 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'ハート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 68 C10 48 10 20 24 20 C32 20 40 28 40 36 C40 28 48 20 56 20 C70 20 70 48 40 68 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'めがね', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="60" viewBox="0 0 140 60"><circle cx="40" cy="30" r="22" fill="rgba(255,255,255,0.4)" stroke="#2E2A47" stroke-width="3"/><circle cx="100" cy="30" r="22" fill="rgba(255,255,255,0.4)" stroke="#2E2A47" stroke-width="3"/><path d="M62 30 L78 30" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'ねこみみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80"><path d="M20 70 L15 20 L55 55 Z" fill="#6B4E2E" stroke="#2E2A47" stroke-width="2"/><path d="M22 60 L20 32 L44 52 Z" fill="#FFA5C2"/><path d="M120 70 L125 20 L85 55 Z" fill="#6B4E2E" stroke="#2E2A47" stroke-width="2"/><path d="M118 60 L120 32 L96 52 Z" fill="#FFA5C2"/></svg>` },
    { label: 'ぼうし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80"><ellipse cx="70" cy="65" rx="60" ry="10" fill="#7C6FF2" stroke="#2E2A47" stroke-width="2"/><path d="M35 65 Q35 20 70 15 Q105 20 105 65 Z" fill="#9D91FF" stroke="#2E2A47" stroke-width="2"/><rect x="35" y="55" width="70" height="8" fill="#5D51CC"/><circle cx="70" cy="55" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'ヘアバンド', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="70" viewBox="0 0 180 70"><path d="M15 50 Q90 -5 165 50 L165 62 Q90 20 15 62 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><circle cx="90" cy="18" r="10" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'マスク', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="70" viewBox="0 0 120 70"><path d="M20 20 Q60 10 100 20 L100 50 Q60 60 20 50 Z" fill="#fff" stroke="#2E2A47" stroke-width="2"/><path d="M20 20 L10 30 M100 20 L110 30 M20 50 L10 40 M100 50 L110 40" stroke="#2E2A47" stroke-width="2" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'めがね2', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="60" viewBox="0 0 140 60"><rect x="18" y="15" width="44" height="30" rx="4" fill="#FFF5C4" stroke="#2E2A47" stroke-width="2.5"/><rect x="78" y="15" width="44" height="30" rx="4" fill="#FFF5C4" stroke="#2E2A47" stroke-width="2.5"/><path d="M62 30 L78 30" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'うさみみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100" viewBox="0 0 140 100"><path d="M30 90 Q10 40 25 10 Q45 5 48 40 Q50 70 40 90 Z" fill="#fff" stroke="#2E2A47" stroke-width="2"/><path d="M33 78 Q22 42 30 18 Q40 16 40 42 Q40 62 36 78 Z" fill="#FFB8D0"/><path d="M110 90 Q130 40 115 10 Q95 5 92 40 Q90 70 100 90 Z" fill="#fff" stroke="#2E2A47" stroke-width="2"/><path d="M107 78 Q118 42 110 18 Q100 16 100 42 Q100 62 104 78 Z" fill="#FFB8D0"/></svg>` },
    { label: 'いぬみみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="80" viewBox="0 0 150 80"><path d="M25 70 Q5 30 20 8 Q45 12 50 45 Q52 60 40 70 Z" fill="#C48A4A" stroke="#2E2A47" stroke-width="2"/><path d="M125 70 Q145 30 130 8 Q105 12 100 45 Q98 60 110 70 Z" fill="#C48A4A" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'くまみみ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="70" viewBox="0 0 150 70"><circle cx="28" cy="30" r="24" fill="#6B4E2E" stroke="#2E2A47" stroke-width="2"/><circle cx="28" cy="30" r="12" fill="#C88B5A"/><circle cx="122" cy="30" r="24" fill="#6B4E2E" stroke="#2E2A47" stroke-width="2"/><circle cx="122" cy="30" r="12" fill="#C88B5A"/></svg>` },
    { label: 'ちょうネクタイ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><path d="M50 30 L15 10 L15 50 Z" fill="#7C6FF2" stroke="#2E2A47" stroke-width="2"/><path d="M50 30 L85 10 L85 50 Z" fill="#7C6FF2" stroke="#2E2A47" stroke-width="2"/><circle cx="50" cy="30" r="8" fill="#5D51CC" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'イヤリング', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><circle cx="15" cy="20" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/><circle cx="85" cy="20" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'サングラス', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="60" viewBox="0 0 140 60"><circle cx="40" cy="30" r="22" fill="#2E2A47" stroke="#2E2A47" stroke-width="3"/><circle cx="100" cy="30" r="22" fill="#2E2A47" stroke="#2E2A47" stroke-width="3"/><path d="M62 30 L78 30" stroke="#2E2A47" stroke-width="3"/><path d="M28 22 Q40 18 48 24" stroke="#7C97C7" stroke-width="3" fill="none" opacity="0.7"/></svg>` },
    { label: 'ティアラ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="70" viewBox="0 0 150 70"><path d="M20 60 L24 30 L45 45 L75 10 L105 45 L126 30 L130 60 Z" fill="#E8E8F0" stroke="#2E2A47" stroke-width="2.5"/><circle cx="75" cy="18" r="7" fill="#5AB8FF" stroke="#2E2A47" stroke-width="1.5"/><circle cx="45" cy="42" r="4" fill="#FF6B9D"/><circle cx="105" cy="42" r="4" fill="#FF6B9D"/></svg>` },
    { label: 'ドクロヘアピン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="26" r="16" fill="#fff" stroke="#2E2A47" stroke-width="2"/><circle cx="24" cy="24" r="3" fill="#2E2A47"/><circle cx="36" cy="24" r="3" fill="#2E2A47"/><path d="M24 34 L28 38 L32 34 L36 38" stroke="#2E2A47" stroke-width="2" fill="none"/></svg>` },
    { label: 'ヘッドホン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="90" viewBox="0 0 150 90"><path d="M15 60 Q15 5 75 5 Q135 5 135 60" stroke="#2E2A47" stroke-width="6" fill="none"/><rect x="5" y="50" width="24" height="36" rx="8" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><rect x="121" y="50" width="24" height="36" rx="8" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'ちょうちょ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><path d="M50 40 C50 20 30 10 20 20 C10 30 20 45 50 40 Z" fill="#B77FE0" stroke="#2E2A47" stroke-width="1.5"/><path d="M50 40 C50 20 70 10 80 20 C90 30 80 45 50 40 Z" fill="#B77FE0" stroke="#2E2A47" stroke-width="1.5"/><path d="M50 40 C50 60 30 68 22 60 C16 52 26 42 50 40 Z" fill="#9D91FF" stroke="#2E2A47" stroke-width="1.5"/><path d="M50 40 C50 60 70 68 78 60 C84 52 74 42 50 40 Z" fill="#9D91FF" stroke="#2E2A47" stroke-width="1.5"/><ellipse cx="50" cy="40" rx="4" ry="10" fill="#2E2A47"/></svg>` },
    { label: 'まきばな', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="70" viewBox="0 0 140 70"><path d="M20 55 Q30 15 70 10 Q110 15 120 55" stroke="#FF6B9D" stroke-width="12" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'フラワークラウン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="70" viewBox="0 0 160 70"><path d="M15 55 Q80 5 145 55" stroke="#4CD4B0" stroke-width="5" fill="none"/><g stroke="#2E2A47" stroke-width="1"><circle cx="40" cy="35" r="8" fill="#FF6B9D"/><circle cx="80" cy="18" r="9" fill="#FFC93C"/><circle cx="120" cy="35" r="8" fill="#B77FE0"/></g></svg>` },
    { label: 'ドット包帯', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><path d="M20 20 Q60 8 100 20 L100 40 Q60 52 20 40 Z" fill="#FFF5F0" stroke="#2E2A47" stroke-width="2"/><line x1="40" y1="16" x2="35" y2="46" stroke="#FF9EBB" stroke-width="2"/><line x1="80" y1="16" x2="85" y2="46" stroke="#FF9EBB" stroke-width="2"/></svg>` },
    { label: 'キツネお面', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="90" viewBox="0 0 140 90"><path d="M70 10 L100 5 L92 35 Z" fill="#FFA34D" stroke="#2E2A47" stroke-width="2"/><path d="M70 10 L40 5 L48 35 Z" fill="#FFA34D" stroke="#2E2A47" stroke-width="2"/><ellipse cx="70" cy="50" rx="45" ry="35" fill="#FFA34D" stroke="#2E2A47" stroke-width="2"/><path d="M70 50 L55 65 L85 65 Z" fill="#fff"/></svg>` },
    { label: 'マフラー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M15 20 Q60 40 105 20 L105 35 Q60 55 15 35 Z" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/><rect x="45" y="35" width="14" height="40" fill="#E14E7F" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'ちいさいリボン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="50" viewBox="0 0 70 50"><path d="M35 25 L12 12 L12 38 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/><path d="M35 25 L58 12 L58 38 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/><circle cx="35" cy="25" r="6" fill="#FFA34D" stroke="#2E2A47" stroke-width="1.5"/></svg>` }
  ]
};

/**
 * 化粧パーツのSVGライブラリ（お化粧画面 & お絵かきのメイクタブ用）
 * fill/stroke に "currentColor" を使うことで、tintSvg() で動的に色変更可能。
 *
 * hasColor: 色変更可能かどうか
 * defaultColor: デフォルト色
 * defaultOpacity: デフォルト不透明度（0-1）
 * isPair: 左右対で配置すべきかどうか
 * pairOffsetX: 対配置時に中心からの左右オフセット（キャンバス座標系ピクセル）
 */
export const MAKEUP_LIBRARY = {
  lip: [
    { label: 'ふつう', hasColor: true, defaultColor: '#E14E7F', defaultOpacity: 0.85, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><path d="M60 12 Q45 4 30 12 Q18 18 12 26 Q30 40 60 42 Q90 40 108 26 Q102 18 90 12 Q75 4 60 12 Z M12 26 Q30 20 60 22 Q90 20 108 26 Q90 46 60 48 Q30 46 12 26 Z" fill="currentColor" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'ぷっくり', hasColor: true, defaultColor: '#E14E7F', defaultOpacity: 0.85, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="70" viewBox="0 0 120 70"><path d="M60 10 Q42 0 26 10 Q10 20 8 30 Q30 44 60 46 Q90 44 112 30 Q110 20 94 10 Q78 0 60 10 Z M8 30 Q30 22 60 24 Q90 22 112 30 Q90 56 60 60 Q30 56 8 30 Z" fill="currentColor" stroke="#2E2A47" stroke-width="1.5"/><path d="M56 22 Q60 18 64 22" stroke="#fff" stroke-width="2" fill="none" opacity="0.6"/></svg>` },
    { label: 'おちょぼ', hasColor: true, defaultColor: '#E14E7F', defaultOpacity: 0.85, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="50" viewBox="0 0 80 50"><path d="M40 10 Q30 6 22 10 Q16 14 12 20 Q26 30 40 32 Q54 30 68 20 Q64 14 58 10 Q50 6 40 10 Z M12 20 Q26 16 40 18 Q54 16 68 20 Q54 38 40 40 Q26 38 12 20 Z" fill="currentColor" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'スマイル', hasColor: true, defaultColor: '#E14E7F', defaultOpacity: 0.85, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><path d="M10 22 Q60 44 110 22 Q60 26 10 22 Z" fill="currentColor" stroke="#2E2A47" stroke-width="1.5"/><path d="M10 22 Q60 4 110 22" stroke="#2E2A47" stroke-width="1.5" fill="none"/></svg>` }
  ],
  blush: [
    { label: 'まる', hasColor: true, defaultColor: '#FF9EBB', defaultOpacity: 0.55, isPair: true, pairOffsetX: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><radialGradient id="g1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="45" fill="url(#g1)"/></svg>` },
    { label: 'ぼかし', hasColor: true, defaultColor: '#FF9EBB', defaultOpacity: 0.45, isPair: true, pairOffsetX: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><defs><radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.85"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="40" rx="55" ry="30" fill="url(#g2)"/></svg>` },
    { label: 'ななめ', hasColor: true, defaultColor: '#FF7FAA', defaultOpacity: 0.55, isPair: true, pairOffsetX: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><defs><radialGradient id="g3"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="30" rx="55" ry="18" fill="url(#g3)" transform="rotate(-15 60 30)"/></svg>` },
    { label: 'キラ', hasColor: true, defaultColor: '#FFB8D0', defaultOpacity: 0.6, isPair: true, pairOffsetX: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><radialGradient id="g4"><stop offset="0%" stop-color="currentColor" stop-opacity="0.85"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="45" fill="url(#g4)"/><g fill="#FFFFFF" opacity="0.9"><circle cx="35" cy="40" r="2"/><circle cx="60" cy="55" r="2.5"/><circle cx="50" cy="30" r="1.5"/><circle cx="70" cy="38" r="1.8"/></g></svg>` }
  ],
  eyeshadow: [
    { label: 'ふつう', hasColor: true, defaultColor: '#B77FE0', defaultOpacity: 0.5, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="40" viewBox="0 0 90 40"><defs><radialGradient id="es1" cy="80%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><ellipse cx="45" cy="25" rx="42" ry="18" fill="url(#es1)"/></svg>` },
    { label: 'しっかり', hasColor: true, defaultColor: '#7A4AC7', defaultOpacity: 0.7, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="40" viewBox="0 0 90 40"><defs><linearGradient id="es2" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.1"/></linearGradient></defs><path d="M8 30 Q45 5 82 30 Q45 22 8 30 Z" fill="url(#es2)"/></svg>` },
    { label: 'キラ', hasColor: true, defaultColor: '#FFC93C', defaultOpacity: 0.65, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="40" viewBox="0 0 90 40"><defs><radialGradient id="es3" cy="80%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><ellipse cx="45" cy="25" rx="42" ry="18" fill="url(#es3)"/><g fill="#FFFFFF"><path d="M25 22 L27 26 L31 27 L27 28 L25 32 L23 28 L19 27 L23 26 Z"/><path d="M55 18 L57 22 L61 23 L57 24 L55 28 L53 24 L49 23 L53 22 Z"/><path d="M70 26 L71 28 L73 29 L71 30 L70 32 L69 30 L67 29 L69 28 Z"/></g></svg>` }
  ],
  eyeliner: [
    { label: 'ふつう', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20"><path d="M6 12 Q40 4 74 12 Q40 8 6 12 Z" fill="currentColor"/></svg>` },
    { label: 'ねこ', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="25" viewBox="0 0 90 25"><path d="M6 15 Q40 6 68 12 L85 4 L80 14 Q60 16 6 15 Z" fill="currentColor"/></svg>` },
    { label: 'たれ', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="25" viewBox="0 0 90 25"><path d="M6 8 Q40 20 78 18 Q40 14 6 8 Z" fill="currentColor"/></svg>` }
  ],
  lashes: [
    { label: 'ナチュラル', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.9, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="25" viewBox="0 0 80 25"><path d="M8 20 Q40 12 72 20" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14 20 L12 8 M22 18 L20 6 M30 16 L28 4 M40 15 L40 3 M50 16 L52 4 M58 18 L60 6 M66 20 L68 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` },
    { label: 'ふさふさ', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="30" viewBox="0 0 90 30"><path d="M8 24 Q45 14 82 24" stroke="currentColor" stroke-width="3" fill="none"/><path d="M12 24 L10 6 M18 22 L15 4 M24 20 L22 2 M32 18 L31 0 M40 17 L40 0 M48 17 L48 0 M56 18 L58 0 M64 20 L67 2 M70 22 L74 4 M76 24 L80 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>` },
    { label: 'カール', hasColor: true, defaultColor: '#2E2A47', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="30" viewBox="0 0 90 30"><path d="M8 24 Q45 14 82 24" stroke="currentColor" stroke-width="3" fill="none"/><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"><path d="M14 24 Q10 12 6 6"/><path d="M22 22 Q18 10 16 4"/><path d="M32 20 Q30 8 28 2"/><path d="M45 18 Q45 6 44 0"/><path d="M58 20 Q60 8 62 2"/><path d="M68 22 Q72 10 74 4"/><path d="M76 24 Q80 12 84 6"/></g></svg>` }
  ],
  brow_makeup: [
    { label: 'アーチ', hasColor: true, defaultColor: '#6B4E2E', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20"><path d="M6 16 Q40 2 74 16" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ふとめ', hasColor: true, defaultColor: '#6B4E2E', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20"><path d="M6 14 Q40 4 74 14 Q40 12 6 14 Z" fill="currentColor"/></svg>` },
    { label: 'ほそめ', hasColor: true, defaultColor: '#6B4E2E', defaultOpacity: 0.95, isPair: true, pairOffsetX: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="15" viewBox="0 0 80 15"><path d="M6 10 Q40 2 74 10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>` }
  ],
  highlight: [
    { label: 'ほおぼね', hasColor: true, defaultColor: '#FFFAF0', defaultOpacity: 0.7, isPair: true, pairOffsetX: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><defs><radialGradient id="hl1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><ellipse cx="40" cy="20" rx="38" ry="14" fill="url(#hl1)"/></svg>` },
    { label: 'はな', hasColor: true, defaultColor: '#FFFAF0', defaultOpacity: 0.75, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="80" viewBox="0 0 30 80"><defs><linearGradient id="hl2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="currentColor" stop-opacity="0"/><stop offset="50%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><rect x="10" y="0" width="10" height="80" fill="url(#hl2)" rx="5"/></svg>` },
    { label: 'キラ', hasColor: true, defaultColor: '#FFFDE4', defaultOpacity: 0.85, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g fill="currentColor"><path d="M30 8 L33 26 L50 30 L33 34 L30 52 L27 34 L10 30 L27 26 Z"/><circle cx="15" cy="15" r="3"/><circle cx="48" cy="18" r="2.5"/><circle cx="45" cy="45" r="2"/><circle cx="12" cy="42" r="2.5"/></g></svg>` }
  ],
  paint: [
    { label: 'ほし', hasColor: true, defaultColor: '#FFC93C', defaultOpacity: 1, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 6 L36 22 L54 22 L39 33 L45 51 L30 40 L15 51 L21 33 L6 22 L24 22 Z" fill="currentColor" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'ハート', hasColor: true, defaultColor: '#FF6B9D', defaultOpacity: 1, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 52 C6 36 6 12 18 12 C24 12 30 18 30 24 C30 18 36 12 42 12 C54 12 54 36 30 52 Z" fill="currentColor" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'はな', hasColor: true, defaultColor: '#FF9EBB', defaultOpacity: 1, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g fill="currentColor" stroke="#2E2A47" stroke-width="1.5"><ellipse cx="30" cy="14" rx="8" ry="12"/><ellipse cx="30" cy="46" rx="8" ry="12"/><ellipse cx="14" cy="30" rx="12" ry="8"/><ellipse cx="46" cy="30" rx="12" ry="8"/></g><circle cx="30" cy="30" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'キラ', hasColor: true, defaultColor: '#FFC93C', defaultOpacity: 1, isPair: false,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 6 L32 26 L52 30 L32 34 L30 54 L28 34 L8 30 L28 26 Z" fill="currentColor" stroke="#2E2A47" stroke-width="1.5"/></svg>` }
  ]
};

/** カテゴリごとの表示名（メイクUI用） */
export const MAKEUP_CATEGORIES = [
  { key: 'lip',         icon: '💋', label: 'リップ' },
  { key: 'blush',       icon: '🌸', label: 'チーク' },
  { key: 'eyeshadow',   icon: '🎨', label: 'アイシャドウ' },
  { key: 'eyeliner',    icon: '✒️', label: 'アイライン' },
  { key: 'lashes',      icon: '👁️', label: 'まつげ' },
  { key: 'brow_makeup', icon: '✏️', label: 'まゆげ' },
  { key: 'highlight',   icon: '✨', label: 'ハイライト' },
  { key: 'paint',       icon: '🖌️', label: 'ペイント' }
];

/** カテゴリ別のおすすめカラーパレット */
export const MAKEUP_COLORS = {
  lip: ['#E14E7F', '#FF6B9D', '#C73E5F', '#FFA0BA', '#8B3A5C', '#FF5A6E', '#D4426B', '#B85D75'],
  blush: ['#FF9EBB', '#FFB8D0', '#FF7FAA', '#FFC5D8', '#F296B5', '#EA82A3', '#FFA5C2', '#FFCFDE'],
  eyeshadow: ['#B77FE0', '#7A4AC7', '#FFC93C', '#F296B5', '#5AB8FF', '#4CD4B0', '#8B5A3C', '#E14E7F'],
  eyeliner: ['#2E2A47', '#3E2A18', '#6B4E2E', '#5D51CC', '#7A4AC7'],
  lashes: ['#2E2A47', '#3E2A18', '#6B4E2E'],
  brow_makeup: ['#6B4E2E', '#3E2A18', '#8B5A3C', '#A26B3A', '#2E2A47'],
  highlight: ['#FFFAF0', '#FFFDE4', '#FFF0E8', '#F5EEDF', '#FFE4A0'],
  paint: ['#FFC93C', '#FF6B9D', '#FF9EBB', '#7C6FF2', '#4CD4B0', '#5AB8FF', '#FFA34D', '#B77FE0']
};

// ============================================================
// 家具ライブラリ（お部屋画面 room.html 用）
// ============================================================
// 2.5Dアイソメトリック風の家具SVG群。
// 各アイテムは正面〜3/4視点で描画し、床タイル上に置かれる。
//
//   footprintW / footprintD: 占有タイル数（幅・奥行）
//   imgWidth / imgHeight:    SVGの表示サイズ（px）
//   anchorX / anchorY:       SVG内で「床タイル中心に着地する点」の座標（画像内座標）
//   wall:                    true なら壁面に貼るタイプ（壁飾り・窓）
//
// TILE_W=64, TILE_H=32 のアイソメ座標系を想定。
// 1タイルの床は、菱形として画面座標で幅64px高32pxに描画される。

export const FURNITURE_LIBRARY = {
  bed: [
    { label: 'ふつう', footprintW: 2, footprintD: 2, imgWidth: 140, imgHeight: 110, anchorX: 70, anchorY: 100,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="110" viewBox="0 0 140 110">
        <defs>
          <linearGradient id="bed1frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A17F52"/><stop offset="55%" stop-color="#8B6B4A"/><stop offset="100%" stop-color="#6E5236"/></linearGradient>
          <linearGradient id="bed1sheet" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFDF8"/><stop offset="50%" stop-color="#F5E6D3"/><stop offset="100%" stop-color="#E8D4BC"/></linearGradient>
          <linearGradient id="bed1pillow" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFDCE9"/><stop offset="100%" stop-color="#F5A8C4"/></linearGradient>
          <linearGradient id="bed1blanket" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C9A6EC"/><stop offset="100%" stop-color="#9D6FD1"/></linearGradient>
          <radialGradient id="bed1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.28)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="70" cy="102" rx="60" ry="6" fill="url(#bed1shadow)"/>
        <path d="M 15 78 L 70 62 L 125 78 L 125 92 L 70 108 L 15 92 Z" fill="url(#bed1frame)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 20 80 L 70 65" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" fill="none"/>
        <path d="M 120 80 L 70 65" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" fill="none"/>
        <path d="M 15 68 L 70 52 L 125 68 L 125 78 L 70 62 L 15 78 Z" fill="url(#bed1sheet)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 25 70 L 70 56" stroke="rgba(255,255,255,0.6)" stroke-width="1" fill="none"/>
        <ellipse cx="35" cy="63" rx="16" ry="6" fill="url(#bed1pillow)" stroke="#2E2A47" stroke-width="1.2"/>
        <ellipse cx="30" cy="61" rx="6" ry="2" fill="rgba(255,255,255,0.55)"/>
        <path d="M 55 59 L 90 50 L 125 62 L 125 74 L 90 66 L 55 65 Z" fill="url(#bed1blanket)" stroke="#2E2A47" stroke-width="1.2"/>
        <path d="M 63 58 L 63 63 M 78 55 L 78 60 M 93 53 L 93 58 M 108 57 L 108 62" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
      </svg>` },
    { label: 'ダブル', footprintW: 3, footprintD: 2, imgWidth: 180, imgHeight: 115, anchorX: 90, anchorY: 105,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="115" viewBox="0 0 180 115">
        <defs>
          <linearGradient id="bed2frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#8A6C42"/><stop offset="55%" stop-color="#6B4E2E"/><stop offset="100%" stop-color="#523A20"/></linearGradient>
          <linearGradient id="bed2sheet" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="60%" stop-color="#FFFAF0"/><stop offset="100%" stop-color="#EFE4D0"/></linearGradient>
          <linearGradient id="bed2pillowL" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8FD4FF"/><stop offset="100%" stop-color="#4A9FE0"/></linearGradient>
          <linearGradient id="bed2pillowR" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFDCE9"/><stop offset="100%" stop-color="#F5A8C4"/></linearGradient>
          <linearGradient id="bed2blanket" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9C90F5"/><stop offset="100%" stop-color="#6A5AD9"/></linearGradient>
          <radialGradient id="bed2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.28)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="90" cy="106" rx="78" ry="6" fill="url(#bed2shadow)"/>
        <path d="M 12 78 L 90 60 L 168 78 L 168 92 L 90 110 L 12 92 Z" fill="url(#bed2frame)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 18 80 L 90 63" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/>
        <path d="M 12 66 L 90 48 L 168 66 L 168 78 L 90 60 L 12 78 Z" fill="url(#bed2sheet)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 68 L 90 52" stroke="rgba(255,255,255,0.6)" stroke-width="1" fill="none"/>
        <ellipse cx="34" cy="60" rx="14" ry="5" fill="url(#bed2pillowL)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="30" cy="58" rx="5" ry="1.8" fill="rgba(255,255,255,0.55)"/>
        <ellipse cx="60" cy="58" rx="14" ry="5" fill="url(#bed2pillowR)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="56" cy="56" rx="5" ry="1.8" fill="rgba(255,255,255,0.55)"/>
        <path d="M 78 57 L 130 48 L 168 62 L 168 74 L 130 62 L 78 62 Z" fill="url(#bed2blanket)" stroke="#2E2A47" stroke-width="1.2"/>
        <path d="M 90 55 L 90 60 M 105 52 L 105 57 M 120 51 L 120 56 M 135 54 L 135 59" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      </svg>` },
    { label: '2だん', footprintW: 2, footprintD: 2, imgWidth: 140, imgHeight: 170, anchorX: 70, anchorY: 160,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="170" viewBox="0 0 140 170">
        <defs>
          <linearGradient id="bed3frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A17F52"/><stop offset="55%" stop-color="#8B6B4A"/><stop offset="100%" stop-color="#6E5236"/></linearGradient>
          <linearGradient id="bed3pole" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7A50"/><stop offset="100%" stop-color="#6E5236"/></linearGradient>
          <linearGradient id="bed3pillowU" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFDCE9"/><stop offset="100%" stop-color="#F5A8C4"/></linearGradient>
          <linearGradient id="bed3pillowD" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8FD4FF"/><stop offset="100%" stop-color="#4A9FE0"/></linearGradient>
          <linearGradient id="bed3blanket" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C9A6EC"/><stop offset="100%" stop-color="#9D6FD1"/></linearGradient>
          <linearGradient id="bed3blanket2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF0A8"/><stop offset="100%" stop-color="#F0C94E"/></linearGradient>
          <radialGradient id="bed3shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.28)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="70" cy="162" rx="60" ry="6" fill="url(#bed3shadow)"/>
        <path d="M 15 138 L 70 122 L 125 138 L 125 152 L 70 168 L 15 152 Z" fill="url(#bed3frame)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 15 128 L 70 112 L 125 128 L 125 138 L 70 122 L 15 138 Z" fill="url(#bed3pillowD)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 129 L 70 115" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none"/>
        <ellipse cx="35" cy="122" rx="12" ry="5" fill="url(#bed3pillowU)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="31" cy="120" rx="4.5" ry="1.6" fill="rgba(255,255,255,0.55)"/>
        <rect x="16" y="80" width="4" height="45" fill="url(#bed3pole)"/>
        <rect x="120" y="80" width="4" height="45" fill="url(#bed3pole)"/>
        <path d="M 15 68 L 70 52 L 125 68 L 125 82 L 70 98 L 15 82 Z" fill="url(#bed3frame)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 15 58 L 70 42 L 125 58 L 125 68 L 70 52 L 15 68 Z" fill="url(#bed3blanket)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 59 L 70 45" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none"/>
        <ellipse cx="35" cy="52" rx="12" ry="5" fill="url(#bed3blanket2)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="31" cy="50" rx="4.5" ry="1.6" fill="rgba(255,255,255,0.5)"/>
      </svg>` },
    { label: 'ベビー', footprintW: 2, footprintD: 1, imgWidth: 120, imgHeight: 100, anchorX: 60, anchorY: 90,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100">
        <defs>
          <linearGradient id="bed4mat" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE0EC"/><stop offset="100%" stop-color="#F5A8C4"/></linearGradient>
          <linearGradient id="bed4bar" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#F0E8DC"/></linearGradient>
          <linearGradient id="bed4rail" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFB6CE"/><stop offset="100%" stop-color="#EF87A9"/></linearGradient>
          <radialGradient id="bed4shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="60" cy="92" rx="52" ry="5" fill="url(#bed4shadow)"/>
        <rect x="15" y="60" width="90" height="28" rx="8" fill="url(#bed4mat)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="18" y="63" width="84" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>
        <g stroke="url(#bed4bar)" stroke-width="1.8"><line x1="25" y1="30" x2="25" y2="60"/><line x1="35" y1="30" x2="35" y2="60"/><line x1="45" y1="30" x2="45" y2="60"/><line x1="55" y1="30" x2="55" y2="60"/><line x1="65" y1="30" x2="65" y2="60"/><line x1="75" y1="30" x2="75" y2="60"/><line x1="85" y1="30" x2="85" y2="60"/><line x1="95" y1="30" x2="95" y2="60"/></g>
        <rect x="12" y="28" width="96" height="6" rx="3" fill="url(#bed4rail)" stroke="#2E2A47" stroke-width="1.2"/>
        <rect x="12" y="58" width="96" height="6" rx="3" fill="url(#bed4rail)" stroke="#2E2A47" stroke-width="1.2"/>
      </svg>` }
  ],
  desk: [
    { label: 'つくえ', footprintW: 2, footprintD: 1, imgWidth: 130, imgHeight: 90, anchorX: 65, anchorY: 82,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="90" viewBox="0 0 130 90">
        <defs>
          <linearGradient id="desk1top" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D3A876"/><stop offset="50%" stop-color="#B78C5A"/><stop offset="100%" stop-color="#9A7248"/></linearGradient>
          <linearGradient id="desk1sideL" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <linearGradient id="desk1sideR" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <linearGradient id="desk1leg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <radialGradient id="desk1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="65" cy="82" rx="55" ry="5" fill="url(#desk1shadow)"/>
        <path d="M 15 42 L 65 30 L 115 42 L 65 54 Z" fill="url(#desk1top)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 41 L 65 32" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" fill="none"/>
        <path d="M 15 42 L 15 50 L 65 62 L 65 54 Z" fill="url(#desk1sideL)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 115 42 L 115 50 L 65 62 L 65 54 Z" fill="url(#desk1sideR)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="18" y="52" width="4" height="28" fill="url(#desk1leg)" stroke="#2E2A47" stroke-width="1"/>
        <rect x="60" y="60" width="4" height="20" fill="url(#desk1leg)" stroke="#2E2A47" stroke-width="1"/>
        <rect x="108" y="52" width="4" height="28" fill="url(#desk1leg)" stroke="#2E2A47" stroke-width="1"/>
      </svg>` },
    { label: 'イス', footprintW: 1, footprintD: 1, imgWidth: 60, imgHeight: 90, anchorX: 30, anchorY: 82,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90" viewBox="0 0 60 90">
        <defs>
          <linearGradient id="desk2seat" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6CE"/><stop offset="100%" stop-color="#E14E7F"/></linearGradient>
          <linearGradient id="desk2back" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FF8FB3"/><stop offset="100%" stop-color="#D63E70"/></linearGradient>
          <linearGradient id="desk2leg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <radialGradient id="desk2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="30" cy="82" rx="22" ry="4" fill="url(#desk2shadow)"/>
        <path d="M 8 50 L 30 44 L 52 50 L 30 56 Z" fill="url(#desk2seat)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 14 49 L 30 45" stroke="rgba(255,255,255,0.4)" stroke-width="1" fill="none"/>
        <rect x="10" y="20" width="6" height="30" fill="url(#desk2back)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="44" y="20" width="6" height="30" fill="url(#desk2back)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 10 20 L 16 20 L 44 20 L 50 20 L 44 26 L 16 26 Z" fill="url(#desk2back)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="10" y="55" width="4" height="25" fill="url(#desk2leg)" stroke="#2E2A47" stroke-width="1"/>
        <rect x="46" y="55" width="4" height="25" fill="url(#desk2leg)" stroke="#2E2A47" stroke-width="1"/>
      </svg>` },
    { label: 'まるテーブル', footprintW: 2, footprintD: 2, imgWidth: 130, imgHeight: 100, anchorX: 65, anchorY: 92,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="100" viewBox="0 0 130 100">
        <defs>
          <radialGradient id="desk3top" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#FFEBD0"/><stop offset="60%" stop-color="#F5D5B0"/><stop offset="100%" stop-color="#D9B78C"/></radialGradient>
          <linearGradient id="desk3side" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#9A7248"/></linearGradient>
          <linearGradient id="desk3leg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <radialGradient id="desk3shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="65" cy="92" rx="55" ry="5" fill="url(#desk3shadow)"/>
        <ellipse cx="65" cy="45" rx="55" ry="14" fill="url(#desk3side)" stroke="#2E2A47" stroke-width="1.5"/>
        <ellipse cx="65" cy="42" rx="55" ry="14" fill="url(#desk3top)" stroke="#2E2A47" stroke-width="1.5"/>
        <ellipse cx="50" cy="37" rx="20" ry="6" fill="rgba(255,255,255,0.35)"/>
        <rect x="62" y="55" width="6" height="35" fill="url(#desk3leg)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="65" cy="88" rx="18" ry="4" fill="url(#desk3leg)" stroke="#2E2A47" stroke-width="1"/>
      </svg>` },
    { label: 'べんきょうづくえ', footprintW: 2, footprintD: 1, imgWidth: 140, imgHeight: 110, anchorX: 70, anchorY: 102,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="110" viewBox="0 0 140 110">
        <defs>
          <radialGradient id="desk4top" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFEBD0"/><stop offset="60%" stop-color="#F5D5B0"/><stop offset="100%" stop-color="#D9B78C"/></radialGradient>
          <linearGradient id="desk4sideL" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#9A7248"/></linearGradient>
          <linearGradient id="desk4sideR" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <linearGradient id="desk4leg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <linearGradient id="desk4drawer" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#96774A"/></linearGradient>
          <radialGradient id="desk4shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="70" cy="102" rx="60" ry="5" fill="url(#desk4shadow)"/>
        <path d="M 10 60 L 70 46 L 130 60 L 70 74 Z" fill="url(#desk4top)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 20 58 L 70 48" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" fill="none"/>
        <path d="M 10 60 L 10 70 L 70 84 L 70 74 Z" fill="url(#desk4sideL)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 130 60 L 130 70 L 70 84 L 70 74 Z" fill="url(#desk4sideR)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="14" y="72" width="4" height="28" fill="url(#desk4leg)"/>
        <rect x="122" y="72" width="4" height="28" fill="url(#desk4leg)"/>
        <rect x="20" y="30" width="80" height="20" fill="url(#desk4drawer)" stroke="#2E2A47" stroke-width="1"/>
        <rect x="25" y="35" width="30" height="12" fill="#96774A" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
        <rect x="60" y="35" width="30" height="12" fill="#7C5E3C" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
        <circle cx="40" cy="41" r="1.6" fill="#5C4527"/>
        <circle cx="75" cy="41" r="1.6" fill="#5C4527"/>
      </svg>` }
  ],
  closet: [
    { label: 'たんす', footprintW: 2, footprintD: 1, imgWidth: 120, imgHeight: 130, anchorX: 60, anchorY: 122,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="130" viewBox="0 0 120 130">
        <defs>
          <linearGradient id="clo1front" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#B08858"/><stop offset="55%" stop-color="#96774A"/><stop offset="100%" stop-color="#755D38"/></linearGradient>
          <linearGradient id="clo1side" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#96774A"/></linearGradient>
          <linearGradient id="clo1drawer" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C9A374"/><stop offset="100%" stop-color="#A0824F"/></linearGradient>
          <radialGradient id="clo1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="60" cy="122" rx="52" ry="5" fill="url(#clo1shadow)"/>
        <path d="M 10 30 L 60 20 L 110 30 L 110 118 L 60 128 L 10 118 Z" fill="url(#clo1front)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 60 20 L 60 128" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 60 20 L 110 30 L 110 118 L 60 128 Z" fill="url(#clo1side)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 16 33 L 60 24" stroke="rgba(255,255,255,0.3)" stroke-width="1" fill="none"/>
        <rect x="18" y="40" width="34" height="20" fill="url(#clo1drawer)" stroke="#2E2A47" stroke-width="0.8" transform="skewY(11)"/>
        <rect x="18" y="72" width="34" height="20" fill="url(#clo1drawer)" stroke="#2E2A47" stroke-width="0.8" transform="skewY(11)"/>
        <circle cx="35" cy="52" r="2" fill="#FFC93C" transform="skewY(11)"/>
        <circle cx="35" cy="84" r="2" fill="#FFC93C" transform="skewY(11)"/>
      </svg>` },
    { label: 'クローゼット', footprintW: 2, footprintD: 1, imgWidth: 130, imgHeight: 150, anchorX: 65, anchorY: 142,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="150" viewBox="0 0 130 150">
        <defs>
          <linearGradient id="clo2front" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="55%" stop-color="#7C6FF2"/><stop offset="100%" stop-color="#5D51CC"/></linearGradient>
          <linearGradient id="clo2side" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#B3A8FF"/><stop offset="100%" stop-color="#8579E8"/></linearGradient>
          <radialGradient id="clo2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="65" cy="142" rx="55" ry="5" fill="url(#clo2shadow)"/>
        <path d="M 10 20 L 65 8 L 120 20 L 120 135 L 65 148 L 10 135 Z" fill="url(#clo2front)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 65 8 L 65 148" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 65 8 L 120 20 L 120 135 L 65 148 Z" fill="url(#clo2side)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 16 22 L 65 11" stroke="rgba(255,255,255,0.35)" stroke-width="1.2" fill="none"/>
        <circle cx="55" cy="80" r="2.5" fill="#FFC93C"/>
        <circle cx="76" cy="82" r="2.5" fill="#FFC93C"/>
      </svg>` },
    { label: 'しゅうのうばこ', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 70, anchorX: 40, anchorY: 62,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="70" viewBox="0 0 80 70">
        <defs>
          <linearGradient id="clo3body" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#6FE0C0"/><stop offset="100%" stop-color="#4CD4B0"/></linearGradient>
          <linearGradient id="clo3lid" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7FEBD0"/><stop offset="100%" stop-color="#5FE0C0"/></linearGradient>
          <radialGradient id="clo3shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="40" cy="62" rx="32" ry="4" fill="url(#clo3shadow)"/>
        <path d="M 10 30 L 40 20 L 70 30 L 70 55 L 40 65 L 10 55 Z" fill="url(#clo3body)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 10 30 L 40 20 L 70 30 L 40 40 Z" fill="url(#clo3lid)" stroke="#2E2A47" stroke-width="1.2"/>
        <path d="M 16 30 L 40 22" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none"/>
        <circle cx="40" cy="42" r="4" fill="#2E2A47"/>
      </svg>` }
  ],
  sofa: [
    { label: 'ソファ', footprintW: 3, footprintD: 1, imgWidth: 180, imgHeight: 90, anchorX: 90, anchorY: 82,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90" viewBox="0 0 180 90">
        <defs>
          <linearGradient id="sofa1seat" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFB6CE"/><stop offset="100%" stop-color="#F296B5"/></linearGradient>
          <linearGradient id="sofa1back" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFC5D8"/><stop offset="100%" stop-color="#FFA5C2"/></linearGradient>
          <linearGradient id="sofa1arm" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#F5628C"/><stop offset="100%" stop-color="#D63E70"/></linearGradient>
          <linearGradient id="sofa1cushL" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4A6F5"/><stop offset="100%" stop-color="#B77FE0"/></linearGradient>
          <linearGradient id="sofa1cushR" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="100%" stop-color="#7C6FF2"/></linearGradient>
          <radialGradient id="sofa1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="90" cy="82" rx="80" ry="5" fill="url(#sofa1shadow)"/>
        <path d="M 15 55 L 90 42 L 165 55 L 165 76 L 90 90 L 15 76 Z" fill="url(#sofa1seat)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 56 L 90 44" stroke="rgba(255,255,255,0.4)" stroke-width="1" fill="none"/>
        <path d="M 15 55 L 15 30 L 90 20 L 165 30 L 165 55 L 90 42 Z" fill="url(#sofa1back)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 15 30 L 15 55 L 30 60 L 30 34 Z" fill="url(#sofa1arm)" stroke="#2E2A47" stroke-width="1.2"/>
        <path d="M 165 30 L 165 55 L 150 60 L 150 34 Z" fill="url(#sofa1arm)" stroke="#2E2A47" stroke-width="1.2"/>
        <ellipse cx="55" cy="58" rx="10" ry="5" fill="url(#sofa1cushL)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="52" cy="56" rx="3.5" ry="1.5" fill="rgba(255,255,255,0.5)"/>
        <ellipse cx="125" cy="58" rx="10" ry="5" fill="url(#sofa1cushR)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="122" cy="56" rx="3.5" ry="1.5" fill="rgba(255,255,255,0.4)"/>
      </svg>` },
    { label: '1人がけ', footprintW: 1, footprintD: 1, imgWidth: 90, imgHeight: 100, anchorX: 45, anchorY: 92,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="100" viewBox="0 0 90 100">
        <defs>
          <linearGradient id="sofa2seat" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="100%" stop-color="#7C6FF2"/></linearGradient>
          <linearGradient id="sofa2back" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#B3A8FF"/><stop offset="100%" stop-color="#9D91FF"/></linearGradient>
          <linearGradient id="sofa2arm" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#6D60E0"/><stop offset="100%" stop-color="#5D51CC"/></linearGradient>
          <radialGradient id="sofa2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="45" cy="92" rx="38" ry="5" fill="url(#sofa2shadow)"/>
        <path d="M 12 62 L 45 52 L 78 62 L 78 82 L 45 96 L 12 82 Z" fill="url(#sofa2seat)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 18 63 L 45 54" stroke="rgba(255,255,255,0.35)" stroke-width="1" fill="none"/>
        <path d="M 12 62 L 12 35 L 45 25 L 78 35 L 78 62 L 45 52 Z" fill="url(#sofa2back)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 12 35 L 12 62 L 25 66 L 25 40 Z" fill="url(#sofa2arm)" stroke="#2E2A47" stroke-width="1.2"/>
        <path d="M 78 35 L 78 62 L 65 66 L 65 40 Z" fill="url(#sofa2arm)" stroke="#2E2A47" stroke-width="1.2"/>
      </svg>` },
    { label: 'ざぶとん', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 45, anchorX: 40, anchorY: 40, flat: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="45" viewBox="0 0 80 45">
        <defs>
          <radialGradient id="sofa3top" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFE770"/><stop offset="100%" stop-color="#FFC93C"/></radialGradient>
          <radialGradient id="sofa3shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.15)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="40" cy="24" rx="34" ry="16" fill="url(#sofa3shadow)"/>
        <path d="M 40 8 L 72 22 L 40 36 L 8 22 Z" fill="url(#sofa3top)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 40 12 L 62 22 L 40 32 L 18 22 Z" fill="rgba(255,255,255,0.25)"/>
        <circle cx="40" cy="22" r="4" fill="#E14E7F"/>
      </svg>` }
  ],
  bookshelf: [
    { label: 'ほんだな', footprintW: 2, footprintD: 1, imgWidth: 120, imgHeight: 140, anchorX: 60, anchorY: 132,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140" viewBox="0 0 120 140">
        <defs>
          <linearGradient id="bs1front" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#AD8757"/><stop offset="55%" stop-color="#96774A"/><stop offset="100%" stop-color="#755D38"/></linearGradient>
          <linearGradient id="bs1side" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#8E6C46"/><stop offset="100%" stop-color="#6B4F2F"/></linearGradient>
          <radialGradient id="bs1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="60" cy="132" rx="52" ry="5" fill="url(#bs1shadow)"/>
        <path d="M 10 25 L 60 15 L 110 25 L 110 125 L 60 137 L 10 125 Z" fill="url(#bs1front)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 60 15 L 60 137" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 60 15 L 110 25 L 110 125 L 60 137 Z" fill="url(#bs1side)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 16 28 L 60 19" stroke="rgba(255,255,255,0.3)" stroke-width="1" fill="none"/>
        <g transform="skewY(11)" stroke="#2E2A47" stroke-width="0.8">
          <rect x="16" y="34" width="6" height="22" fill="#FF6B9D"/>
          <rect x="24" y="34" width="6" height="22" fill="#5AB8FF"/>
          <rect x="32" y="34" width="6" height="22" fill="#FFC93C"/>
          <rect x="40" y="34" width="6" height="22" fill="#4CD4B0"/>
          <rect x="16" y="60" width="6" height="22" fill="#B77FE0"/>
          <rect x="24" y="60" width="6" height="22" fill="#FF9EBB"/>
          <rect x="32" y="60" width="6" height="22" fill="#7C6FF2"/>
          <rect x="40" y="60" width="6" height="22" fill="#FFA34D"/>
          <rect x="16" y="86" width="6" height="22" fill="#4CD4B0"/>
          <rect x="24" y="86" width="6" height="22" fill="#FF6B9D"/>
          <rect x="32" y="86" width="6" height="22" fill="#5AB8FF"/>
          <rect x="40" y="86" width="6" height="22" fill="#FFC93C"/>
        </g>
      </svg>` },
      { label: 'たな', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 90, anchorX: 40, anchorY: 82,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="90" viewBox="0 0 80 90">
        <defs>
          <linearGradient id="bs2front" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#9A7248"/></linearGradient>
          <linearGradient id="bs2side" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <radialGradient id="bs2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="40" cy="82" rx="32" ry="4" fill="url(#bs2shadow)"/>
        <path d="M 10 25 L 40 15 L 70 25 L 70 78 L 40 88 L 10 78 Z" fill="url(#bs2front)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 40 15 L 40 88" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 40 15 L 70 25 L 70 78 L 40 88 Z" fill="url(#bs2side)" stroke="#2E2A47" stroke-width="1"/>
        <g transform="skewY(11)" stroke="#2E2A47" stroke-width="0.6">
          <rect x="14" y="34" width="5" height="16" fill="#FF6B9D"/>
          <rect x="20" y="34" width="5" height="16" fill="#4CD4B0"/>
          <rect x="26" y="34" width="5" height="16" fill="#FFC93C"/>
        </g>
      </svg>` },
    { label: 'かべだな', footprintW: 2, footprintD: 1, imgWidth: 130, imgHeight: 45, anchorX: 65, anchorY: 40, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="45" viewBox="0 0 130 45">
        <defs>
          <linearGradient id="bs3shelf" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#8E6C46"/></linearGradient>
        </defs>
        <rect x="8" y="18" width="114" height="8" fill="url(#bs3shelf)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="8" y="18" width="114" height="2.5" fill="rgba(255,255,255,0.35)"/>
        <rect x="18" y="4" width="8" height="14" fill="#FF6B9D" stroke="#2E2A47" stroke-width="0.8"/>
        <rect x="30" y="0" width="8" height="18" fill="#5AB8FF" stroke="#2E2A47" stroke-width="0.8"/>
        <circle cx="55" cy="12" r="6" fill="#4CD4B0" stroke="#2E2A47" stroke-width="0.8"/>
        <rect x="70" y="4" width="10" height="14" fill="#FFC93C" stroke="#2E2A47" stroke-width="0.8"/>
        <path d="M 90 18 L 100 4 L 110 18 Z" fill="#B77FE0" stroke="#2E2A47" stroke-width="0.8"/>
      </svg>` }
  ],
  rug: [
    { label: 'まる ラグ', footprintW: 2, footprintD: 2, imgWidth: 140, imgHeight: 80, anchorX: 70, anchorY: 40, flat: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80">
        <defs>
          <radialGradient id="rug1a" cx="45%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFC2D6"/><stop offset="100%" stop-color="#FF9EBB"/></radialGradient>
          <radialGradient id="rug1b" cx="45%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFDCE9"/><stop offset="100%" stop-color="#FFC5D8"/></radialGradient>
          <radialGradient id="rug1c" cx="45%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFCFE0"/><stop offset="100%" stop-color="#FFB8D0"/></radialGradient>
        </defs>
        <ellipse cx="70" cy="40" rx="65" ry="32" fill="url(#rug1a)" stroke="#2E2A47" stroke-width="1.5"/>
        <ellipse cx="70" cy="40" rx="50" ry="24" fill="url(#rug1b)" stroke="#2E2A47" stroke-width="1" stroke-dasharray="4 3"/>
        <ellipse cx="70" cy="40" rx="30" ry="15" fill="url(#rug1c)" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="55" cy="28" rx="16" ry="6" fill="rgba(255,255,255,0.3)"/>
        <circle cx="70" cy="40" r="6" fill="#E14E7F"/>
      </svg>` },
    { label: 'しかく ラグ', footprintW: 3, footprintD: 2, imgWidth: 200, imgHeight: 100, anchorX: 100, anchorY: 50, flat: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
        <defs>
          <linearGradient id="rug2a" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C9A6F5"/><stop offset="100%" stop-color="#B77FE0"/></linearGradient>
          <linearGradient id="rug2b" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E4CFFB"/><stop offset="100%" stop-color="#D4B5F0"/></linearGradient>
          <linearGradient id="rug2c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="100%" stop-color="#7C6FF2"/></linearGradient>
        </defs>
        <path d="M 100 8 L 192 50 L 100 92 L 8 50 Z" fill="url(#rug2a)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 100 22 L 174 50 L 100 78 L 26 50 Z" fill="url(#rug2b)" stroke="#2E2A47" stroke-width="1" stroke-dasharray="4 3"/>
        <path d="M 100 40 L 138 50 L 100 60 L 62 50 Z" fill="url(#rug2c)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 40 30 L 100 15" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/>
      </svg>` },
    { label: 'ハート ラグ', footprintW: 2, footprintD: 2, imgWidth: 140, imgHeight: 100, anchorX: 70, anchorY: 50, flat: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100" viewBox="0 0 140 100">
        <defs>
          <radialGradient id="rug3a" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#FF93B4"/><stop offset="100%" stop-color="#FF6B9D"/></radialGradient>
          <radialGradient id="rug3b" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFC5D8"/><stop offset="100%" stop-color="#FFA5C2"/></radialGradient>
        </defs>
        <path d="M 70 90 C 25 65 20 25 45 25 C 55 25 65 35 70 45 C 75 35 85 25 95 25 C 120 25 115 65 70 90 Z" fill="url(#rug3a)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 70 75 C 40 58 38 35 52 35 C 60 35 68 42 70 50 C 72 42 80 35 88 35 C 102 35 100 58 70 75 Z" fill="url(#rug3b)" stroke="#2E2A47" stroke-width="1" stroke-dasharray="3 2"/>
        <ellipse cx="55" cy="40" rx="8" ry="4" fill="rgba(255,255,255,0.35)"/>
      </svg>` },
    { label: 'ほし ラグ', footprintW: 2, footprintD: 2, imgWidth: 140, imgHeight: 90, anchorX: 70, anchorY: 45, flat: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="90" viewBox="0 0 140 90">
        <defs>
          <radialGradient id="rug4a" cx="45%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFE770"/><stop offset="100%" stop-color="#FFC93C"/></radialGradient>
          <radialGradient id="rug4b" cx="45%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="100%" stop-color="#FFEA88"/></radialGradient>
        </defs>
        <path d="M 70 10 L 82 34 L 108 34 L 90 50 L 96 76 L 70 60 L 44 76 L 50 50 L 32 34 L 58 34 Z" fill="url(#rug4a)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 70 24 L 78 40 L 96 40 L 82 50 L 88 66 L 70 56 L 52 66 L 58 50 L 44 40 L 62 40 Z" fill="url(#rug4b)" stroke="#2E2A47" stroke-width="1" stroke-dasharray="3 2"/>
      </svg>` }
  ],
  lamp: [
    { label: 'フロアランプ', footprintW: 1, footprintD: 1, imgWidth: 55, imgHeight: 130, anchorX: 28, anchorY: 122,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="55" height="130" viewBox="0 0 55 130">
        <defs>
          <linearGradient id="lamp1base" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <linearGradient id="lamp1pole" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9A7748"/><stop offset="100%" stop-color="#6E5333"/></linearGradient>
          <radialGradient id="lamp1shade" cx="45%" cy="20%" r="90%"><stop offset="0%" stop-color="#FFFCEA"/><stop offset="100%" stop-color="#FFF0A0"/></radialGradient>
          <radialGradient id="lamp1glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,234,136,0.9)"/><stop offset="100%" stop-color="rgba(255,234,136,0)"/></radialGradient>
          <radialGradient id="lamp1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="28" cy="122" rx="20" ry="4" fill="url(#lamp1shadow)"/>
        <ellipse cx="28" cy="118" rx="16" ry="5" fill="url(#lamp1base)" stroke="#2E2A47" stroke-width="1.2"/>
        <rect x="26" y="30" width="4" height="90" fill="url(#lamp1pole)"/>
        <ellipse cx="28" cy="20" rx="20" ry="10" fill="url(#lamp1glow)"/>
        <path d="M 10 18 L 46 18 L 40 40 L 16 40 Z" fill="url(#lamp1shade)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 14 20 L 40 20" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
        <ellipse cx="28" cy="18" rx="18" ry="4" fill="#FFEA88" stroke="#2E2A47" stroke-width="1.2"/>
      </svg>` },
    { label: 'テーブルランプ', footprintW: 1, footprintD: 1, imgWidth: 55, imgHeight: 75, anchorX: 28, anchorY: 68,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="55" height="75" viewBox="0 0 55 75">
        <defs>
          <linearGradient id="lamp2base" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <radialGradient id="lamp2shade" cx="45%" cy="20%" r="90%"><stop offset="0%" stop-color="#FFFCEA"/><stop offset="100%" stop-color="#FFF0A0"/></radialGradient>
          <radialGradient id="lamp2glow" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="rgba(255,234,136,0.85)"/><stop offset="100%" stop-color="rgba(255,234,136,0)"/></radialGradient>
          <radialGradient id="lamp2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="28" cy="68" rx="18" ry="4" fill="url(#lamp2shadow)"/>
        <ellipse cx="28" cy="65" rx="14" ry="4" fill="url(#lamp2base)" stroke="#2E2A47" stroke-width="1.2"/>
        <rect x="26" y="30" width="4" height="35" fill="url(#lamp2base)"/>
        <ellipse cx="28" cy="18" rx="18" ry="9" fill="url(#lamp2glow)"/>
        <path d="M 10 8 L 46 8 L 42 30 L 14 30 Z" fill="url(#lamp2shade)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 13 10 L 42 10" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      </svg>` },
    { label: 'てんじょうランプ', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 100, anchorX: 40, anchorY: 5,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 80 100">
        <defs>
          <radialGradient id="lamp3shade" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFFCEA"/><stop offset="100%" stop-color="#FFF0A0"/></radialGradient>
          <radialGradient id="lamp3glow" cx="50%" cy="55%" r="70%"><stop offset="0%" stop-color="rgba(255,234,136,0.6)"/><stop offset="100%" stop-color="rgba(255,234,136,0)"/></radialGradient>
        </defs>
        <line x1="40" y1="0" x2="40" y2="20" stroke="#2E2A47" stroke-width="2"/>
        <ellipse cx="40" cy="70" rx="42" ry="24" fill="url(#lamp3glow)"/>
        <ellipse cx="40" cy="60" rx="34" ry="30" fill="url(#lamp3shade)" stroke="#2E2A47" stroke-width="2"/>
        <ellipse cx="30" cy="48" rx="12" ry="10" fill="rgba(255,255,255,0.4)"/>
        <ellipse cx="40" cy="88" rx="34" ry="6" fill="#FFEA88" stroke="#2E2A47" stroke-width="1.5"/>
      </svg>` },
    { label: 'ろうそく', footprintW: 1, footprintD: 1, imgWidth: 45, imgHeight: 90, anchorX: 22, anchorY: 82,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="90" viewBox="0 0 45 90">
        <defs>
          <radialGradient id="lamp4base" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#D4A876"/><stop offset="100%" stop-color="#B78C5A"/></radialGradient>
          <linearGradient id="lamp4wax" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#FFFCF4"/><stop offset="100%" stop-color="#EFE8D8"/></linearGradient>
          <radialGradient id="lamp4glow" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="rgba(255,201,60,0.75)"/><stop offset="100%" stop-color="rgba(255,201,60,0)"/></radialGradient>
          <radialGradient id="lamp4shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.2)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="22" cy="82" rx="14" ry="3" fill="url(#lamp4shadow)"/>
        <ellipse cx="22" cy="78" rx="12" ry="4" fill="url(#lamp4base)" stroke="#2E2A47" stroke-width="1"/>
        <rect x="15" y="35" width="14" height="45" fill="url(#lamp4wax)" stroke="#2E2A47" stroke-width="1.2"/>
        <rect x="16" y="37" width="3" height="40" fill="rgba(255,255,255,0.6)"/>
        <ellipse cx="22" cy="35" rx="7" ry="2" fill="#F5F0DF"/>
        <path d="M 22 30 L 22 20" stroke="#2E2A47" stroke-width="1"/>
        <ellipse cx="22" cy="22" rx="14" ry="12" fill="url(#lamp4glow)"/>
        <path d="M 22 25 Q 25 20 22 12 Q 19 20 22 25 Z" fill="#FFA34D" stroke="#FF6B00" stroke-width="1"/>
        <ellipse cx="22" cy="18" rx="4" ry="7" fill="#FFC93C" opacity="0.9"/>
      </svg>` }
  ],
  window: [
    { label: 'まど', footprintW: 2, footprintD: 1, imgWidth: 130, imgHeight: 120, anchorX: 65, anchorY: 100, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="120" viewBox="0 0 130 120">
        <defs>
          <linearGradient id="win1frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <linearGradient id="win1sky" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#D3EDFF"/><stop offset="100%" stop-color="#B8E4FF"/></linearGradient>
          <linearGradient id="win1curtain" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFB6CE"/><stop offset="100%" stop-color="#F296B5"/></linearGradient>
        </defs>
        <rect x="12" y="20" width="106" height="80" fill="url(#win1frame)" stroke="#2E2A47" stroke-width="2"/>
        <rect x="18" y="26" width="94" height="68" fill="url(#win1sky)" stroke="#2E2A47" stroke-width="1"/>
        <line x1="65" y1="26" x2="65" y2="94" stroke="#8B6B3F" stroke-width="3"/>
        <line x1="18" y1="60" x2="112" y2="60" stroke="#8B6B3F" stroke-width="3"/>
        <circle cx="94" cy="42" r="10" fill="#FFF5C4" opacity="0.9"/>
        <circle cx="90" cy="38" r="4" fill="rgba(255,255,255,0.6)"/>
        <path d="M 30 76 Q 40 68 50 76 Q 60 84 70 76" stroke="#FFFFFF" stroke-width="2" fill="none" opacity="0.7"/>
        <path d="M 8 20 L 8 100 L 20 108 L 20 22 Z" fill="url(#win1curtain)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 122 20 L 122 100 L 110 108 L 110 22 Z" fill="url(#win1curtain)" stroke="#2E2A47" stroke-width="1.5"/>
      </svg>` },
    { label: 'カーテン', footprintW: 2, footprintD: 1, imgWidth: 130, imgHeight: 120, anchorX: 65, anchorY: 100, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="120" viewBox="0 0 130 120">
        <defs>
          <linearGradient id="win2rod" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <linearGradient id="win2fabL" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="100%" stop-color="#7C6FF2"/></linearGradient>
          <linearGradient id="win2fabR" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#7C6FF2"/><stop offset="100%" stop-color="#9D91FF"/></linearGradient>
          <linearGradient id="win2sky" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#D3EDFF"/><stop offset="100%" stop-color="#B8E4FF"/></linearGradient>
        </defs>
        <rect x="5" y="15" width="120" height="4" fill="url(#win2rod)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 10 19 Q 12 30 8 40 Q 12 50 8 60 Q 12 70 8 80 Q 12 90 8 100 L 55 105 L 55 19 Z" fill="url(#win2fabL)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 120 19 Q 118 30 122 40 Q 118 50 122 60 Q 118 70 122 80 Q 118 90 122 100 L 75 105 L 75 19 Z" fill="url(#win2fabR)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 16 25 Q 14 40 16 55" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/>
        <path d="M 114 25 Q 116 40 114 55" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/>
        <path d="M 55 19 Q 60 60 55 105 L 75 105 Q 70 60 75 19 Z" fill="url(#win2sky)" stroke="#2E2A47" stroke-width="1.5"/>
      </svg>` },
    { label: 'まる まど', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 80, anchorX: 40, anchorY: 60, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <linearGradient id="win3frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#A9835A"/><stop offset="100%" stop-color="#7C5E3C"/></linearGradient>
          <radialGradient id="win3sky" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#E0F4FF"/><stop offset="100%" stop-color="#B8E4FF"/></radialGradient>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#win3frame)" stroke="#2E2A47" stroke-width="2"/>
        <circle cx="40" cy="40" r="28" fill="url(#win3sky)"/>
        <path d="M 12 40 L 68 40 M 40 12 L 40 68" stroke="#8B6B3F" stroke-width="3"/>
        <circle cx="52" cy="28" r="6" fill="#FFF5C4" opacity="0.9"/>
        <ellipse cx="26" cy="24" rx="10" ry="5" fill="rgba(255,255,255,0.35)"/>
      </svg>` }
  ],
  plant: [
    { label: 'かんようしょくぶつ', footprintW: 1, footprintD: 1, imgWidth: 80, imgHeight: 110, anchorX: 40, anchorY: 105,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="110" viewBox="0 0 80 110">
        <defs>
          <linearGradient id="pl1pot" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#9A7248"/></linearGradient>
          <radialGradient id="pl1leaf" cx="35%" cy="25%" r="80%"><stop offset="0%" stop-color="#6FE0C0"/><stop offset="100%" stop-color="#3FAE8E"/></radialGradient>
          <radialGradient id="pl1shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="40" cy="103" rx="26" ry="5" fill="url(#pl1shadow)"/>
        <path d="M 22 80 L 58 80 L 55 105 L 25 105 Z" fill="url(#pl1pot)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 26 83 L 30 102" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
        <ellipse cx="40" cy="80" rx="18" ry="4" fill="#7C5E3C" stroke="#2E2A47" stroke-width="1.2"/>
        <g fill="url(#pl1leaf)" stroke="#2E2A47" stroke-width="1.2">
          <ellipse cx="30" cy="60" rx="10" ry="22" transform="rotate(-25 30 60)"/>
          <ellipse cx="50" cy="55" rx="10" ry="24" transform="rotate(20 50 55)"/>
          <ellipse cx="40" cy="45" rx="9" ry="26"/>
          <ellipse cx="22" cy="70" rx="8" ry="18" transform="rotate(-45 22 70)"/>
          <ellipse cx="58" cy="70" rx="8" ry="18" transform="rotate(40 58 70)"/>
        </g>
        <path d="M 40 25 L 40 55" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      </svg>` },
    { label: 'サボテン', footprintW: 1, footprintD: 1, imgWidth: 60, imgHeight: 90, anchorX: 30, anchorY: 85,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90" viewBox="0 0 60 90">
        <defs>
          <linearGradient id="pl2pot" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#F5628C"/><stop offset="100%" stop-color="#D63E70"/></linearGradient>
          <radialGradient id="pl2body" cx="35%" cy="25%" r="85%"><stop offset="0%" stop-color="#6FE0C0"/><stop offset="100%" stop-color="#3FAE8E"/></radialGradient>
          <radialGradient id="pl2shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="30" cy="84" rx="20" ry="4" fill="url(#pl2shadow)"/>
        <path d="M 15 68 L 45 68 L 42 86 L 18 86 Z" fill="url(#pl2pot)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 22 34 Q 20 55 30 68 Q 40 55 38 34 Q 38 24 30 20 Q 22 24 22 34 Z" fill="url(#pl2body)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 26 26 Q 25 45 30 60" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" fill="none"/>
        <path d="M 15 46 Q 10 50 12 58 Q 18 55 22 52" fill="url(#pl2body)" stroke="#2E2A47" stroke-width="1.5"/>
        <path d="M 45 40 Q 52 42 52 52 Q 46 52 40 50" fill="url(#pl2body)" stroke="#2E2A47" stroke-width="1.5"/>
        <circle cx="26" cy="24" r="2" fill="#FF6B9D"/>
        <path d="M 24 32 L 26 34 M 28 40 L 30 42 M 32 30 L 34 32" stroke="#FFF" stroke-width="1"/>
      </svg>` },
    { label: 'ミニ しょくぶつ', footprintW: 1, footprintD: 1, imgWidth: 50, imgHeight: 65, anchorX: 25, anchorY: 60,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="65" viewBox="0 0 50 65">
        <defs>
          <linearGradient id="pl3pot" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#9D91FF"/><stop offset="100%" stop-color="#7C6FF2"/></linearGradient>
          <radialGradient id="pl3leaf" cx="35%" cy="25%" r="85%"><stop offset="0%" stop-color="#6FE0C0"/><stop offset="100%" stop-color="#3FAE8E"/></radialGradient>
          <radialGradient id="pl3shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="25" cy="60" rx="16" ry="3" fill="url(#pl3shadow)"/>
        <path d="M 12 50 L 38 50 L 35 62 L 15 62 Z" fill="url(#pl3pot)" stroke="#2E2A47" stroke-width="1.5"/>
        <g fill="url(#pl3leaf)" stroke="#2E2A47" stroke-width="1"><ellipse cx="20" cy="35" rx="6" ry="14" transform="rotate(-20 20 35)"/><ellipse cx="30" cy="32" rx="6" ry="16" transform="rotate(15 30 32)"/><ellipse cx="25" cy="24" rx="5" ry="16"/></g>
      </svg>` },
    { label: 'はな', footprintW: 1, footprintD: 1, imgWidth: 60, imgHeight: 85, anchorX: 30, anchorY: 80,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="85" viewBox="0 0 60 85">
        <defs>
          <linearGradient id="pl4pot" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#8FD4FF"/><stop offset="100%" stop-color="#4A9FE0"/></linearGradient>
          <radialGradient id="pl4pink" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#FF93B4"/><stop offset="100%" stop-color="#E14E7F"/></radialGradient>
          <radialGradient id="pl4yellow" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFE770"/><stop offset="100%" stop-color="#F0C020"/></radialGradient>
          <radialGradient id="pl4purple" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#D4A6F5"/><stop offset="100%" stop-color="#9D6FD1"/></radialGradient>
          <radialGradient id="pl4shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        </defs>
        <ellipse cx="30" cy="80" rx="18" ry="3" fill="url(#pl4shadow)"/>
        <path d="M 18 60 L 42 60 L 40 78 L 20 78 Z" fill="url(#pl4pot)" stroke="#2E2A47" stroke-width="1.5"/>
        <line x1="24" y1="60" x2="20" y2="34" stroke="#4CD4B0" stroke-width="2.5"/>
        <line x1="36" y1="60" x2="40" y2="30" stroke="#4CD4B0" stroke-width="2.5"/>
        <line x1="30" y1="60" x2="30" y2="25" stroke="#4CD4B0" stroke-width="2.5"/>
        <g fill="url(#pl4pink)" stroke="#2E2A47" stroke-width="1"><circle cx="20" cy="30" r="5"/><circle cx="18" cy="26" r="4"/><circle cx="24" cy="26" r="4"/><circle cx="22" cy="22" r="4"/></g>
        <g fill="url(#pl4yellow)" stroke="#2E2A47" stroke-width="1"><circle cx="40" cy="26" r="5"/><circle cx="38" cy="22" r="4"/><circle cx="44" cy="22" r="4"/><circle cx="42" cy="18" r="4"/></g>
        <g fill="url(#pl4purple)" stroke="#2E2A47" stroke-width="1"><circle cx="30" cy="20" r="5"/><circle cx="28" cy="16" r="4"/><circle cx="34" cy="16" r="4"/><circle cx="32" cy="12" r="4"/></g>
      </svg>` }
  ],
  wall_decor: [
    { label: 'え', footprintW: 1, footprintD: 1, imgWidth: 70, imgHeight: 60, anchorX: 35, anchorY: 55, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="60" viewBox="0 0 70 60">
        <defs>
          <linearGradient id="wd1frame" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C49865"/><stop offset="100%" stop-color="#96774A"/></linearGradient>
          <linearGradient id="wd1sky" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#D3EDFF"/><stop offset="100%" stop-color="#B8E4FF"/></linearGradient>
        </defs>
        <rect x="6" y="6" width="58" height="48" fill="url(#wd1frame)" stroke="#2E2A47" stroke-width="1.5"/>
        <rect x="10" y="10" width="50" height="40" fill="url(#wd1sky)"/>
        <path d="M 10 40 L 20 30 L 28 35 L 40 20 L 50 30 L 60 25 L 60 50 L 10 50 Z" fill="#4CD4B0" stroke="#2E2A47" stroke-width="0.8"/>
        <circle cx="50" cy="18" r="4" fill="#FFC93C"/>
        <circle cx="48" cy="16" r="1.5" fill="rgba(255,255,255,0.6)"/>
      </svg>` },
    { label: 'ポスター', footprintW: 1, footprintD: 1, imgWidth: 60, imgHeight: 80, anchorX: 30, anchorY: 75, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80">
        <defs>
          <linearGradient id="wd2bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6CE"/><stop offset="100%" stop-color="#F296B5"/></linearGradient>
        </defs>
        <rect x="4" y="4" width="52" height="72" fill="url(#wd2bg)" stroke="#2E2A47" stroke-width="1.5"/>
        <text x="30" y="26" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="12" fill="#fff">MUSIC</text>
        <circle cx="30" cy="50" r="14" fill="#2E2A47"/>
        <circle cx="30" cy="50" r="4" fill="#F296B5"/>
        <ellipse cx="25" cy="44" rx="4" ry="2" fill="rgba(255,255,255,0.3)"/>
        <path d="M 20 68 L 40 68" stroke="#fff" stroke-width="2"/>
      </svg>` },
    { label: 'とけい', footprintW: 1, footprintD: 1, imgWidth: 60, imgHeight: 60, anchorX: 30, anchorY: 55, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
        <defs>
          <radialGradient id="wd3face" cx="40%" cy="35%" r="75%"><stop offset="0%" stop-color="#FFFCEA"/><stop offset="100%" stop-color="#FFF0A0"/></radialGradient>
        </defs>
        <circle cx="30" cy="30" r="26" fill="#FFFFFF" stroke="#2E2A47" stroke-width="2"/>
        <circle cx="30" cy="30" r="22" fill="url(#wd3face)"/>
        <ellipse cx="22" cy="20" rx="8" ry="5" fill="rgba(255,255,255,0.5)"/>
        <g stroke="#2E2A47" stroke-width="1" stroke-linecap="round">
          <line x1="30" y1="10" x2="30" y2="14"/>
          <line x1="50" y1="30" x2="46" y2="30"/>
          <line x1="30" y1="50" x2="30" y2="46"/>
          <line x1="10" y1="30" x2="14" y2="30"/>
        </g>
        <line x1="30" y1="30" x2="30" y2="16" stroke="#E14E7F" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="30" y1="30" x2="42" y2="30" stroke="#E14E7F" stroke-width="2" stroke-linecap="round"/>
        <circle cx="30" cy="30" r="2.5" fill="#2E2A47"/>
      </svg>` },
    { label: 'ミラー', footprintW: 1, footprintD: 1, imgWidth: 55, imgHeight: 80, anchorX: 28, anchorY: 75, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="55" height="80" viewBox="0 0 55 80">
        <defs>
          <linearGradient id="wd4frame" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE770"/><stop offset="100%" stop-color="#FFC93C"/></linearGradient>
          <radialGradient id="wd4glass" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#EFF9FF"/><stop offset="100%" stop-color="#DDEEFF"/></radialGradient>
        </defs>
        <ellipse cx="28" cy="40" rx="24" ry="34" fill="url(#wd4frame)" stroke="#2E2A47" stroke-width="2"/>
        <ellipse cx="28" cy="40" rx="18" ry="28" fill="url(#wd4glass)" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 18 22 Q 15 30 15 45" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.7"/>
      </svg>` },
    { label: 'ガーランド', footprintW: 3, footprintD: 1, imgWidth: 180, imgHeight: 50, anchorX: 90, anchorY: 45, wall: true,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="50" viewBox="0 0 180 50">
        <path d="M 5 10 Q 45 40 90 20 Q 135 40 175 10" stroke="#8B6B3F" stroke-width="1.5" fill="none"/>
        <path d="M 22 24 L 26 14 L 32 24 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 42 32 L 46 22 L 52 32 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 62 36 L 66 26 L 72 36 Z" fill="#4CD4B0" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 82 34 L 86 24 L 92 34 Z" fill="#5AB8FF" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 102 32 L 106 22 L 112 32 Z" fill="#B77FE0" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 122 28 L 126 18 L 132 28 Z" fill="#FF9EBB" stroke="#2E2A47" stroke-width="1"/>
        <path d="M 142 22 L 146 12 L 152 22 Z" fill="#FFA34D" stroke="#2E2A47" stroke-width="1"/>
        <circle cx="26" cy="18" r="1.3" fill="rgba(255,255,255,0.6)"/>
        <circle cx="86" cy="27" r="1.3" fill="rgba(255,255,255,0.6)"/>
        <circle cx="146" cy="15" r="1.3" fill="rgba(255,255,255,0.6)"/>
      </svg>` }
  ]
};

export const FURNITURE_CATEGORIES = [
  { key: 'bed',        icon: '🛏️', label: 'ベッド' },
  { key: 'desk',       icon: '🪑', label: 'つくえ・イス' },
  { key: 'closet',     icon: '🚪', label: 'たんす' },
  { key: 'sofa',       icon: '🛋️', label: 'ソファ' },
  { key: 'bookshelf',  icon: '📚', label: 'ほんだな' },
  { key: 'rug',        icon: '🟪', label: 'ラグ' },
  { key: 'lamp',       icon: '💡', label: 'ランプ' },
  { key: 'window',     icon: '🪟', label: 'まど' },
  { key: 'plant',      icon: '🌱', label: 'しょくぶつ' },
  { key: 'wall_decor', icon: '🖼️', label: 'かべ かざり' }
];

/** 壁の色 / 床の色のプリセット */
export const ROOM_WALL_COLORS = ['#F5EEDF', '#FFE5EC', '#E4DAF5', '#DDEEFF', '#E4F5DA', '#FFF3C9', '#F0E0D0'];
export const ROOM_FLOOR_COLORS = ['#D4B896', '#B78C5A', '#96774A', '#F5D5B0', '#D8CDBD', '#C69C6D', '#EED6B8'];


// ============================================================
// 背景シーンライブラリ（scene.html 用）
// ============================================================
// 各シーンは 720x500 のSVG背景画像。中央にアバターを立たせられる。
// groundY: 地面（アバターの足元）のY座標

export const SCENE_LIBRARY = [
  {
    key: 'park', label: '🏞️ こうえん', groundY: 380,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <defs><linearGradient id="skypark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#87CEEB"/><stop offset="100%" stop-color="#DDEEFF"/></linearGradient></defs>
      <rect width="720" height="380" fill="url(#skypark)"/>
      <circle cx="580" cy="90" r="45" fill="#FFF5C4"/>
      <g fill="#FFFFFF" opacity="0.9"><ellipse cx="120" cy="80" rx="45" ry="18"/><ellipse cx="160" cy="70" rx="30" ry="14"/><ellipse cx="460" cy="130" rx="60" ry="20"/></g>
      <rect y="380" width="720" height="120" fill="#7BC868"/>
      <rect y="380" width="720" height="10" fill="#5FA850"/>
      <g><path d="M 100 380 L 100 280 L 130 280 L 130 380 Z" fill="#8B6B3F"/><circle cx="115" cy="240" r="55" fill="#4A9E3D"/><circle cx="90" cy="260" r="35" fill="#5FBA50"/><circle cx="145" cy="255" r="35" fill="#4A9E3D"/></g>
      <g><path d="M 600 380 L 600 300 L 625 300 L 625 380 Z" fill="#8B6B3F"/><circle cx="612" cy="265" r="42" fill="#4A9E3D"/><circle cx="590" cy="280" r="28" fill="#5FBA50"/><circle cx="640" cy="275" r="28" fill="#4A9E3D"/></g>
      <g fill="#FF6B9D" stroke="#2E2A47" stroke-width="1"><circle cx="220" cy="410" r="4"/><circle cx="216" cy="406" r="3"/><circle cx="224" cy="406" r="3"/><circle cx="222" cy="402" r="3"/></g>
      <g fill="#FFC93C" stroke="#2E2A47" stroke-width="1"><circle cx="500" cy="420" r="4"/><circle cx="496" cy="416" r="3"/><circle cx="504" cy="416" r="3"/><circle cx="502" cy="412" r="3"/></g>
      <g fill="#B77FE0" stroke="#2E2A47" stroke-width="1"><circle cx="380" cy="430" r="4"/><circle cx="376" cy="426" r="3"/><circle cx="384" cy="426" r="3"/><circle cx="382" cy="422" r="3"/></g>
    </svg>`
  },
  {
    key: 'beach', label: '🏖️ ビーチ', groundY: 380,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <defs><linearGradient id="skybeach" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFB988"/><stop offset="50%" stop-color="#FFDBB0"/><stop offset="100%" stop-color="#B8E4FF"/></linearGradient></defs>
      <rect width="720" height="280" fill="url(#skybeach)"/>
      <circle cx="360" cy="170" r="55" fill="#FFD966"/>
      <circle cx="360" cy="170" r="80" fill="#FFE99C" opacity="0.4"/>
      <rect y="280" width="720" height="100" fill="#5AB8FF"/>
      <g fill="#FFFFFF" opacity="0.7"><path d="M 0 300 Q 90 290 180 300 T 360 300 T 540 300 T 720 300 L 720 310 L 0 310 Z"/><path d="M 0 320 Q 120 315 240 320 T 480 320 T 720 320 L 720 328 L 0 328 Z"/></g>
      <rect y="380" width="720" height="120" fill="#F5D5B0"/>
      <g><rect x="620" y="340" width="6" height="45" fill="#B78C5A"/><ellipse cx="623" cy="335" rx="55" ry="18" fill="#FF6B9D"/><path d="M 570 335 L 623 335 L 623 320 M 623 335 L 680 335 L 623 322 M 570 335 L 623 322 M 680 335 L 623 322" stroke="#E14E7F" stroke-width="1"/></g>
      <g fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"><path d="M 150 415 L 155 405 L 160 415 L 165 405 L 170 415 L 175 405 L 180 415 Z"/></g>
      <ellipse cx="480" cy="440" rx="28" ry="12" fill="#FF9EBB" stroke="#2E2A47" stroke-width="1.5"/>
      <text x="120" y="200" font-size="30" fill="#FF6B9D">🌴</text>
    </svg>`
  },
  {
    key: 'school', label: '🏫 がっこう', groundY: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <rect width="720" height="400" fill="#F5EEDF"/>
      <rect y="400" width="720" height="100" fill="#8B6B3F"/>
      <rect y="400" width="720" height="12" fill="#6B4E2E"/>
      <rect x="120" y="140" width="480" height="180" fill="#2E4A3E" stroke="#8B6B3F" stroke-width="8"/>
      <rect x="120" y="140" width="480" height="180" fill="#2E4A3E"/>
      <g fill="#FFFFFF" font-family="'Baloo 2',sans-serif" font-size="18"><text x="180" y="180">きょうの じかんわり</text><text x="180" y="215">1. こくご</text><text x="180" y="245">2. さんすう</text><text x="180" y="275">3. たいいく</text><text x="440" y="215" fill="#FFC93C">きょうも がんばろう！</text></g>
      <path d="M 350 210 L 375 235 L 395 220" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="50" y="360" width="80" height="40" fill="#B78C5A" stroke="#2E2A47" stroke-width="1.5"/>
      <rect x="55" y="330" width="70" height="35" fill="#96774A" stroke="#2E2A47" stroke-width="1.5"/>
      <rect x="590" y="360" width="80" height="40" fill="#B78C5A" stroke="#2E2A47" stroke-width="1.5"/>
      <rect x="595" y="330" width="70" height="35" fill="#96774A" stroke="#2E2A47" stroke-width="1.5"/>
      <circle cx="640" cy="80" r="24" fill="#FFF5C4" stroke="#2E2A47" stroke-width="2"/>
      <line x1="640" y1="65" x2="640" y2="80" stroke="#E14E7F" stroke-width="2"/>
      <line x1="640" y1="80" x2="652" y2="80" stroke="#E14E7F" stroke-width="2"/>
    </svg>`
  },
  {
    key: 'forest', label: '🌲 もり', groundY: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <defs><linearGradient id="skyforest" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C9E6B8"/><stop offset="100%" stop-color="#F5F5DC"/></linearGradient></defs>
      <rect width="720" height="400" fill="url(#skyforest)"/>
      <rect y="400" width="720" height="100" fill="#8B6B3F"/>
      <rect y="400" width="720" height="10" fill="#6B4E2E"/>
      <g><path d="M 60 400 L 45 300 L 60 300 L 45 220 L 65 220 L 55 130 L 85 130 L 75 220 L 95 220 L 80 300 L 95 300 L 80 400 Z" fill="#2E7A3E"/></g>
      <g><path d="M 140 400 L 130 320 L 145 320 L 130 240 L 150 240 L 140 160 L 170 160 L 160 240 L 180 240 L 165 320 L 180 320 L 170 400 Z" fill="#3A8F4A"/></g>
      <g><path d="M 570 400 L 555 320 L 570 320 L 555 240 L 575 240 L 565 160 L 595 160 L 585 240 L 605 240 L 590 320 L 605 320 L 590 400 Z" fill="#3A8F4A"/></g>
      <g><path d="M 660 400 L 650 300 L 662 300 L 650 220 L 668 220 L 660 140 L 685 140 L 677 220 L 695 220 L 683 300 L 695 300 L 685 400 Z" fill="#2E7A3E"/></g>
      <g fill="#FFA34D"><ellipse cx="250" cy="435" rx="15" ry="8"/><path d="M 240 428 Q 250 415 260 428" fill="#8B4A2E"/></g>
      <text x="410" y="440" font-size="30">🍄</text>
      <text x="180" y="445" font-size="25">🌸</text>
      <text x="460" y="380" font-size="20">🐿️</text>
    </svg>`
  },
  {
    key: 'cafe', label: '☕ カフェ', groundY: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <rect width="720" height="400" fill="#F5EEDF"/>
      <rect y="400" width="720" height="100" fill="#8B6B3F"/>
      <g stroke="#2E2A47" stroke-width="1" opacity="0.15"><line x1="0" y1="410" x2="720" y2="410"/><line x1="0" y1="430" x2="720" y2="430"/><line x1="0" y1="450" x2="720" y2="450"/><line x1="0" y1="470" x2="720" y2="470"/></g>
      <rect x="0" y="0" width="720" height="200" fill="#B8E4FF"/>
      <rect x="20" y="20" width="200" height="160" fill="#DDEEFF" stroke="#8B6B3F" stroke-width="4"/>
      <line x1="120" y1="20" x2="120" y2="180" stroke="#8B6B3F" stroke-width="4"/>
      <line x1="20" y1="100" x2="220" y2="100" stroke="#8B6B3F" stroke-width="4"/>
      <rect x="500" y="20" width="200" height="160" fill="#DDEEFF" stroke="#8B6B3F" stroke-width="4"/>
      <line x1="600" y1="20" x2="600" y2="180" stroke="#8B6B3F" stroke-width="4"/>
      <line x1="500" y1="100" x2="700" y2="100" stroke="#8B6B3F" stroke-width="4"/>
      <text x="260" y="120" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="42" fill="#8B6B3F">☕ Cafe</text>
      <text x="285" y="155" font-family="'Baloo 2',sans-serif" font-weight="700" font-size="18" fill="#B78C5A">〜 のんびり タイム 〜</text>
      <ellipse cx="80" cy="440" rx="45" ry="15" fill="rgba(0,0,0,0.2)"/>
      <rect x="45" y="380" width="70" height="60" fill="#B78C5A" stroke="#2E2A47" stroke-width="1.5"/>
      <ellipse cx="80" cy="380" rx="35" ry="10" fill="#F5D5B0" stroke="#2E2A47" stroke-width="1.5"/>
      <ellipse cx="620" cy="440" rx="45" ry="15" fill="rgba(0,0,0,0.2)"/>
      <rect x="585" y="380" width="70" height="60" fill="#B78C5A" stroke="#2E2A47" stroke-width="1.5"/>
      <ellipse cx="620" cy="380" rx="35" ry="10" fill="#F5D5B0" stroke="#2E2A47" stroke-width="1.5"/>
    </svg>`
  },
  {
    key: 'town', label: '🏙️ まち', groundY: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="500" viewBox="0 0 720 500">
      <defs><linearGradient id="skytown" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFB988"/><stop offset="60%" stop-color="#FFDBB0"/><stop offset="100%" stop-color="#F5EEDF"/></linearGradient></defs>
      <rect width="720" height="400" fill="url(#skytown)"/>
      <circle cx="580" cy="120" r="50" fill="#FFD966" opacity="0.8"/>
      <rect x="40" y="200" width="90" height="200" fill="#B77FE0" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="55" y="220" width="18" height="22"/><rect x="90" y="220" width="18" height="22"/><rect x="55" y="255" width="18" height="22"/><rect x="90" y="255" width="18" height="22"/><rect x="55" y="290" width="18" height="22"/><rect x="90" y="290" width="18" height="22"/><rect x="55" y="325" width="18" height="22"/><rect x="90" y="325" width="18" height="22"/></g>
      <rect x="140" y="150" width="100" height="250" fill="#7C6FF2" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="158" y="175" width="20" height="26"/><rect x="200" y="175" width="20" height="26"/><rect x="158" y="215" width="20" height="26"/><rect x="200" y="215" width="20" height="26"/><rect x="158" y="255" width="20" height="26"/><rect x="200" y="255" width="20" height="26"/><rect x="158" y="295" width="20" height="26"/><rect x="200" y="295" width="20" height="26"/><rect x="158" y="335" width="20" height="26"/><rect x="200" y="335" width="20" height="26"/></g>
      <rect x="250" y="230" width="80" height="170" fill="#FF9EBB" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="265" y="250" width="16" height="20"/><rect x="300" y="250" width="16" height="20"/><rect x="265" y="280" width="16" height="20"/><rect x="300" y="280" width="16" height="20"/><rect x="265" y="310" width="16" height="20"/><rect x="300" y="310" width="16" height="20"/><rect x="265" y="340" width="16" height="20"/><rect x="300" y="340" width="16" height="20"/></g>
      <rect x="340" y="180" width="90" height="220" fill="#4CD4B0" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="355" y="200" width="18" height="24"/><rect x="395" y="200" width="18" height="24"/><rect x="355" y="235" width="18" height="24"/><rect x="395" y="235" width="18" height="24"/><rect x="355" y="270" width="18" height="24"/><rect x="395" y="270" width="18" height="24"/><rect x="355" y="305" width="18" height="24"/><rect x="395" y="305" width="18" height="24"/><rect x="355" y="340" width="18" height="24"/><rect x="395" y="340" width="18" height="24"/></g>
      <rect x="440" y="220" width="80" height="180" fill="#FFA34D" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="455" y="240" width="16" height="20"/><rect x="490" y="240" width="16" height="20"/><rect x="455" y="270" width="16" height="20"/><rect x="490" y="270" width="16" height="20"/><rect x="455" y="300" width="16" height="20"/><rect x="490" y="300" width="16" height="20"/><rect x="455" y="330" width="16" height="20"/><rect x="490" y="330" width="16" height="20"/></g>
      <rect x="530" y="180" width="100" height="220" fill="#5AB8FF" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="548" y="200" width="20" height="24"/><rect x="590" y="200" width="20" height="24"/><rect x="548" y="234" width="20" height="24"/><rect x="590" y="234" width="20" height="24"/><rect x="548" y="268" width="20" height="24"/><rect x="590" y="268" width="20" height="24"/><rect x="548" y="302" width="20" height="24"/><rect x="590" y="302" width="20" height="24"/><rect x="548" y="336" width="20" height="24"/><rect x="590" y="336" width="20" height="24"/></g>
      <rect x="640" y="250" width="70" height="150" fill="#FFC93C" stroke="#2E2A47" stroke-width="2"/>
      <g fill="#FFE99C" stroke="#2E2A47" stroke-width="0.8"><rect x="655" y="270" width="16" height="20"/><rect x="685" y="270" width="16" height="20"/><rect x="655" y="300" width="16" height="20"/><rect x="685" y="300" width="16" height="20"/><rect x="655" y="330" width="16" height="20"/><rect x="685" y="330" width="16" height="20"/></g>
      <rect y="400" width="720" height="100" fill="#5A5A5A"/>
      <g stroke="#FFFFFF" stroke-width="3" stroke-dasharray="20 20"><line x1="0" y1="450" x2="720" y2="450"/></g>
    </svg>`
  }
];

// ============================================================
// 服・アイテムライブラリ（draw.htmlの「👗 ふく」タブ用のプリセット）
// ============================================================

export const CLOTHING_LIBRARY = {
  dress: [
    { label: 'ワンピース', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="180" viewBox="0 0 140 180"><path d="M 40 20 L 60 15 L 80 15 L 100 20 L 105 60 L 120 160 L 20 160 L 35 60 Z" fill="#FF9EBB" stroke="#2E2A47" stroke-width="2"/><path d="M 60 15 L 60 25 L 80 25 L 80 15" fill="#FF6B9D" stroke="#2E2A47" stroke-width="1.5"/><circle cx="70" cy="55" r="4" fill="#E14E7F"/><path d="M 35 100 L 105 100" stroke="#E14E7F" stroke-width="2"/></svg>` },
    { label: 'ワンピース (青)', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="180" viewBox="0 0 140 180"><path d="M 40 20 L 60 15 L 80 15 L 100 20 L 105 60 L 130 160 L 10 160 L 35 60 Z" fill="#5AB8FF" stroke="#2E2A47" stroke-width="2"/><path d="M 60 15 L 60 25 L 80 25 L 80 15" fill="#4A8CD8" stroke="#2E2A47" stroke-width="1.5"/><g fill="#FFFFFF"><circle cx="55" cy="80" r="3"/><circle cx="85" cy="90" r="3"/><circle cx="70" cy="120" r="3"/><circle cx="45" cy="130" r="3"/><circle cx="95" cy="130" r="3"/></g></svg>` },
    { label: 'フリル', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="180" viewBox="0 0 140 180"><path d="M 40 20 L 60 15 L 80 15 L 100 20 L 105 60 L 115 140 L 25 140 L 35 60 Z" fill="#F296B5" stroke="#2E2A47" stroke-width="2"/><path d="M 60 15 L 60 25 L 80 25 L 80 15" fill="#E14E7F" stroke="#2E2A47" stroke-width="1.5"/><path d="M 25 140 Q 40 155 55 145 Q 70 155 85 145 Q 100 155 115 140" fill="#FFC5D8" stroke="#2E2A47" stroke-width="1.5"/><path d="M 25 155 Q 40 168 55 158 Q 70 168 85 158 Q 100 168 115 155" fill="#FFFFFF" stroke="#2E2A47" stroke-width="1.5"/></svg>` }
  ],
  skirt: [
    { label: 'スカート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="120" viewBox="0 0 140 120"><path d="M 40 10 L 100 10 L 120 100 L 20 100 Z" fill="#B77FE0" stroke="#2E2A47" stroke-width="2"/><rect x="40" y="10" width="60" height="8" fill="#7C6FF2" stroke="#2E2A47" stroke-width="1"/><g stroke="#7C6FF2" stroke-width="1.5"><line x1="50" y1="20" x2="45" y2="98"/><line x1="70" y1="20" x2="70" y2="98"/><line x1="90" y1="20" x2="95" y2="98"/></g></svg>` },
    { label: 'スカート (赤)', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="120" viewBox="0 0 140 120"><path d="M 40 10 L 100 10 L 120 100 L 20 100 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><rect x="40" y="10" width="60" height="8" fill="#E14E7F" stroke="#2E2A47" stroke-width="1"/><g fill="#FFC93C"><circle cx="45" cy="55" r="3"/><circle cx="75" cy="65" r="3"/><circle cx="95" cy="80" r="3"/><circle cx="55" cy="85" r="3"/></g></svg>` },
    { label: 'プリーツ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="120" viewBox="0 0 140 120"><path d="M 40 10 L 100 10 L 120 100 L 20 100 Z" fill="#2E4A8B" stroke="#2E2A47" stroke-width="2"/><rect x="40" y="10" width="60" height="6" fill="#1E3A7B" stroke="#2E2A47" stroke-width="1"/><g stroke="#4A66B0" stroke-width="1"><line x1="48" y1="18" x2="42" y2="98"/><line x1="56" y1="18" x2="52" y2="98"/><line x1="64" y1="18" x2="62" y2="98"/><line x1="72" y1="18" x2="72" y2="98"/><line x1="80" y1="18" x2="82" y2="98"/><line x1="88" y1="18" x2="92" y2="98"/><line x1="96" y1="18" x2="102" y2="98"/></g></svg>` }
  ],
  top: [
    { label: 'Tシャツ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="130" viewBox="0 0 140 130"><path d="M 40 20 L 55 10 L 65 20 L 75 20 L 85 10 L 100 20 L 120 40 L 110 60 L 100 55 L 100 120 L 40 120 L 40 55 L 30 60 L 20 40 Z" fill="#FFFFFF" stroke="#2E2A47" stroke-width="2"/><path d="M 55 10 L 65 20 L 75 20 L 85 10" stroke="#2E2A47" stroke-width="1.5" fill="none"/></svg>` },
    { label: 'Tシャツ (縞)', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="130" viewBox="0 0 140 130"><path d="M 40 20 L 55 10 L 65 20 L 75 20 L 85 10 L 100 20 L 120 40 L 110 60 L 100 55 L 100 120 L 40 120 L 40 55 L 30 60 L 20 40 Z" fill="#FFFFFF" stroke="#2E2A47" stroke-width="2"/><g fill="#5AB8FF"><rect x="40" y="70" width="60" height="8"/><rect x="40" y="88" width="60" height="8"/><rect x="40" y="106" width="60" height="8"/></g><path d="M 55 10 L 65 20 L 75 20 L 85 10" stroke="#2E2A47" stroke-width="1.5" fill="none"/></svg>` },
    { label: 'パーカー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="150" viewBox="0 0 140 150"><path d="M 30 40 L 45 15 L 60 5 L 80 5 L 95 15 L 110 40 L 120 55 L 108 70 L 108 140 L 32 140 L 32 70 L 20 55 Z" fill="#4CD4B0" stroke="#2E2A47" stroke-width="2"/><path d="M 45 15 Q 70 30 95 15 L 90 40 L 50 40 Z" fill="#3AB498" stroke="#2E2A47" stroke-width="1.5"/><path d="M 60 5 L 60 30 M 80 5 L 80 30" stroke="#FFF" stroke-width="2"/><rect x="55" y="80" width="30" height="18" fill="#3AB498" stroke="#2E2A47" stroke-width="1.5" rx="3"/></svg>` }
  ],
  shoes: [
    { label: 'スニーカー', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><path d="M 15 40 L 20 20 L 45 15 L 70 25 L 100 30 L 105 45 L 100 50 L 15 50 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><path d="M 15 45 L 105 45 L 105 50 L 15 50 Z" fill="#FFFFFF" stroke="#2E2A47" stroke-width="1.5"/><g stroke="#FFFFFF" stroke-width="2" fill="none"><path d="M 30 22 L 38 30"/><path d="M 40 20 L 48 28"/><path d="M 50 18 L 58 26"/></g><circle cx="60" cy="30" r="2" fill="#FFF"/></svg>` },
    { label: 'スニーカー (白)', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><path d="M 15 40 L 20 20 L 45 15 L 70 25 L 100 30 L 105 45 L 100 50 L 15 50 Z" fill="#FFFFFF" stroke="#2E2A47" stroke-width="2"/><path d="M 15 45 L 105 45 L 105 50 L 15 50 Z" fill="#2E2A47" stroke="#2E2A47" stroke-width="1.5"/><g stroke="#2E2A47" stroke-width="2" fill="none"><path d="M 30 22 L 38 30"/><path d="M 40 20 L 48 28"/><path d="M 50 18 L 58 26"/></g></svg>` },
    { label: 'ブーツ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120"><path d="M 25 5 L 65 5 L 65 80 L 85 80 L 90 100 L 85 110 L 15 110 L 15 90 L 25 80 Z" fill="#8B6B3F" stroke="#2E2A47" stroke-width="2"/><path d="M 15 100 L 90 100 L 90 110 L 15 110 Z" fill="#2E2A47"/><g stroke="#B78C5A" stroke-width="1"><line x1="30" y1="25" x2="60" y2="25"/><line x1="30" y1="45" x2="60" y2="45"/><line x1="30" y1="65" x2="60" y2="65"/></g></svg>` }
  ],
  hat: [
    { label: 'ぼうし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80"><ellipse cx="70" cy="65" rx="60" ry="10" fill="#7C6FF2" stroke="#2E2A47" stroke-width="2"/><path d="M 35 65 Q 35 20 70 15 Q 105 20 105 65 Z" fill="#9D91FF" stroke="#2E2A47" stroke-width="2"/><rect x="35" y="55" width="70" height="8" fill="#5D51CC"/><circle cx="70" cy="55" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` },
    { label: 'キャップ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="70" viewBox="0 0 140 70"><path d="M 20 45 Q 70 5 120 45 L 120 55 L 20 55 Z" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/><path d="M 20 55 L 20 65 L 130 65 L 120 55 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><circle cx="70" cy="30" r="8" fill="#FFF" stroke="#2E2A47" stroke-width="1.5"/><text x="70" y="35" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="12" fill="#E14E7F">M</text></svg>` },
    { label: 'ふゆ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="120" viewBox="0 0 140 120"><path d="M 30 60 Q 70 15 110 60 L 115 90 Q 70 100 25 90 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><rect x="25" y="85" width="90" height="15" fill="#FFFFFF" stroke="#2E2A47" stroke-width="1.5"/><g fill="#2E2A47"><rect x="35" y="88" width="4" height="9"/><rect x="55" y="88" width="4" height="9"/><rect x="75" y="88" width="4" height="9"/><rect x="95" y="88" width="4" height="9"/></g><circle cx="115" cy="20" r="15" fill="#FFFFFF" stroke="#2E2A47" stroke-width="1.5"/></svg>` }
  ],
  bag: [
    { label: 'リュック', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><path d="M 20 20 Q 20 10 30 10 L 70 10 Q 80 10 80 20 L 80 130 L 20 130 Z" fill="#5AB8FF" stroke="#2E2A47" stroke-width="2"/><rect x="30" y="35" width="40" height="55" fill="#4A9ED8" stroke="#2E2A47" stroke-width="1.5" rx="4"/><rect x="35" y="45" width="30" height="15" fill="#FFFFFF" stroke="#2E2A47" stroke-width="1"/><path d="M 20 20 L 5 25 L 5 90 L 20 100" stroke="#2E2A47" stroke-width="2" fill="none"/><path d="M 80 20 L 95 25 L 95 90 L 80 100" stroke="#2E2A47" stroke-width="2" fill="none"/></svg>` },
    { label: 'かばん', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><rect x="15" y="30" width="70" height="45" fill="#FF9EBB" stroke="#2E2A47" stroke-width="2" rx="5"/><path d="M 30 30 Q 30 10 50 10 Q 70 10 70 30" stroke="#2E2A47" stroke-width="2" fill="none"/><circle cx="50" cy="50" r="6" fill="#FFC93C" stroke="#2E2A47" stroke-width="1.5"/></svg>` }
  ]
};

export const CLOTHING_CATEGORIES = [
  { key: 'dress', icon: '👗', label: 'ワンピース' },
  { key: 'skirt', icon: '🩱', label: 'スカート' },
  { key: 'top',   icon: '👕', label: 'トップス' },
  { key: 'shoes', icon: '👟', label: 'くつ' },
  { key: 'hat',   icon: '🎩', label: 'ぼうし' },
  { key: 'bag',   icon: '🎒', label: 'かばん' }
];


// ============================================================
// フェーズ4: 育成システム (ステータス・お世話)
// ============================================================
// avatar / madeup / look ドキュメントに以下フィールドが乗る想定:
//   stats: {
//     onaka, kiyoraka, genki, heart, kashikosa, exp, level
//   }
//   lastCareAt: Timestamp | number (ms)
// stats 未設定の既存ドキュメントは DEFAULT_STATS で扱う（後方互換）。

/** ステータスの初期値。既存アバターも読込時にこれで正規化される。 */
export const DEFAULT_STATS = Object.freeze({
  onaka: 100,     // 0-100 おなか
  kiyoraka: 100,  // 0-100 きよらか
  genki: 100,     // 0-100 げんき
  heart: 100,     // 0-100 ハート
  kashikosa: 0,   // 0- かしこさ（減らない）
  exp: 0,         // 経験値
  level: 1
});

/**
 * ステータス定義。減衰は「1時間あたり」の減り値。floor は下限。
 * ゆるめ設定: 3日で「お世話して」、7日で「しょんぼり」まで。絶対に 0 にならない。
 */
export const STAT_META = [
  { key: 'onaka',     icon: '🍚', label: 'おなか',   decayPerHour: 1.0, floor: 15, color: '#FFB347' },
  { key: 'kiyoraka',  icon: '🫧', label: 'きよらか', decayPerHour: 0.5, floor: 20, color: '#5AB8FF' },
  { key: 'genki',     icon: '⚡', label: 'げんき',   decayPerHour: 0.5, floor: 25, color: '#FFC93C' },
  { key: 'heart',     icon: '💗', label: 'ハート',   decayPerHour: 0.2, floor: 30, color: '#FF6B9D' },
  { key: 'kashikosa', icon: '🧠', label: 'かしこさ', decayPerHour: 0,   floor: 0,  color: '#B77FE0' }
];

/** お世話アクション定義。 */
export const CARE_ACTIONS = [
  { key: 'feed',  icon: '🍎', label: 'ごはん', effect: { onaka: 40 },    exp: 5, cooldownSec: 0,  msg: 'おいしい〜！ 🍎' },
  { key: 'bath',  icon: '🛁', label: 'おふろ', effect: { kiyoraka: 50 }, exp: 5, cooldownSec: 0,  msg: 'さっぱり！ 🫧' },
  { key: 'sleep', icon: '😴', label: 'ねる',   effect: { genki: 40 },    exp: 3, cooldownSec: 0,  msg: 'ぐっすり… 💤' },
  { key: 'pet',   icon: '🤗', label: 'なでる', effect: { heart: 20 },    exp: 2, cooldownSec: 30, msg: 'えへへ ♪' }
];

/** 生の stats を正規化。未設定フィールドはデフォルトで埋め、範囲外はクランプ。
 *  level は必ず exp から算出（保存されている level は無視、表示用の派生値扱い）。 */
export function normalizeStats(raw) {
  const s = { ...DEFAULT_STATS };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULT_STATS)) {
      const v = raw[k];
      if (typeof v === 'number' && isFinite(v)) s[k] = v;
    }
  }
  for (const k of ['onaka', 'kiyoraka', 'genki', 'heart']) {
    s[k] = Math.max(0, Math.min(100, s[k]));
  }
  s.kashikosa = Math.max(0, s.kashikosa);
  s.exp = Math.max(0, s.exp);
  s.level = calcLevel(s.exp).level;
  return s;
}

/** Firestore Timestamp | number | undefined を ms に変換。無効なら null。 */
export function readLastCareAtMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && isFinite(raw)) return raw;
  if (typeof raw.toMillis === 'function') {
    try { return raw.toMillis(); } catch (e) { /* ignore */ }
  }
  if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  return null;
}

/**
 * lastCareAt からの経過時間で stats を減衰させる。
 * @param {object} stats - 正規化ずみ stats
 * @param {number|null} lastCareAtMs
 * @param {number} nowMs
 * @returns {{stats: object, hours: number}}
 */
export function applyStatsDecay(stats, lastCareAtMs, nowMs = Date.now()) {
  const s = { ...stats };
  if (!lastCareAtMs || lastCareAtMs > nowMs) return { stats: s, hours: 0 };
  const hours = (nowMs - lastCareAtMs) / 3600000;
  if (hours < 0.05) return { stats: s, hours: 0 }; // 3分未満は無視
  for (const meta of STAT_META) {
    if (meta.decayPerHour <= 0) continue;
    const newVal = s[meta.key] - meta.decayPerHour * hours;
    s[meta.key] = Math.max(meta.floor, newVal);
  }
  return { stats: s, hours };
}

/**
 * お世話アクションを適用（1回分）。
 * @returns {{stats, expGained, leveledUp, oldLevel, newLevel, action}}
 */
export function applyCareAction(stats, actionKey) {
  const action = CARE_ACTIONS.find(a => a.key === actionKey);
  if (!action) return { stats, expGained: 0, leveledUp: false, oldLevel: stats.level, newLevel: stats.level, action: null };
  const s = { ...stats };
  for (const [k, v] of Object.entries(action.effect)) {
    s[k] = Math.max(0, Math.min(100, (s[k] || 0) + v));
  }
  // level は exp からの派生値なので、caring 前の真の level を再計算してから比較
  const oldLevel = calcLevel(s.exp || 0).level;
  s.exp = (s.exp || 0) + action.exp;
  s.level = calcLevel(s.exp).level;
  return {
    stats: s,
    expGained: action.exp,
    leveledUp: s.level > oldLevel,
    oldLevel,
    newLevel: s.level,
    action
  };
}

/**
 * exp → レベル計算。
 *   level = floor(sqrt(exp / 20)) + 1
 *   Lv2 で 80 exp、Lv5 で 500 exp、Lv10 で 2000 exp くらい。
 */
export function calcLevel(exp) {
  const e = Math.max(0, exp || 0);
  const level = Math.floor(Math.sqrt(e / 20)) + 1;
  const curThreshold = (level - 1) * (level - 1) * 20;
  const nextThreshold = level * level * 20;
  const inLevel = e - curThreshold;
  const span = Math.max(1, nextThreshold - curThreshold);
  return {
    level,
    curThreshold,
    nextThreshold,
    inLevel,
    span,
    pct: Math.min(100, Math.max(0, (inLevel / span) * 100))
  };
}

/** ステータスの状態バンド。UI 色分けに使う。 */
export function getStatBand(value) {
  if (value >= 50) return 'good';
  if (value >= 20) return 'warn';
  return 'bad';
}

/** stats の平均元気度から気分を返す（吹き出し等用）。 */
export function getMood(stats) {
  const care = [stats.onaka, stats.kiyoraka, stats.genki, stats.heart];
  const avg = care.reduce((a, b) => a + b, 0) / care.length;
  if (avg >= 80) return { key: 'happy',   icon: '😊', msg: 'たのしい！' };
  if (avg >= 60) return { key: 'ok',      icon: '🙂', msg: 'げんき！' };
  if (avg >= 40) return { key: 'meh',     icon: '😐', msg: 'ちょっと…' };
  if (avg >= 25) return { key: 'sad',     icon: '😢', msg: 'さみしい…' };
  return          { key: 'sleepy',  icon: '😪', msg: 'しょんぼり…' };
}

// ============================================================
// フェーズ5: Gold 経済 - UI ヘルパー
// ============================================================

/**
 * 全画面共通の Gold バッジをヘッダーに設置し、Firestore 監視で残高更新する。
 * ピッカー未選択時はピッカーを開き、選択後にバッジを有効化する。
 * 自動的に「連続ログインボーナス」も判定する。
 *
 * @param {object} deps - firebase.js のヘルパー群を注入
 *   { isAllowanceConfigured, getStoredChildKey, setStoredChildKey,
 *     watchAllowance, listAllowanceChildren, earnGold, updateAllowanceChild }
 * @param {HTMLElement} headerEl - バッジを追加する場所（通常 <header>）
 * @param {HTMLElement} insertBefore - このボタンの前に挿入（省略なら末尾）
 * @returns {object} { getGold, getChildKey, openChildPicker, awardSaveBonus }
 */
export function setupGoldBadge(deps, headerEl, insertBefore = null) {
  const {
    isAllowanceConfigured, getStoredChildKey, setStoredChildKey,
    watchAllowance, listAllowanceChildren,
    earnGold, updateAllowanceChild
  } = deps;

  // バッジ本体
  const badge = document.createElement('button');
  badge.className = 'gold-badge';
  badge.type = 'button';
  badge.title = 'ゴールド残高';
  badge.innerHTML = `<span class="gold-icon">💰</span><span class="gold-amount">--</span><span>G</span>`;
  if (insertBefore && insertBefore.parentNode === headerEl) {
    headerEl.insertBefore(badge, insertBefore);
  } else {
    headerEl.appendChild(badge);
  }

  let currentGold = 0;
  let currentChildKey = getStoredChildKey();
  let unsubscribe = null;
  let streakChecked = false;
  const amountEl = badge.querySelector('.gold-amount');

  if (!isAllowanceConfigured) {
    return {
      getGold: () => 0,
      getChildKey: () => null,
      openChildPicker: () => Promise.resolve(null),
      awardSaveBonus: async () => 0
    };
  }

  function updateBadge(gold) {
    currentGold = gold;
    amountEl.textContent = gold;
    badge.classList.add('show');
  }

  /** YYYY-MM-DD 文字列 */
  function ymd(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  /** 昨日の YYYY-MM-DD */
  function yesterdayYmd() {
    return ymd(Date.now() - 24*60*60*1000);
  }

  /** 連続ログインボーナス判定 */
  async function checkLoginStreak(childData) {
    if (streakChecked || !earnGold || !updateAllowanceChild) return;
    streakChecked = true;
    const today = ymd(Date.now());
    const lastYmd = childData.avatarAppLastLoginYmd || null;
    if (lastYmd === today) return; // 今日はもう貰った
    let streak = childData.avatarAppLoginStreak || 0;
    if (lastYmd === yesterdayYmd()) {
      streak += 1; // 連続維持
    } else {
      streak = 1; // リセット
    }
    let bonus = 2; // 通常 +2G
    let msg = 'まいにち ログイン ボーナス';
    if (streak === 7) {
      bonus = 12; // 7日目は 2 + 10 の 12G
      msg = '7れんぞく！ すごい！ +10G ボーナス';
    } else if (streak > 7 && streak % 7 === 0) {
      // 14日、21日... も同じサプライズ
      bonus = 12;
      msg = `${streak}れんぞく！ 大きなボーナス！`;
    }
    try {
      await earnGold(currentChildKey, bonus, msg);
      await updateAllowanceChild(currentChildKey, {
        avatarAppLastLoginYmd: today,
        avatarAppLoginStreak: streak
      });
      showGoldFly(bonus);
      showToast(`🌟 ${msg} +${bonus}G！`, 2400);
    } catch (err) {
      console.warn('ログインボーナス失敗', err);
    }
  }

  function watchForChild(key) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!key) { badge.classList.remove('show'); return; }
    unsubscribe = watchAllowance(data => {
      if (!data) return;
      const child = (data.children || {})[key];
      if (!child) {
        setStoredChildKey(null);
        currentChildKey = null;
        badge.classList.remove('show');
        openChildPicker();
        return;
      }
      updateBadge(child.gold || 0);
      // 初回スナップで連続ログイン判定
      checkLoginStreak(child);
    });
  }

  // ==== ピッカーモーダル ====
  function ensurePickerModal() {
    let modal = document.getElementById('childPickerBackdrop');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'child-picker-backdrop';
    modal.id = 'childPickerBackdrop';
    modal.innerHTML = `
      <div class="child-picker-card">
        <h3>👋 あなたは だれ？</h3>
        <p class="sub">おこづかいの きろく と つなげるよ。<br>したから えらんでね</p>
        <div class="child-picker-grid" id="childPickerGrid"></div>
        <button class="skip-btn" id="childPickerSkip">きょうは スキップ</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#childPickerSkip').addEventListener('click', () => {
      modal.classList.remove('show');
    });
    return modal;
  }

  async function openChildPicker() {
    const modal = ensurePickerModal();
    const grid = modal.querySelector('#childPickerGrid');
    grid.innerHTML = '<p class="empty">よみこみ ちゅう...</p>';
    modal.classList.add('show');
    let list = [];
    try {
      list = await listAllowanceChildren();
    } catch (e) {
      console.warn('children 取得失敗', e);
      grid.innerHTML = '<p class="empty">おこづかいアプリと つながらなかったよ 😢</p>';
      return null;
    }
    if (list.length === 0) {
      grid.innerHTML = '<p class="empty">おこづかいアプリ に あなたの データがないよ<br>おうちのひとに たのんでね</p>';
      return null;
    }
    grid.innerHTML = '';
    return new Promise(resolve => {
      list.forEach(c => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'child-picker-item';
        item.innerHTML = `
          <div class="avatar-emoji">${c.avatar || '🧒'}</div>
          <div class="name">${c.name}</div>
          <div class="gold-info">💰 ${c.gold} G</div>
        `;
        item.addEventListener('click', () => {
          setStoredChildKey(c.key);
          currentChildKey = c.key;
          streakChecked = false;
          modal.classList.remove('show');
          watchForChild(c.key);
          resolve(c.key);
        });
        grid.appendChild(item);
      });
    });
  }

  /**
  * 「保存で +1G」ボーナス。1日に最大 3 回まで。
   * @param {string} what - 何を保存したか（履歴に残る）
   * @returns {Promise<number>} 支払われた G。既に上限なら 0
   */
  async function awardSaveBonus(what = 'あたらしい え') {
    if (!currentChildKey || !earnGold) return 0;
    const LS_KEY = 'avatarApp_saveBonus_' + ymd(Date.now());
    let count = 0;
    try { count = Number(localStorage.getItem(LS_KEY) || 0); } catch (e) {}
    if (count >= 3) return 0;
    try {
      await earnGold(currentChildKey, 1, `${what} を ほぞん`);
      localStorage.setItem(LS_KEY, String(count + 1));
      showGoldFly(1);
      return 1;
    } catch (err) {
      console.warn('保存ボーナス失敗', err);
      return 0;
    }
  }

  // バッジタップでピッカーを開く（お子さん切替）
  badge.addEventListener('click', () => openChildPicker());

  // 初期化: childKey があれば即監視、無ければピッカー
  if (currentChildKey) {
    watchForChild(currentChildKey);
  } else {
    setTimeout(() => openChildPicker(), 800);
  }

  return {
    getGold: () => currentGold,
    getChildKey: () => currentChildKey,
    openChildPicker,
    awardSaveBonus,
    refreshBadge: () => amountEl && (amountEl.textContent = currentGold)
  };
}

/**
 * 「+2G」等が浮かんで消えるエフェクト。
 * @param {number} amount - 正なら earn 演出、負なら spend
 * @param {number} x - 画面 X 座標（省略時は中央）
 * @param {number} y - 画面 Y 座標（省略時は中央上）
 */
export function showGoldFly(amount, x = null, y = null) {
  const el = document.createElement('div');
  el.className = 'gold-fly ' + (amount >= 0 ? 'earn' : 'spend');
  el.textContent = (amount >= 0 ? '+' : '') + amount + 'G';
  el.style.left = (x ?? window.innerWidth / 2) + 'px';
  el.style.top  = (y ?? window.innerHeight / 3) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
  // バッジも軽くパルス
  const badge = document.querySelector('.gold-badge.show');
  if (badge) {
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }
}

// ============================================================
// ソクラテス先生（learn.html）のクイックトピック プール
// ============================================================
// 「毎日新しく」を体感してもらうため、日付シードで固定4個を毎日入れ替える。
// question: ソクラテス先生に渡す質問文（data-q 相当）
// label:    ボタンに表示する短いラベル
// icon:     絵文字アイコン
export const SOCRATES_TOPIC_POOL = [
  { icon: '🌤️', label: 'そら の いろ', question: 'どうして そらは あおいの？' },
  { icon: '❄️', label: 'ふゆの さむさ', question: 'どうして 冬は さむいの？' },
  { icon: '🐕', label: 'いぬの しっぽ', question: 'どうして 犬は しっぽを ふるの？' },
  { icon: '🌙', label: 'おつきさま', question: 'どうして お月さまは かたちが かわるの？' },
  { icon: '🌈', label: 'にじ', question: 'どうして 雨のあとに にじが でるの？' },
  { icon: '⭐', label: 'ほし の ひかり', question: 'どうして 夜空の ほしは キラキラ ひかるの？' },
  { icon: '🌊', label: 'うみ の しょっぱさ', question: 'どうして 海の水は しょっぱいの？' },
  { icon: '🍃', label: 'はっぱ の いろ', question: 'どうして 秋に なると はっぱの いろが かわるの？' },
  { icon: '🐦', label: 'とり は とべる', question: 'どうして 鳥は そらを とべるの？' },
  { icon: '🐟', label: 'さかな の いき', question: 'どうして さかなは 水の中で いきが できるの？' },
  { icon: '🦋', label: 'ちょうちょ', question: 'どうして いもむしは ちょうちょに なるの？' },
  { icon: '🐱', label: 'ねこ の め', question: 'どうして ねこの めは くらいところで ひかるの？' },
  { icon: '🐘', label: 'ぞうの はな', question: 'どうして ぞうの はなは ながいの？' },
  { icon: '🦒', label: 'きりんの くび', question: 'どうして きりんの くびは ながいの？' },
  { icon: '🕷️', label: 'くも の す', question: 'どうして くもの すは くっつかないの？' },
  { icon: '🐝', label: 'はち と みつ', question: 'どうして はちみつは あまいの？' },
  { icon: '🌱', label: 'たね から め', question: 'どうして たねから め が でるの？' },
  { icon: '🌸', label: 'はな の におい', question: 'どうして はなには いい におい が あるの？' },
  { icon: '🌳', label: 'き の たかさ', question: 'どうして 木は あんなに たかく なれるの？' },
  { icon: '🍎', label: 'りんご の いろ', question: 'どうして りんごは あかくなるの？' },
  { icon: '🍚', label: 'ごはん の げんき', question: 'どうして ごはんを たべると げんきが でるの？' },
  { icon: '🦷', label: 'は が ぬける', question: 'どうして こどもの はは ぬけかわるの？' },
  { icon: '😪', label: 'ねむい わけ', question: 'どうして よるに なると ねむくなるの？' },
  { icon: '🤧', label: 'くしゃみ', question: 'どうして くしゃみが でるの？' },
  { icon: '❤️', label: 'しんぞう', question: 'どうして しんぞうは ずっと うごいているの？' },
  { icon: '👣', label: 'あくび が うつる', question: 'どうして あくびは ひとに うつるの？' },
  { icon: '🩹', label: 'かさぶた', question: 'どうして きずは かさぶたに なるの？' },
  { icon: '🌩️', label: 'かみなり', question: 'どうして かみなりは ゴロゴロ おとが するの？' },
  { icon: '🌪️', label: 'たつまき', question: 'どうして たつまきは できるの？' },
  { icon: '🔥', label: 'ひ の いろ', question: 'どうして ひは あかく ひかるの？' },
  { icon: '🧊', label: 'こおり が うく', question: 'どうして こおりは 水に うくの？' },
  { icon: '💧', label: 'あめ の しずく', question: 'どうして あめは まるい しずくに なるの？' },
  { icon: '🌫️', label: 'きり', question: 'どうして あさは きりが でるの？' },
  { icon: '🏔️', label: 'やま の てっぺん', question: 'どうして たかい やまの うえは さむいの？' },
  { icon: '🌋', label: 'かざん', question: 'どうして かざんは けむりを だすの？' },
  { icon: '🚗', label: 'くるま が うごく', question: 'どうして くるまは ガソリンで うごくの？' },
  { icon: '✈️', label: 'ひこうき が とぶ', question: 'どうして ひこうきは そらを とべるの？' },
  { icon: '🚀', label: 'ロケット', question: 'どうして ロケットは うちゅうに いけるの？' },
  { icon: '🧲', label: 'じしゃく', question: 'どうして じしゃくは くっつくの？' },
  { icon: '💡', label: 'でんき', question: 'どうして でんきを つけると あかるくなるの？' },
  { icon: '📱', label: 'でんわ で はなす', question: 'どうして スマホで とおくの ひとと はなせるの？' },
  { icon: '🪞', label: 'かがみ', question: 'どうして かがみには じぶんが うつるの？' },
  { icon: '🎈', label: 'ふうせん が とぶ', question: 'どうして ふうせんは そらに とんでいくの？' },
  { icon: '🫧', label: 'しゃぼんだま', question: 'どうして しゃぼんだまは まるいの？' },
  { icon: '🎵', label: 'おと', question: 'どうして たいこを たたくと おとが でるの？' },
  { icon: '👂', label: 'こだま', question: 'どうして やまで さけぶと こだまが かえってくるの？' },
  { icon: '🕰️', label: 'じかん', question: 'どうして とけいは いつも おなじ はやさで すすむの？' },
  { icon: '🌍', label: 'ちきゅう が まわる', question: 'どうして ちきゅうは まわっているの？' },
  { icon: '☀️', label: 'たいよう', question: 'どうして たいようは あつくて まぶしいの？' },
  { icon: '🕳️', label: 'よる が くる', question: 'どうして ひると よるが あるの？' },
  { icon: '🐢', label: 'かめ の こうら', question: 'どうして かめは こうらを せおっているの？' },
  { icon: '🐧', label: 'ペンギン', question: 'どうして ペンギンは そらを とべないの？' },
  { icon: '🦈', label: 'さめ の は', question: 'どうして さめの はは たくさん あるの？' },
  { icon: '🍯', label: 'はちみつ が くさらない', question: 'どうして はちみつは くさらないの？' },
  { icon: '🧀', label: 'チーズ', question: 'どうして ミルクから チーズが できるの？' },
  { icon: '🍞', label: 'パン が ふくらむ', question: 'どうして パンは やくと ふくらむの？' },
  { icon: '🦷', label: 'あめ で むしば', question: 'どうして あめを たべすぎると むしばに なるの？' },
  { icon: '📚', label: 'ほん の かみ', question: 'どうして ほんは かみで できているの？' },
  { icon: '🖍️', label: 'いろ が まざる', question: 'どうして いろを まぜると べつの いろに なるの？' }
];

/** 日付文字列（YYYYMMDD）から決定的な擬似乱数を作る簡易ハッシュ */
function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return function () {
    // xorshift 風の簡易 PRNG。呼ぶたびに 0〜1 の値を返す
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return (h % 100000) / 100000;
  };
}

/**
 * 日付シードで SOCRATES_TOPIC_POOL から count 個を決定的に抽出する。
 * 同じ日なら誰がアクセスしても同じ組み合わせ、日付が変われば入れ替わる。
 * @param {number} count - 抽出する個数（既定 4）
 * @param {Date} [date] - 基準日（省略時は今日。テスト用）
 * @returns {Array<{icon:string,label:string,question:string}>}
 */
export function getDailyTopics(count = 4, date = new Date()) {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = seededRandom(ymd);
  const pool = SOCRATES_TOPIC_POOL.slice();
  // Fisher-Yatesで決定的シャッフル
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
