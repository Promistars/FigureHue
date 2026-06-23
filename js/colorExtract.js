/** K-Means color extraction from image data */

import { rgbToHex, isNeutralBackground, isNeutralHex, colorDistance, hexToRgb } from './colorUtils.js';

function distSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function kMeansPlusPlusInit(pixels, k) {
  const centroids = [[...pixels[Math.floor(Math.random() * pixels.length)]]];
  while (centroids.length < k) {
    const distances = pixels.map(p => {
      let min = Infinity;
      for (const c of centroids) min = Math.min(min, distSq(p, c));
      return min;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = pixels[0];
    for (let i = 0; i < pixels.length; i++) {
      r -= distances[i];
      if (r <= 0) { chosen = pixels[i]; break; }
    }
    centroids.push([...chosen]);
  }
  return centroids;
}

function kMeans(pixels, k, maxIter = 30) {
  if (pixels.length === 0) return [];
  k = Math.min(k, pixels.length);

  const centroids = kMeansPlusPlusInit(pixels, k);

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < k; c++) {
        const d = (pixels[i][0] - centroids[c][0]) ** 2 +
                  (pixels[i][1] - centroids[c][1]) ** 2 +
                  (pixels[i][2] - centroids[c][2]) ** 2;
        if (d < minDist) { minDist = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      sums[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  const counts = new Array(k).fill(0);
  assignments.forEach(a => counts[a]++);

  return centroids
    .map((c, i) => ({
      rgb: c,
      hex: rgbToHex(c[0], c[1], c[2]),
      weight: counts[i] / pixels.length,
      x: 0,
      y: 0,
    }))
    .filter(c => c.weight > 0.005)
    .sort((a, b) => b.weight - a.weight);
}

function filterNeutralClusters(clusters, ignoreBackground) {
  if (!ignoreBackground) return clusters;
  return clusters.filter(c => !isNeutralBackground(c.rgb[0], c.rgb[1], c.rgb[2]));
}

function filterExcluded(clusters, excludeColors, minDist = 32) {
  if (!excludeColors.length) return clusters;
  return clusters.filter(c => !excludeColors.some(ex => colorDistance(c.hex, ex) < minDist));
}

function extractClusters(pixels, count, ignoreBackground, excludeColors = []) {
  if (pixels.length === 0) return [];

  let k = count;
  let clusters = filterExcluded(
    filterNeutralClusters(kMeans(pixels, k), ignoreBackground),
    excludeColors
  );

  let attempt = 0;
  while (clusters.length < count && attempt < 5 && pixels.length > count) {
    k = Math.min(pixels.length, k + count * 2);
    const candidates = filterExcluded(
      filterNeutralClusters(kMeans(pixels, k), ignoreBackground),
      excludeColors
    );
    const seen = new Set(clusters.map(c => c.hex));
    for (const c of candidates) {
      if (!seen.has(c.hex)) {
        seen.add(c.hex);
        clusters.push(c);
      }
    }
    clusters.sort((a, b) => b.weight - a.weight);
    attempt++;
  }

  return clusters.slice(0, count);
}

function samplePixels(imageData, step = 4) {
  const { data, width, height } = imageData;
  const pixels = [];
  const positions = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
      positions.push({ x, y });
    }
  }
  return { pixels, positions, width, height, step };
}

function assignSamplePoints(clusters, pixels, positions, width, height, step) {
  clusters.forEach(cluster => {
    let bestDist = Infinity;
    let bestPos = { x: width / 2, y: height / 2 };
    for (let i = 0; i < pixels.length; i++) {
      const d = (pixels[i][0] - cluster.rgb[0]) ** 2 +
                (pixels[i][1] - cluster.rgb[1]) ** 2 +
                (pixels[i][2] - cluster.rgb[2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestPos = positions[i];
      }
    }
    cluster.x = bestPos.x;
    cluster.y = bestPos.y;
  });
  return clusters;
}

export function extractColorsFromImageData(imageData, {
  count = 6,
  ignoreBackground = true,
  lockedColors = [],
  excludeColors = [],
} = {}) {
  const { pixels, positions, width, height, step } = samplePixels(imageData, 3);

  let filtered = pixels;
  let filteredPositions = positions;
  if (ignoreBackground) {
    filtered = [];
    filteredPositions = [];
    for (let i = 0; i < pixels.length; i++) {
      const [r, g, b] = pixels[i];
      if (!isNeutralBackground(r, g, b)) {
        filtered.push(pixels[i]);
        filteredPositions.push(positions[i]);
      }
    }
  }

  const pool = filtered.length > 0 ? filtered : pixels;
  const poolPositions = filtered.length > 0 ? filteredPositions : positions;

  const exclude = excludeColors.filter(
    ex => !lockedColors.some(lk => colorDistance(lk, ex) < 10)
  );

  const remaining = Math.max(1, count - lockedColors.length);
  let clusters = extractClusters(pool, remaining, ignoreBackground, exclude);

  clusters = assignSamplePoints(
    clusters,
    pool,
    poolPositions,
    width, height, step
  );

  const locked = lockedColors.map((hex, i) => {
    const { r, g, b } = hexToRgb(hex);
    return {
      hex,
      rgb: [r, g, b],
      weight: 1,
      x: width * (0.2 + i * 0.1),
      y: height / 2,
      locked: true,
    };
  });

  let all = [...locked, ...clusters.map(c => ({ ...c, locked: false }))];

  if (ignoreBackground) {
    all = all.filter(c => c.locked || !isNeutralHex(c.hex));
  }

  all = all.filter(c => c.locked || !exclude.some(ex => colorDistance(c.hex, ex) < 32));

  const seen = new Set();
  all = all.filter(c => {
    if (seen.has(c.hex)) return false;
    seen.add(c.hex);
    return true;
  });

  while (all.length < count) {
    const base = all[all.length - 1]?.hex || '#888888';
    const { r, g, b } = { r: parseInt(base.slice(1,3),16), g: parseInt(base.slice(3,5),16), b: parseInt(base.slice(5,7),16) };
    const variant = rgbToHex(
      Math.min(255, r + 20),
      Math.min(255, g + 15),
      Math.min(255, b + 10)
    );
    if (!seen.has(variant) && !exclude.some(ex => colorDistance(variant, ex) < 32)) {
      seen.add(variant);
      all.push({ hex: variant, rgb: [parseInt(variant.slice(1,3),16), parseInt(variant.slice(3,5),16), parseInt(variant.slice(5,7),16)], weight: 0, x: width/2, y: height/2, locked: false });
    } else break;
  }

  return all.slice(0, count);
}

export function findSamplePointForColor(imageData, hex, ignoreBackground = true) {
  const target = hexToRgb(hex);
  const { pixels, positions, width, height } = samplePixels(imageData, 3);

  let bestDist = Infinity;
  let bestPos = { x: Math.round(width / 2), y: Math.round(height / 2) };

  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = pixels[i];
    if (ignoreBackground && isNeutralBackground(r, g, b)) continue;
    const d = (r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestPos = positions[i];
    }
  }

  return bestPos;
}

export function pickColorAt(imageData, x, y) {
  const { data, width, height } = imageData;
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const i = (py * width + px) * 4;
  return rgbToHex(data[i], data[i + 1], data[i + 2]);
}

export function mergeDistinctColors(colors, minDistance = 35) {
  const result = [];
  for (const hex of colors) {
    if (!result.some(c => colorDistance(c, hex) < minDistance)) {
      result.push(hex);
    }
  }
  return result;
}

export async function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = src;
  });
}

export function imageToCanvas(img, maxSize = 800) {
  const canvas = document.createElement('canvas');
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxSize || h > maxSize) {
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}
