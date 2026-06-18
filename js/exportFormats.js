/** Export palette to various formats */

export function exportHexList(colors) {
  return colors.join('\n');
}

export function exportCss(colors, name = 'palette') {
  let css = `:root {\n`;
  colors.forEach((c, i) => { css += `  --${name}-${i + 1}: ${c};\n`; });
  css += '}\n';
  return css;
}

export function exportMatplotlib(colors) {
  const list = colors.map(c => `"${c}"`).join(', ');
  return `# Matplotlib color palette
import matplotlib.pyplot as plt

colors = [${list}]
plt.rcParams['axes.prop_cycle'] = plt.cycler(color=colors)

# Usage example:
# fig, ax = plt.subplots()
# ax.bar(['A','B','C','D'], [3,5,2,4], color=colors[:4])`;
}

export function exportGgplot2(colors) {
  const list = colors.map(c => `"${c}"`).join(', ');
  return `# ggplot2 color palette
library(ggplot2)

my_colors <- c(${list})

# Usage:
# ggplot(df, aes(x, y, fill=group)) +
#   geom_bar(stat="identity") +
#   scale_fill_manual(values = my_colors)`;
}

export function exportSeaborn(colors) {
  const list = colors.map(c => `"${c}"`).join(', ');
  return `# Seaborn color palette
import seaborn as sns

custom_palette = [${list}]
sns.set_palette(custom_palette)

# Or as color palette object:
# palette = sns.color_palette(custom_palette)`;
}

export function exportLatex(colors) {
  let tex = `% LaTeX xcolor definitions\n\\usepackage{xcolor}\n\n`;
  colors.forEach((c, i) => {
    const r = parseInt(c.slice(1, 3), 16) / 255;
    const g = parseInt(c.slice(3, 5), 16) / 255;
    const b = parseInt(c.slice(5, 7), 16) / 255;
    tex += `\\definecolor{palette${i + 1}}{RGB}{${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)}}\n`;
    tex += `% ${c} -> rgb(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})\n`;
  });
  tex += `\n% Usage: \\textcolor{palette1}{text}\n`;
  return tex;
}

export function exportJson(colors, meta = {}) {
  return JSON.stringify({
    name: meta.name || 'Untitled Palette',
    colors,
    created: new Date().toISOString(),
    ...meta,
  }, null, 2);
}

export function exportFigma(colors) {
  return JSON.stringify({
    name: 'Palette Studio Export',
    colors: colors.map((c, i) => ({
      name: `Color ${i + 1}`,
      color: {
        r: parseInt(c.slice(1, 3), 16) / 255,
        g: parseInt(c.slice(3, 5), 16) / 255,
        b: parseInt(c.slice(5, 7), 16) / 255,
        a: 1,
      },
      hex: c,
    })),
  }, null, 2);
}

export const EXPORT_FORMATS = [
  { id: 'hex', label: 'HEX 列表', fn: exportHexList, ext: 'txt' },
  { id: 'css', label: 'CSS 变量', fn: exportCss, ext: 'css' },
  { id: 'matplotlib', label: 'Matplotlib (Python)', fn: exportMatplotlib, ext: 'py' },
  { id: 'ggplot2', label: 'ggplot2 (R)', fn: exportGgplot2, ext: 'R' },
  { id: 'seaborn', label: 'Seaborn (Python)', fn: exportSeaborn, ext: 'py' },
  { id: 'latex', label: 'LaTeX xcolor', fn: exportLatex, ext: 'tex' },
  { id: 'json', label: 'JSON', fn: exportJson, ext: 'json' },
  { id: 'figma', label: 'Figma JSON', fn: exportFigma, ext: 'json' },
];

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}

export function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
