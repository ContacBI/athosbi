import { useMemo } from "react";
import { Check, Plus, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { WIDGET_CATALOG } from "../../lib/dashboardWidgets.js";
import { WidgetBody } from "./WidgetGrid.jsx";

const CATEGORY_ORDER = ["Demonstrações", "DRE", "Balanço", "Indicadores", "Gráficos", "Listas"];

function groupCatalog() {
  const byCategory = new Map();
  WIDGET_CATALOG.forEach((definition) => {
    if (!byCategory.has(definition.category)) byCategory.set(definition.category, []);
    byCategory.get(definition.category).push(definition);
  });
  return CATEGORY_ORDER.map((category) => ({ category, items: byCategory.get(category) || [] })).filter((group) => group.items.length);
}

// Every catalog item shown as it actually renders, live, with real data —
// a gallery instead of a checklist, so there's nothing left to imagine.
export default function CatalogPicker({ ctx, selectedIds, onToggle, onClose }) {
  const appState = useAppState();
  // WIDGET_CATALOG is a shared module-level array that lib/indicators.js
  // patches in place when an indicator is created/edited/reset — this must
  // be recomputed per render (keyed on indicatorOverrides) rather than
  // once at module load, or a catalog edit would never show up here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const GROUPS = useMemo(() => groupCatalog(), [appState.indicatorOverrides]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 py-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-accent-600">Catálogo</p>
            <p className="text-[15px] font-medium text-ink-900">Escolha o que entra nesta aba</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-page px-5 py-4">
          <div className="flex flex-col gap-5">
            {GROUPS.map((group) => (
              <div key={group.category}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">{group.category}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((definition) => {
                    const active = selectedIds.has(definition.id);
                    return (
                      <div
                        key={definition.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggle(definition)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onToggle(definition);
                          }
                        }}
                        className={`flex h-40 cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          active ? "border-accent-400 ring-2 ring-accent-200" : "border-line"
                        }`}
                      >
                        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-medium text-ink-700">{definition.label}</span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              active ? "bg-accent-500 text-white" : "bg-surface-muted text-ink-300"
                            }`}
                          >
                            {active ? <Check size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={2.5} />}
                          </span>
                        </div>
                        <div className="pointer-events-none flex-1 overflow-hidden text-[11px] [&_p]:text-[11px] [&_span]:text-[11px]">
                          {ctx ? <WidgetBody definition={definition} ctx={ctx} /> : <p className="text-ink-300">Sem dados</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-line px-5 py-3">
          <p className="text-[11px] text-ink-400">{selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
          >
            <Check size={14} strokeWidth={2} />
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
