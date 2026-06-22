/** Palette import/export and share-link helpers. */

const HEX_RE = /#?[0-9a-f]{6}\b|#?[0-9a-f]{3}\b/gi;

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map(ch => ch + ch).join('');
  return `#${hex.toUpperCase()}`;
}

function normalizeColors(values) {
  const colors = values
    .map(value => normalizeHex(typeof value === 'string' ? value : value?.hex))
    .filter(Boolean);
  return [...new Set(colors)].slice(0, 16);
}

function parseJsonPalette(text) {
  const data = JSON.parse(text);
  const values = Array.isArray(data) ? data : data?.colors;
  if (!Array.isArray(values)) return [];

  return normalizeColors(values.map(value => {
    if (typeof value === 'string' || value?.hex) return value;
    const color = value?.color;
    if (!color || ![color.r, color.g, color.b].every(Number.isFinite)) return null;
    const channel = n => Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16).padStart(2, '0');
    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  }));
}

function parseGplPalette(text) {
  if (!/^GIMP Palette/im.test(text)) return [];
  const colors = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/);
    if (!match) continue;
    const hex = match.slice(1, 4)
      .map(value => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, '0'))
      .join('');
    colors.push(`#${hex}`);
  }
  return normalizeColors(colors);
}

export function parsePaletteText(text) {
  const source = String(text || '').trim();
  if (!source) throw new Error('请输入色板内容或选择文件');

  if (/^[\[{]/.test(source)) {
    try {
      const colors = parseJsonPalette(source);
      if (colors.length) return colors;
    } catch {
      // Continue with GPL/HEX parsing for friendly fallback behavior.
    }
  }

  const gplColors = parseGplPalette(source);
  if (gplColors.length) return gplColors;

  const colors = normalizeColors(source.match(HEX_RE) || []);
  if (colors.length) return colors;
  throw new Error('未识别到颜色；支持 JSON、GPL 或 HEX 列表');
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

export function buildShareUrl(colors) {
  const payload = JSON.stringify({ v: 1, colors: normalizeColors(colors) });
  const encoded = bytesToBase64(new TextEncoder().encode(payload));
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('palette', encoded);
  return url.toString();
}

export function readSharedPalette() {
  const encoded = new URL(window.location.href).searchParams.get('palette');
  if (!encoded) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64ToBytes(encoded)));
    const colors = normalizeColors(payload?.colors || []);
    return colors.length ? colors : null;
  } catch {
    return null;
  }
}
