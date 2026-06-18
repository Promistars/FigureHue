/** Color blindness simulation using Brettel/Vienot matrices */

import { hexToRgb, rgbToHex } from './colorUtils.js';

const MATRICES = {
  protanopia: [
    [0.56667, 0.43333, 0],
    [0.55833, 0.44167, 0],
    [0, 0.24167, 0.75833],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.43333, 0.56667],
    [0, 0.475, 0.525],
  ],
};

function applyMatrix(r, g, b, matrix) {
  return {
    r: Math.round(Math.max(0, Math.min(255, r * matrix[0][0] + g * matrix[0][1] + b * matrix[0][2]))),
    g: Math.round(Math.max(0, Math.min(255, r * matrix[1][0] + g * matrix[1][1] + b * matrix[1][2]))),
    b: Math.round(Math.max(0, Math.min(255, r * matrix[2][0] + g * matrix[2][1] + b * matrix[2][2]))),
  };
}

export function simulateColorBlindness(hex, type) {
  const matrix = MATRICES[type];
  if (!matrix) return hex;
  const { r, g, b } = hexToRgb(hex);
  const result = applyMatrix(r, g, b, matrix);
  return rgbToHex(result.r, result.g, result.b);
}

export function simulatePalette(colors, type) {
  return colors.map(c => simulateColorBlindness(c, type));
}

export const COLORBLIND_TYPES = [
  { id: 'normal', label: '正常视觉' },
  { id: 'protanopia', label: '红色盲 (Protanopia)' },
  { id: 'deuteranopia', label: '绿色盲 (Deuteranopia)' },
  { id: 'tritanopia', label: '蓝色盲 (Tritanopia)' },
];
