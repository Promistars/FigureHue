import {
  extractColorsFromImageData,
  pickColorAt,
  findSamplePointForColor,
  loadImageFromSource,
  imageToCanvas,
} from './colorExtract.js';
import {
  adjustColor,
  contrastRatio,
  colorDistance,
  generateGradient,
  getReadableTextColor,
  formatRgb,
  hexToRgb,
  COLOR_ROLES,
} from './colorUtils.js';
import { simulatePalette, COLORBLIND_TYPES } from './colorblind.js';
import { mapToColorBrewer, findNearestColorBrewerSet } from './colorbrewer.js';
import { STYLE_PRESETS, EXAMPLE_IMAGES, svgToDataUrl } from './presets.js';
import {
  EXPORT_FORMATS,
  copyToClipboard,
  downloadFile,
} from './exportFormats.js';
import { loadSavedPalettes, savePalette, deletePalette } from './storage.js';
import { renderPreviewCharts, renderCompareCharts, destroyCharts } from './charts.js';
import { buildShareUrl, parsePaletteText, readSharedPalette } from './paletteExchange.js';

const state = {
  imageData: null,
  sourceCanvas: null,
  rawColors: [],
  lockedIndices: new Set(),
  excludedColors: new Set(),
  clusters: [],
  pickedColor: null,
  pickedPoint: null,
  currentExportFormat: 'matplotlib',
  savedPalettes: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 2500);
}

function getSettings() {
  return {
    count: parseInt($('#color-count').value, 10),
    ignoreBackground: $('#ignore-bg').checked,
    preset: $('#style-preset').value,
    colorbrewer: $('#colorbrewer-set').value,
    saturation: parseInt($('#sat-slider').value, 10),
    brightness: parseInt($('#bright-slider').value, 10),
    colorblind: $('#colorblind-select').value,
    grayscale: $('#grayscale-preview').checked,
  };
}

function getLockedColors() {
  return [...state.lockedIndices]
    .sort((a, b) => a - b)
    .map(i => state.rawColors[i])
    .filter(Boolean);
}

function processColors(rawHexes) {
  const settings = getSettings();
  let colors = [...rawHexes];

  if (settings.preset !== 'original' && STYLE_PRESETS[settings.preset]) {
    colors = STYLE_PRESETS[settings.preset].transform(colors);
  }

  if (settings.saturation !== 0 || settings.brightness !== 0) {
    colors = colors.map(c => adjustColor(c, {
      saturation: settings.saturation,
      brightness: settings.brightness,
    }));
  }

  if (settings.colorbrewer) {
    colors = mapToColorBrewer(colors, settings.colorbrewer);
  }

  return colors;
}

function getDisplayColors() {
  if (!state.rawColors.length) return [];

  let colors = processColors(state.rawColors);

  if (getSettings().colorblind !== 'normal') {
    colors = simulatePalette(colors, getSettings().colorblind);
  }

  return colors;
}

function hasExtractedPalette() {
  return state.rawColors.length > 0;
}

