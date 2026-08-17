import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, FileSpreadsheet, FileStack, FileText, LayoutGrid, Network, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { useAppState, setData, state } from "../data/useStore.js";
import { missingMappingAccounts } from "../data/calculations.js";
import { groupCompanies, activeWorkspaceName } from "../lib/groups.js";
import { usePageActions } from "../lib/pageActions.jsx";
import { buildDashboardContext } from "../lib/dashboardData.js";
import { buildSummaryExportRows } from "../lib/dashboardExport.js";
import { buildFullReportExport, slug } from "../lib/demonstrativoExport.js";
import { exportDemonstrativoPdf } from "../lib/reportPdf.js";
import { exportDemonstrativoExcel } from "../lib/reportExcel.js";
import { periodLabelPt } from "../lib/format.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import PeriodPicker from "./PeriodPicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Ghost buttons that live directly on the navy identity bar — same shape as
// the old white-background versions, just recolored for a dark surface.
const BAR_BUTTON = "flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-[12px] font-medium text-white/85 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white";

// A straight shortcut into "Relatórios mensais" now — no menu to open.
// Importing/attaching balancete, diário and de/para all live on their own
// screens (Relatórios mensais and De/Para, reachable from the "Dados | De/
// Para" nav that replaces the tab strip while there), since each needs real
// screen space (a 12-month grid, a searchable account list) that never fit
// well in a dropdown, and a click that opens yet another menu just to pick
// "Relatórios mensais" was one extra step for no reason.
function SettingsButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/empresa/relatorios")}
      aria-label="Dados e configurações"
      title="Dados e configurações"
      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-[15px] leading-none transition-colors hover:border-white/25 hover:bg-white/10"
    >
      ⚙️
    </button>
  );
}

const DEMONSTRATIVOS_HREF = "/empresa/demonstrativos";

// Every dashboard tab, flattened to its checkable items — a tab's own
// widgets, or (if it has sub-tabs) every sub-tab's widgets pooled together,
// since generating is per top-level tab, not per sub-tab.
function collectTabItems(tabs) {
  return (tabs || [])
    .map((tab) => {
      const widgetEntries = tab.subTabs?.length ? tab.subTabs.flatMap((sub) => sub.widgets || []) : tab.widgets || [];
      const items = widgetEntries
        .map((entry, index) => {
          const definition = WIDGET_CATALOG.find((item) => item.id === entry.id);
          return definition ? { key: `${tab.id}:${entry.id}:${index}`, entryId: entry.id, definition } : null;
        })
        .filter(Boolean);
      return { id: tab.id, name: tab.name, items };
    })
    .filter((tab) => tab.items.length > 0);
}

function isFullReportLink(definition) {
  return definition.type === "link" && definition.href === DEMONSTRATIVOS_HREF;
}

