import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Maximize2, Minimize2, Search, Waves } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { buildDfcDirect, buildDfcIndirect, reportMonths } from "../data/calculations.js";
import { money, moneyOrDash, periodLabelPt } from "../lib/format.js";
import { columnLabel, isZeroNoMovement } from "../lib/reportColumns.js";
import { activeWorkspaceName } from "../lib/groups.js";
import { exportDemonstrativoPdf } from "../lib/reportPdf.js";
import { exportDemonstrativoExcel } from "../lib/reportExcel.js";
import { useDownloadHandlers } from "../lib/pageActions.jsx";
import ReportSettingsMenu from "../components/ReportSettingsMenu.jsx";
import LedgerModal from "../components/LedgerModal.jsx";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Ícone por grupo macro — mesma lógica visual do resto do app (categoria com
// uma pista visual rápida), só que a DFC não tinha nenhuma até agora.
function groupIcon(group) {
  const key = norm(group);
  if (key.includes("operacion")) return Waves;
  if (key.includes("investi")) return ArrowUpFromLine;
  if (key.includes("financ")) return ArrowDownToLine;
  return Waves;
}

// Mesmo padrão de exportação de Demonstrativos.jsx (exportMeta/buildExportColumns/
// buildExportRows), simplificado pro formato da DFC: só o modo "padrão" existe
// aqui (sem comparativo/vertical), e as contas analíticas vêm em row.contas em
// vez de já estarem achatadas nas linhas — exporta tudo (não só o que estiver
// expandido na tela), pra não depender do estado de UI no momento do clique.
function exportMeta(state, mode) {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const workspaceName = activeWorkspaceName();
  const reportName = `DFC ${mode === "direct" ? "Direta" : "Indireta"}`;
  const periodLabel = periodLabelPt(state.periodStart, state.periodEnd);
  const metaLine = [company?.cnpj && `CNPJ ${company.cnpj}`, reportName, periodLabel].filter(Boolean).join(" | ");
  const fileLabel = `${reportName}_${workspaceName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return { companyName: workspaceName, reportName, metaLine, fileLabel };
}

function buildDfcExportColumns(columns) {
  return columns.map((column) => ({ key: column, label: columnLabel(column) }));
}

// Exporta exatamente o que está na tela — só entra o detalhe analítico de
// uma linha (row.contas) se ela estiver expandida no momento do clique em
// "Baixar". Antes exportava tudo aberto sempre, direto do relatório
// completo, sem olhar pro que estava fechado/aberto na tela.
function buildDfcExportRows(rows, columns, expandedRows) {
  const out = [];
  const cellsFor = (source) => {
    const cells = {};
    columns.forEach((column) => { cells[column] = moneyOrDash(column === "saldo" ? source.saldo : source.monthValues?.[column] || 0); });
    return cells;
  };
  const codeLabel = (classificacao) => (Array.isArray(classificacao) ? classificacao.join(", ") : classificacao || "");
  rows.forEach((row) => {
    out.push({ codigo: row.codigo_gerencial || "", nome: row.categoria_gerencial || "", nivel: Number(row.nivel || 0), isAnalytic: false, cells: cellsFor(row) });
    if (!expandedRows.has(row.codigo_gerencial)) return;
    (row.contas || []).forEach((child) => {
      out.push({ codigo: codeLabel(child.classificacao), nome: child.nome_conta || "", nivel: Number(row.nivel || 0) + 1, isAnalytic: true, cells: cellsFor(child) });
    });
  });
  return out;
}

// Uma conta bate na busca pelo nome dela OU (se a linha-pai bateu) fica
// visível também — não faz sentido esconder o pai de uma conta que bateu.
function matchesSearch(row, query) {
  if (!query) return true;
  const haystack = norm(`${row.categoria_gerencial || ""} ${(row.contas || []).map((c) => c.nome_conta).join(" ")}`);
  return haystack.includes(query);
}

function GroupHeading({ group }) {
  const Icon = groupIcon(group);
  return (
    <p className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
      <Icon size={12} strokeWidth={2} className="text-ink-400" />
      {group}
    </p>
  );
}

function DfcRow({ row, columns, template, isOpen, onToggle, onOpenLedger }) {
  const subtotal = row.natureza === "subtotal";
  const heading = row.natureza === "heading";
  const children = row.contas || [];
  return (
    <div>
      <button
        type="button"
        disabled={!children.length}
        onClick={() => onToggle(row.codigo_gerencial)}
        style={{ gridTemplateColumns: template }}
        className={`grid w-full items-center gap-4 border-b border-line px-4 py-2.5 text-left disabled:cursor-default ${children.length ? "hover:bg-surface-muted" : ""} ${
          subtotal ? "bg-accent-50 font-semibold" : heading ? "bg-surface-muted font-semibold" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-800">
          {children.length > 0 && <ChevronRight size={15} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
          <span className="truncate">{row.categoria_gerencial}</span>
        </span>
        {/* Linha de cabeçalho de seção (ex.: "ATIVIDADES OPERACIONAIS") não
            carrega valor de verdade — antes mostrava "R$ 0,00" em cada mês
            à toa; agora fica em branco, só o título mesmo. */}
        {!heading &&
          columns.map((column) => {
            const value = column === "saldo" ? row.saldo : row.monthValues?.[column] || 0;
            return (
              <span key={column} className={`whitespace-nowrap text-right tabular-nums text-[13px] ${value < 0 ? "text-danger-600" : "text-ink-900"}`}>
                {money(value)}
              </span>
            );
          })}
        {heading && columns.map((column) => <span key={column} />)}
      </button>
      {isOpen &&
        children.map((child) => (
          <button
            key={child.classificacao}
            type="button"
            onClick={() => onOpenLedger(child)}
            style={{ gridTemplateColumns: template }}
            className="grid w-full items-center gap-4 border-b border-line bg-surface-page/60 px-4 py-2 text-left hover:bg-accent-50"
          >
            <span className="truncate pl-7 text-[12px] text-ink-600">
              {child.nome_conta}
              <span className="ml-2 text-[10px] text-ink-400">{child.classificacao} · {child.qtd_lancamentos} lançamentos</span>
            </span>
            {columns.map((column) => {
              const value = column === "saldo" ? child.saldo : child.monthValues?.[column] || 0;
              return (
                <span key={column} className={`whitespace-nowrap text-right text-[12px] tabular-nums ${value < 0 ? "text-danger-600" : "text-ink-700"}`}>
                  {money(value)}
                </span>
              );
            })}
          </button>
        ))}
    </div>
  );
}

function DfcTable({ rows, mode, columns, expandedRows, onToggle, onOpenLedger, search, expanded }) {
  // Largura FIXA (não minmax/auto) é o que garante alinhamento de verdade
  // aqui: cabeçalho e cada linha são grids CSS independentes (um <div> por
  // linha, não uma <table> só), então "auto"/minmax deixa cada um calcular
  // a própria largura sozinho a partir do PRÓPRIO conteúdo — cabeçalho e
  // linhas nunca ficavam de fato sincronizados, só pareciam por acaso.
  // Fixo em todos garante o mesmo valor em todo mundo. 148px cobre valores
  // grandes (ex. "-R$ 1.628.776,38") sem estourar.
  const template = `minmax(240px, 1fr) ${columns.map(() => "148px").join(" ")}`;
  const visibleRows = rows.filter((row) => matchesSearch(row, search));
  let lastGroup = "";
  return (
    <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
      <div className="flex items-center justify-between border-b border-line bg-surface-muted px-4 py-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">DFC {mode === "direct" ? "direta" : "indireta"}</h1>
          <p className="mt-0.5 text-[12px] text-ink-400">Clique numa linha com contas para abrir sua composição; clique na conta para ver o diário.</p>
        </div>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-700">{visibleRows.length} linhas</span>
      </div>
      <div className={`overflow-auto scrollbar-thin ${expanded ? "max-h-[calc(100vh-260px)]" : "max-h-[68vh]"}`}>
        <div className="min-w-max">
          <div className="sticky top-0 z-10 grid border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-medium text-ink-400" style={{ gridTemplateColumns: template }}>
            <span>Conta</span>
            {columns.map((column) => (
              <span key={column} className="text-right">{columnLabel(column)}</span>
            ))}
          </div>
          {visibleRows.map((row) => {
            const group = row.grupo_macro || "Outros";
            const first = group !== lastGroup;
            lastGroup = group;
            return (
              <div key={row.codigo_gerencial}>
                {first && row.natureza !== "heading" && <GroupHeading group={group} />}
                <DfcRow
                  row={row}
                  columns={columns}
                  template={template}
                  isOpen={expandedRows.has(row.codigo_gerencial)}
                  onToggle={onToggle}
                  onOpenLedger={onOpenLedger}
                />
              </div>
            );
          })}
          {visibleRows.length === 0 && (
            <p className="px-4 py-12 text-center text-[13px] text-ink-400">
              {search ? "Nenhuma conta bate com essa busca." : "Não há movimentos para o período selecionado."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dfc({ lockedMode } = {}) {
  const state = useAppState();
  // O modo, quando travado (lockedMode vindo de um card do Personalizar/
  // Painel), segue o prop diretamente — nunca fica em estado local próprio.
  // Fazia isso antes com useState(lockedMode || "direct"), que só lê o
  // valor inicial UMA vez: ao trocar de subaba sem o componente remontar
  // (comum dentro do editor do Personalizar), o modo ficava preso no valor
  // da primeira subaba visitada, "vazando" pra outra. Sem estado próprio
  // nesse caso, as duas ficam de fato independentes.
  const [localMode, setLocalMode] = useState("direct");
  const mode = lockedMode || localMode;
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [ledgerRow, setLedgerRow] = useState(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const columns = useMemo(() => (state.reportCompare ? reportMonths() : ["saldo"]), [state.reportCompare, state.periodStart, state.periodEnd, state.journal]);
  const builtRows = mode === "direct" ? buildDfcDirect() : buildDfcIndirect();
  const rows = state.hideZeroNoMovement
    ? builtRows.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row))
    : builtRows;
  const toggle = (code) => setExpandedRows((current) => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next; });
  useDownloadHandlers(rows.length ? {
    pdf: () => exportDemonstrativoPdf({ ...exportMeta(state, mode), columns: buildDfcExportColumns(columns), rows: buildDfcExportRows(rows, columns, expandedRows) }),
    excel: () => exportDemonstrativoExcel({ ...exportMeta(state, mode), columns: buildDfcExportColumns(columns), rows: buildDfcExportRows(rows, columns, expandedRows) }),
    reportKind: { type: "dfc", mode },
  } : null);

  return (
    <div className={expanded ? "fixed inset-0 z-50 overflow-y-auto bg-surface-page p-5" : "flex flex-col gap-4"}>
      <div className={expanded ? "flex flex-col gap-4" : "contents"}>
        <div className="rounded-xl bg-surface-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!lockedMode && (
                <div className="inline-flex w-fit rounded-full bg-surface-muted p-1">
                  <button
                    type="button"
                    onClick={() => setLocalMode("direct")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${mode === "direct" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}
                  >
                    <ArrowDownToLine size={14} />DFC direta
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalMode("indirect")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${mode === "indirect" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}
                  >
                    <ArrowUpFromLine size={14} />DFC indireta
                  </button>
                </div>
              )}
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar conta"
                  className="w-52 rounded-md border border-line-strong bg-surface-card py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ReportSettingsMenu tab="DFC" />
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Sair da tela cheia" : "Tela cheia"}
                title={expanded ? "Sair da tela cheia" : "Tela cheia"}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted"
              >
                {expanded ? <Minimize2 size={14} strokeWidth={1.8} /> : <Maximize2 size={14} strokeWidth={1.8} />}
              </button>
            </div>
          </div>
        </div>
        <DfcTable
          rows={rows}
          mode={mode}
          columns={columns}
          expandedRows={expandedRows}
          onToggle={toggle}
          onOpenLedger={setLedgerRow}
          search={norm(search)}
          expanded={expanded}
        />
      </div>
      {ledgerRow && <LedgerModal row={ledgerRow} onClose={() => setLedgerRow(null)} />}
    </div>
  );
}
