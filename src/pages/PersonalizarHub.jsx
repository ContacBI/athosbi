import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { createTab, updateTab, deleteTab, createSubTab, updateSubTab, deleteSubTab } from "../lib/dashboardTabs.js";
import { replicateDashboardTabs } from "../lib/companies.js";
import { buildDashboardContext } from "../lib/dashboardData.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import Avatar from "../components/Avatar.jsx";
import CanvasEditor from "../components/dashboard/CanvasEditor.jsx";
import CatalogPicker from "../components/dashboard/CatalogPicker.jsx";
import Demonstrativos from "./Demonstrativos.jsx";

function ReplicateWorkspaceModal({ sourceCompany, otherCompanies, onClose, onApplied }) {
  const [selected, setSelected] = useState(new Set());

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApply() {
    if (!selected.size) return;
    const names = otherCompanies.filter((company) => selected.has(company.id)).map((company) => company.name);
    if (
      !confirm(
        `Substituir todo o workspace (abas, subabas e widgets) de ${names.length === 1 ? names[0] : `${names.length} empresas`} pelo workspace atual de "${sourceCompany.name}"? O que essas empresas já tinham montado será perdido.`
      )
    )
      return;
    const applied = replicateDashboardTabs(sourceCompany.id, [...selected]);
    onApplied(applied);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[16px] font-medium text-ink-900">Replicar relatórios</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-400">Use "{sourceCompany.name}" como modelo pra outras empresas.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {otherCompanies.length === 0 ? (
            <p className="text-[13px] text-ink-400">Cadastre outra empresa primeiro pra poder replicar o workspace pra ela.</p>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] text-ink-500">Escolha pra quais empresas copiar este workspace inteiro:</p>
              <div className="flex flex-col gap-1">
                {otherCompanies.map((company) => (
                  <label
                    key={company.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                      selected.has(company.id) ? "bg-accent-50" : "hover:bg-surface-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(company.id)}
                      onChange={() => toggle(company.id)}
                      className="h-4 w-4 rounded border-line-strong text-accent-500 focus:ring-accent-400"
                    />
                    <Avatar name={company.name} size={26} />
                    <span className="text-[13px] text-ink-700">{company.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {otherCompanies.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!selected.size}
              className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aplicar{selected.size > 0 ? ` pra ${selected.size}` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTED_DEFAULT = [
  { id: "dre_receita_liquida", size: "sm" },
  { id: "dre_resultado_liquido", size: "sm" },
  { id: "ratio_margem_bruta", size: "sm" },
  { id: "ratio_margem_liquida", size: "sm" },
  { id: "bp_ativo", size: "sm" },
  { id: "ratio_liquidez_corrente", size: "sm" },
  { id: "chart_resultado", size: "lg" },
  { id: "chart_balanco", size: "md" },
  { id: "list_destaques_dre", size: "md" },
  { id: "list_checklist", size: "md" },
];

function TabPill({ item, active, small, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);

  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  function commit() {
    setEditing(false);
    const trimmed = name.trim() || "Sem nome";
    if (trimmed !== item.name) onRename(trimmed);
  }

  const textSize = small ? "text-[12.5px]" : "text-[13px]";

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setName(item.name);
            setEditing(false);
          }
        }}
        className={`rounded-full border border-accent-400 bg-white px-3.5 py-1 font-medium text-ink-900 outline-none ${textSize}`}
      />
    );
  }

  return (
    <div
      className={`group flex shrink-0 items-center gap-1 rounded-full py-1 pl-3.5 pr-1.5 transition-colors ${textSize} ${
        active ? "bg-accent-500 font-medium text-white" : "bg-surface-muted text-ink-600 hover:bg-line"
      }`}
    >
      <button type="button" onClick={onSelect} onDoubleClick={() => setEditing(true)} className="py-0.5">
        {item.name}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Renomear"
        className={`rounded-full px-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${
          active ? "hover:bg-white/20" : "hover:bg-white"
        }`}
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Excluir"
        className={`flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 ${
          active ? "hover:bg-white/20" : "hover:bg-white"
        }`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function PersonalizarHub() {
  const appState = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = appState.dashboardTabs || [];

  const [activeId, setActiveId] = useState(location.state?.tabId || tabs[0]?.id || null);
  const [activeSubId, setActiveSubId] = useState(location.state?.subId || null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const activeCompany = appState.companies.find((company) => company.id === appState.activeCompanyId) || null;
  const otherCompanies = appState.companies.filter((company) => company.id !== appState.activeCompanyId);
  const activeTab = tabs.find((item) => item.id === activeId) || null;
  const subTabs = activeTab?.subTabs || [];
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;

  const ctx = useMemo(() => {
    if (!hasData) return null;
    return buildDashboardContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, appState.mappings, appState.accounts, appState.journal, appState.periodStart, appState.periodEnd]);

  useEffect(() => {
    if (!activeId && tabs.length) setActiveId(tabs[0].id);
    if (activeId && !tabs.some((tab) => tab.id === activeId) && tabs.length) setActiveId(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length]);

  useEffect(() => {
    if (subTabs.length && !subTabs.some((sub) => sub.id === activeSubId)) setActiveSubId(subTabs[0].id);
    if (!subTabs.length && activeSubId) setActiveSubId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, subTabs.length]);

  // A tab is either a flat canvas or a container of sub-tabs. Whichever one
  // is in play right now is what every editing action below targets.
  const editTarget = subTabs.length > 0 ? subTabs.find((sub) => sub.id === activeSubId) || null : activeTab;
  const editWidgets = editTarget?.widgets || [];
  const selectedIds = useMemo(() => new Set(editWidgets.map((entry) => entry.id)), [editWidgets]);

  // Same idea as the live view: a tab/subtab whose sole content is a "DRE
  // completo" / "Balanço completo" shortcut IS that report — embed it full
  // size instead of a manageable grid. "Usar sugestão"/"Esvaziar" above it
  // are still there as the way back into a normal widget canvas.
  const soleLinkDefinition = editWidgets.length === 1 ? WIDGET_CATALOG.find((definition) => definition.id === editWidgets[0].id) : null;
  const isSoleLink = soleLinkDefinition?.type === "link" && soleLinkDefinition.href === "/empresa/demonstrativos";

  function saveEditTarget(patch) {
    if (!activeTab || !editTarget) return;
    if (subTabs.length > 0) updateSubTab(activeTab.id, editTarget.id, patch);
    else updateTab(activeTab.id, patch);
  }

  function handleCreateTab() {
    const tab = createTab("Nova aba");
    setActiveId(tab.id);
    setActiveSubId(null);
  }

  function handleDeleteTab(tab) {
    if (!confirm(`Excluir a aba "${tab.name}"?`)) return;
    deleteTab(tab.id);
    if (activeId === tab.id) setActiveId(null);
  }

  function handleCreateSubTab() {
    if (!activeTab) return;
    const sub = createSubTab(activeTab.id, "Nova subaba");
    setActiveSubId(sub.id);
  }

  function handleDeleteSubTab(sub) {
    if (!activeTab) return;
    if (!confirm(`Excluir a subaba "${sub.name}"?`)) return;
    deleteSubTab(activeTab.id, sub.id);
    if (activeSubId === sub.id) setActiveSubId(null);
  }

  function toggleWidget(definition) {
    if (!editTarget) return;
    const next = selectedIds.has(definition.id)
      ? editWidgets.filter((entry) => entry.id !== definition.id)
      : [...editWidgets, { id: definition.id, size: definition.defaultSize || "sm" }];
    saveEditTarget({ widgets: next });
  }

  function handleLayoutChange(nextLayout) {
    if (!editTarget) return;
    const layoutById = new Map(nextLayout.map((item) => [item.i, { x: item.x, y: item.y, w: item.w, h: item.h }]));
    const widgets = editWidgets.map((entry) => ({ ...entry, layout: layoutById.get(entry.id) || entry.layout }));
    saveEditTarget({ widgets });
  }

  function removeWidget(widgetId) {
    if (!editTarget) return;
    saveEditTarget({ widgets: editWidgets.filter((entry) => entry.id !== widgetId) });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-strong text-ink-500 hover:bg-surface-muted"
            aria-label="Voltar"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <span className="text-[12px] font-medium uppercase tracking-wide text-accent-600">Personalizar</span>
            <h1 className="mt-0.5 text-[20px] font-medium leading-tight text-ink-900">
              {appState.activeGroupId ? "O workspace consolidado deste grupo" : "O workspace desta empresa"}
            </h1>
          </div>
        </div>
        {!appState.activeGroupId && activeCompany && (
          <div className="flex items-center gap-2">
            {flash && <span className="text-[12px] text-ink-400">{flash}</span>}
            <button
              type="button"
              onClick={() => setReplicateOpen(true)}
              title="Copiar este workspace inteiro pra outras empresas"
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-surface-muted"
            >
              <Copy size={14} strokeWidth={1.8} />
              Replicar relatórios
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm">
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            item={tab}
            active={activeId === tab.id}
            onSelect={() => {
              setActiveId(tab.id);
              setActiveSubId(null);
            }}
            onRename={(name) => updateTab(tab.id, { name })}
            onDelete={() => handleDeleteTab(tab)}
          />
        ))}
        <button
          type="button"
          onClick={handleCreateTab}
          title="Criar nova aba"
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-[12px] text-ink-500 transition-colors hover:border-accent-400 hover:text-accent-600"
        >
          <Plus size={13} strokeWidth={2} />
          Nova aba
        </button>
      </div>

      {activeTab && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted/60 p-2 pl-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Subabas</span>
          {subTabs.map((sub) => (
            <TabPill
              key={sub.id}
              item={sub}
              active={activeSubId === sub.id}
              small
              onSelect={() => setActiveSubId(sub.id)}
              onRename={(name) => updateSubTab(activeTab.id, sub.id, { name })}
              onDelete={() => handleDeleteSubTab(sub)}
            />
          ))}
          <button
            type="button"
            onClick={handleCreateSubTab}
            title="Criar subaba"
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11.5px] text-ink-500 transition-colors hover:border-accent-400 hover:text-accent-600"
          >
            <Plus size={12} strokeWidth={2} />
            {subTabs.length === 0 ? "Criar subabas" : "Nova subaba"}
          </button>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <Sparkles size={22} strokeWidth={1.6} className="text-accent-400" />
          <p className="text-[13px] text-ink-500">Importe o balancete e o diário da empresa pra poder montar o workspace com dados reais.</p>
        </div>
      ) : !activeTab ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <Sparkles size={22} strokeWidth={1.6} className="text-accent-400" />
          <p className="text-[13px] text-ink-500">Crie uma aba acima pra começar a montar o workspace.</p>
        </div>
      ) : !editTarget ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <Sparkles size={22} strokeWidth={1.6} className="text-accent-400" />
          <p className="text-[13px] text-ink-500">Escolha ou crie uma subaba acima pra montar o conteúdo dela.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => saveEditTarget({ widgets: SUGGESTED_DEFAULT })}
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"
            >
              <Sparkles size={13} strokeWidth={1.8} />
              Usar sugestão
            </button>
            <button
              type="button"
              onClick={() => saveEditTarget({ widgets: [] })}
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"
            >
              <Trash2 size={13} strokeWidth={1.8} />
              Esvaziar
            </button>
          </div>

          {editWidgets.length === 0 && (
            <p className="text-[12px] text-ink-400">
              {subTabs.length > 0 ? "Esta subaba" : "Esta aba"} está vazia — clique em "Adicionar" abaixo pra escolher o que aparece aqui.
            </p>
          )}

          {isSoleLink ? (
            <Demonstrativos lockedTab={soleLinkDefinition.navState?.tab} />
          ) : (
            <CanvasEditor
              widgets={editWidgets}
              ctx={ctx}
              onLayoutChange={handleLayoutChange}
              onRemove={removeWidget}
              onAddClick={() => setCatalogOpen(true)}
            />
          )}
        </>
      )}

      {catalogOpen && editTarget && (
        <CatalogPicker ctx={ctx} selectedIds={selectedIds} onToggle={toggleWidget} onClose={() => setCatalogOpen(false)} />
      )}

      {replicateOpen && activeCompany && (
        <ReplicateWorkspaceModal
          sourceCompany={activeCompany}
          otherCompanies={otherCompanies}
          onClose={() => setReplicateOpen(false)}
          onApplied={(count) => {
            setReplicateOpen(false);
            setFlash(count > 0 ? `Replicado pra ${count} empresa${count === 1 ? "" : "s"}.` : "");
            if (count > 0) setTimeout(() => setFlash(""), 3500);
          }}
        />
      )}
    </div>
  );
}