function defaultPlaceholderColors() {
  return ['#2166AC', '#D6604D', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33'];
}

function updatePaletteScrollMode() {
  const body = document.querySelector('.panel-palette-body');
  if (!body) return;
  const needsScroll = body.scrollHeight > body.clientHeight + 1;
  body.classList.toggle('has-internal-scroll', needsScroll);
}

function syncWorkspacePanelHeights() {
  const input = document.querySelector('.panel-input');
  const palette = document.querySelector('.panel-palette');
  const preview = document.querySelector('.panel-preview');
  if (!input) return;

  const stacked = window.matchMedia('(max-width: 1100px)').matches;

  for (const panel of [palette, preview]) {
    if (!panel) continue;
    if (stacked) {
      panel.style.height = '';
      panel.style.maxHeight = '';
    } else {
      const h = input.offsetHeight;
      panel.style.height = `${h}px`;
      panel.style.maxHeight = `${h}px`;
    }
  }

  const canvas = $('#image-canvas');
  if (canvas && !$('#canvas-frame').hidden) {
    syncCanvasDisplaySize(canvas);
    renderSampleMarkers();
  }

  requestAnimationFrame(updatePaletteScrollMode);
}

function updatePanelEmptyState() {
  const hasPalette = hasExtractedPalette();
  const hasImage = !!state.sourceCanvas;
  document.querySelector('.panel-palette')?.classList.toggle('is-empty', !hasPalette);
  document.querySelector('.panel-preview')?.classList.toggle('is-empty', !hasImage);
  const pickBlock = $('#pick-block');
  if (pickBlock) pickBlock.hidden = !hasImage;
  if (hasImage) initPickToolsUI();
}

function syncCanvasDisplaySize(canvas) {
  if (!canvas?.width || !canvas?.height) return;
  const wrapper = $('#canvas-wrapper');
  if (!wrapper) return;

  const maxW = wrapper.clientWidth;
  const maxH = wrapper.clientHeight;
  if (maxW <= 0 || maxH <= 0) return;

  const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  canvas.style.width = `${Math.round(canvas.width * scale)}px`;
  canvas.style.height = `${Math.round(canvas.height * scale)}px`;
}

function updatePageBackground(sourceCanvas) {
  const bg = $('#page-bg');
  const bgImage = $('#page-bg-image');
  if (!sourceCanvas) {
    bg.hidden = true;
    document.body.classList.remove('has-bg');
    if (bgImage) bgImage.style.backgroundImage = '';
    return;
  }
  bgImage.style.backgroundImage = `url(${sourceCanvas.toDataURL('image/jpeg', 0.85)})`;
  bg.hidden = false;
  document.body.classList.add('has-bg');
}

function showImagePreview(show) {
  const wrapper = $('#canvas-wrapper');
  const frame = $('#canvas-frame');
  const empty = $('#empty-state');
  if (show) {
    wrapper.classList.add('has-image');
    empty.hidden = true;
    frame.hidden = false;
    updatePageBackground(state.sourceCanvas);
  } else {
    wrapper.classList.remove('has-image');
    empty.hidden = false;
    frame.hidden = true;
    hideHoverColorPreview();
    updatePageBackground(null);
  }
}

function hidePickedColorUI() {
  resetPickedColorIdle();
}

function setHoverColorPreviewIdle(rootSelector = '#hover-color-preview') {
  const tip = document.querySelector(rootSelector);
  if (!tip) return;
  tip.classList.add('is-idle');
  tip.querySelector('.tip-swatch').style.background = '#e5e7eb';
  tip.querySelector('.tip-hex').textContent = '—';
  tip.querySelector('.tip-rgb').textContent = '在图片上悬停预览';
  const hint = tip.querySelector('.tip-hint');
  if (hint) hint.textContent = rootSelector === '#zoom-hover-preview' ? '等待悬停' : '等待悬停';
}

function resetPickedColorIdle() {
  const picked = $('#picked-color');
  if (!picked) return;
  picked.classList.add('is-idle');
  picked.querySelector('.swatch').style.background = '#e5e7eb';
  picked.querySelector('code').textContent = '点击图片确认取色';
  const btn = $('#btn-add-picked');
  if (btn) btn.disabled = true;
}

function initPickToolsUI() {
  setHoverColorPreviewIdle();
  resetPickedColorIdle();
  updatePickedTargetOptions();
}

function resetToDefaultExtraction() {
  if (!state.imageData) return;

  state.lockedIndices.clear();
  state.excludedColors.clear();
  state.pickedColor = null;
  state.pickedPoint = null;
  hidePickedColorUI();
  hideHoverColorPreview();
  hideZoomHoverPreview();

  $('#sat-slider').value = 0;
  $('#bright-slider').value = 0;
  $('#sat-val').textContent = '0';
  $('#bright-val').textContent = '0';
  $('#style-preset').value = 'original';
  $('#colorbrewer-set').value = '';

  extractAndRender();
  showToast('已恢复默认取色');
}

function updateActionButtons() {
  const hasImage = !!state.imageData;
  const hasPalette = hasExtractedPalette();
  $('#btn-reextract').disabled = !hasImage;
  $('#btn-reset-palette').disabled = !hasImage;
  $('#btn-save-palette').disabled = !hasPalette;
  $('#btn-share-palette').disabled = !hasPalette;
  $('#btn-compare').disabled = !hasPalette;
}

async function loadImage(src) {
  try {
    const img = await loadImageFromSource(src);
    const canvas = imageToCanvas(img);
    state.sourceCanvas = canvas;
    state.imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    state.lockedIndices.clear();
    state.excludedColors.clear();
    state.pickedColor = null;
    state.pickedPoint = null;

    const displayCanvas = $('#image-canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    displayCanvas.getContext('2d').drawImage(canvas, 0, 0);
    syncCanvasDisplaySize(displayCanvas);
    showImagePreview(true);
    updatePanelEmptyState();
    requestAnimationFrame(syncWorkspacePanelHeights);

    await extractAndRender();
    updateActionButtons();
    showToast('配色已从图片提取');
  } catch (err) {
    showToast('加载失败: ' + err.message);
  }
}

async function extractAndRender() {
  if (!state.imageData) return;

  const settings = getSettings();
  const locked = getLockedColors();

  state.clusters = extractColorsFromImageData(state.imageData, {
    count: settings.count,
    ignoreBackground: settings.ignoreBackground,
    lockedColors: locked,
    excludeColors: [...state.excludedColors],
  });

  state.rawColors = state.clusters.map(c => c.hex);

  restoreLockedIndices(locked);
  renderAll();
}

function restoreLockedIndices(lockedHexes) {
  state.lockedIndices.clear();
  for (const hex of lockedHexes) {
    const idx = state.rawColors.findIndex(c => colorDistance(c, hex) < 12);
    if (idx >= 0) state.lockedIndices.add(idx);
  }
}

async function deleteColor(index) {
  if (!state.rawColors[index]) return;
  if (state.rawColors.length <= 1) {
    showToast('至少保留一种颜色');
    return;
  }

  const removed = state.rawColors[index];
  const lockedHexes = [...state.lockedIndices]
    .filter(i => i !== index)
    .map(i => state.rawColors[i]);

  state.excludedColors.add(removed);

  if (state.imageData) {
    const settings = getSettings();
    state.clusters = extractColorsFromImageData(state.imageData, {
      count: settings.count,
      ignoreBackground: settings.ignoreBackground,
      lockedColors: lockedHexes,
      excludeColors: [...state.excludedColors],
    });
    state.rawColors = state.clusters.map(c => c.hex);
    restoreLockedIndices(lockedHexes);
    renderAll();
    showToast('已替换该颜色');
  } else {
    state.rawColors.splice(index, 1);
    restoreLockedIndices(lockedHexes);
    renderAll();
    showToast('已删除该颜色');
  }
}

function renderAll() {
  renderPaletteSlots();
  renderSampleMarkers();
  renderGradient();
  renderAccessibility();
  renderCharts();
  renderExport();
  updateActionButtons();
  updatePanelEmptyState();
  if (state.sourceCanvas) updatePickedTargetOptions();
  requestAnimationFrame(syncWorkspacePanelHeights);
}

function renderPaletteSlots() {
  const container = $('#palette-slots');

  if (!hasExtractedPalette()) {
    container.innerHTML = '<p class="palette-empty">上传或选择示例图片后，将自动从图中提取主色调</p>';
    return;
  }

  const colors = getDisplayColors();

  container.innerHTML = colors.map((hex, i) => {
    const locked = state.lockedIndices.has(i);
    const role = COLOR_ROLES[i] || `Color ${i + 1}`;
    const textColor = getReadableTextColor(hex);
    return `
      <div class="palette-slot ${locked ? 'locked' : ''}" data-index="${i}" draggable="true" style="animation-delay:${i * 0.05}s">
        <span class="drag-handle" title="拖拽排序" aria-hidden="true">⠿</span>
        <div class="swatch" style="background:${hex};color:${textColor}" title="点击复制">${i + 1}</div>
        <div class="info">
          <div class="hex">${hex.toUpperCase()}</div>
          <div class="role">${role} · ${formatRgb(hex)}</div>
        </div>
        <div class="actions">
          <button class="slot-btn lock-btn ${locked ? 'active' : ''}" data-index="${i}" title="锁定">${locked ? '🔒' : '🔓'}</button>
          <button class="slot-btn copy-btn" data-hex="${hex}" title="复制">📋</button>
          <button class="slot-btn delete-btn" data-index="${i}" title="删除并替换">🗑</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.swatch').forEach(el => {
    el.addEventListener('click', () => {
      const hex = el.parentElement.querySelector('.hex').textContent;
      copyToClipboard(hex);
      showToast('已复制 ' + hex);
    });
  });

  container.querySelectorAll('.lock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      if (state.lockedIndices.has(i)) state.lockedIndices.delete(i);
      else state.lockedIndices.add(i);
      extractAndRender();
    });
  });

  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.hex);
      showToast('已复制 ' + btn.dataset.hex);
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteColor(parseInt(btn.dataset.index, 10));
    });
  });

  setupPaletteDrag(container);

  setupPalettePickTargets(container);
}

function reorderPalette(from, to) {
  if (from === to || from < 0 || to < 0 || to >= state.rawColors.length) return;

  const locked = state.rawColors.map((_, i) => state.lockedIndices.has(i));
  const [color] = state.rawColors.splice(from, 1);
  state.rawColors.splice(to, 0, color);

  if (state.clusters.length === locked.length) {
    const [cluster] = state.clusters.splice(from, 1);
    state.clusters.splice(to, 0, cluster);
  }

  const [wasLocked] = locked.splice(from, 1);
  locked.splice(to, 0, wasLocked);
  state.lockedIndices = new Set(locked.flatMap((value, i) => value ? [i] : []));
  renderAll();
  showToast('已调整颜色顺序');
}

function setupPaletteDrag(container) {
  let dragIndex = -1;
  const slots = [...container.querySelectorAll('.palette-slot')];

  slots.forEach(slot => {
    slot.addEventListener('dragstart', (e) => {
      dragIndex = parseInt(slot.dataset.index, 10);
      slot.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragIndex));
    });
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = dragIndex >= 0 ? dragIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
      reorderPalette(from, parseInt(slot.dataset.index, 10));
    });
    slot.addEventListener('dragend', () => {
      dragIndex = -1;
      slots.forEach(item => item.classList.remove('dragging', 'drag-over'));
    });
  });
}

function setupPalettePickTargets(container) {
  const picked = $('#picked-color');
  if (!picked || !state.sourceCanvas) return;

  const select = $('#picked-target-slot');
  const activeIdx = parseInt(select?.value, 10);

  container.querySelectorAll('.palette-slot').forEach(slot => {
    const i = parseInt(slot.dataset.index, 10);
    slot.classList.add('pick-target');
    slot.classList.toggle('target-selected', i === activeIdx);

    slot.addEventListener('click', (e) => {
      if (e.target.closest('.slot-btn')) return;
      if (state.lockedIndices.has(i)) {
        showToast('该色槽已锁定，请选择其他色槽');
        return;
      }
      if (select) select.value = String(i);
      container.querySelectorAll('.palette-slot').forEach(s => s.classList.remove('target-selected'));
      slot.classList.add('target-selected');
    });
  });
}

function updatePickedTargetOptions() {
  const select = $('#picked-target-slot');
  if (!select) return;

  const count = Math.max(state.rawColors.length, getSettings().count);
  const slots = count > 0 ? count : getSettings().count;
  const prev = parseInt(select.value, 10);

  select.innerHTML = Array.from({ length: slots }, (_, i) => {
    const hex = state.rawColors[i];
    const locked = state.lockedIndices.has(i);
    const role = COLOR_ROLES[i] || `Color ${i + 1}`;
    const hexLabel = hex ? hex.toUpperCase() : '空';
    const label = locked
      ? `色槽 ${i + 1} · ${role}（已锁定）`
      : `色槽 ${i + 1} · ${role} · ${hexLabel}`;
    return `<option value="${i}"${locked ? ' disabled' : ''}>${label}</option>`;
  }).join('');

  const firstUnlocked = [...Array(slots).keys()].find(i => !state.lockedIndices.has(i)) ?? 0;
  if (!isNaN(prev) && prev >= 0 && prev < slots && !state.lockedIndices.has(prev)) {
    select.value = String(prev);
  } else {
    select.value = String(firstUnlocked);
  }

  document.querySelectorAll('.palette-slot.target-selected').forEach(el => {
    el.classList.remove('target-selected');
  });
  const active = document.querySelector(`.palette-slot[data-index="${select.value}"]`);
  active?.classList.add('target-selected');
}

function showPickedColorUI(hex) {
  const picked = $('#picked-color');
  if (!picked) return;
  picked.classList.remove('is-idle');
  picked.querySelector('.swatch').style.background = hex;
  const { r, g, b } = hexToRgb(hex);
  picked.querySelector('code').textContent = `${hex.toUpperCase()} · rgb(${r}, ${g}, ${b})`;
  const btn = $('#btn-add-picked');
  if (btn) btn.disabled = false;
  updatePickedTargetOptions();
}

function applyPickedColor() {
  if (!state.pickedColor) return;

  const select = $('#picked-target-slot');
  let idx = parseInt(select?.value, 10);
  if (isNaN(idx) || idx < 0) {
    idx = state.rawColors.findIndex((_, i) => !state.lockedIndices.has(i));
    if (idx < 0) idx = 0;
  }

  if (state.lockedIndices.has(idx)) {
    showToast('该色槽已锁定，请选择其他色槽');
    return;
  }

  const hex = state.pickedColor;
  if (!state.rawColors.length) {
    state.rawColors = defaultPlaceholderColors().slice(0, getSettings().count);
  }
  if (idx >= state.rawColors.length) {
    showToast('无效的色槽');
    return;
  }

  state.rawColors[idx] = hex;
  updateClusterAt(idx, hex, state.pickedPoint);
  renderAll();
  showToast(`已替换色槽 ${idx + 1}`);
  if (state.sourceCanvas) updatePickedTargetOptions();
}

function updateClusterAt(index, hex, point) {
  const { r, g, b } = hexToRgb(hex);
  const x = Math.round(point?.x ?? state.clusters[index]?.x ?? 0);
  const y = Math.round(point?.y ?? state.clusters[index]?.y ?? 0);
  const entry = {
    hex,
    rgb: [r, g, b],
    weight: state.clusters[index]?.weight ?? 0,
    x,
    y,
  };

  if (index < state.clusters.length) {
    state.clusters[index] = { ...state.clusters[index], ...entry };
  } else {
    while (state.clusters.length < index) {
      state.clusters.push({ ...entry });
    }
    state.clusters.push(entry);
  }
}

function getMarkerPosition(index, hex) {
  const cluster = state.clusters[index];
  if (cluster && colorDistance(cluster.hex, hex) < 12) {
    return { x: cluster.x, y: cluster.y };
  }
  if (
    state.pickedPoint &&
    state.pickedColor &&
    colorDistance(state.pickedColor, hex) < 12
  ) {
    return {
      x: Math.round(state.pickedPoint.x),
      y: Math.round(state.pickedPoint.y),
    };
  }
  if (state.imageData) {
    return findSamplePointForColor(
      state.imageData,
      hex,
      getSettings().ignoreBackground
    );
  }
  return { x: 0, y: 0 };
}

function renderSampleMarkers() {
  const markers = $('#sample-markers');
  const canvas = $('#image-canvas');
  const frame = $('#canvas-frame');
  if (!canvas || frame.hidden || !state.rawColors.length) {
    markers.innerHTML = '';
    return;
  }

  syncCanvasDisplaySize(canvas);

  const scaleX = canvas.clientWidth / canvas.width;
  const scaleY = canvas.clientHeight / canvas.height;

  const colors = processColors(state.rawColors);
  markers.innerHTML = state.rawColors.map((rawHex, i) => {
    const { x, y } = getMarkerPosition(i, rawHex);
    const hex = colors[i] || rawHex;
    return `<div class="sample-marker" style="left:${x * scaleX}px;top:${y * scaleY}px;background:${hex}"></div>`;
  }).join('');
}

function renderGradient() {
  const colors = getDisplayColors();
  const section = $('#gradient-section');
  if (!colors.length) { section.hidden = true; return; }
  section.hidden = false;
  const gradient = generateGradient(colors[0], 7);
  $('#gradient-bar').innerHTML = gradient.map(c =>
    `<span style="background:${c}" title="${c}"></span>`
  ).join('');
}

function renderA11yItem(it) {
  const tip = it.suggestion
    ? `<span class="a11y-item-tip">${escapeHtml(it.suggestion)}</span>`
    : '';
  return `<div class="a11y-item ${it.level}">
    <span class="a11y-item-icon">${it.icon}</span>
    <div class="a11y-item-body">
      <span class="a11y-item-text">${escapeHtml(it.text)}</span>${tip}
    </div>
  </div>`;
}

function renderAccessibility() {
  const report = $('#a11y-report');
  const colors = getDisplayColors();
  if (colors.length < 2) { report.innerHTML = ''; return; }

  const items = [];

  const whiteContrast = colors.map(c => contrastRatio(c, '#ffffff'));
  const minWhite = Math.min(...whiteContrast);
  const whiteItem = {
    level: minWhite >= 3 ? 'pass' : minWhite >= 2 ? 'warn' : 'fail',
    icon: minWhite >= 3 ? '✓' : '⚠',
    text: `与白底对比度: 最低 ${minWhite.toFixed(1)}:1 ${minWhite >= 4.5 ? '(WCAG AA ✓)' : minWhite >= 3 ? '(大文字 OK)' : '(偏低)'}`,
  };
  if (minWhite < 4.5) {
    whiteItem.suggestion = minWhite < 2
      ? '建议：将过浅颜色加深明度（明度滑块 +5~15），或仅用于大面积填充、文字改用深色'
      : '建议：浅色用于小字号/细线时加深 10% 左右明度，或搭配深色描边与标签';
  }
  items.push(whiteItem);

  let minDist = Infinity;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      minDist = Math.min(minDist, colorDistance(colors[i], colors[j]));
    }
  }
  const distItem = {
    level: minDist >= 50 ? 'pass' : minDist >= 30 ? 'warn' : 'fail',
    icon: minDist >= 50 ? '✓' : '⚠',
    text: `相邻色可区分性: 最小距离 ${minDist.toFixed(0)} ${minDist >= 50 ? '(良好)' : minDist >= 30 ? '(一般)' : '(易混淆)'}`,
  };
  if (minDist < 50) {
    distItem.suggestion = minDist < 30
      ? '建议：替换过于接近的色槽，或微调饱和度/明度拉开差距；图表中叠加线型/形状区分'
      : '建议：微调相邻色槽的色相或明度，或启用 ColorBrewer 映射增强区分度';
  }
  items.push(distItem);

  const cbTypes = ['protanopia', 'deuteranopia', 'tritanopia'];
  let cbIssues = 0;
  for (const type of cbTypes) {
    const sim = simulatePalette(colors, type);
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        if (colorDistance(sim[i], sim[j]) < 25) cbIssues++;
      }
    }
  }
  const cbItem = {
    level: cbIssues === 0 ? 'pass' : cbIssues <= 2 ? 'warn' : 'fail',
    icon: cbIssues === 0 ? '✓' : '⚠',
    text: `色盲模式冲突: ${cbIssues} 处 ${cbIssues === 0 ? '(无问题)' : '(建议调整)'}`,
  };
  if (cbIssues > 0) {
    cbItem.suggestion = cbIssues > 2
      ? '建议：切换色盲模拟逐一检查，拉开红绿/蓝黄相近色的明度差，必要时用线型、标记形状辅助区分'
      : '建议：在色盲模拟下确认易混淆色对，微调其中一色的明度或换用 ColorBrewer 安全色板';
  }
  items.push(cbItem);

  const cb = findNearestColorBrewerSet(colors);
  items.push({
    level: 'pass',
    icon: 'ℹ',
    text: `最近 ColorBrewer: ${cb.name} (${cb.type})`,
  });

  report.innerHTML = items.map(renderA11yItem).join('');
}

function renderCharts() {
  const colors = getDisplayColors();
  if (!colors.length) {
    destroyCharts();
    return;
  }
  renderPreviewCharts(colors, {
    bar: 'chart-bar',
    line: 'chart-line',
    scatter: 'chart-scatter',
    heatmap: 'chart-heatmap',
  }, {
    grayscale: getSettings().grayscale,
  });
}

function renderExport() {
  const tabs = $('#export-tabs');
  if (!tabs.children.length) {
    tabs.innerHTML = EXPORT_FORMATS.map(f =>
      `<button class="export-tab ${f.id === state.currentExportFormat ? 'active' : ''}" data-format="${f.id}">${f.label}</button>`
    ).join('');
    tabs.querySelectorAll('.export-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentExportFormat = tab.dataset.format;
        tabs.querySelectorAll('.export-tab').forEach(t => t.classList.toggle('active', t.dataset.format === state.currentExportFormat));
        renderExport();
      });
    });
  }

  const format = EXPORT_FORMATS.find(f => f.id === state.currentExportFormat);
  const colors = getDisplayColors();
  const meta = { name: 'FigureHue Export', version: '1.1.0' };
  $('#export-code').textContent = colors.length
    ? format.fn(colors, meta)
    : '# 请先上传图片提取配色';
}

function renderSavedPalettes() {
  state.savedPalettes = loadSavedPalettes();
  const container = $('#saved-palettes');

  if (!state.savedPalettes.length) {
    container.innerHTML = '<p class="saved-empty">暂无保存的方案。提取配色后点击「保存方案」。</p>';
    return;
  }

  container.innerHTML = state.savedPalettes.map(p => `
    <div class="saved-card glass" data-id="${p.id}">
      <h4>${escapeHtml(p.name)}</h4>
      <div class="saved-strip">${p.colors.map(c => `<span style="background:${c}"></span>`).join('')}</div>
      <div class="saved-actions">
        <button class="btn btn-small load-saved" data-id="${p.id}">加载</button>
        <button class="btn btn-small delete-saved" data-id="${p.id}">删除</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.load-saved').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = state.savedPalettes.find(x => x.id === btn.dataset.id);
      if (p) {
        state.rawColors = [...p.colors];
        state.lockedIndices.clear();
        renderAll();
        showToast('已加载: ' + p.name);
      }
    });
  });

  container.querySelectorAll('.delete-saved').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePalette(btn.dataset.id);
      renderSavedPalettes();
      showToast('已删除');
    });
  });
}

