/** localStorage palette persistence */

const STORAGE_KEY = 'figurehue-saved';

export function loadSavedPalettes() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function savePalette(name, colors, meta = {}) {
  const palettes = loadSavedPalettes();
  const entry = {
    id: Date.now().toString(36),
    name,
    colors: [...colors],
    created: new Date().toISOString(),
    ...meta,
  };
  palettes.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes.slice(0, 50)));
  return entry;
}

export function deletePalette(id) {
  const palettes = loadSavedPalettes().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  return palettes;
}

export function updatePalette(id, updates) {
  const palettes = loadSavedPalettes().map(p =>
    p.id === id ? { ...p, ...updates, colors: updates.colors ? [...updates.colors] : p.colors } : p
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  return palettes;
}
