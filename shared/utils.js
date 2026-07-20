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
  eye: [
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="20" fill="#fff" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="40" r="12" fill="#2E2A47"/><circle cx="44" cy="36" r="4" fill="#fff"/></svg>` },
    { label: 'キラ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="26" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><ellipse cx="40" cy="40" rx="14" ry="16" fill="#7C6FF2"/><circle cx="40" cy="40" r="7" fill="#2E2A47"/><circle cx="44" cy="34" r="5" fill="#fff"/><circle cx="34" cy="45" r="2" fill="#fff"/></svg>` },
    { label: 'ねむ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M12 42 Q40 22 68 42" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M18 40 L14 34 M28 30 L26 24 M40 26 L40 20 M52 30 L54 24 M62 40 L66 34" stroke="#2E2A47" stroke-width="3" stroke-linecap="round"/></svg>` },
    { label: 'ハート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="28" ry="22" fill="#fff" stroke="#2E2A47" stroke-width="3"/><path d="M40 52 C24 42 24 26 32 26 C36 26 40 30 40 34 C40 30 44 26 48 26 C56 26 56 42 40 52 Z" fill="#FF6B9D"/></svg>` }
  ],
  mouth: [
    { label: 'にこ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M10 20 Q40 55 70 20" stroke="#2E2A47" stroke-width="4" fill="#FF9EBB" stroke-linecap="round"/></svg>` },
    { label: 'まる', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><ellipse cx="40" cy="30" rx="14" ry="18" fill="#E14E7F" stroke="#2E2A47" stroke-width="3"/></svg>` },
    { label: 'すま', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M14 24 Q40 44 66 24" stroke="#2E2A47" stroke-width="4" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ぺろ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><path d="M14 20 Q40 45 66 20" stroke="#2E2A47" stroke-width="4" fill="#FF9EBB" stroke-linecap="round"/><path d="M46 38 Q52 50 46 52" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/></svg>` }
  ],
  nose: [
    { label: 'ちい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M30 15 Q35 40 30 45 Q25 40 30 15 Z" fill="#FFCFB8" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: '・', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="24" cy="30" r="3" fill="#2E2A47"/><circle cx="36" cy="30" r="3" fill="#2E2A47"/></svg>` },
    { label: 'v', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="M22 20 Q30 40 38 20" stroke="#2E2A47" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` }
  ],
  brow: [
    { label: 'アーチ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 20 Q40 4 70 20" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'まっすぐ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 18 L70 18" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
    { label: 'ななめ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30"><path d="M10 8 L70 22" stroke="#6B4E2E" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` }
  ],
  cheek: [
    { label: 'ほお', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="22" ry="14" fill="#FF9EBB" opacity="0.55"/></svg>` }
  ],
  hair: [
    { label: 'ながい', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M100 20 C60 20 30 60 30 110 C30 130 34 150 40 170 L60 175 L60 100 Q65 60 100 55 Q135 60 140 100 L140 175 L160 170 C166 150 170 130 170 110 C170 60 140 20 100 20 Z" fill="#6B4E2E"/></svg>` },
    { label: 'ボブ', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><path d="M100 15 C55 15 30 50 30 90 C30 105 34 120 40 130 L50 130 L50 80 Q60 55 100 50 Q140 55 150 80 L150 130 L160 130 C166 120 170 105 170 90 C170 50 145 15 100 15 Z" fill="#3E2A18"/></svg>` },
    { label: 'ツイン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200"><path d="M120 20 C80 20 55 55 55 95 C55 105 58 115 62 122 L70 122 L70 90 Q75 55 120 50 Q165 55 170 90 L170 122 L178 122 C182 115 185 105 185 95 C185 55 160 20 120 20 Z" fill="#A26B3A"/><ellipse cx="45" cy="140" rx="30" ry="55" fill="#A26B3A"/><ellipse cx="195" cy="140" rx="30" ry="55" fill="#A26B3A"/></svg>` }
  ],
  accessory: [
    { label: 'リボン', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M60 40 L20 20 L20 60 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><path d="M60 40 L100 20 L100 60 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/><circle cx="60" cy="40" r="10" fill="#E14E7F" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'かんむり', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80" viewBox="0 0 140 80"><path d="M20 60 L20 30 L40 45 L70 15 L100 45 L120 30 L120 60 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="3"/><circle cx="40" cy="45" r="5" fill="#FF6B9D"/><circle cx="70" cy="30" r="5" fill="#7C6FF2"/><circle cx="100" cy="45" r="5" fill="#4CD4B0"/></svg>` },
    { label: 'ほし', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 8 L48 30 L72 30 L52 44 L60 68 L40 54 L20 68 L28 44 L8 30 L32 30 Z" fill="#FFC93C" stroke="#2E2A47" stroke-width="2"/></svg>` },
    { label: 'ハート', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 68 C10 48 10 20 24 20 C32 20 40 28 40 36 C40 28 48 20 56 20 C70 20 70 48 40 68 Z" fill="#FF6B9D" stroke="#2E2A47" stroke-width="2"/></svg>` }
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