function renderExampleGallery() {
  const gallery = $('#example-gallery');
  gallery.innerHTML = EXAMPLE_IMAGES.map(ex => {
    const url = svgToDataUrl(ex.svg);
    return `<div class="example-thumb" data-url="${url}" title="${ex.name}"><img src="${url}" alt="${ex.name}" /></div>`;
  }).join('');

  gallery.querySelectorAll('.example-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => loadImage(thumb.dataset.url));
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function setupDropZone() {
  const zone = $('#drop-zone');
  const fileInput = $('#file-input');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(URL.createObjectURL(file));
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImage(URL.createObjectURL(fileInput.files[0]));
  });

  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        loadImage(URL.createObjectURL(blob));
        break;
      }
    }
  });
}

function canvasPointerCoords(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function updateHoverColorPreview(hex, rootSelector = '#hover-color-preview') {
  const tip = document.querySelector(rootSelector);
  if (!tip) return;

  const { r, g, b } = hexToRgb(hex);
  tip.classList.remove('is-idle');
  tip.querySelector('.tip-swatch').style.background = hex;
  tip.querySelector('.tip-hex').textContent = hex.toUpperCase();
  tip.querySelector('.tip-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
  const hint = tip.querySelector('.tip-hint');
  if (hint) hint.textContent = '悬停中';
}

function hideHoverColorPreview() {
  if (state.sourceCanvas) setHoverColorPreviewIdle();
}

function hideZoomHoverPreview() {
  setHoverColorPreviewIdle('#zoom-hover-preview');
}

function handleImagePick(x, y, { closeZoom = false } = {}) {
  const hex = pickColorAt(state.imageData, x, y);
  state.pickedColor = hex;
  state.pickedPoint = { x, y };
  showPickedColorUI(hex);
  if (closeZoom) closeModal('zoom-pick-modal');
}

function applyZoomPickScale() {
  const canvas = $('#zoom-pick-canvas');
  const scaleInput = $('#zoom-pick-scale');
  if (!canvas || !scaleInput) return;

  const scale = parseInt(scaleInput.value, 10) / 100;
  canvas.style.width = `${Math.round(canvas.width * scale)}px`;
  canvas.style.height = `${Math.round(canvas.height * scale)}px`;
  $('#zoom-pick-scale-val').textContent = `${Math.round(scale * 100)}%`;
}

function openZoomPickModal() {
  if (!state.sourceCanvas) return;

  const canvas = $('#zoom-pick-canvas');
  canvas.width = state.sourceCanvas.width;
  canvas.height = state.sourceCanvas.height;
  canvas.getContext('2d').drawImage(state.sourceCanvas, 0, 0);
  applyZoomPickScale();
  hideZoomHoverPreview();
  openModal('zoom-pick-modal');
}

function setupZoomPick() {
  const canvas = $('#zoom-pick-canvas');
  if (!canvas) return;

  $('#btn-zoom-pick')?.addEventListener('click', openZoomPickModal);
  $('#btn-close-zoom-pick')?.addEventListener('click', () => closeModal('zoom-pick-modal'));

  $('#zoom-pick-scale')?.addEventListener('input', () => {
    applyZoomPickScale();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.imageData) return;
    const { x, y } = canvasPointerCoords(canvas, e);
    const hex = pickColorAt(state.imageData, x, y);
    updateHoverColorPreview(hex, '#zoom-hover-preview');
  });

  canvas.addEventListener('mouseleave', hideZoomHoverPreview);

  canvas.addEventListener('click', (e) => {
    if (!state.imageData) return;
    const { x, y } = canvasPointerCoords(canvas, e);
    handleImagePick(x, y, { closeZoom: true });
    showToast('已选取颜色，可在下方加入配色');
  });
}

function setupCanvasClick() {
  const canvas = $('#image-canvas');
  const frame = $('#canvas-frame');

  canvas.addEventListener('mousemove', (e) => {
    if (!state.imageData || frame.hidden) return;
    const { x, y } = canvasPointerCoords(canvas, e);
    const hex = pickColorAt(state.imageData, x, y);
    updateHoverColorPreview(hex);
  });

  canvas.addEventListener('mouseleave', hideHoverColorPreview);

  frame.addEventListener('mouseleave', hideHoverColorPreview);

  canvas.addEventListener('click', (e) => {
    if (!state.imageData || frame.hidden) return;
    const { x, y } = canvasPointerCoords(canvas, e);
    handleImagePick(x, y);
  });

  $('#btn-add-picked').addEventListener('click', applyPickedColor);

  $('#picked-target-slot')?.addEventListener('change', (e) => {
    const idx = e.target.value;
    document.querySelectorAll('.palette-slot').forEach(s => {
      s.classList.toggle('target-selected', s.dataset.index === idx);
    });
  });

  window.addEventListener('resize', () => {
    syncWorkspacePanelHeights();
  });

  const inputPanel = document.querySelector('.panel-input');
  if (inputPanel && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => syncWorkspacePanelHeights()).observe(inputPanel);
  }
}

