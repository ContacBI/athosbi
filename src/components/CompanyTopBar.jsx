import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, EyeOff, FileSpreadsheet, FileStack, FileText, LayoutGrid, Network, PanelLeft, Presentation, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { useAppState, setData, state } from "../data/useStore.js";
import { missingMappingAccounts } from "../data/calculations.js";
import { groupCompanies, activeWorkspaceName } from "../lib/groups.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { usePageActions } from "../lib/pageActions.jsx";
import { sharedDashboardContext } from "../lib/dashboardData.js";
import { buildSummaryExportRows, buildTableWidgetExport } from "../lib/dashboardExport.js";
import { buildFullReportExport, slug } from "../lib/demonstrativoExport.js";
import { buildFullDfcExport } from "../lib/dfcExport.js";
import { buildPerCompanyReports } from "../lib/groupExport.js";
import { exportDemonstrativoPdf, exportDemonstrativoExcel, exportMultiSheetExcel, downloadZip, loadReportPdf } from "../lib/exportLoaders.js";
import { periodLabelPt } from "../lib/format.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import PeriodPicker from "./PeriodPicker.jsx";
import FechamentoMenu from "./FechamentoMenu.jsx";
import { ModoDaTela, VisaoClienteOlho } from "./VisaoClienteBotao.jsx";
import { kAba, oculto } from "../lib/visibilidade.js";
import { limiteDoCliente, ultimoDiaDoMes } from "../lib/fechamento.js";
import ThemeToggle from "./ThemeToggle.jsx";
import { biDentroDoHub, hubLigado } from "../lib/hub.js";
import { usaModos } from "../lib/modoEquipe.js";
import { ferramentasDaTela } from "../lib/modulos.js";
import { lembrarGrupoContexto } from "../lib/unidades.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import AthosMark from "./AthosMark.jsx";
import SeletorDeEmpresa from "./SeletorDeEmpresa.jsx";
import WorkspaceLoading from "./WorkspaceLoading.jsx";
import { createPortal } from "react-dom";

// Chama a função pura certa (buildFullDfcExport/buildFullReportExport) pra
// reconstruir "o mesmo tipo de relatório que está na tela" a partir do
// {type, mode|tab} que a própria página registrou (ver reportKind em
// useDownloadHandlers) — usado tanto pro consolidado quanto, escopado por
// empresa (ver buildPerCompanyReports em groupExport.js), pra cada membro
// do grupo. "tabela" é uma aba do Painel com um só cartão de demonstração
// (EBITDA, DRE resumida, Balanço, DFC — ver buildTableWidgetExport). null
// quando a tela atual não tem um construtor "cheio" equivalente (ex.: o
// Resumo com vários cartões) — export Consolidado+Individual fica
// indisponível nesse caso.
function buildReportForKind(reportKind) {
  if (reportKind?.type === "dfc") return buildFullDfcExport(reportKind.mode);
  if (reportKind?.type === "demonstrativo") return buildFullReportExport(reportKind.tab);
  if (reportKind?.type === "tabela") return buildTableWidgetExport(reportKind.table);
  return null;
}

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
          const ctx = sharedDashboardContext();
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

// Monta o consolidado (com o estado atual, já é a visão do grupo) + um
// relatório por empresa-membro (estado escopado, ver groupExport.js), no
// MESMO formato "cheio"/expandido dos dois — o ponto do flag é justamente
// abrir cada empresa separada, então usa sempre o relatório completo em
// vez do que estiver aberto/fechado na tela (que só faz sentido pro
// consolidado sozinho).
function buildConsolidatedAndIndividual(group, reportKind) {
  const consolidated = buildReportForKind(reportKind);
  if (!consolidated) return null;
  const perCompany = buildPerCompanyReports(group, () => buildReportForKind(reportKind));
  return [{ company: null, data: consolidated }, ...perCompany];
}

async function downloadConsolidatedAndIndividualPdf(group, reportKind) {
  const entries = buildConsolidatedAndIndividual(group, reportKind);
  if (!entries) return;
  const { buildDemonstrativoPdfBlob } = await loadReportPdf();
  const files = entries.map(({ data }) => ({ name: `${data.fileLabel}.pdf`, blob: buildDemonstrativoPdfBlob(data) }));
  await downloadZip(files, `${slug(`${entries[0].data.reportName}_${group.name}`)}.zip`);
}

