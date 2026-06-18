/** Color conversion and manipulation utilities */

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

/** 调色时避免滑到纯白/纯黑/纯灰 */
const ADJUST_MIN_LIGHTNESS = 16;
const ADJUST_MAX_LIGHTNESS = 84;
const ADJUST_MIN_SATURATION = 14;

export function adjustColor(hex, { saturation = 0, brightness = 0 } = {}) {
  const { r, g, b } = hexToRgb(hex);
  let { h, s, l } = rgbToHsl(r, g, b);
  const origS = s;

  s = s + saturation;
  l = l + brightness;

  // 原本有色彩的，不允许完全去饱和成灰
  if (origS >= 6) {
    s = Math.max(ADJUST_MIN_SATURATION, s);
  }
  s = Math.max(0, Math.min(100, s));

  // 明度限制在安全区间，避免 #FFF / #000
  l = Math.max(ADJUST_MIN_LIGHTNESS, Math.min(ADJUST_MAX_LIGHTNESS, l));

  const rgb = hslToRgb(h, s, l);
  let result = rgbToHex(rgb.r, rgb.g, rgb.b);

  // 兜底：若仍变成中性色，用原色相 + 最低饱和度重建
  if (!isNeutralHex(hex) && isNeutralHex(result)) {
    s = Math.max(ADJUST_MIN_SATURATION, origS * 0.55 + ADJUST_MIN_SATURATION * 0.45);
    l = Math.max(ADJUST_MIN_LIGHTNESS, Math.min(ADJUST_MAX_LIGHTNESS, l));
    const retry = hslToRgb(h, s, l);
    result = rgbToHex(retry.r, retry.g, retry.b);
  }

  return result;
}

export function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function colorDistance(c1, c2) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function toGrayscale(hex) {
  const { r, g, b } = hexToRgb(hex);
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return rgbToHex(v, v, v);
}

export function generateGradient(baseHex, steps = 5) {
  const { r, g, b } = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const result = [];
  for (let i = 0; i < steps; i++) {
    const nl = 15 + (i / (steps - 1)) * 70;
    const rgb = hslToRgb(h, Math.max(s * 0.85, 20), nl);
    result.push(rgbToHex(rgb.r, rgb.g, rgb.b));
  }
  return result;
}

export function isNearWhiteOrBlack(r, g, b, threshold = 25) {
  if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) return true;
  if (r < threshold && g < threshold && b < threshold) return true;
  return false;
}

/**
 * 检测白/黑/灰背景（HSL + RGB 联合判断，比纯 RGB 阈值更完整）
 */
export function isNeutralBackground(r, g, b, opts = {}) {
  const maxSat = opts.maxSaturation ?? 16;
  const whiteL = opts.minWhiteLightness ?? 80;
  const blackL = opts.maxBlackLightness ?? 20;
  const rgbThreshold = opts.rgbThreshold ?? 40;

  if (isNearWhiteOrBlack(r, g, b, rgbThreshold)) return true;

  const { s, l } = rgbToHsl(r, g, b);

  // 低饱和 + 很亮 → 白、米白、浅灰背景
  if (s <= maxSat && l >= whiteL) return true;
  // 低饱和 + 很暗 → 黑、深灰
  if (s <= maxSat && l <= blackL) return true;
  // 极低饱和的中性灰（论文截图常见 #E8E8E8、#CCCCCC）
  if (s <= 10 && l >= 55 && l <= whiteL) return true;
  // 极亮即便略有色相（乳白、纸张）
  if (l >= 92 && s <= 28) return true;
  // 极暗（阴影、边框）
  if (l <= 8) return true;

  return false;
}

export function isNeutralHex(hex, opts) {
  const { r, g, b } = hexToRgb(hex);
  return isNeutralBackground(r, g, b, opts);
}

export function formatRgb(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getReadableTextColor(bgHex) {
  const white = contrastRatio(bgHex, '#ffffff');
  const black = contrastRatio(bgHex, '#000000');
  return white >= black ? '#ffffff' : '#000000';
}

export const COLOR_ROLES = ['Primary', 'Primary', 'Secondary', 'Secondary', 'Accent', 'Neutral', 'Neutral', 'Highlight'];