function setupControls() {
  $('#color-count').addEventListener('input', (e) => {
    $('#color-count-val').textContent = e.target.value;
    extractAndRender();
  });

  $('#ignore-bg').addEventListener('change', extractAndRender);
  $('#style-preset').addEventListener('change', renderAll);
  $('#colorbrewer-set').addEventListener('change', renderAll);

  $('#sat-slider').addEventListener('input', (e) => {
    $('#sat-val').textContent = e.target.value;
    renderAll();
  });

  $('#bright-slider').addEventListener('input', (e) => {
    $('#bright-val').textContent = e.target.value;
    renderAll();
  });

  $('#colorblind-select').addEventListener('change', renderAll);
  $('#grayscale-preview').addEventListener('change', renderAll);

  $('#btn-reextract').addEventListener('click', () => {
    state.lockedIndices.clear();
    state.excludedColors.clear();
    extractAndRender();
  });

  $('#btn-reset-palette').addEventListener('click', resetToDefaultExtraction);

  $('#btn-load-url').addEventListener('click', () => {
    const url = $('#url-input').value.trim();
    if (url) loadImage(url);
  });

  $('#url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-load-url').click();
  });
}

function setupExport() {
  $('#btn-copy-export').addEventListener('click', async () => {
    const text = $('#export-code').textContent;
    await copyToClipboard(text);
    showToast('已复制到剪贴板');
  });

  $('#btn-download-export').addEventListener('click', () => {
    const format = EXPORT_FORMATS.find(f => f.id === state.currentExportFormat);
    const text = $('#export-code').textContent;
    downloadFile(text, `figurehue-palette.${format.ext}`);
    showToast('已下载');
  });
}

