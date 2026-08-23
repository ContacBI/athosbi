import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RGL, { WidthProvider } from "react-grid-layout/legacy";
import { GripVertical, Plus, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { WIDGET_CATALOG, formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { WidgetBody, DetailModal } from "./WidgetGrid.jsx";
import { GRID_COLS, ROW_HEIGHT, layoutFor, marginPxFor, DEFAULT_SPACING } from "./gridLayout.js";

const GridLayout = WidthProvider(RGL);

// The tab's canvas in edit mode: the real widgets, rendered live, free to
// drag anywhere and resize from any corner — react-grid-layout handles the
// collision/compaction math, we just persist whatever layout it settles on.
export default function CanvasEditor({ widgets, ctx, spacing = DEFAULT_SPACING, onLayoutChange, onRemove, onAddClick, readOnly = false }) {
  const [detailFor, setDetailFor] = useState(null);
  const navigate = useNavigate();
  const appState = useAppState();
  const marginPx = marginPxFor(spacing);
  // See the matching comment in WidgetGrid.jsx — WIDGET_CATALOG gets
  // patched in place by lib/indicators.js, so this map needs to rebuild
  // whenever indicatorOverrides changes, not just once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogById = useMemo(() => new Map(WIDGET_CATALOG.map((definition) => [definition.id, definition])), [appState.indicatorOverrides]);

  const layout = useMemo(
    () => widgets.map((entry) => layoutFor(entry, catalogById.get(entry.id))),
    [widgets, catalogById]
  );

  function handleOpenDetail(definition) {
    const { value, format } = definition.value(ctx);
    const detail = definition.detail(ctx);
    setDetailFor({ title: definition.label, value: formatWidgetValue(value, format), ...detail });
  }

  return (
    <>
      <GridLayout
        className="layout"
        layout={layout}
        cols={GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[marginPx, marginPx]}
        containerPadding={[0, 0]}
        draggableHandle=".widget-drag-handle"
        isDraggable={!readOnly}
        isResizable={!readOnly}
        onLayoutChange={onLayoutChange}
      >
        {widgets.map((entry) => {
          const definition = catalogById.get(entry.id);
          if (!definition) return null;
          return (
            <div key={entry.id} className="group relative overflow-hidden rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-transparent transition-shadow hover:shadow-md">
              {!readOnly && (
                <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                  <span
                    className="widget-drag-handle pointer-events-auto flex h-6 w-6 cursor-move items-center justify-center rounded-md bg-white/95 text-ink-400 shadow ring-1 ring-line hover:text-accent-600"
                    title="Arrastar"
                  >
                    <GripVertical size={13} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-danger-600 shadow ring-1 ring-line hover:bg-danger-50"
                    aria-label={`Remover ${definition.label}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="h-full overflow-hidden">
                <WidgetBody definition={definition} ctx={ctx} onOpenDetail={handleOpenDetail} onNavigate={navigate} />
              </div>
            </div>
          );
        })}
      </GridLayout>

      {!readOnly && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-3 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong py-6 text-ink-400 transition-colors hover:border-accent-400 hover:text-accent-600"
        >
          <Plus size={20} strokeWidth={1.8} />
          <span className="text-[12px] font-medium">Adicionar</span>
        </button>
      )}

      <DetailModal detail={detailFor} onClose={() => setDetailFor(null)} />
    </>
  );
}
