import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, ChevronsDownUp, ChevronsUpDown, Search, Wallet, X } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fillTokens, fontStack, isDark, mix, rgba } from "../../lib/presentations.js";
import { DEMO_DEFAULT_DEPTH, DEMO_SOURCES, DEMO_TITLES, demoRows, ledgerData } from "../../lib/slideDemo.js";
import { money } from "../../lib/format.js";
import { DemoTable, useNewRowKeys } from "./DemoBlock.jsx";

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
        style={{ width: `min(${width}px, 100%)`, height: "100%", display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", background: c.bg, color: c.text, fontFamily: fontStack("@body", theme), boxShadow: dark ? "0 40px 120px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06)" : "0 40px 120px rgba(15, 23, 42, 0.35)", border: `1px solid ${rgba(c.text, dark ? 0.1 : 0.08)}` }}
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

export function ExplorerOverlay({ deck, env, initial, z, onClose, onLedger }) {
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