function applyStandalonePalette(colors, message = '色板已导入') {
  state.imageData = null;
  state.sourceCanvas = null;
  state.clusters = [];
  state.rawColors = [...colors];
  state.lockedIndices.clear();
  state.excludedColors.clear();
  state.pickedColor = null;
  state.pickedPoint = null;

  $('#style-preset').value = 'original';
  $('#colorbrewer-set').value = '';
  $('#sat-slider').value = 0;
  $('#bright-slider').value = 0;
  $('#sat-val').textContent = '0';
  $('#bright-val').textContent = '0';
  $('#colorblind-select').value = 'normal';
  if (colors.length >= 3 && colors.length <= 8) {
    $('#color-count').value = String(colors.length);
    $('#color-count-val').textContent = String(colors.length);
  }

  showImagePreview(false);
  renderAll();
  showToast(message);
}

function setupPaletteExchange() {
  const text = $('#import-palette-text');
  const fileInput = $('#import-palette-file');

  $('#btn-import-palette').addEventListener('click', () => {
    text.value = '';
    fileInput.value = '';
    openModal('import-modal');
    text.focus();
  });

  $('#btn-close-import').addEventListener('click', () => closeModal('import-modal'));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      text.value = await file.text();
      showToast(`已读取 ${file.name}`);
    } catch {
      showToast('文件读取失败');
    }
  });

  $('#btn-confirm-import').addEventListener('click', () => {
    try {
      const colors = parsePaletteText(text.value);
      applyStandalonePalette(colors, `已导入 ${colors.length} 种颜色`);
      closeModal('import-modal');
    } catch (err) {
      showToast(err.message);
    }
  });

  $('#btn-share-palette').addEventListener('click', async () => {
    const url = buildShareUrl(getDisplayColors());
    await copyToClipboard(url);
    showToast('分享链接已复制');
  });

  const shared = readSharedPalette();
  if (shared) applyStandalonePalette(shared, `已从分享链接载入 ${shared.length} 种颜色`);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

