// Shared grid math between the editable canvas (Personalizar) and the real
// read-only view (a tab), so what you arrange is pixel-for-pixel what shows
// up later — both just feed the same layout array into react-grid-layout,
// one with drag/resize on, the other off.
// 8 colunas (dobrado de 4) — granularidade maior pra posicionar/redimensionar
// widgets. Os presets de tamanho abaixo foram dobrados junto (sm/md/lg) pra
// manter a MESMA aparência de antes; layouts já salvos em cada empresa
// (`layout.x`/`layout.w`) foram migrados uma única vez (x2) num script
// separado — não fazem mais sentido lidos contra o valor antigo de 4.
export const GRID_COLS = 8;
export const ROW_HEIGHT = 24;

// How much air sits between cards — a per-tab/subtab choice (stored as
// `spacing` on the tab object, see dashboardTabs.js) rather than a fixed
// constant, since a dense KPI wall and a loose "just the highlights" tab
// want different amounts of breathing room. Same value drives the editor,
// the live view, and the PDF export, so what you set is what you get
// everywhere.
export const SPACING_PRESETS = { compacto: 10, normal: 18, amplo: 28 };
export const DEFAULT_SPACING = "normal";

export function marginPxFor(spacing) {
  return SPACING_PRESETS[spacing] ?? SPACING_PRESETS[DEFAULT_SPACING];
}

const SIZE_PRESET = {
  sm: { w: 2, h: 6 },
  md: { w: 4, h: 8 },
  lg: { w: 8, h: 12 },
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
