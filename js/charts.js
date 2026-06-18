/** Chart preview rendering with Chart.js */

let chartInstances = {};

export function destroyCharts() {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
}

export function renderPreviewCharts(colors, containerIds, options = {}) {
  destroyCharts();
  const { colorblindSim = null, grayscale = false } = options;

  let displayColors = [...colors];
  if (colorblindSim && colorblindSim !== 'normal') {
    import('./colorblind.js').then(({ simulatePalette }) => {
      displayColors = simulatePalette(colors, colorblindSim);
      _renderAll(displayColors, containerIds, grayscale);
    });
  } else {
    _renderAll(displayColors, containerIds, grayscale);
  }
}

function _renderAll(colors, containerIds, grayscale) {
  if (grayscale) {
    import('./colorUtils.js').then(({ toGrayscale }) => {
      const gs = colors.map(toGrayscale);
      _createBarChart(containerIds.bar, gs);
      _createLineChart(containerIds.line, gs);
      _createScatterChart(containerIds.scatter, gs);
      _createHeatmap(containerIds.heatmap, gs);
    });
  } else {
    _createBarChart(containerIds.bar, colors);
    _createLineChart(containerIds.line, colors);
    _createScatterChart(containerIds.scatter, colors);
    _createHeatmap(containerIds.heatmap, colors);
  }
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: '#eee' }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#eee' }, ticks: { font: { size: 10 } } },
    },
  };
}

function _createBarChart(canvasId, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  chartInstances.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: colors.map((_, i) => `G${i + 1}`),
      datasets: [{
        data: colors.map((_, i) => 3 + Math.sin(i) * 2 + i),
        backgroundColor: colors,
        borderRadius: 4,
      }],
    },
    options: { ...chartDefaults(), plugins: { legend: { display: false }, title: { display: true, text: '分组柱状图', font: { size: 11 } } } },
  });
}

function _createLineChart(canvasId, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  chartInstances.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: colors.slice(0, 4).map((c, i) => ({
        label: `S${i + 1}`,
        data: labels.map((_, j) => 2 + i + Math.sin(j + i) * 1.5),
        borderColor: c,
        backgroundColor: c + '33',
        tension: 0.3,
        pointRadius: 3,
      })),
    },
    options: { ...chartDefaults(), plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }, title: { display: true, text: '多系列折线图', font: { size: 11 } } } },
  });
}

function _createScatterChart(canvasId, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  chartInstances.scatter = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: colors.slice(0, 4).map((c, i) => ({
        label: `C${i + 1}`,
        data: Array.from({ length: 8 }, (_, j) => ({
          x: j + i * 0.5 + Math.random() * 0.3,
          y: 2 + i + Math.cos(j) * 1.2,
        })),
        backgroundColor: c,
        pointRadius: 5,
      })),
    },
    options: { ...chartDefaults(), plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }, title: { display: true, text: '分类散点图', font: { size: 11 } } } },
  });
}

function _createHeatmap(canvasId, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  const gradient = colors[0] || '#2166AC';
  const gradColors = [];
  import('./colorUtils.js').then(({ generateGradient }) => {
    const steps = generateGradient(gradient, 6);
    const data = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 6; x++) {
        data.push({ x, y, v: Math.random() });
      }
    }
    chartInstances.heatmap = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1', '2', '3', '4', '5', '6'],
        datasets: Array.from({ length: 5 }, (_, row) => ({
          label: `R${row + 1}`,
          data: Array.from({ length: 6 }, (_, col) => row * 0.2 + col * 0.15 + 0.1),
          backgroundColor: steps[row % steps.length],
          barPercentage: 0.95,
          categoryPercentage: 0.95,
        })),
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } },
          y: { stacked: true, display: false },
        },
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Heatmap 渐变', font: { size: 11 } },
        },
      },
    });
  });
}

export function renderCompareCharts(colorsA, colorsB, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (chartInstances.compare) chartInstances.compare.destroy();
  const ctx = el.getContext('2d');
  chartInstances.compare = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, Math.max(colorsA.length, colorsB.length)),
      datasets: [
        { label: '方案 A', data: [3, 5, 2, 4, 6, 3].slice(0, colorsA.length), backgroundColor: colorsA },
        { label: '方案 B', data: [4, 3, 5, 2, 4, 5].slice(0, colorsB.length), backgroundColor: colorsB },
      ],
    },
    options: { ...chartDefaults(), plugins: { legend: { display: true, position: 'bottom' }, title: { display: true, text: '配色对比', font: { size: 11 } } } },
  });
}
