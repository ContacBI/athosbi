import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { LayoutDashboard, LayoutGrid, Sparkles } from "lucide-react";
import { useAppState, setData, state } from "../data/useStore.js";
import { buildDashboardContext } from "../lib/dashboardData.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import { buildSummaryExportRows } from "../lib/dashboardExport.js";
import { exportDemonstrativoPdf } from "../lib/reportPdf.js";
import { exportDemonstrativoExcel } from "../lib/reportExcel.js";
import { exportDomSnapshotPdf } from "../lib/domSnapshotPdf.js";
import { slug } from "../lib/demonstrativoExport.js";
import { periodLabelPt } from "../lib/format.js";
import { useDownloadHandlers } from "../lib/pageActions.jsx";
import { activeWorkspaceName } from "../lib/groups.js";
import Placeholder from "../components/Placeholder.jsx";
import WidgetGrid, { PrintableWidgetGrid } from "../components/dashboard/WidgetGrid.jsx";
import Demonstrativos from "./Demonstrativos.jsx";

// Renders nothing — just registers the top bar's "Relatório atual" action
// for this tab. PDF is a screenshot of `printRef` — a plain, off-screen
// duplicate of the widgets (see PrintableWidgetGrid) rather than the live
// drag-and-drop grid, since html2canvas can't reliably capture
// react-grid-layout's transform-positioned cards. Excel has no such visual
// concept, so it stays a plain table of the same widgets. A separate
// component (not inline logic in PainelTab) so the hook only runs in the
// "real widget grid" branch — PainelTab itself never registers anything for
// the sole-link/empty-tab cases, leaving those to whichever child actually
// owns the content (the embedded Demonstrativos, or nothing).
function SummaryDownloadRegistrar({ widgets, ctx, tabName, printRef }) {
  const handlers = useMemo(() => {
    if (!ctx || widgets.length === 0) return null;
    const workspaceName = activeWorkspaceName();
    const meta = {
      companyName: workspaceName,
      reportName: "Resumo",
      metaLine: [`Resumo · ${tabName}`, periodLabelPt(state.periodStart, state.periodEnd)].filter(Boolean).join(" | "),
      fileLabel: slug(`resumo_${tabName}_${workspaceName}`),
    };
    const columns = [{ key: "valor", label: "Valor" }];
    return {
      pdf: () => exportDomSnapshotPdf({ ...meta, element: printRef.current }),
      excel: () => exportDemonstrativoExcel({ ...meta, columns, rows: buildSummaryExportRows(widgets, ctx) }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets, ctx, tabName]);

  useDownloadHandlers(handlers);
  return null;
}

export default function PainelTab() {
  const { tabId } = useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const hasData = state.accounts.length > 0 || state.journal.length > 0;
  const tab = (state.dashboardTabs || []).find((item) => item.id === tabId);
  const subTabs = tab?.subTabs || [];

  const [activeSubId, setActiveSubId] = useState(subTabs[0]?.id || null);
  useEffect(() => {
    if (subTabs.length && !subTabs.some((sub) => sub.id === activeSubId)) setActiveSubId(subTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, subTabs.length]);

  const ctx = useMemo(() => {
    if (!hasData) return null;
    return buildDashboardContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, state.mappings, state.accounts, state.journal, state.periodStart, state.periodEnd]);

  const activeSub = subTabs.find((sub) => sub.id === activeSubId) || null;
  const widgets = subTabs.length > 0 ? activeSub?.widgets || [] : tab?.widgets || [];
  const personalizarState = subTabs.length > 0 ? { tabId: tab?.id, subId: activeSub?.id } : { tabId: tab?.id };

  // A tab/subtab that's just a single "DRE completo" / "Balanço completo"
  // shortcut isn't really a widget grid at all — it IS that report. Embed
  // the real Demonstrativos page directly, full width, instead of a card.
  const soleLinkDefinition = widgets.length === 1 ? WIDGET_CATALOG.find((definition) => definition.id === widgets[0].id) : null;
  const isSoleLink = soleLinkDefinition?.type === "link" && soleLinkDefinition.href === "/empresa/demonstrativos";

  if (!tab) return <Navigate to="/empresa" replace />;

  if (!hasData) {
    return (
      <Placeholder
        icon={LayoutDashboard}
        title="Nenhum dado importado ainda"
        description="Vá até o menu Dados e importe o balancete e o diário da empresa selecionada para ver esta aba."
      />
    );
  }

  // The sub-tab strip must ALWAYS render when there are sibling sub-tabs —
  // even when the active one is a full embedded report — otherwise there's
  // no way to reach the other sub-tabs (e.g. "DRE" next to "Balanço").
  const subTabStrip = subTabs.length > 0 && (
    <div className="flex flex-wrap items-center gap-4 border-b border-line">
      {subTabs.map((sub) => (
        <button
          key={sub.id}
          type="button"
          onClick={() => setActiveSubId(sub.id)}
          className={`shrink-0 border-b-2 py-1.5 text-[12.5px] transition-colors ${
            activeSubId === sub.id
              ? "border-accent-500 font-medium text-ink-900"
              : "border-transparent text-ink-400 hover:text-ink-700"
          }`}
        >
          {sub.name}
        </button>
      ))}
    </div>
  );

  if (isSoleLink) {
    return (
      <div className="mx-auto flex w-full flex-col gap-3">
        {subTabStrip}
        <Demonstrativos lockedTab={soleLinkDefinition.navState?.tab} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SummaryDownloadRegistrar widgets={widgets} ctx={ctx} tabName={activeSub?.name || tab.name} printRef={printRef} />

      {subTabStrip}

      {widgets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
            <Sparkles size={26} strokeWidth={1.6} />
          </span>
          <p className="text-[15px] font-medium text-ink-900">{subTabs.length > 0 ? "Esta subaba" : "Esta aba"} ainda está vazia</p>
          <p className="max-w-md text-[13px] text-ink-400">
            Escolha quais cards, gráficos, listas e demonstrações aparecem aqui, e o tamanho de cada um.
          </p>
          <button
            type="button"
            onClick={() => navigate("/empresa/personalizar", { state: personalizarState })}
            className="mt-1 flex items-center gap-1.5 rounded-full bg-accent-500 px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
          >
            <LayoutGrid size={14} strokeWidth={1.8} />
            Personalizar
          </button>
        </div>
      ) : (
        <>
          <WidgetGrid widgets={widgets} ctx={ctx} />
          {/* Invisible but still laid out at full size — html2canvas needs
              real dimensions to capture when "Relatório atual" fires, and
              Recharts' ResponsiveContainer needs a real, unclipped-from-its-
              own-perspective box to size itself against (a `left:-99999px`
              or `opacity:0` push breaks that measurement in some browsers,
              and opacity:0 would also make the captured image transparent).
              A 0×0 clipping wrapper hides it from the page without hiding
              it from the child's own layout math or from html2canvas. The
              `printRef` div itself needs its own explicit width, though —
              as a plain block element inside a 0-width containing block it
              would otherwise compute to 0 width itself (its child can still
              overflow to its own 1100px and report a real offsetHeight, but
              html2canvas captures `printRef`'s own — zero-width — box). */}
          <div style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
            <div ref={printRef} style={{ width: 1100 }}>
              <PrintableWidgetGrid widgets={widgets} ctx={ctx} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
