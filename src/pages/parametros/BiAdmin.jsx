import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ChevronDown, Pencil, Plus, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { WIDGET_CATALOG } from "../../lib/dashboardWidgets.js";
import { buildConsolidatedContext } from "../../lib/consolidatedContext.js";
import { EDITABLE_CATEGORIES, isBuiltinIndicator, saveIndicator, resetIndicator, deleteCustomIndicator } from "../../lib/indicators.js";
import { WidgetBody } from "../../components/dashboard/WidgetGrid.jsx";
import IndicatorEditorModal from "../../components/IndicatorEditorModal.jsx";
import PageHeader from "../../components/PageHeader.jsx";

const CATEGORY_ORDER = ["Demonstrações", "DRE", "Balanço", "Indicadores", "Gráficos", "Listas"];

const TYPE_LABEL = {
  kpi: "Card",
  chart: "Gráfico",
  table: "Tabela",
  list: "Lista",
  link: "Atalho",
};

function PreviewModal({ definition, ctx, onNavigate, onClose }) {
  if (!definition) return null;
  const isLink = definition.type === "link";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-accent-600">
            {isLink ? "Atalho" : "Pré-visualização · carteira consolidada"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-1 mb-4 text-[15px] font-medium text-ink-900">{definition.label}</p>
        <div className="rounded-xl border border-line bg-surface-page p-4">
          {isLink ? (
            <WidgetBody definition={definition} ctx={ctx} onNavigate={onNavigate} />
          ) : ctx ? (
            <WidgetBody definition={definition} ctx={ctx} />
          ) : (
            <p className="text-[12px] text-ink-400">Nenhuma empresa com dados importados ainda.</p>
          )}
        </div>
        {isLink && <p className="mt-3 text-[11px] text-ink-400">Abre o relatório de verdade, na empresa ativa no momento.</p>}
      </div>
    </div>
  );
}

export default function BiAdmin() {
  const appState = useAppState();
  const navigate = useNavigate();
  const [openCategories, setOpenCategories] = useState({ Indicadores: true });
  const [previewItem, setPreviewItem] = useState(null);
  // undefined = closed, null = creating a new indicator, a definition = editing one.
  const [editorTarget, setEditorTarget] = useState(undefined);
  const [newItemCategory, setNewItemCategory] = useState("Indicadores");

  const hasAnyData = appState.companies.some((company) => (company.accounts || []).length || (company.journal || []).length);

  // Preview data = every company in the wallet merged together, since B.I.
  // isn't scoped to one client — it's the library every workspace draws from.
  const ctx = useMemo(() => {
    if (!hasAnyData) return null;
    return buildConsolidatedContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyData, appState.companies]);

  // WIDGET_CATALOG is a shared module-level array that lib/indicators.js
  // patches in place (see its own comment) rather than a piece of React
  // state — appState.indicatorOverrides changing is what tells this memo an
  // edit happened and it's time to re-read the array, even though the
  // array reference itself never changes.
  const groups = useMemo(() => {
    const byCategory = new Map();
    WIDGET_CATALOG.forEach((definition) => {
      if (!byCategory.has(definition.category)) byCategory.set(definition.category, []);
      byCategory.get(definition.category).push(definition);
    });
    return CATEGORY_ORDER.map((category) => ({ category, items: byCategory.get(category) || [] })).filter((group) => group.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.indicatorOverrides]);

  function toggleCategory(category) {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  function handleSaveIndicator(record) {
    saveIndicator(record);
    setEditorTarget(undefined);
  }

  function handleResetIndicator(id) {
    resetIndicator(id);
    setEditorTarget(undefined);
  }

  function handleDeleteIndicator(id) {
    if (!confirm("Excluir esse indicador personalizado? Ele some do catálogo e de qualquer aba que já o usa.")) return;
    deleteCustomIndicator(id);
    setEditorTarget(undefined);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros"
        title="B.I."
        description="O catálogo de relatórios, cards e gráficos que ficam disponíveis pra qualquer empresa personalizar. É daqui que sai a lista que aparece no Personalizar de cada cliente."
        icon={BarChart3}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-3.5 shadow-sm">
          <p className="text-[11px] text-ink-400">Itens no catálogo</p>
          <p className="mt-1 text-[19px] font-medium text-ink-900">{WIDGET_CATALOG.length}</p>
        </div>
        <div className="rounded-xl bg-white p-3.5 shadow-sm">
          <p className="text-[11px] text-ink-400">Categorias</p>
          <p className="mt-1 text-[19px] font-medium text-ink-900">{groups.length}</p>
        </div>
        <div className="rounded-xl bg-white p-3.5 shadow-sm">
          <p className="text-[11px] text-ink-400">Disponível para</p>
          <p className="mt-1 text-[19px] font-medium text-ink-900">Todas as empresas</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const open = Boolean(openCategories[group.category]);
          const isEditable = EDITABLE_CATEGORIES.includes(group.category);
          return (
            <div key={group.category} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex w-full items-center justify-between px-4 py-3">
                <button type="button" onClick={() => toggleCategory(group.category)} className="flex flex-1 items-center gap-2 text-left">
                  <span className="text-[12px] font-medium uppercase tracking-wide text-ink-500">{group.category}</span>
                  <span className="text-[11px] text-ink-400">{group.items.length} itens</span>
                </button>
                <div className="flex items-center gap-2">
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewItemCategory(group.category);
                        setEditorTarget(null);
                        setOpenCategories((prev) => ({ ...prev, [group.category]: true }));
                      }}
                      className="flex items-center gap-1 rounded-md bg-accent-500 px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:bg-accent-600"
                    >
                      <Plus size={12} />
                      {group.category === "Indicadores" ? "Novo indicador" : "Novo card"}
                    </button>
                  )}
                  <button type="button" onClick={() => toggleCategory(group.category)} aria-label="Expandir/recolher">
                    <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
              {open && (
                <div className="grid grid-cols-1 gap-2 border-t border-line px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((definition) => {
                    const Icon = definition.icon;
                    const custom = isEditable && !isBuiltinIndicator(definition.id);
                    const overridden = isEditable && !custom && appState.indicatorOverrides.some((item) => item.id === definition.id);
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        onClick={() => (isEditable ? setEditorTarget(definition) : setPreviewItem(definition))}
                        className="group flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent-400 hover:bg-surface-muted"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600">
                          {Icon ? <Icon size={14} strokeWidth={1.8} /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink-800">
                            <span className="truncate">{definition.label}</span>
                            {custom && <span className="shrink-0 rounded-full bg-accent-50 px-1.5 py-0.5 text-[9.5px] font-medium text-accent-600">novo</span>}
                            {overridden && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[9.5px] font-medium text-ink-500">editado</span>}
                          </p>
                          <p className="text-[11px] text-ink-400">{TYPE_LABEL[definition.type] || definition.type}</p>
                        </div>
                        {isEditable && <Pencil size={12} className="mt-0.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PreviewModal definition={previewItem} ctx={ctx} onNavigate={navigate} onClose={() => setPreviewItem(null)} />

      {editorTarget !== undefined && (
        <IndicatorEditorModal
          definition={editorTarget}
          defaultCategory={newItemCategory}
          ctx={ctx}
          onClose={() => setEditorTarget(undefined)}
          onSave={handleSaveIndicator}
          onReset={handleResetIndicator}
          onDelete={handleDeleteIndicator}
        />
      )}
    </div>
  );
}
