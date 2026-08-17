import { state, setData } from "../data/useStore.js";
import { INDICATORS_KEY, readStoredArray, writePersistent } from "./persistence.js";
import { WIDGET_CATALOG } from "./dashboardWidgets.js";
import { evaluateIndicatorFormula, describeIndicatorFormula, indicatorDetailRows, richLineDetail, isSingleLineFormula } from "./indicatorFormula.js";
import { iconFor, nameForIcon } from "./indicatorIcons.js";

// Every category whose cards are just "a formula over managerial-plan
// lines" — DRE and Balanço used to be plain single-line lookups
// (lib/dashboardWidgets.js's old fromTree helper), Indicadores were always
// ratio/sum formulas. All three now share the exact same editable shape.
export const EDITABLE_CATEGORIES = ["Indicadores", "DRE", "Balanço"];

// A pristine snapshot of every built-in card across the editable
// categories, captured once at module load — before any override has ever
// been applied. This is what "restaurar padrão" reverts to, and what tells
// the editor whether a given card is a built-in (resettable, not
// deletable) or a custom one (deletable, not resettable).
const BUILTIN_SNAPSHOT = new Map(
  WIDGET_CATALOG.filter((definition) => EDITABLE_CATEGORIES.includes(definition.category)).map((definition) => [
    definition.id,
    { label: definition.label, category: definition.category, icon: definition.icon, defaultSize: definition.defaultSize, formula: definition.formula },
  ])
);

export function isBuiltinIndicator(id) {
  return BUILTIN_SNAPSHOT.has(id);
}

export function builtinIndicatorIds() {
  return [...BUILTIN_SNAPSHOT.keys()];
}

function buildEntry(record) {
  const formula = record.formula;
  return {
    id: record.id,
    label: record.label,
    category: record.category || "Indicadores",
    // Every other "no explicit type" entry in the original WIDGET_CATALOG
    // literal gets backfilled to "kpi" by a one-time .map() at module load
    // (see dashboardWidgets.js) — that backfill never runs again, so an
    // entry pushed in later (built-in override or custom) has to set this
    // itself or WidgetBody has nothing to dispatch on and renders nothing.
    type: "kpi",
    icon: iconFor(record.icon),
    defaultSize: record.defaultSize || "sm",
    formula,
    builtin: BUILTIN_SNAPSHOT.has(record.id),
    value: (ctx) => evaluateIndicatorFormula(formula, ctx),
    detail: (ctx) =>
      isSingleLineFormula(formula)
        ? richLineDetail(formula.numerator[0].code, ctx)
        : { formula: describeIndicatorFormula(formula), rows: indicatorDetailRows(formula, ctx) },
  };
}

// Mutates the shared WIDGET_CATALOG array in place. Every screen that reads
// it — the live dashboard, Personalizar's picker, "Gerar relatórios", this
// admin page — imports the same module-level array, so patching entries
// here is what makes an edit show up everywhere at once without threading
// this state through nine separate files. The `setData` call in persist()
// below is what actually triggers those screens to re-render and read the
// freshly patched array (mutating it alone wouldn't).
function resetBuiltinsInCatalog() {
  BUILTIN_SNAPSHOT.forEach((snapshot, id) => {
    const index = WIDGET_CATALOG.findIndex((item) => item.id === id);
    if (index === -1) return;
    WIDGET_CATALOG[index] = buildEntry({ id, ...snapshot });
  });
}

function removeStaleCustomEntries(overrides) {
  const keepIds = new Set([...BUILTIN_SNAPSHOT.keys(), ...overrides.map((item) => item.id)]);
  for (let index = WIDGET_CATALOG.length - 1; index >= 0; index -= 1) {
    const item = WIDGET_CATALOG[index];
    if (EDITABLE_CATEGORIES.includes(item.category) && !keepIds.has(item.id)) WIDGET_CATALOG.splice(index, 1);
  }
}

function applyOverrides(overrides) {
  overrides.forEach((record) => {
    const entry = buildEntry(record);
    const index = WIDGET_CATALOG.findIndex((item) => item.id === record.id);
    if (index === -1) WIDGET_CATALOG.push(entry);
    else WIDGET_CATALOG[index] = entry;
  });
}

// Every built-in first reverts to its pristine snapshot, then whatever's
// actually stored gets reapplied on top — otherwise a reset/deleted
// override would leave the previous patched object sitting in the array.
function syncCatalog(overrides) {
  resetBuiltinsInCatalog();
  removeStaleCustomEntries(overrides);
  applyOverrides(overrides);
}

export async function loadIndicatorOverrides() {
  const overrides = await readStoredArray(INDICATORS_KEY);
  syncCatalog(overrides);
  setData({ indicatorOverrides: overrides });
}

function persist(overrides) {
  writePersistent(INDICATORS_KEY, overrides);
  syncCatalog(overrides);
  setData({ indicatorOverrides: overrides });
}

// `record`: { id, label, category, icon (name string), defaultSize, formula }.
// Used both to create a brand-new custom card and to save an edit to a
// built-in one (which just adds/replaces its override).
export function saveIndicator(record) {
  const overrides = state.indicatorOverrides.filter((item) => item.id !== record.id);
  overrides.push({ ...record, icon: typeof record.icon === "string" ? record.icon : nameForIcon(record.icon) });
  persist(overrides);
}

// Built-ins: drops the override, reverting to the pristine default.
// No-op (returns false) if there's nothing to revert.
export function resetIndicator(id) {
  if (!state.indicatorOverrides.some((item) => item.id === id)) return false;
  persist(state.indicatorOverrides.filter((item) => item.id !== id));
  return true;
}

// Custom cards only — built-ins can be reset but never deleted, since
// deleting one would leave a hole in the standard catalog every other
// company's workspace expects to find.
export function deleteCustomIndicator(id) {
  if (BUILTIN_SNAPSHOT.has(id)) return false;
  persist(state.indicatorOverrides.filter((item) => item.id !== id));
  return true;
}

export function makeIndicatorId() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
