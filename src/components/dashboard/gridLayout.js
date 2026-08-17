// Shared grid math between the editable canvas (Personalizar) and the real
// read-only view (a tab), so what you arrange is pixel-for-pixel what shows
// up later — both just feed the same layout array into react-grid-layout,
// one with drag/resize on, the other off.
export const GRID_COLS = 4;
export const ROW_HEIGHT = 24;

const SIZE_PRESET = {
  sm: { w: 1, h: 6 },
  md: { w: 2, h: 8 },
  lg: { w: 4, h: 12 },
};

// entry: { id, size?, layout? } from a tab's widgets array.
// definition: the matching WIDGET_CATALOG entry (for its defaultSize).
export function layoutFor(entry, definition) {
  if (entry.layout) {
    return { i: entry.id, x: entry.layout.x, y: entry.layout.y, w: entry.layout.w, h: entry.layout.h };
  }
  const preset = SIZE_PRESET[entry.size || definition?.defaultSize || "sm"] || SIZE_PRESET.sm;
  // y: Infinity tells react-grid-layout to auto-place this at the bottom,
  // right where a freshly-added widget belongs.
  return { i: entry.id, x: 0, y: Infinity, ...preset };
}
