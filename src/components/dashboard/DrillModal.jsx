import { Fragment, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BookOpen, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, Search, X } from "lucide-react";
import { state } from "../../data/useStore.js";
import { buildDrill } from "../../lib/drill.js";
import { ledgerData } from "../../lib/slideDemo.js";
import { formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { exportLedgerPdf } from "../../lib/ledgerPdf.js";
import { slug } from "../../lib/demonstrativoExport.js";
import { money, periodLabelPt } from "../../lib/format.js";

// "De onde vem esse número?": a composição de um card do B.I. (ou de uma
// linha das tabelas) até as contas e, numa conta, os lançamentos do razão
// com filtro por mês, conta e histórico. Ver lib/drill.js.

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthName(month) {
  const [year, mm] = String(month || "").split("-");
  return year && mm ? `${MONTHS[Number(mm) - 1]}/${year.slice(2)}` : month;
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : value || "";
}

function moneyClass(value) {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.005) return "text-ink-400";
  return n < 0 ? "text-danger-600" : "text-ink-900";
}

function axisValue(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

const isZero = (value) => Math.abs(Number(value || 0)) < 0.005;

function Pill({ active, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${active ? "bg-navy-900 text-white" : "bg-surface-muted text-ink-600 hover:bg-accent-50 hover:text-accent-700"} ${className}`}
    >
      {children}
    </button>
  );
}

function SearchInput({ value, onChange, placeholder, className = "" }) {
  return (
    <label className={`relative flex items-center ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-line bg-surface-page pl-8 pr-7 text-[12.5px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 text-ink-300 hover:text-ink-600" aria-label="Limpar busca">
          <X size={13} />
        </button>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Composição

function visibleKids(node, column) {
  const kids = node.children().filter((child) => !isZero(child.value(column)));
  // Contas da maior pra menor; linhas gerenciais na ordem do plano.
  if (kids.length && kids.every((child) => child.kind === "account")) return [...kids].sort((a, b) => Math.abs(b.value(column)) - Math.abs(a.value(column)));
  return kids;
}

function flatten(groups, column, open, term) {
  const out = [];
  groups.forEach((group) => {
    const rows = [];
    // A barrinha é o peso de cada linha entre as irmãs (pelo tamanho, sem
    // o sinal — com receita e custo misturados o % "da linha de cima"
    // passava de 100%). `parentValue` null = sem barrinha (termo do card,
    // ou filho único, que seria sempre 100%).
    function visit(node, depth, parentValue) {
      const kids = visibleKids(node, column);
      const value = node.value(column);
      const childBase = kids.length > 1 ? kids.reduce((sum, child) => sum + Math.abs(child.value(column)), 0) : null;
      const entry = { node, depth, value, share: parentValue != null && Math.abs(parentValue) > 0.005 ? Math.abs(value) / Math.abs(parentValue) : null, hasKids: kids.length > 0, expanded: false };
      rows.push(entry);
      if (term) {
        // Na busca: tudo aberto; depois sobra só o que bate + o caminho.
        entry.expanded = kids.length > 0;
        kids.forEach((child) => visit(child, depth + 1, childBase));
        return;
      }
      if (kids.length && open.has(node.key)) {
        entry.expanded = true;
        kids.forEach((child) => visit(child, depth + 1, childBase));
      }
    }
    group.terms.forEach((termNode) => visit(termNode, 0, null));
    let kept = rows;
    if (term) {
      const keep = new Set();
      const stack = [];
      rows.forEach((row, index) => {
        stack.length = row.depth;
        stack[row.depth] = index;
        if (normalize(row.node.name).includes(term) || normalize(row.node.detail).includes(term)) stack.forEach((i) => keep.add(i));
      });
      kept = rows.filter((_, index) => keep.has(index));
    }
    out.push({ group, rows: kept });
  });
  return out;
}

function CompositionRow({ entry, onToggle, onLedger, hasJournal }) {
  const { node, depth, value, share, hasKids, expanded } = entry;
  const ledgerRequest = hasJournal ? (node.kind === "account" ? node.ledger : node.lineLedger?.()) : null;
  const isTerm = depth === 0;
  return (
    <div
      className={`drill-row group grid items-center gap-3 rounded-lg px-2 py-1.5 ${hasKids ? "cursor-pointer hover:bg-surface-muted" : ""} ${isTerm ? "font-semibold text-ink-900" : node.kind === "account" ? "text-[12.5px] text-ink-600" : "text-ink-700"}`}
      style={{ gridTemplateColumns: "minmax(0,1fr) auto 132px" }}
      onClick={hasKids ? () => onToggle(node.key) : undefined}
    >
      <span className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
        {hasKids ? <ChevronRight size={14} className={`shrink-0 text-ink-400 transition-transform ${expanded ? "rotate-90" : ""}`} /> : <span className="w-[14px] shrink-0" />}
        <span className="min-w-0">
          <span className="block truncate" title={node.name}>
            {isTerm && node.sign < 0 ? "(−) " : ""}
            {node.name}
          </span>
          {node.kind === "account" && node.detail && <span className="block truncate text-[10.5px] text-ink-400">{node.detail}</span>}
        </span>
        {share != null && (
          <span className="ml-1 hidden shrink-0 items-center gap-1 sm:flex" title={`${(share * 100).toFixed(1).replace(".", ",")}% do total das linhas deste nível`}>
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-accent-400" style={{ width: `${Math.min(100, share * 100)}%` }} />
            </span>
            <span className="w-9 text-[10.5px] tabular-nums text-ink-400">{(share * 100).toFixed(0)}%</span>
          </span>
        )}
      </span>
      <span>
        {ledgerRequest && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLedger(ledgerRequest, node);
            }}
            className="drill-lancamentos flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-accent-600 opacity-70 hover:bg-accent-50 hover:opacity-100 group-hover:opacity-100"
            title={node.kind === "account" ? "Ver os lançamentos desta conta" : "Ver os lançamentos de todas as contas desta linha"}
          >
            <BookOpen size={12} /> Lançamentos
          </button>
        )}
      </span>
      <span className={`text-right tabular-nums ${moneyClass(value)}`}>{money(value)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Razão

const PAGE = 300;

function LedgerView({ request, initialMonth, trail, onBack }) {
  const data = useMemo(() => ledgerData(request), [request]);
  const [month, setMonth] = useState(initialMonth && initialMonth !== "total" ? initialMonth : "");
  const [account, setAccount] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const term = normalize(search.trim());
  const accounts = useMemo(() => {
    const byCode = new Map();
    data.lines.forEach((line) => {
      const current = byCode.get(line.account) || { code: line.account, name: line.accountName, count: 0 };
      current.count += 1;
      byCode.set(line.account, current);
    });
    return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data]);
  const lines = useMemo(
    () =>
      data.lines.filter((line) => {
        if (month && String(line.data || "").slice(0, 7) !== month) return false;
        if (account && line.account !== account) return false;
        if (term && !normalize(`${formatDate(line.data)} ${line.historico} ${line.counterpart} ${line.accountName} ${money(line.debito)} ${money(line.credito)}`).includes(term)) return false;
        return true;
      }),
    [data, month, account, term]
  );
  useEffect(() => setLimit(PAGE), [month, account, term]);
  const filtered = Boolean(month || account || term);
  const debits = lines.reduce((sum, line) => sum + line.debito, 0);
  const credits = lines.reduce((sum, line) => sum + line.credito, 0);
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  const isBalance = data.isBalance;
  const multi = accounts.length > 1;
  const showCompany = lines.some((line) => line.company);
  const shown = lines.slice(0, limit);
  const showRunning = !filtered;
  const template = `92px minmax(0,1fr) 118px 118px${showRunning ? " 128px" : ""}`;

  function handlePdf() {
    exportLedgerPdf({
      label: request.name,
      classificacaoLabel: [multi ? `${accounts.length} contas` : accounts[0]?.code || "", month ? monthName(month) : periodLabelPt(state.periodStart, state.periodEnd)].filter(Boolean).join(" · "),
      totalLabel: `${lines.length} lançamento${lines.length === 1 ? "" : "s"} · Total ${money(total)}`,
      showCompany: false,
      rows: lines.map((line) => ({ data: line.data, historico: line.historico, counterpartText: [line.counterpart, multi ? line.accountName : "", line.company].filter(Boolean).join(" · "), debito: line.debito, credito: line.credito })),
      fileLabel: `lancamentos_${slug(request.name)}`,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-1 text-[11.5px] text-ink-400">
          <button type="button" onClick={onBack} className="drill-voltar mr-1 flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 font-medium text-ink-700 hover:bg-accent-50 hover:text-accent-700">
            <ArrowLeft size={13} /> Composição
          </button>
          {trail.map((name, index) => (
            <Fragment key={`${name}-${index}`}>
              {index > 0 && <ChevronRight size={11} />}
              <span className={index === trail.length - 1 ? "font-medium text-ink-700" : ""}>{name}</span>
            </Fragment>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {isBalance && !filtered && <Stat label="Saldo no início" value={data.opening} />}
          <Stat label={filtered ? "Débitos (filtro)" : "Débitos"} value={debits} plain />
          <Stat label={filtered ? "Créditos (filtro)" : "Créditos"} value={credits} plain />
          <Stat label={filtered ? "Total do filtro" : isBalance ? "Saldo no fim" : "Total no período"} value={filtered ? total : isBalance ? data.closing : data.total} strong />
        </div>
        {data.monthly.length > 1 && (
          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 4" />
                <XAxis dataKey="month" tickFormatter={monthName} tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={axisValue} tick={{ fontSize: 10, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} width={56} />
                <Tooltip cursor={{ fill: "var(--color-surface-muted)" }} formatter={(value) => [money(value), isBalance ? "Movimento do mês" : "Valor do mês"]} labelFormatter={monthName} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  cursor="pointer"
                  onClick={(_, index) => {
                    const picked = data.monthly[index]?.month;
                    if (picked) setMonth((current) => (current === picked ? "" : picked));
                  }}
                >
                  {data.monthly.map((item) => (
                    <Cell key={item.month} fill={month && month !== item.month ? "var(--color-line-strong)" : item.value < 0 ? "var(--color-danger-500)" : "var(--color-accent-500)"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <Pill active={!month} onClick={() => setMonth("")}>Todos os meses</Pill>
            {data.monthly.map((item) => (
              <Pill key={item.month} active={month === item.month} onClick={() => setMonth(month === item.month ? "" : item.month)} className="drill-mes">
                {monthName(item.month)}
              </Pill>
            ))}
          </div>
          {multi && (
            <select value={account} onChange={(event) => setAccount(event.target.value)} className="drill-conta h-8 max-w-[260px] rounded-lg border border-line bg-surface-page px-2 text-[12.5px] text-ink-700 outline-none focus:border-accent-400">
              <option value="">Todas as contas ({accounts.length})</option>
              {accounts.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          )}
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar histórico, contrapartida, valor ou data…" className="min-w-[220px] flex-1" />
          <button type="button" onClick={handlePdf} disabled={!lines.length} className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:opacity-40">
            <Download size={13} /> PDF
          </button>
        </div>
        {filtered && <p className="text-[11px] text-ink-400">{lines.length} de {data.lines.length} lançamentos</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <div className="sticky top-0 z-[1] grid gap-3 border-b border-line bg-surface-card px-5 py-2 text-[10.5px] font-medium uppercase tracking-wide text-ink-400 sm:px-6" style={{ gridTemplateColumns: template }}>
            <span>Data</span>
            <span>Histórico</span>
            <span className="text-right">Débito</span>
            <span className="text-right">Crédito</span>
            {showRunning && <span className="text-right">{isBalance ? "Saldo" : "Acumulado"}</span>}
          </div>
          {shown.map((line, index) => (
            <div key={line.id} className={`drill-lancamento grid items-start gap-3 px-5 py-1.5 text-[12.5px] sm:px-6 ${index % 2 ? "bg-surface-muted/60" : ""}`} style={{ gridTemplateColumns: template }}>
              <span className="tabular-nums text-ink-500">{formatDate(line.data)}</span>
              <span className="min-w-0">
                <span className="block truncate text-ink-900" title={line.historico}>{line.historico || "(sem histórico)"}</span>
                <span className="block truncate text-[11px] text-ink-400" title={line.counterpart}>
                  {line.counterpart ? `Contrapartida: ${line.counterpart}` : request.source === "DFC" ? "" : <span className="italic text-warning-600">contrapartida não encontrada</span>}
                  {multi ? ` · ${line.accountName}` : ""}
                  {showCompany && line.company ? ` · ${line.company}` : ""}
                </span>
              </span>
              <span className="text-right tabular-nums text-ink-700">{line.debito ? money(line.debito) : ""}</span>
              <span className="text-right tabular-nums text-ink-700">{line.credito ? money(line.credito) : ""}</span>
              {showRunning && <span className={`text-right font-medium tabular-nums ${moneyClass(line.running)}`}>{money(line.running)}</span>}
            </div>
          ))}
          {lines.length > shown.length && (
            <div className="p-4 text-center">
              <Pill onClick={() => setLimit((value) => value + PAGE)}>
                Mostrar mais {Math.min(PAGE, lines.length - shown.length)} de {lines.length - shown.length}
              </Pill>
            </div>
          )}
          {!lines.length && <p className="px-6 py-10 text-center text-[13px] text-ink-400">{data.lines.length ? "Nenhum lançamento com esse filtro." : "Nenhum lançamento no período."}</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, strong, plain }) {
  return (
    <div className="rounded-xl bg-surface-page px-3 py-2">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`text-[15px] tabular-nums ${strong ? "font-semibold" : "font-medium"} ${plain ? "text-ink-800" : moneyClass(value)}`}>{money(value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function DrillModal({ target, ctx, onClose }) {
  const drill = useMemo(() => (target && ctx ? buildDrill(target, ctx) : null), [target, ctx]);
  const [column, setColumn] = useState("total");
  const [open, setOpen] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [ledger, setLedger] = useState(null);
  const term = normalize(search.trim());

  // Abre o primeiro nível (os termos) já de cara: o card sozinho não diz
  // nada que o próprio card já não mostrava.
  useEffect(() => {
    if (!drill) return;
    setOpen(new Set(drill.groups.flatMap((group) => group.terms.map((termNode) => termNode.key))));
    setColumn("total");
    setSearch("");
    setLedger(null);
  }, [drill]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (ledger) setLedger(null);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ledger, onClose]);

  const sections = useMemo(() => (drill ? flatten(drill.groups, column, open, term) : []), [drill, column, open, term]);
  if (!drill) return null;

  function toggle(key) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function expandAll() {
    const keys = new Set();
    const visit = (node) => {
      const kids = visibleKids(node, column);
      if (!kids.length) return;
      keys.add(node.key);
      kids.forEach(visit);
    };
    drill.groups.forEach((group) => group.terms.forEach(visit));
    setOpen(keys);
  }

  // Caminho até a conta, pro "Composição › Despesas › Pessoal › Salários".
  function trailFor(node) {
    const names = [drill.label];
    const visit = (current, path) => {
      if (current === node) {
        names.push(...path, current.name);
        return true;
      }
      return current.children().some((child) => visit(child, [...path, current.name]));
    };
    drill.groups.some((group) => group.terms.some((termNode) => visit(termNode, [])));
    return names.filter((name, index) => normalize(name) !== normalize(names[index - 1]));
  }

  const headerValue = formatWidgetValue(drill.valueAt(column), drill.format);
  const periodText = column === "total" ? periodLabelPt(state.periodStart, state.periodEnd) : `Só ${monthName(column)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 p-2 backdrop-blur-sm sm:p-6" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="drill-modal flex h-full max-h-[880px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">De onde vem esse número</p>
            <h2 className="mt-0.5 truncate text-[18px] font-semibold text-ink-900">{drill.label}</h2>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="drill-valor text-[26px] font-semibold tabular-nums text-ink-900">{headerValue}</span>
              <span className="text-[12px] text-ink-400">{periodText}</span>
            </div>
            {drill.formulaText && normalize(drill.formulaText) !== normalize(drill.label) && <p className="mt-1 text-[12px] italic text-ink-400">= {drill.formulaText}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900">
            <X size={17} />
          </button>
        </div>

        {ledger ? (
          <LedgerView request={ledger.request} initialMonth={column} trail={ledger.trail} onBack={() => setLedger(null)} />
        ) : (
          <>
            <div className="flex flex-col gap-2.5 border-b border-line px-5 py-3 sm:px-6">
              {drill.months.length > 1 && (
                <div className="flex flex-wrap items-center gap-1">
                  <Pill active={column === "total"} onClick={() => setColumn("total")}>Período todo</Pill>
                  {drill.months.map((month) => (
                    <Pill key={month} active={column === month} onClick={() => setColumn(month)} className="drill-coluna">
                      {monthName(month)}
                    </Pill>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar linha ou conta…" className="min-w-[200px] flex-1" />
                <button type="button" onClick={expandAll} className="drill-abrir flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                  <ChevronsUpDown size={14} /> Abrir tudo
                </button>
                <button type="button" onClick={() => setOpen(new Set())} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                  <ChevronsDownUp size={14} /> Fechar tudo
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4">
              {sections.map(({ group, rows }) => (
                <div key={group.id} className="mb-4">
                  {group.title && (
                    <div className="mb-1 flex items-center justify-between border-b border-line px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      <span>{group.title}</span>
                      <span className="tabular-nums">{money(drill.groupTotal(group, column))}</span>
                    </div>
                  )}
                  {rows.map((entry) => (
                    <CompositionRow key={entry.node.key} entry={entry} onToggle={toggle} hasJournal={drill.hasJournal} onLedger={(request, node) => setLedger({ request: { ...request, months: drill.months }, trail: trailFor(node) })} />
                  ))}
                  {!rows.length && <p className="px-2 py-3 text-[12.5px] text-ink-400">{term ? `Nada com “${search}”.` : "Sem valores neste período."}</p>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[11.5px] text-ink-400 sm:px-6">
              <span>Clique numa linha para abrir as de baixo.</span>
              {drill.hasJournal ? <span>Em “Lançamentos” você vê o razão da conta, com filtro por mês, conta e histórico.</span> : <span>Esta empresa só tem o balancete importado: a composição vai até as contas, sem os lançamentos.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
