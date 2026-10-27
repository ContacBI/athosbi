import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, BookOpen, ChevronsDownUp, ChevronsUpDown, GitCompareArrows, Search, TrendingUp, Wallet, X } from "lucide-react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactValue, fillTokens, fontStack, friendlyPeriod, isDark, mix, rgba, widgetDefinition } from "../../lib/presentations.js";
import { formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { dataMonths, shortPeriod } from "../../lib/assistant/context.js";
import { DEMO_DEFAULT_DEPTH, DEMO_SOURCES, DEMO_TITLES, demoRows, ledgerData } from "../../lib/slideDemo.js";
import { money } from "../../lib/format.js";
import { DemoTable, useNewRowKeys } from "./DemoBlock.jsx";
import { COMPARACOES, acumular, comparacaoDoBloco, contextoDoPeriodo, envDoBloco, numeroDeSaldo, partesDaComparacao, periodoDaEvolucao, serieDoNumero, variacaoDoNumero } from "../../lib/periodoDoBloco.js";

// Janelas do modo apresentação, por cima do slide: "Explorar" (os
// demonstrativos inteiros, interativos) e o razão de uma conta. Pintadas
// com as cores e fontes do tema da apresentação — parecem parte dela.

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : value || "";
}

function Shell({ theme, z, onClose, children, width = 1240 }) {
  const c = theme.colors;
  const dark = isDark(c.bg);
  return (
    <div
      className="present-overlay"
      style={{ position: "fixed", inset: 0, zIndex: z, display: "flex", alignItems: "center", justifyContent: "center", padding: "3vh 3vw", background: dark ? "rgba(0, 0, 0, 0.62)" : "rgba(15, 15, 20, 0.45)", backdropFilter: "blur(10px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="present-overlay-panel"
        style={{ width: `min(${width}px, 100%)`, height: "100%", display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", background: c.bg, color: c.text, fontFamily: fontStack("@body", theme), "--ov-cursor": rgba(c.text, 0.07), "--ov-tip-bg": c.surface, "--ov-tip-line": rgba(c.text, 0.14), "--ov-text": c.text, "--ov-muted": c.muted, boxShadow: dark ? "0 40px 120px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06)" : "0 40px 120px rgba(15, 23, 42, 0.35)", border: `1px solid ${rgba(c.text, dark ? 0.1 : 0.08)}` }}
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ theme, onClose, label = "Voltar" }) {
  const c = theme.colors;
  return (
    <button type="button" onClick={onClose} title="Fechar (Esc)" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: `1px solid ${rgba(c.text, 0.16)}`, background: rgba(c.text, 0.05), color: c.text, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
      <X size={15} strokeWidth={2.2} />
      {label}
    </button>
  );
}

function Pill({ active, theme, onClick, children, title }) {
  const c = theme.colors;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1px solid ${active ? c.accent : rgba(c.text, 0.14)}`, background: active ? c.accent : "transparent", color: active ? (isDark(c.accent) ? "#ffffff" : "#161616") : c.text, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {children}
    </button>
  );
}

function SearchBox({ theme, value, onChange, placeholder }) {
  const c = theme.colors;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 36, borderRadius: 999, border: `1px solid ${rgba(c.text, 0.14)}`, background: rgba(c.text, 0.04), minWidth: 240, flex: "0 1 320px" }}>
      <Search size={15} style={{ color: c.muted, flexShrink: 0 }} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: c.text, fontSize: 13.5, fontFamily: "inherit" }}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Explorar: DRE, Balanço e DFC inteiros, no período da apresentação.

const LEVELS = [
  { id: "base", label: "Resumido", extra: 0 },
  { id: "mais", label: "Mais detalhe", extra: 1 },
  { id: "detalhe", label: "Detalhado", extra: 2 },
  { id: "tudo", label: "Até as contas", extra: 99 },
];

export function ExplorerOverlay({ deck, env: envApresentacao, initial, z, onClose, onLedger }) {
  // Aberto de um bloco com período próprio: explora no período dele.
  const periodoDoBloco = initial?.periodo || initial?.block?.periodo;
  const env = useMemo(() => envDoBloco({ kind: "demo", periodo: periodoDoBloco }, envApresentacao), [periodoDoBloco, envApresentacao]);
  const theme = deck.theme;
  const c = theme.colors;
  const [source, setSource] = useState(initial?.source || "DRE");
  const startBlock = initial?.block && initial.block.source === source ? initial.block : null;
  const [level, setLevel] = useState("base");
  const [open, setOpen] = useState(() => startBlock?.open || {});
  const [columns, setColumns] = useState(startBlock?.columns === "meses" || startBlock?.columns === "meses_total" ? "meses_total" : "total");
  const [showPercent, setShowPercent] = useState(Boolean(startBlock?.showPercent));
  const [showTrend, setShowTrend] = useState(Boolean(startBlock?.showTrend));
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());

  function changeSource(next) {
    setSource(next);
    setOpen({});
    setLevel("base");
  }

  const extra = LEVELS.find((item) => item.id === level)?.extra || 0;
  const block = useMemo(
    () => ({
      source,
      depth: term ? 99 : DEMO_DEFAULT_DEPTH[source] + extra,
      columns,
      showPercent: showPercent && source !== "DFC",
      showTrend,
      hideZero: true,
      highlight: startBlock?.highlight || [],
      hide: [],
    }),
    [source, extra, columns, showPercent, showTrend, term, startBlock]
  );
  const data = useMemo(() => (env.ctx ? demoRows(block, env.ctx, { open: term ? {} : open }) : null), [block, env.ctx, open, term]);
  const rows = useMemo(() => {
    const all = data?.rows || [];
    if (!term) return all;
    // Linha que bate com a busca + o caminho até ela (as linhas-mãe).
    const keep = new Set();
    const stack = [];
    all.forEach((row, index) => {
      stack.length = row.depth;
      stack[row.depth] = index;
      if (normalize(row.name).includes(term) || normalize(row.code).includes(term)) stack.forEach((i) => keep.add(i));
    });
    return all.filter((_, index) => keep.has(index));
  }, [data, term]);
  const fresh = useNewRowKeys(rows);

  function toggle(row) {
    setOpen((current) => ({ ...current, [row.code]: row.expanded ? false : "one" }));
  }
  function expandAll(flag) {
    setOpen({});
    setLevel(flag ? "tudo" : "base");
  }

  return (
    <Shell theme={theme} z={z} onClose={onClose}>
      <div style={{ padding: "26px 32px 18px", borderBottom: `1px solid ${rgba(c.text, 0.1)}`, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: c.accent }}>Explorar demonstrativos</div>
            <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 30, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{DEMO_TITLES[source]}</div>
            <div style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>
              {env.info?.empresa}
              {env.info?.empresa ? " · " : ""}
              {fillTokens("{periodo}", env.ctx, env.info)}
            </div>
          </div>
          <CloseButton theme={theme} onClose={onClose} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 999, background: rgba(c.text, 0.06) }}>
            {DEMO_SOURCES.map((item) => (
              <Pill key={item.value} theme={theme} active={source === item.value} onClick={() => changeSource(item.value)}>
                {item.value === "BP" ? "Balanço" : item.label}
              </Pill>
            ))}
          </div>
          <span style={{ width: 1, height: 24, background: rgba(c.text, 0.12) }} />
          {LEVELS.map((item) => (
            <Pill key={item.id} theme={theme} active={!term && level === item.id} onClick={() => { setLevel(item.id); setOpen({}); }}>
              {item.label}
            </Pill>
          ))}
          <span style={{ flex: 1 }} />
          <SearchBox theme={theme} value={search} onChange={setSearch} placeholder="Buscar linha ou conta (ex.: caixa)…" />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Pill theme={theme} active={columns === "total"} onClick={() => setColumns("total")}>Total do período</Pill>
          <Pill theme={theme} active={columns === "meses_total"} onClick={() => setColumns("meses_total")}>Mês a mês</Pill>
          {source !== "DFC" && (
            <Pill theme={theme} active={showPercent} onClick={() => setShowPercent((value) => !value)} title={source === "BP" ? "% do ativo total" : "% da receita líquida"}>
              % análise vertical
            </Pill>
          )}
          <Pill theme={theme} active={showTrend} onClick={() => setShowTrend((value) => !value)}>Tendência</Pill>
          <span style={{ flex: 1 }} />
          <Pill theme={theme} onClick={() => expandAll(true)} title="Abrir todas as linhas até as contas">
            <ChevronsUpDown size={14} /> Abrir tudo
          </Pill>
          <Pill theme={theme} onClick={() => expandAll(false)} title="Voltar ao resumido">
            <ChevronsDownUp size={14} /> Fechar tudo
          </Pill>
        </div>
      </div>
      <div className="demo-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 22px 28px", "--demo-thumb": rgba(c.text, 0.22) }}>
        {!env.ctx ? (
          <p style={{ color: c.muted, padding: 24 }}>Sem lançamentos no período.</p>
        ) : rows.length ? (
          <DemoTable
            rows={rows}
            columns={data.columns}
            theme={theme}
            fontSize={16}
            numberStyle="full"
            stripe
            showPercent={block.showPercent}
            showTrend={showTrend}
            interactive
            onToggle={toggle}
            onLedger={(row) => onLedger({ source, row: row.node.row, parentCode: row.node.parentCode, name: row.name, months: data.months })}
            animateKeys={fresh}
          />
        ) : (
          <p style={{ color: c.muted, padding: 24 }}>Nenhuma linha com “{search}”.</p>
        )}
      </div>
      <div style={{ padding: "10px 32px", borderTop: `1px solid ${rgba(c.text, 0.08)}`, fontSize: 12.5, color: c.muted, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span>Clique numa linha pra abrir ou fechar.</span>
        <span>Clique numa conta pra ver o razão.</span>
        <span>Esc volta pro slide.</span>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Razão da conta.

function Stat({ theme, icon: Icon, label, value, tone }) {
  const c = theme.colors;
  const color = tone === "pos" ? c.positive : tone === "neg" ? c.negative : c.accent;
  return (
    <div style={{ flex: "1 1 180px", padding: "16px 18px", borderRadius: 18, background: c.surface, border: `1px solid ${rgba(c.text, 0.06)}`, display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: rgba(color, 0.16), color, flexShrink: 0 }}>
        <Icon size={19} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: c.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: value < -0.004 ? c.negative : c.text }}>{money(value)}</div>
      </div>
    </div>
  );
}

const PAGE = 250;

function axisValue(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const fmt = (v, digits) => v.toLocaleString("pt-BR", { maximumFractionDigits: digits });
  if (abs >= 1e6) return `${fmt(n / 1e6, 1)} mi`;
  if (abs >= 1e3) return `${fmt(n / 1e3, 0)} mil`;
  return fmt(n, 0);
}

export function LedgerOverlay({ deck, request, z, onClose }) {
  const theme = deck.theme;
  const c = theme.colors;
  const data = useMemo(() => ledgerData(request), [request]);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const term = normalize(search.trim());
  const lines = useMemo(() => {
    if (!term) return data.lines;
    return data.lines.filter((line) => normalize(`${formatDate(line.data)} ${line.historico} ${line.counterpart} ${money(line.debito)} ${money(line.credito)}`).includes(term));
  }, [data, term]);
  const shown = lines.slice(0, limit);
  const listRef = useRef(null);
  useEffect(() => {
    setLimit(PAGE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [term]);
  const isBalance = data.isBalance;
  const grid = rgba(c.text, 0.1);
  const showRunning = request.source !== "DFC";
  const template = `110px minmax(0, 1fr) 140px 140px${showRunning ? " 150px" : ""}`;
  return (
    <Shell theme={theme} z={z} onClose={onClose} width={1180}>
      <div style={{ padding: "26px 32px 20px", display: "flex", flexDirection: "column", gap: 18, borderBottom: `1px solid ${rgba(c.text, 0.1)}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: c.accent }}>
              <BookOpen size={14} strokeWidth={2.4} /> {request.source === "DFC" ? "Movimentos de caixa" : "Razão da conta"}
            </div>
            <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 30, fontWeight: 700, lineHeight: 1.15, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.name}</div>
            <div style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>
              {Array.isArray(request.row.classificacao) ? `${request.row.classificacao.length} contas somadas` : request.row.classificacao}
              {" · "}
              {data.lines.length} lançamento{data.lines.length === 1 ? "" : "s"}
            </div>
          </div>
          <CloseButton theme={theme} onClose={onClose} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {isBalance && <Stat theme={theme} icon={Wallet} label="Saldo no início" value={data.opening} />}
          <Stat theme={theme} icon={ArrowDownLeft} label="Débitos" value={data.debits} tone="pos" />
          <Stat theme={theme} icon={ArrowUpRight} label="Créditos" value={data.credits} tone="neg" />
          <Stat theme={theme} icon={Wallet} label={isBalance ? "Saldo no fim" : "Total no período"} value={isBalance ? data.closing : data.total} />
        </div>
        {data.monthly.length > 1 && (
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: c.muted }} axisLine={{ stroke: grid }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: c.muted }} tickFormatter={axisValue} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  cursor={{ fill: rgba(c.text, 0.06) }}
                  contentStyle={{ background: c.surface, border: `1px solid ${rgba(c.text, 0.12)}`, borderRadius: 12, color: c.text, fontSize: 13 }}
                  labelStyle={{ color: c.muted }}
                  formatter={(value, name) => [money(value), name === "balance" ? "Saldo no fim do mês" : isBalance ? "Movimento do mês" : "Valor do mês"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {data.monthly.map((item) => (
                    <Cell key={item.month} fill={item.value < 0 ? c.negative : isBalance ? mix(c.accent, c.bg, 0.35) : c.positive} />
                  ))}
                </Bar>
                {isBalance && <Line dataKey="balance" stroke={c.accent} strokeWidth={2.6} dot={{ r: 3.5, fill: c.accent }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SearchBox theme={theme} value={search} onChange={setSearch} placeholder="Buscar histórico, contrapartida, valor ou data…" />
          {term && <span style={{ fontSize: 13, color: c.muted }}>{lines.length} de {data.lines.length}</span>}
        </div>
      </div>
      <div ref={listRef} className="demo-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", "--demo-thumb": rgba(c.text, 0.22) }}>
        <div style={{ position: "sticky", top: 0, zIndex: 1, display: "grid", gridTemplateColumns: template, gap: 16, padding: "10px 32px", background: c.bg, borderBottom: `1px solid ${grid}`, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: c.muted }}>
          <span>Data</span>
          <span>Histórico</span>
          <span style={{ textAlign: "right" }}>Débito</span>
          <span style={{ textAlign: "right" }}>Crédito</span>
          {showRunning && <span style={{ textAlign: "right" }}>Saldo</span>}
        </div>
        {shown.map((line, index) => (
          <div key={line.id} className="demo-row" style={{ display: "grid", gridTemplateColumns: template, gap: 16, alignItems: "center", padding: "9px 32px", fontSize: 14, background: index % 2 ? rgba(c.text, 0.03) : "transparent", fontVariantNumeric: "tabular-nums", "--demo-hover": rgba(c.text, 0.07) }}>
            <span style={{ color: c.muted }}>{formatDate(line.data)}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={line.historico}>{line.historico}</span>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: c.muted }}>
                {line.counterpart ? `${request.source === "DFC" ? "Conta de caixa" : "Contrapartida"}: ${line.counterpart}` : request.source === "DFC" ? "" : "contrapartida não encontrada"}
                {line.company ? ` · ${line.company}` : ""}
              </span>
            </span>
            <span style={{ textAlign: "right", color: line.debito ? c.positive : c.muted }}>{line.debito ? money(line.debito) : "–"}</span>
            <span style={{ textAlign: "right", color: line.credito ? c.negative : c.muted }}>{line.credito ? money(line.credito) : "–"}</span>
            {showRunning && <span style={{ textAlign: "right", fontWeight: 600, color: line.running < -0.004 ? c.negative : c.text }}>{money(line.running)}</span>}
          </div>
        ))}
        {lines.length > shown.length && (
          <div style={{ padding: 18, textAlign: "center" }}>
            <Pill theme={theme} onClick={() => setLimit((value) => value + PAGE)}>Mostrar mais {Math.min(PAGE, lines.length - shown.length)} de {lines.length - shown.length}</Pill>
          </div>
        )}
        {!lines.length && <p style={{ padding: "24px 32px", color: c.muted }}>{data.lines.length ? "Nenhum lançamento com essa busca." : "Nenhum lançamento no período."}</p>}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Comparar: clicar num Número no modo apresentação abre o valor do período