function openModal(id) {
  ['compare-modal', 'save-modal', 'zoom-pick-modal', 'import-modal'].forEach(closeModal);
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function setupModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.hidden = true;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('compare-modal');
      closeModal('save-modal');
      closeModal('zoom-pick-modal');
      closeModal('import-modal');
    }
  });
}

function setupSave() {
  $('#btn-save-palette').addEventListener('click', () => {
    openModal('save-modal');
    $('#save-name').value = '';
    $('#save-name').focus();
  });

  $('#btn-close-save').addEventListener('click', () => {
    closeModal('save-modal');
  });

  $('#btn-confirm-save').addEventListener('click', () => {
    const name = $('#save-name').value.trim() || '未命名方案';
    savePalette(name, getDisplayColors());
    closeModal('save-modal');
    renderSavedPalettes();
    showToast('已保存: ' + name);
  });

  $('#save-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-confirm-save').click();
  });
}

function setupCompare() {
  $('#btn-compare').addEventListener('click', () => {
    state.savedPalettes = loadSavedPalettes();
    const current = { id: '__current__', name: '当前方案', colors: getDisplayColors() };
    const options = [current, ...state.savedPalettes];

    if (options.length < 2) {
      showToast('请先保存至少一个方案以便对比');
      return;
    }

    const selA = $('#compare-a');
    const selB = $('#compare-b');
    selA.innerHTML = options.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
    selB.innerHTML = options.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
    if (options.length > 1) selB.selectedIndex = 1;

    openModal('compare-modal');
    updateCompare();

    selA.onchange = updateCompare;
    selB.onchange = updateCompare;
  });

  $('#btn-close-compare').addEventListener('click', () => {
    closeModal('compare-modal');
  });

  function updateCompare() {
    const current = { id: '__current__', name: '当前方案', colors: getDisplayColors() };
    const all = [current, ...loadSavedPalettes()];
    const a = all.find(p => p.id === $('#compare-a').value);
    const b = all.find(p => p.id === $('#compare-b').value);
    if (!a || !b) return;

    $('#compare-palettes').innerHTML = [a, b].map(p => `
      <div class="compare-strip">
        <label>${escapeHtml(p.name)}</label>
        <div class="compare-colors">${p.colors.map(c => `<span style="background:${c}"></span>`).join('')}</div>
      </div>
    `).join('');

    renderCompareCharts(a.colors, b.colors, 'chart-compare');
  }
}

function init() {
  setupDropZone();
  setupCanvasClick();
  setupZoomPick();
  setupControls();
  setupExport();
  setupModals();
  setupPaletteExchange();
  setupSave();
  setupCompare();
  renderExampleGallery();
  renderSavedPalettes();
  renderExport();
  renderAll();

  requestAnimationFrame(syncWorkspacePanelHeights);
}

init();
