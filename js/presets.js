/** Academic style presets */

import { adjustColor } from './colorUtils.js';

export const STYLE_PRESETS = {
  nature: {
    label: 'Nature 风格',
    description: '低饱和、专业、适合期刊',
    transform: (colors) => colors.map(c => adjustColor(c, { saturation: -25, brightness: -5 })),
  },
  science: {
    label: 'Science 风格',
    description: '高对比、清晰区分',
    transform: (colors) => colors.map(c => adjustColor(c, { saturation: -10, brightness: 0 })),
  },
  morandi: {
    label: '莫兰迪',
    description: '柔和灰调、高级感',
    transform: (colors) => colors.map(c => adjustColor(c, { saturation: -40, brightness: 5 })),
  },
  vibrant: {
    label: '鲜艳海报',
    description: '高饱和、视觉冲击',
    transform: (colors) => colors.map(c => adjustColor(c, { saturation: 20, brightness: 5 })),
  },
  print: {
    label: '印刷友好',
    description: '适合黑白打印识别',
    transform: (colors) => colors.map(c => adjustColor(c, { saturation: -15, brightness: -10 })),
  },
  original: {
    label: '原图提取',
    description: '不做风格调整',
    transform: (colors) => [...colors],
  },
};

export const EXAMPLE_IMAGES = [
  {
    id: 'sunset',
    name: '日落渐变',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6B6B"/><stop offset="50%" stop-color="#FFE66D"/><stop offset="100%" stop-color="#4ECDC4"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/></svg>`,
  },
  {
    id: 'ocean',
    name: '海洋蓝',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0077B6"/><stop offset="100%" stop-color="#90E0EF"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="300" cy="80" r="40" fill="#FFD166" opacity="0.8"/></svg>`,
  },
  {
    id: 'forest',
    name: '森林绿',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#2D6A4F"/><rect x="0" y="180" width="400" height="120" fill="#40916C"/><rect x="50" y="100" width="80" height="200" fill="#1B4332"/><rect x="200" y="60" width="60" height="240" fill="#52B788"/><circle cx="320" cy="200" r="50" fill="#95D5B2"/></svg>`,
  },
  {
    id: 'abstract',
    name: '抽象艺术',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#F8F9FA"/><circle cx="100" cy="150" r="80" fill="#E63946"/><circle cx="200" cy="120" r="70" fill="#457B9D"/><circle cx="300" cy="180" r="90" fill="#F4A261"/><circle cx="250" cy="250" r="60" fill="#2A9D8F"/></svg>`,
  },
  {
    id: 'paper',
    name: '论文经典',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#FFFFFF"/><rect x="40" y="40" width="60" height="180" fill="#2166AC"/><rect x="120" y="80" width="60" height="140" fill="#D6604D"/><rect x="200" y="60" width="60" height="160" fill="#4DAF4A"/><rect x="280" y="100" width="60" height="120" fill="#984EA3"/><line x1="30" y1="230" x2="370" y2="230" stroke="#333" stroke-width="2"/></svg>`,
  },
  {
    id: 'cyber',
    name: '赛博朋克',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#0D0221"/><rect x="0" y="0" width="400" height="150" fill="#FF006E" opacity="0.3"/><rect x="100" y="50" width="200" height="200" fill="#8338EC" opacity="0.6"/><rect x="150" y="100" width="100" height="100" fill="#3A86FF"/><text x="200" y="280" text-anchor="middle" fill="#FB5607" font-size="24" font-family="monospace">NEON</text></svg>`,
  },
];

export function svgToDataUrl(svg) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
