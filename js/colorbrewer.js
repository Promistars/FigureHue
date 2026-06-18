/** ColorBrewer palette definitions */

export const COLORBREWER = {
  qualitative: {
    Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'],
    Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
    Set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5'],
    Paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00'],
    Dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
  },
  sequential: {
    Blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c'],
    Greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
    OrRd: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#990000'],
    PuBu: ['#fff7fb', '#ece2f0', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#034e7b'],
  },
  diverging: {
    RdBu: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'],
    PiYG: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'],
    Spectral: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
  },
};

export function findNearestColorBrewerSet(colors) {
  let bestMatch = { name: 'Set2', type: 'qualitative', score: Infinity };
  for (const [type, sets] of Object.entries(COLORBREWER)) {
    for (const [name, palette] of Object.entries(sets)) {
      const slice = palette.slice(0, colors.length);
      let score = 0;
      for (let i = 0; i < colors.length; i++) {
        const target = colors[i];
        let minD = Infinity;
        for (const p of palette) {
          const d = hexDist(target, p);
          if (d < minD) minD = d;
        }
        score += minD;
      }
      if (score < bestMatch.score) {
        bestMatch = { name, type, score, palette: slice };
      }
    }
  }
  return bestMatch;
}

function hexDist(a, b) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

export function mapToColorBrewer(colors, setName = 'Set2') {
  const palette = COLORBREWER.qualitative[setName] || COLORBREWER.qualitative.Set2;
  const used = new Set();
  return colors.map((hex) => {
    let best = palette[0];
    let bestDist = Infinity;
    for (const candidate of palette) {
      if (used.has(candidate)) continue;
      const d = hexDist(hex, candidate);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    if (used.has(best)) {
      best = palette.reduce((a, b) => hexDist(hex, a) <= hexDist(hex, b) ? a : b);
    }
    used.add(best);
    return best;
  });
}