async function downloadConsolidatedAndIndividualExcel(group, reportKind) {
  const entries = buildConsolidatedAndIndividual(group, reportKind);
  if (!entries) return;
  const sheets = entries.map(({ company, data }) => ({
    sheetName: company ? company.name : "Consolidado",
    companyName: data.companyName,
    metaLine: data.metaLine,
    columns: data.columns,
    rows: data.rows,
  }));
  await exportMultiSheetExcel(sheets, slug(`${entries[0].data.reportName}_${group.name}`));
}

// Two ways to leave with a report: "Relatório atual" fires the current
// screen's registered {pdf/excel} handler as-is (whatever's on screen right
// now — Resumo, Demonstrativos, any tab); "Personalizado" opens the full
// builder covering every tab at once. Disappears entirely once there's no
// data to report on.
//
// Em modo grupo, um flag "Consolidado + Individual" troca esse
// comportamento padrão: além do consolidado, baixa também o relatório de
// cada empresa-membro separada — em PDF, tudo zipado junto; em Excel, um
// arquivo só com uma aba por empresa (+ consolidado). Só disponível quando
// a tela atual registrou um reportKind (DFC ou Demonstrativos — não o
// Resumo com widgets, que não tem um "relatório completo" equivalente).
function ReportsMenu() {
  const appState = useAppState();
  const navigate = useNavigate();
  const actions = usePageActions();
  const [open, setOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [consolidatedIndividual, setConsolidatedIndividual] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;
  const group = appState.activeGroupId ? appState.groups.find((item) => item.id === appState.activeGroupId) || null : null;
  if (!hasData) return null;
  const handlers = actions?.downloadHandlers;
  // reportKind é uma FUNÇÃO (não um valor direto) justamente pra sempre
  // pegar a aba/modo mais recente — ver o comentário grande em
  // pageActions.jsx sobre por que um valor direto ficava "congelado" na
  // primeira aba renderizada. Chamar aqui, no corpo do componente, só
  // decide se o checkbox aparece habilitado; a chamada que importa de
  // verdade é a de dentro de handleCurrent, sempre lida na hora do clique.
  const canSplit = Boolean(group && handlers?.reportKind?.());

  async function handleCurrent(format) {
    setOpen(false);
    const reportKind = handlers?.reportKind?.();
    if (group && reportKind && consolidatedIndividual) {
      setBusy(true);
      try {
        if (format === "pdf") await downloadConsolidatedAndIndividualPdf(group, reportKind);
        else await downloadConsolidatedAndIndividualExcel(group, reportKind);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (format === "pdf") handlers?.pdf?.();
    else handlers?.excel?.();
  }

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
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl bg-surface-card p-1.5 shadow-lg ring-1 ring-line">
              {group && (
                <label
                  title={canSplit ? "" : "Esse relatório ainda não gera versão separada por empresa"}
                  className={`mb-1 flex items-start gap-2 rounded-lg border-b border-line px-2.5 pb-2.5 pt-1.5 ${canSplit ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={consolidatedIndividual}
                    disabled={!canSplit}
                    onChange={(event) => setConsolidatedIndividual(event.target.checked)}
                  />
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink-800">Consolidado + Individual</span>
                    <span className="block text-[11px] text-ink-400">Baixa também cada empresa do grupo separada — PDF vira .zip, Excel vira abas</span>
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/empresa/apresentacoes");
                }}
                className="mb-1 flex w-full items-start gap-2.5 rounded-lg border-b border-line px-2.5 pb-2.5 pt-2 text-left hover:bg-surface-muted"
              >
                <Presentation size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent-500" />
                <span>
                  <span className="block text-[13px] font-medium text-ink-800">Apresentação em slides</span>
                  <span className="block text-[11px] text-ink-400">Monte do seu jeito, apresente e baixe em PDF</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleCurrent("pdf")}
                disabled={busy || (!handlers?.pdf && !(canSplit && consolidatedIndividual))}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileText size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[13px] text-ink-800">{busy ? "Gerando…" : "Relatório atual (PDF)"}</span>
                  <span className="block text-[11px] text-ink-400">Exatamente o que está na tela</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleCurrent("excel")}
                disabled={busy || (!handlers?.excel && !(canSplit && consolidatedIndividual))}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileSpreadsheet size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[13px] text-ink-800">{busy ? "Gerando…" : "Relatório atual (Excel)"}</span>
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
//
// Agora é uma faixa laranja no topo da tela (mesmo estilo do aviso de razão
// que não carregou), em todas as telas da empresa, com a contagem, os
// primeiros nomes e o atalho pro De/Para.
function PendingMappingsBanner({ company }) {
  const appState = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const hasData = appState.accounts.length > 0;
  const missing = useMemo(() => (hasData ? missingMappingAccounts() : []), [hasData, appState.accounts, appState.mappings, appState.periodStart, appState.companies]);
  if (!missing.length) return null;

  const label = `${missing.length} conta${missing.length === 1 ? "" : "s"} sem De/Para`;
  const exemplos = missing
    .slice(0, 3)
    .map((account) => `${account.classificacao} ${account.nome_conta || ""}`.trim())
    .join(" · ");
  const resto = missing.length > 3 ? ` e mais ${missing.length - 3}` : "";
  const classes = "flex w-full items-center gap-2 bg-warning-500 px-5 py-1.5 text-left text-[12px] font-medium text-warning-950";
  // A group has no single chart of accounts to jump into — the fix happens
  // per company — so it's shown there as a heads-up, not a shortcut.
  if (!company) {
    return (
      <div className={classes}>
        <TriangleAlert size={14} strokeWidth={2} className="shrink-0" />
        <span>
          <b>{label}</b> em alguma empresa deste grupo — os valores dela ficam de fora do consolidado até vincular.
        </span>
      </div>
    );
  }

  // Já está na tela do De/Para: a faixa só continua avisando, sem link.
  const naTela = location.pathname.startsWith("/empresa/de-para");
  return (
    <button type="button" onClick={() => !naTela && navigate("/empresa/de-para")} disabled={naTela} title="Essas contas ficam de fora dos relatórios até serem vinculadas" className={`${classes} ${naTela ? "cursor-default" : "transition-colors hover:bg-warning-600"}`}>
      <TriangleAlert size={14} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 truncate">
        <b>{label}</b> ({exemplos}
        {resto}) — ficam fora dos relatórios até vincular.
      </span>
      {!naTela && <span className="ml-auto shrink-0 rounded-md bg-warning-950/15 px-2 py-0.5 underline decoration-warning-950/40">Abrir De/Para</span>}
    </button>
  );
}

// Com o B.I. dentro do hub: a setinha ao lado da marca mostra/esconde o
// menu do topo do hub (o mesmo das páginas do hub — pedido do Izaias,
// 29/10/2026), e é lá que se troca de empresa ou grupo.
function SetinhaDoHub() {
  const aberto = useAppState().topoDoHubAberto;
  return (
    <button
      type="button"
      onClick={() => {
        if (!aberto) window.scrollTo({ top: 0, behavior: "smooth" });
        setData({ topoDoHubAberto: !aberto });
      }}
      aria-label="Menu do hub"
      aria-expanded={aberto}
      title={aberto ? "Esconder o menu do hub" : "Mostrar o menu do hub (Início, Reforma, Ferramentas, trocar de empresa)"}
      className={`flex shrink-0 items-center gap-1 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-white/10 ${aberto ? "bg-white/10" : ""}`}
    >
      <AthosMark size={26} />
      <ChevronDown size={14} className={`text-white/55 transition-transform duration-300 ${aberto ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function CompanyTopBar({ company, modulesOpen = false, onToggleModules }) {
  const appState = useAppState();
  const navigate = useNavigate();
  // Com o hub ligado, trocar de empresa é numa janela flutuante, sem sair do B.I.
  const comHub = hubLigado(appState);
  // O B.I. dentro do hub (lib/hub.js): o topo do hub tem o menu e a troca de empresa; aqui fica só o nome.
  const dentroDoHub = biDentroDoHub(appState);
  const [seletor, setSeletor] = useState(false);
  const { pending: abrindo, abrirEmpresa, abrirGrupo, cancelar: cancelarAbertura } = useAbrirWorkspace();
  const location = useLocation();
  const tabs = (appState.dashboardTabs || []).filter((tab) => !oculto(kAba(tab.id))); // abas que a equipe ocultou pro cliente (lib/visibilidade.js)
  const group = appState.activeGroupId ? appState.groups.find((item) => item.id === appState.activeGroupId) || null : null;
  const groupMembers = group ? groupCompanies(group) : [];
  // Mesma regra do CompanyLayout.jsx: admin sempre edita; colaborador
  // Restrito só se estiver em company.responsaveis DESTA empresa, ou —
  // em modo grupo — responsável por ALGUMA empresa-membro.
  const canEdit =
    appState.isAdmin ||
    (company && (company.responsaveis || []).includes(appState.userEmail)) ||
    (group && isResponsavelForGroup(appState, group.id));
  // Cliente: o período não passa do mês fechado (ver lib/fechamento.js).
  const limiteCliente = limiteDoCliente(appState);
  // Personalizar is its own self-contained editor with its own tab strip —
  // the normal site nav underneath would just be noise there.
  const isPersonalizar = location.pathname.startsWith("/empresa/personalizar");
  // Relatórios mensais / De/Para are the company's data-management area —
  // showing the user's own custom Resumo/Demonstrativos tabs here wouldn't
  // make sense (this isn't part of the workspace they built), so it gets
  // its own fixed "Dados | De/Para" nav instead.
  const isDataArea = ["/empresa/relatorios", "/empresa/de-para", "/empresa/vinculo-dfc", "/empresa/conferencia"].some((prefix) => location.pathname.startsWith(prefix));
  // Módulos complementares (Orçamento, Carga tributária) são coisas separadas do B.I Contábil: sem as abas do B.I (Resumo, Demonstrativos…), e a
  // Carga tributária também sem os botões do B.I (período, relatórios, personalizar) -- ela tem o período e a personalização dela.
  const isCarga = location.pathname.startsWith("/empresa/carga-tributaria");
  const isModulo = isCarga || location.pathname.startsWith("/empresa/orcamento") || location.pathname.startsWith("/empresa/analise-desempenho") || location.pathname.startsWith("/empresa/entradas-saidas");
  const showNav = !isPersonalizar && !isDataArea && !isModulo && tabs.length > 0;
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;

  return (
    <header className="bi-topo sticky top-0 z-30 bg-navy-950">
      {appState.journalLoadFailed && (
        <div className="flex items-center gap-2 bg-warning-500 px-5 py-1.5 text-[12px] font-medium text-warning-950">
          <TriangleAlert size={14} strokeWidth={2} className="shrink-0" />
          Não consegui carregar o razão {group ? "de uma das empresas deste grupo" : "desta empresa"} agora (falha de conexão) — o que aparece pode estar incompleto. Nada será salvo por cima até recarregar a página.
          <button type="button" onClick={() => window.location.reload()} className="ml-1 shrink-0 rounded-md bg-warning-950/15 px-2 py-0.5 underline decoration-warning-950/40 hover:bg-warning-950/25">
            Recarregar agora
          </button>
        </div>
      )}
      {hasData && !isCarga && !isPersonalizar && <PendingMappingsBanner company={company} />}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleModules && (
            <button
              type="button"
              onClick={onToggleModules}
              aria-label={modulesOpen ? "Fechar menu de módulos" : "Abrir menu de módulos"}
              aria-pressed={Boolean(modulesOpen)}
              title="Módulos: B.I Contábil, Orçamento e Carga tributária"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${modulesOpen ? "border-white/40 bg-white/15 text-white" : "border-white/15 bg-white/5 text-white/85 hover:border-white/25 hover:bg-white/10 hover:text-white"}`}
            >
              <PanelLeft size={15} strokeWidth={1.8} />
            </button>
          )}
          {dentroDoHub ? (
            <SetinhaDoHub />
          ) : comHub ? (
            <button type="button" onClick={() => navigate("/")} className="flex shrink-0 items-center transition-transform hover:scale-105" aria-label="Início" title="Início">
              <AthosMark size={26} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-[11px] font-semibold text-white transition-transform hover:scale-105"
              aria-label="Início"
              title="Início"
            >
              A
            </button>
          )}

          {(company || group) && (
            <>
              <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />
              {dentroDoHub ? (
                <div className="flex min-w-0 items-center gap-2.5 py-1" data-nome-do-bi="">
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => (comHub ? setSeletor(true) : navigate("/empresas"))}
                  aria-label="Trocar empresa"
                  title="Trocar empresa"
                  className="group -ml-1 flex min-w-0 items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/10"
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
              )}
            </>
          )}
          {/* longe da lua (antes ficava colado nela e se clicava errado) */}
          {usaModos(appState) ? <ModoDaTela className="shrink-0" /> : <VisaoClienteOlho className="shrink-0" />}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasData && !isCarga && company && canEdit && <FechamentoMenu company={company} />}
          {hasData && !isCarga && (
            <PeriodPicker
              label="Período"
              start={appState.periodStart}
              end={appState.periodEnd}
              max={limiteCliente ? ultimoDiaDoMes(limiteCliente) : ""}
              onChange={(start, end) => setData({ periodStart: start, periodEnd: end })}
            />
          )}
          {!isCarga && <ReportsMenu />}
          {/* Visível pra qualquer colaborador, responsável ou não — dá pra
              ENTRAR sem poder editar (útil pra usar como modelo em
              "Replicar relatórios"); quem não é responsável só não vê os
              controles de edição lá dentro (ver PersonalizarHub.jsx). */}
          {(appState.isAdmin || appState.isColaborador) && !isCarga && (
            <button
              type="button"
              onClick={() => navigate("/empresa/personalizar")}
              title={canEdit ? undefined : "Só visualização — você não é responsável por esta empresa/grupo"}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors ${
                isPersonalizar ? "border-accent-500 bg-accent-500 text-white" : "border-accent-500/40 bg-accent-500/15 text-accent-300 hover:border-accent-500/70 hover:bg-accent-500/25 hover:text-white"
              }`}
            >
              <LayoutGrid size={13} strokeWidth={1.8} />
              Personalizar
            </button>
          )}
          {company && canEdit && <SettingsButton />}
          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>

      {showNav && (
        <nav className="bi-abas flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/empresa/painel/${tab.id}`}
              className={({ isActive }) =>
                `bi-aba shrink-0 border-b-2 py-3 text-[13px] transition-colors ${
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

      {/* Com o hub não há mais menu lateral: dentro de uma ferramenta, a faixa leva de volta ao B.I. e às outras ferramentas. */}
      {isModulo && dentroDoHub && (
        <nav className="bi-abas flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1" aria-label="Ferramentas">
          <button type="button" onClick={() => navigate("/empresa")} className="flex shrink-0 items-center gap-1 py-3 text-[13px] text-ink-500 hover:text-ink-800">
            <ChevronLeft size={14} />
            Voltar ao B.I.
          </button>
          <span className="h-4 w-px shrink-0 bg-line" aria-hidden="true" />
          {ferramentasDaTela(appState)
            .filter((modulo) => !(modulo.precisaDeDados && !hasData))
            .map((modulo) => (
              <NavLink
                key={modulo.id}
                to={modulo.rota}
                title={modulo.doCliente === false ? "Não liberada para o cliente — só a equipe vê" : undefined}
                className={({ isActive }) => `bi-aba flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[13px] transition-colors ${isActive ? "border-accent-500 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"}`}
              >
                {modulo.nome}
                {modulo.doCliente === false && <EyeOff size={13} className="text-ink-400" aria-label="só a equipe vê" />}
              </NavLink>
            ))}
          {ferramentasDaTela(appState).find((modulo) => location.pathname.startsWith(modulo.rota))?.doCliente === false && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[12px] text-ink-500">
              <EyeOff size={13} /> Não liberada para o cliente — só a equipe vê
            </span>
          )}
        </nav>
      )}

      {isDataArea && (
        <nav className="bi-abas flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1">
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
            { to: "/empresa/vinculo-dfc", label: "Vínculo DFC" },
            ...(appState.activeGroupId ? [] : [{ to: "/empresa/conferencia", label: "Conferência" }]),
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `bi-aba shrink-0 border-b-2 py-3 text-[13px] transition-colors ${
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
      {comHub && !dentroDoHub && (
        <SeletorDeEmpresa
          aberto={seletor}
          onFechar={() => setSeletor(false)}
          onEscolher={(item) => {
            if (item.tipo === "grupo") {
              lembrarGrupoContexto(item.id);
              abrirGrupo(item.id);
            } else abrirEmpresa(item.id);
          }}
        />
      )}
      {abrindo &&
        createPortal(<WorkspaceLoading name={abrindo.name} isGroup={abrindo.isGroup} phase={abrindo.phase} progress={appState.journalLoadProgress} onCancel={cancelarAbertura} />, document.body)}
    </header>
  );
}