// lado a lado com o do período de comparação (do mesmo tamanho), o mês a
// mês dos dois e o que mais mudou. Dá pra trocar a comparação aqui mesmo.

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (mes) => (mes ? `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}` : "");

function ValorDoPeriodo({ theme, rotulo, periodo, valor, format, destaque }) {
  const c = theme.colors;
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "22px 24px", borderRadius: 22, background: destaque ? `linear-gradient(145deg, ${rgba(c.accent, 0.16)}, ${rgba(c.accent, 0.04)})` : rgba(c.text, 0.04), border: `1px solid ${destaque ? rgba(c.accent, 0.45) : rgba(c.text, 0.1)}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: destaque ? c.accent : c.muted }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: destaque ? c.accent : rgba(c.text, 0.35) }} />
        {rotulo}
      </div>
      <div style={{ fontSize: 14, color: c.muted, marginTop: 6 }}>{periodo}</div>
      <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 44, fontWeight: 700, lineHeight: 1.05, marginTop: 14, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: valor == null ? c.muted : valor < 0 ? c.negative : destaque ? c.text : mix(c.text, c.bg, 0.25) }}>
        {valor == null ? "—" : compactValue(valor, format)}
      </div>
      {valor != null && format === "money" && Math.abs(valor) >= 1e4 && <div style={{ fontSize: 13, color: c.muted, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{formatWidgetValue(valor, format)}</div>}
    </div>
  );
}

const JANELAS = [
  { id: "6", rotulo: "6 meses", meses: 6 },
  { id: "12", rotulo: "12 meses", meses: 12 },
  { id: "24", rotulo: "24 meses", meses: 24 },
  { id: "tudo", rotulo: "Tudo", meses: 0 },
];

function Destaque({ theme, rotulo, valor, sub, cor }) {
  const c = theme.colors;
  return (
    <div style={{ minWidth: 0, padding: "16px 18px", borderRadius: 18, background: rgba(c.text, 0.04), border: `1px solid ${rgba(c.text, 0.08)}` }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.muted }}>{rotulo}</div>
      <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 24, fontWeight: 700, marginTop: 6, color: cor || c.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12.5, color: c.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// O gráfico da Evolução: área em degradê (vermelha abaixo de zero), a
// média tracejada e só três pontos marcados — o maior, o menor e o último
// (pulsando) —, com o valor escrito ao lado.
function GraficoDaEvolucao({ theme, pontos, formatar, eixo, extremos = true, media: mostrarMedia = true }) {
  const c = theme.colors;
  const uid = useId().replace(/:/g, "");
  const valores = pontos.map((ponto) => ponto.valor ?? 0);
  const maior = Math.max(...valores);
  const menor = Math.min(...valores);
  const iMaior = valores.indexOf(maior);
  const iMenor = valores.indexOf(menor);
  const ultimo = pontos.length - 1;
  const media = valores.reduce((soma, valor) => soma + valor, 0) / (valores.length || 1);
  // Onde o zero cai no degradê (só quando a série cruza o zero).
  const corte = maior <= 0 ? 0 : menor >= 0 ? 1 : maior / (maior - menor);
  const grid = rgba(c.text, 0.09);
  const Ponto = ({ cx, cy, index, payload }) => {
    const ehMaior = extremos && index === iMaior;
    const ehMenor = extremos && index === iMenor && iMenor !== iMaior;
    const ehUltimo = index === ultimo;
    if ((!ehMaior && !ehMenor && !ehUltimo) || cx == null || cy == null) return <g key={`p${index}`} />;
    const cor = (payload.valor ?? 0) < 0 ? c.negative : c.accent;
    const etiqueta = ehUltimo ? formatar(payload.valor) : `${ehMaior ? "maior" : "menor"} · ${formatar(payload.valor)}`;
    const largura = etiqueta.length * 7.2 + 22;
    const abaixo = ehMenor && !ehUltimo;
    const dx = index === ultimo ? -largura / 2 + 10 : index === 0 ? largura / 2 - 10 : 0;
    return (
      <g key={`p${index}`}>
        {ehUltimo && <circle cx={cx} cy={cy} r={14} fill={rgba(cor, 0.22)} className="evo-pulso" />}
        <circle cx={cx} cy={cy} r={ehUltimo ? 7 : 5.5} fill={cor} stroke={c.bg} strokeWidth={3} />
        <g transform={`translate(${cx + dx}, ${abaixo ? cy + 28 : cy - 18})`}>
          <rect x={-largura / 2} y={-15} width={largura} height={23} rx={11.5} fill={ehUltimo ? cor : c.surface} stroke={ehUltimo ? "none" : rgba(cor, 0.55)} />
          <text textAnchor="middle" y={1.5} fontSize={12} fontWeight={700} fill={ehUltimo ? (isDark(cor) ? "#ffffff" : "#161616") : c.text}>
            {etiqueta}
          </text>
        </g>
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={pontos} margin={{ top: 40, right: 26, left: 4, bottom: 6 }}>
        <defs>
          <linearGradient id={`evoArea${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={maior > 0 ? c.accent : c.negative} stopOpacity={0.5} />
            <stop offset={corte} stopColor={maior > 0 ? c.accent : c.negative} stopOpacity={0.04} />
            <stop offset={corte} stopColor={c.negative} stopOpacity={0.04} />
            <stop offset="1" stopColor={c.negative} stopOpacity={menor < 0 ? 0.45 : 0.04} />
          </linearGradient>
          <linearGradient id={`evoLinha${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={maior > 0 ? c.accent : c.negative} />
            <stop offset={corte} stopColor={maior > 0 ? c.accent : c.negative} />
            <stop offset={corte} stopColor={c.negative} />
            <stop offset="1" stopColor={c.negative} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 6" />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12.5, fill: c.muted }} axisLine={{ stroke: grid }} tickLine={false} interval="preserveStartEnd" minTickGap={18} tickMargin={10} />
        <YAxis tick={{ fontSize: 11.5, fill: c.muted }} tickFormatter={eixo} axisLine={false} tickLine={false} width={66} />
        {menor < 0 && maior > 0 && <ReferenceLine y={0} stroke={rgba(c.text, 0.3)} />}
        {mostrarMedia && pontos.length > 2 && <ReferenceLine y={media} stroke={rgba(c.text, 0.4)} strokeDasharray="6 6" />}
        <Tooltip
          cursor={{ stroke: rgba(c.text, 0.25), strokeDasharray: "4 4" }}
          contentStyle={{ background: c.surface, border: `1px solid ${rgba(c.text, 0.12)}`, borderRadius: 12, color: c.text, fontSize: 13 }}
          labelStyle={{ color: c.muted }}
          formatter={(valor) => [formatar(valor), "Valor"]}
        />
        <Area type="monotone" dataKey="valor" stroke={`url(#evoLinha${uid})`} strokeWidth={3} fill={`url(#evoArea${uid})`} dot={Ponto} activeDot={{ r: 6, stroke: c.bg, strokeWidth: 3, fill: c.accent }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Cada mês como um quadradinho mais forte quanto maior o valor (vermelho
// pros negativos) — dá pra ver a sazonalidade de relance.
function FaixaDeCalor({ theme, pontos, formatar }) {
  const c = theme.colors;
  // Força relativa ao intervalo de cada lado do zero: meses parecidos ainda
  // se distinguem.
  const positivos = pontos.map((ponto) => ponto.valor ?? 0).filter((valor) => valor >= 0);
  const negativos = pontos.map((ponto) => Math.abs(ponto.valor ?? 0)).filter((_, index) => (pontos[index].valor ?? 0) < 0);
  const escala = (lista, valor) => {
    if (!lista.length) return 0.5;
    const menor = Math.min(...lista);
    const maior = Math.max(...lista);
    return maior - menor < 1e-9 ? 0.6 : (valor - menor) / (maior - menor);
  };
  const poucos = pontos.length <= 12;
  return (
    <div className="evolucao-calor" style={{ display: "grid", gridTemplateColumns: `repeat(${pontos.length}, minmax(0, 1fr))`, gap: 5 }}>
      {pontos.map((ponto) => {
        const valor = ponto.valor ?? 0;
        const forca = valor < 0 ? escala(negativos, Math.abs(valor)) : escala(positivos, valor);
        const base = valor < 0 ? c.negative : c.accent;
        const alpha = 0.12 + 0.7 * forca;
        const texto = alpha > 0.55 ? (isDark(base) ? "#ffffff" : "#161616") : c.text;
        return (
          <div key={ponto.mes} title={`${ponto.rotulo}: ${formatar(ponto.valor)}`} style={{ minWidth: 0, height: poucos ? 62 : 48, borderRadius: 12, background: rgba(base, alpha), color: texto, padding: "7px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>{ponto.rotulo}</span>
            {poucos && <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatar(ponto.valor)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function ComparisonOverlay({ deck, env: envApresentacao, request, z, onClose }) {
  const theme = deck.theme;
  const c = theme.colors;
  const [comparar, setComparar] = useState(request.comparar || "anterior");
  const [aba, setAba] = useState("comparar");
  const [janela, setJanela] = useState("12");
  const [acumulado, setAcumulado] = useState(false);
  const definition = widgetDefinition(request.widgetId);
  const env = useMemo(() => envDoBloco({ kind: "kpi", periodo: request.periodo }, envApresentacao), [request.periodo, envApresentacao]);
  const saldo = numeroDeSaldo(definition);
  const dados = useMemo(() => {
    const periodo = { start: env.info?.start || "", end: env.info?.end || "" };
    const comparacao = comparacaoDoBloco(comparar, periodo);
    if (!definition || !env.ctx || !comparacao) return null;
    const raiz = env.raiz || env.ctx;
    const ctxDe = (alvo) => (alvo.start === periodo.start && alvo.end === periodo.end ? env.ctx : contextoDoPeriodo(raiz, alvo));
    const ctxAtual = ctxDe(comparacao.atual);
    const ctxBase = ctxDe(comparacao.base);
    const valorEm = (ctx) => {
      try {
        return ctx ? definition.value(ctx) : null;
      } catch {
        return null;
      }
    };
    const atual = valorEm(ctxAtual);
    const base = valorEm(ctxBase);
    const format = atual?.format || base?.format || "money";
    const serieAtual = serieDoNumero(definition, ctxAtual);
    const serieBase = serieDoNumero(definition, ctxBase);
    const meses = Array.from({ length: Math.max(serieAtual.length, serieBase.length) }, (_, index) => ({
      rotulo: serieAtual[index] ? mesCurto(serieAtual[index].mes) : "",
      mesBase: serieBase[index] ? mesCurto(serieBase[index].mes) : "",
      atual: serieAtual[index]?.valor ?? null,
      base: serieBase[index]?.valor ?? null,
    }));
    const semBase = !serieBase.some((ponto) => ponto.valor != null && Math.abs(ponto.valor) > 0.005);
    return {
      comparacao,
      format,
      atual: atual ? Number(atual.value) : null,
      base: base && !semBase ? Number(base.value) : null,
      semBase,
      meses,
      partes: format === "money" && !semBase ? partesDaComparacao(definition, ctxAtual, ctxBase) : [],
    };
  }, [definition, env, comparar]);

  const label = request.label || definition?.label || "Número";
  const variacao = dados && dados.base != null ? variacaoDoNumero(dados.atual, dados.base, dados.format) : null;
  const diff = dados && dados.base != null && dados.atual != null ? dados.atual - dados.base : null;
  const tom = variacao ? (variacao.up ? c.positive : c.negative) : c.muted;
  const grid = rgba(c.text, 0.1);
  const corBase = rgba(c.text, isDark(c.bg) ? 0.32 : 0.22);
  const rotuloAtual = dados ? shortPeriod(dados.comparacao.atual.start, dados.comparacao.atual.end) : "";
  const rotuloBase = dados ? shortPeriod(dados.comparacao.base.start, dados.comparacao.base.end) : "";
  const textoDiff = diff == null ? "" : dados.format === "percent" ? `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : `${diff >= 0 ? "+" : "−"}${compactValue(Math.abs(diff), dados.format)}`;
  const maiorParte = Math.max(1, ...(dados?.partes || []).map((parte) => Math.abs(parte.diff)));
  // Aba Evolução: o número nos últimos N meses até o fim do período.
  const evolucao = useMemo(() => {
    if (aba !== "evolucao" || !definition || !env.ctx) return null;
    const escolha = JANELAS.find((item) => item.id === janela) || JANELAS[1];
    const periodo = periodoDaEvolucao(dataMonths(), env.info?.end, escolha.meses);
    if (!periodo) return null;
    const ctx = periodo.start === env.info?.start && periodo.end === env.info?.end ? env.ctx : contextoDoPeriodo(env.raiz || env.ctx, periodo);
    let format = "money";
    try {
      format = definition.value(ctx).format || "money";
    } catch {
      format = "money";
    }
    const mensal = serieDoNumero(definition, ctx).map((ponto) => ({ ...ponto, rotulo: mesCurto(ponto.mes) }));
    const pontos = acumulado && format === "money" && !saldo ? acumular(mensal) : mensal;
    return { periodo, format, pontos, mensal };
  }, [aba, definition, env, janela, acumulado, saldo]);
  const formatar = (valor) => (valor == null ? "—" : dados?.format === "percent" ? `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : compactValue(valor, dados?.format || "money"));

  const formatarEvo = (valor) => (valor == null ? "—" : evolucao?.format === "percent" ? `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : compactValue(valor, evolucao?.format || "money"));
  const pontosEvo = evolucao?.pontos || [];
  // Destaques e a faixa sempre com o valor de cada mês (mesmo no acumulado).
  const mensalEvo = evolucao?.mensal || [];
  const valoresEvo = mensalEvo.map((ponto) => ponto.valor ?? 0);
  const maiorEvo = mensalEvo.length ? mensalEvo[valoresEvo.indexOf(Math.max(...valoresEvo))] : null;
  const menorEvo = mensalEvo.length ? mensalEvo[valoresEvo.indexOf(Math.min(...valoresEvo))] : null;
  const mediaEvo = valoresEvo.length ? valoresEvo.reduce((soma, valor) => soma + valor, 0) / valoresEvo.length : null;
  const variacaoEvo = pontosEvo.length > 1 ? variacaoDoNumero(valoresEvo[valoresEvo.length - 1], valoresEvo[0], evolucao.format) : null;
  const fluxo = evolucao && evolucao.format === "money" && !saldo;
  const abas = [
    { id: "comparar", rotulo: "Comparação", icone: GitCompareArrows },
    { id: "evolucao", rotulo: "Evolução", icone: TrendingUp },
  ];
  const Icone = aba === "evolucao" ? TrendingUp : GitCompareArrows;

  return (
    <Shell theme={theme} z={z} onClose={onClose} width={1120}>
      <div style={{ padding: "26px 34px 20px", display: "flex", flexDirection: "column", gap: 18, borderBottom: `1px solid ${rgba(c.text, 0.1)}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: c.accent }}>
              <Icone size={15} strokeWidth={2.4} /> {aba === "evolucao" ? "Evolução" : "Comparação"}
            </div>
            <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 32, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>
              {env.info?.empresa}
              {env.info?.empresa ? " · " : ""}
              {aba === "evolucao" ? (evolucao ? friendlyPeriod(evolucao.periodo.start, evolucao.periodo.end) : "") : rotuloAtual && rotuloBase ? `${rotuloAtual} contra ${rotuloBase}` : ""}
            </div>
          </div>
          <CloseButton theme={theme} onClose={onClose} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="comparar-abas" role="tablist" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: rgba(c.text, 0.07) }}>
            {abas.map(({ id, rotulo, icone: IconeAba }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={`comparar-aba-${id}`}
                onClick={() => setAba(id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, border: "none", background: aba === id ? c.surface : "transparent", color: aba === id ? c.text : c.muted, fontSize: 13.5, fontWeight: aba === id ? 700 : 500, cursor: "pointer", boxShadow: aba === id ? `0 2px 10px ${rgba("#000000", 0.2)}` : "none", fontFamily: "inherit" }}
              >
                <IconeAba size={15} strokeWidth={2.2} /> {rotulo}
              </button>
            ))}
          </div>
          <div className="comparar-opcoes" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {aba === "comparar"
              ? COMPARACOES.map((opcao) => (
                  <Pill key={opcao.id} theme={theme} active={comparar === opcao.id} onClick={() => setComparar(opcao.id)}>
                    {opcao.rotulo}
                  </Pill>
                ))
              : JANELAS.map((opcao) => (
                  <Pill key={opcao.id} theme={theme} active={janela === opcao.id} onClick={() => setJanela(opcao.id)}>
                    {opcao.rotulo}
                  </Pill>
                ))}
            {aba === "evolucao" && fluxo && (
              <Pill theme={theme} active={acumulado} onClick={() => setAcumulado((valor) => !valor)} title="O gráfico soma os meses; os destaques continuam mês a mês">
                Ver acumulado no gráfico
              </Pill>
            )}
          </div>
        </div>
      </div>

      <div className="demo-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "24px 34px 32px", display: "flex", flexDirection: "column", gap: 22, "--demo-thumb": rgba(c.text, 0.22) }}>
        {aba === "evolucao" ? (
          pontosEvo.length < 2 ? (
            <p style={{ color: c.muted }}>Ainda não há meses suficientes com lançamentos para mostrar a evolução.</p>
          ) : (
            <>
              <div className="evolucao-destaques" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {fluxo ? (
                  <Destaque theme={theme} rotulo="Total no período" valor={formatarEvo(valoresEvo.reduce((soma, valor) => soma + valor, 0))} sub={`${pontosEvo.length} meses`} />
                ) : (
                  <Destaque theme={theme} rotulo="Do primeiro ao último" valor={variacaoEvo ? `${variacaoEvo.up ? "+" : "−"}${variacaoEvo.text}` : "—"} sub={`${pontosEvo[0].rotulo} → ${pontosEvo[pontosEvo.length - 1].rotulo}`} cor={variacaoEvo ? (variacaoEvo.up ? c.positive : c.negative) : undefined} />
                )}
                <Destaque theme={theme} rotulo={saldo ? "Saldo médio" : "Média por mês"} valor={formatarEvo(mediaEvo)} sub={`${pontosEvo.length} meses`} />
                <Destaque theme={theme} rotulo="Maior mês" valor={formatarEvo(maiorEvo?.valor)} sub={maiorEvo?.rotulo} />
                <Destaque theme={theme} rotulo="Menor mês" valor={formatarEvo(menorEvo?.valor)} sub={menorEvo?.rotulo} cor={(menorEvo?.valor ?? 0) < 0 ? c.negative : undefined} />
              </div>
              <div style={{ padding: "18px 20px 12px", borderRadius: 22, border: `1px solid ${rgba(c.text, 0.1)}`, background: `linear-gradient(180deg, ${rgba(c.accent, 0.05)}, ${rgba(c.text, 0.02)})` }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 18, fontWeight: 700 }}>
                    {label} {acumulado && fluxo ? "somado mês a mês (acumulado)" : saldo ? "no fim de cada mês" : "mês a mês"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: c.muted }}>
                    {!(acumulado && fluxo) && pontosEvo.length > 2 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 18, borderTop: `2px dashed ${rgba(c.text, 0.45)}` }} /> média {formatarEvo(mediaEvo)}
                      </span>
                    )}
                    <span>{friendlyPeriod(evolucao.periodo.start, evolucao.periodo.end)}</span>
                  </div>
                </div>
                <div className="evolucao-grafico" style={{ height: 330, marginTop: 6 }}>
                  <GraficoDaEvolucao theme={theme} pontos={pontosEvo} formatar={formatarEvo} eixo={evolucao.format === "percent" ? (valor) => `${Math.round(valor)}%` : axisValue} extremos={!(acumulado && fluxo)} media={!(acumulado && fluxo)} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 18, fontWeight: 700 }}>Mês a mês, de relance</div>
                  <div style={{ fontSize: 12.5, color: c.muted }}>Mais forte = maior valor{menorEvo?.valor < 0 ? " · vermelho = negativo" : ""}</div>
                </div>
                <FaixaDeCalor theme={theme} pontos={mensalEvo} formatar={formatarEvo} />
              </div>
            </>
          )
        ) : !dados ? (
          <p style={{ color: c.muted }}>Sem dados para comparar neste período.</p>
        ) : (
          <>
            <div className="comparar-valores" style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
              <ValorDoPeriodo theme={theme} rotulo="Agora" periodo={friendlyPeriod(dados.comparacao.atual.start, dados.comparacao.atual.end)} valor={dados.atual} format={dados.format} destaque />
              <div style={{ width: 168, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
                {variacao ? (
                  <>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 999, background: rgba(tom, 0.14), color: tom, boxShadow: `0 0 0 8px ${rgba(tom, 0.06)}` }}>
                      {variacao.up ? <ArrowUpRight size={30} strokeWidth={2.4} /> : <ArrowDownRight size={30} strokeWidth={2.4} />}
                    </span>
                    <span style={{ fontFamily: fontStack("@heading", theme), fontSize: 30, fontWeight: 800, color: tom, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {variacao.up ? "+" : "−"}
                      {variacao.text}
                    </span>
                    {dados.format !== "percent" && <span style={{ fontSize: 13, color: c.muted, fontVariantNumeric: "tabular-nums" }}>{textoDiff}</span>}
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: c.muted, lineHeight: 1.4 }}>{dados.semBase ? "Sem lançamentos no período de comparação" : "Sem variação para mostrar"}</span>
                )}
              </div>
              <ValorDoPeriodo theme={theme} rotulo="Comparado com" periodo={friendlyPeriod(dados.comparacao.base.start, dados.comparacao.base.end)} valor={dados.base} format={dados.format} />
            </div>

            {dados.meses.length > 1 && !dados.semBase && (
              <div style={{ padding: "18px 20px 10px", borderRadius: 22, border: `1px solid ${rgba(c.text, 0.1)}`, background: rgba(c.text, 0.025) }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 18, fontWeight: 700 }}>Mês a mês</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: c.muted }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> {rotuloAtual}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: corBase }} /> {rotuloBase}
                    </span>
                  </div>
                </div>
                <div style={{ height: 210, marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.meses} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                      <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />
                      <XAxis
                        dataKey="rotulo"
                        axisLine={{ stroke: grid }}
                        tickLine={false}
                        height={42}
                        interval={0}
                        tick={({ x, y, payload, index }) => (
                          <g transform={`translate(${x},${y + 14})`}>
                            <text textAnchor="middle" fontSize={13} fontWeight={600} fill={c.text}>
                              {payload.value}
                            </text>
                            <text textAnchor="middle" y={16} fontSize={11.5} fill={c.muted}>
                              {dados.meses[index]?.mesBase ? `× ${dados.meses[index].mesBase}` : ""}
                            </text>
                          </g>
                        )}
                      />
                      <YAxis tick={{ fontSize: 11.5, fill: c.muted }} tickFormatter={dados.format === "percent" ? (valor) => `${Math.round(valor)}%` : axisValue} axisLine={false} tickLine={false} width={64} />
                      <Tooltip
                        cursor={{ fill: rgba(c.text, 0.06) }}
                        contentStyle={{ background: c.surface, border: `1px solid ${rgba(c.text, 0.12)}`, borderRadius: 12, color: c.text, fontSize: 13 }}
                        labelStyle={{ color: c.muted }}
                        labelFormatter={(rotulo, itens) => (itens?.[0]?.payload?.mesBase ? `${rotulo} × ${itens[0].payload.mesBase}` : rotulo)}
                        formatter={(valor, nome, item) => [formatar(valor), nome === "atual" ? item.payload.rotulo : item.payload.mesBase]}
                      />
                      <Bar dataKey="base" fill={corBase} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                      <Bar dataKey="atual" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                        {dados.meses.map((item, index) => (
                          <Cell key={index} fill={item.atual < 0 ? c.negative : c.accent} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {dados.partes.length > 1 && (
              <div className="comparar-partes">
                <div style={{ fontFamily: fontStack("@heading", theme), fontSize: 18, fontWeight: 700, marginBottom: 10 }}>O que mais mudou</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 120px 220px", gap: 14, padding: "0 4px 8px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: c.muted, borderBottom: `1px solid ${grid}` }}>
                  <span>Parte</span>
                  <span style={{ textAlign: "right" }}>{rotuloBase}</span>
                  <span style={{ textAlign: "right" }}>{rotuloAtual}</span>
                  <span style={{ textAlign: "right" }}>Diferença</span>
                </div>
                {dados.partes.map((parte) => {
                  const corParte = parte.diff >= 0 ? c.positive : c.negative;
                  return (
                    <div key={parte.rotulo} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 120px 220px", gap: 14, alignItems: "center", padding: "11px 4px", fontSize: 14, borderBottom: `1px solid ${rgba(c.text, 0.06)}`, fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={parte.rotulo}>
                        {parte.rotulo}
                      </span>
                      <span style={{ textAlign: "right", color: c.muted }}>{compactValue(parte.base, "money")}</span>
                      <span style={{ textAlign: "right", fontWeight: 600 }}>{compactValue(parte.atual, "money")}</span>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                        <span style={{ flex: 1, height: 8, borderRadius: 99, background: rgba(c.text, 0.06), overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>
                          <span style={{ width: `${Math.max(3, (Math.abs(parte.diff) / maiorParte) * 100)}%`, height: "100%", borderRadius: 99, background: corParte }} />
                        </span>
                        <span style={{ width: 92, textAlign: "right", fontWeight: 700, color: Math.abs(parte.diff) < 0.5 ? c.muted : corParte }}>
                          {parte.diff >= 0 ? "+" : "−"}
                          {compactValue(Math.abs(parte.diff), "money")}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