// The big picker: every tab this company has, with a checkbox per item, so
// the user flags exactly what goes into each tab's PDF/Excel — one file per
// tab. A "DRE completo"/"Balanço completo" item, wherever it's flagged,
// generates that report in full (whatever depth/columns are currently
// configured) rather than folding it into the flat summary table.
function ReportBuilderModal({ onClose }) {
  const appState = useAppState();
  const tabs = collectTabItems(appState.dashboardTabs);
  const [selected, setSelected] = useState(() => {
    const initial = {};
    tabs.forEach((tab) => {
      initial[tab.id] = new Set(tab.items.map((item) => item.key));
    });
    return initial;
  });
  const [busy, setBusy] = useState(false);

  function toggleItem(tabId, key) {
    setSelected((prev) => {
      const next = new Set(prev[tabId]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [tabId]: next };
    });
  }

  function toggleAll(tabId, items, checked) {
    setSelected((prev) => ({ ...prev, [tabId]: checked ? new Set(items.map((item) => item.key)) : new Set() }));
  }

  function generate(format) {
    setBusy(true);
    try {
      const workspaceName = activeWorkspaceName();
      tabs.forEach((tab) => {
        const checkedKeys = selected[tab.id] || new Set();
        const checkedItems = tab.items.filter((item) => checkedKeys.has(item.key));
        if (!checkedItems.length) return;

        const fullReportItems = checkedItems.filter((item) => isFullReportLink(item.definition));
        const summaryItems = checkedItems.filter((item) => !isFullReportLink(item.definition));

        // "DRE completo"/"Balanço completo" always gets its own full,
        // currently-configured report — flattening it into the summary
        // table would throw away exactly the detail the user asked to keep.
        fullReportItems.forEach((item) => {
          const built = buildFullReportExport(item.definition.navState?.tab === "BP" ? "BP" : "DRE");
          if (format === "pdf") exportDemonstrativoPdf(built);
          else exportDemonstrativoExcel(built);
        });

        if (summaryItems.length) {
          const ctx = buildDashboardContext();
          const meta = {
            companyName: workspaceName,
            reportName: tab.name,
            metaLine: [`Resumo · ${tab.name}`, periodLabelPt(state.periodStart, state.periodEnd)].filter(Boolean).join(" | "),
            fileLabel: slug(`resumo_${tab.name}_${workspaceName}`),
          };
          const columns = [{ key: "valor", label: "Valor" }];
          const rows = buildSummaryExportRows(summaryItems.map((item) => ({ id: item.entryId })), ctx);
          if (format === "pdf") exportDemonstrativoPdf({ ...meta, columns, rows });
          else exportDemonstrativoExcel({ ...meta, columns, rows });
        }
      });
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-surface-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[16px] font-medium text-ink-900">Relatórios personalizados</h2>
            <p className="text-[12px] text-ink-400">Escolha o que entra em cada arquivo — cada aba vira um PDF separado.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tabs.length === 0 && <p className="text-[13px] text-ink-400">Nenhuma aba com conteúdo pra exportar ainda.</p>}
          {tabs.map((tab) => {
            const checkedCount = selected[tab.id]?.size || 0;
            const allChecked = checkedCount === tab.items.length;
            return (
              <div key={tab.id} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-ink-900">{tab.name}</h3>
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
                    <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(tab.id, tab.items, event.target.checked)} />
                    Selecionar tudo
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {tab.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-700 hover:bg-surface-muted">
                      <input type="checkbox" checked={selected[tab.id]?.has(item.key) || false} onChange={() => toggleItem(tab.id, item.key)} />
                      <span className="truncate">{item.definition.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-4 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || tabs.length === 0}
            onClick={() => generate("excel")}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-[13px] text-ink-600 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet size={14} strokeWidth={1.8} />
            Gerar Excel
          </button>
          <button
            type="button"
            disabled={busy || tabs.length === 0}
            onClick={() => generate("pdf")}
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={14} strokeWidth={1.8} />
            {busy ? "Gerando…" : "Gerar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Two ways to leave with a report: "Relatório atual" fires the current
// screen's registered {pdf} handler as-is (whatever's on screen right now —
// Resumo, Demonstrativos, any tab); "Personalizado" opens the full builder
// covering every tab at once. Disappears entirely once there's no data to
// report on.
function ReportsMenu() {
  const appState = useAppState();
  const actions = usePageActions();
  const [open, setOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;
  if (!hasData) return null;
  const handlers = actions?.downloadHandlers;

  return (
    <>
      <div className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} className={BAR_BUTTON}>
          <FileStack size={13} strokeWidth={1.8} />
          Gerar relatórios
          <ChevronDown size={12} className={`text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 rounded-xl bg-surface-card p-1.5 shadow-lg ring-1 ring-line">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handlers?.pdf?.();
                }}
                disabled={!handlers?.pdf}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileText size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[13px] text-ink-800">Relatório atual</span>
                  <span className="block text-[11px] text-ink-400">Exatamente o que está na tela</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setBuilderOpen(true);
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted"
              >
                <SlidersHorizontal size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[13px] text-ink-800">Personalizado</span>
                  <span className="block text-[11px] text-ink-400">Escolher o que entra em cada PDF</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {builderOpen && <ReportBuilderModal onClose={() => setBuilderOpen(false)} />}
    </>
  );
}

// Every report — Resumo, Demonstrativos, DFC — silently drops whatever
// account has no De/Para instead of erroring, which is correct behavior for
// a partially-set-up company but dangerous once real numbers are being
// generated: an account imported this month with no mapping yet just
// vanishes from the totals with no visible sign anything is missing. This
// used to only surface inside an opt-in "Próximos passos" widget on Resumo
// — easy to never add — so it's pinned here instead, always on screen
// whenever there's a mapping gap, company or consolidated group alike.
function PendingMappingsBadge({ company }) {
  const appState = useAppState();
  const navigate = useNavigate();
  const hasData = appState.accounts.length > 0;
  const missing = useMemo(() => (hasData ? missingMappingAccounts() : []), [hasData, appState.accounts, appState.mappings]);
  if (!missing.length) return null;

  const label = `${missing.length} conta${missing.length === 1 ? "" : "s"} sem De/Para`;
  // A group has no single chart of accounts to jump into — the fix happens
  // per company — so it's shown there as a heads-up, not a shortcut.
  if (!company) {
    return (
      <span
        title="Alguma empresa deste grupo tem contas sem De/Para — os valores dela ficam de fora do consolidado até isso ser corrigido."
        className="flex h-8 items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 text-[12px] font-medium text-warning-500"
      >
        <TriangleAlert size={13} strokeWidth={1.8} />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate("/empresa/de-para")}
      title="Essas contas ficam de fora dos relatórios até serem vinculadas"
      className="flex h-8 items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 text-[12px] font-medium text-warning-500 transition-colors hover:border-warning-500/70 hover:bg-warning-500/20"
    >
      <TriangleAlert size={13} strokeWidth={1.8} />
      {label}
    </button>
  );
}

export default function CompanyTopBar({ company }) {
  const appState = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = appState.dashboardTabs || [];
  const group = appState.activeGroupId ? appState.groups.find((item) => item.id === appState.activeGroupId) || null : null;
  const groupMembers = group ? groupCompanies(group) : [];
  // Personalizar is its own self-contained editor with its own tab strip —
  // the normal site nav underneath would just be noise there.
  const isPersonalizar = location.pathname.startsWith("/empresa/personalizar");
  // Relatórios mensais / De/Para are the company's data-management area —
  // showing the user's own custom Resumo/Demonstrativos tabs here wouldn't
  // make sense (this isn't part of the workspace they built), so it gets
  // its own fixed "Dados | De/Para" nav instead.
  const isDataArea = location.pathname.startsWith("/empresa/relatorios") || location.pathname.startsWith("/empresa/de-para");
  const showNav = !isPersonalizar && !isDataArea && tabs.length > 0;
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;

  return (
    <header className="sticky top-0 z-30 bg-navy-950">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-[11px] font-semibold text-white transition-transform hover:scale-105"
            aria-label="Início"
            title="Início"
          >
            A
          </button>

          {(company || group) && (
            <>
              <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => navigate("/empresas")}
                aria-label="Trocar empresa"
                title="Trocar empresa"
                className="group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 -ml-1 transition-colors hover:bg-white/10"
              >
                {group && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                    <Network size={13} strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 text-left">
                  <p className="flex items-baseline gap-1.5 truncate text-[14px] font-medium leading-tight text-white">
                    {company?.codigo && <span className="text-white/50">{company.codigo}</span>}
                    <span className="truncate">{company ? company.name : group.name}</span>
                  </p>
                  {company?.cnpj && <p className="truncate text-[11px] leading-tight text-white/50">{company.cnpj}</p>}
                  {group && (
                    <p className="truncate text-[11px] leading-tight text-white/50">
                      Grupo · {groupMembers.map((item) => item.name).join(" + ")}
                    </p>
                  )}
                </div>
                <ChevronDown size={13} className="shrink-0 text-white/40 transition-colors group-hover:text-white/70" />
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasData && <PendingMappingsBadge company={company} />}
          {hasData && (
            <PeriodPicker
              label="Período"
              start={appState.periodStart}
              end={appState.periodEnd}
              onChange={(start, end) => setData({ periodStart: start, periodEnd: end })}
            />
          )}
          <ReportsMenu />
          <button
            type="button"
            onClick={() => navigate("/empresa/personalizar")}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors ${
              isPersonalizar ? "border-accent-500 bg-accent-500 text-white" : "border-accent-500/40 bg-accent-500/15 text-accent-100 hover:border-accent-500/70 hover:bg-accent-500/25"
            }`}
          >
            <LayoutGrid size={13} strokeWidth={1.8} />
            Personalizar
          </button>
          {company && <SettingsButton />}
          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>

      {showNav && (
        <nav className="flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/empresa/painel/${tab.id}`}
              className={({ isActive }) =>
                `shrink-0 border-b-2 py-3 text-[13px] transition-colors ${
                  isActive
                    ? "border-accent-500 font-medium text-ink-900"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </nav>
      )}

      {isDataArea && (
        <nav className="flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1">
          <button
            type="button"
            onClick={() => navigate("/empresa")}
            className="flex shrink-0 items-center gap-1 py-3 text-[13px] text-ink-500 hover:text-ink-800"
          >
            <ChevronLeft size={14} />
            Voltar ao B.I.
          </button>
          <span className="h-4 w-px shrink-0 bg-line" aria-hidden="true" />
          {[
            { to: "/empresa/relatorios", label: "Dados" },
            { to: "/empresa/de-para", label: "De/Para" },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shrink-0 border-b-2 py-3 text-[13px] transition-colors ${
                  isActive
                    ? "border-accent-500 font-medium text-ink-900"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
