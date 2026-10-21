import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, Maximize2 } from "lucide-react";
import { fillTokens, fontStack, mix, resolveColor, rgba } from "../../lib/presentations.js";
import { DEMO_TITLES, demoRows, formatDemoValue } from "../../lib/slideDemo.js";

// O "Demonstrativo sob medida" no slide (ver lib/slideDemo.js) e a tabela
// que ele desenha — a mesma tabela serve o bloco e a janela "Explorar" do
// modo apresentação (PresentOverlays.jsx).

function Spark({ values, color, width, height }) {
  const points = (values || []).map((value, i) => [i, Number(value || 0)]);
  if (points.length < 2) return null;
  const min = Math.min(...points.map(([, v]) => v));
  const max = Math.max(...points.map(([, v]) => v));
  const span = max - min || 1;
  const last = points.length - 1;
  const xy = points.map(([i, v]) => [(i / last) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: "block", overflow: "visible" }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.6" fill={color} />
    </svg>
  );
}

export function demoLayout({ fontSize, columns, numberStyle, showPercent, showTrend, width }) {
  const colW = numberStyle === "compact" ? 6.2 : numberStyle === "int" ? 7.6 : 8.8;
  const per = colW + (showPercent ? 3.8 : 0);
  const needed = fontSize * (12 + columns.length * per + (showTrend ? 5.5 : 0));
  const size = width && needed > width ? Math.max(8, fontSize * (width / needed)) : fontSize;
  return { size, colW: size * colW, pctW: size * 3.8, trendW: size * 5.5, rowH: size * 2.05 };
}

// A tabela. `interactive`: linhas com filhas abrem/fecham no clique e a
// conta abre o razão. `maxRows`: corta (PDF/editor); sem ele, tudo.
export function DemoTable({ rows, columns, theme, fontSize, font, numberStyle = "full", stripe = true, highlightColor, showPercent, showTrend, interactive, onToggle, onLedger, maxRows, width, animateKeys }) {
  const c = theme.colors;
  const hl = resolveColor(highlightColor || "@accent", theme) || c.accent;
  const layout = demoLayout({ fontSize, columns, numberStyle, showPercent, showTrend, width });
  const { size } = layout;
  const shown = maxRows != null ? rows.slice(0, maxRows) : rows;
  const extra = rows.length - shown.length;
  const template = [
    "minmax(0, 1fr)",
    ...(showTrend ? [`${layout.trendW}px`] : []),
    ...columns.flatMap(() => [`${layout.colW}px`, ...(showPercent ? [`${layout.pctW}px`] : [])]),
  ].join(" ");
  const line = rgba(c.text, 0.12);
  return (
    <div style={{ fontFamily: fontStack(font || "@body", theme), fontSize: size, color: c.text, fontVariantNumeric: "tabular-nums" }}>
      <div style={{ display: "grid", gridTemplateColumns: template, columnGap: size * 0.9, alignItems: "end", padding: `0 ${size * 0.6}px ${size * 0.45}px`, borderBottom: `1px solid ${line}`, color: c.muted, fontSize: size * 0.72, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        <span>Conta</span>
        {showTrend && <span style={{ textAlign: "center" }}>Tendência</span>}
        {columns.map((col) => [
          <span key={col.id} style={{ textAlign: "right" }}>{col.label}</span>,
          showPercent ? <span key={`${col.id}%`} style={{ textAlign: "right" }}>%</span> : null,
        ])}
      </div>
      {shown.map((row, index) => {
        const clickable = interactive && (row.hasChildren || row.kind === "analytic");
        const isAccount = row.kind === "analytic";
        const bold = row.isTotal || row.depth === 0;
        let background = stripe && index % 2 === 1 ? rgba(c.text, 0.035) : "transparent";
        if (row.highlighted) background = rgba(hl, 0.16);
        const boxShadow = row.highlighted ? `inset ${Math.max(3, size * 0.25)}px 0 0 ${hl}` : undefined;
        const nameColor = isAccount ? mix(c.text, c.muted, 0.45) : row.depth === 0 || row.isTotal ? c.text : mix(c.text, c.muted, 0.2);
        return (
          <div
            key={row.key}
            data-interactive={clickable ? "" : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? (event) => {
              event.stopPropagation();
              if (isAccount) onLedger?.(row);
              else onToggle?.(row);
            } : undefined}
            className={`demo-row${clickable ? " demo-row-click" : ""}${animateKeys?.has(row.key) ? " demo-row-in" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: template,
              columnGap: size * 0.9,
              alignItems: "center",
              minHeight: layout.rowH,
              padding: `0 ${size * 0.6}px`,
              background,
              boxShadow,
              borderTop: bold && index > 0 && !row.highlighted ? `1px solid ${line}` : undefined,
              fontWeight: row.highlighted || row.isTotal ? 700 : row.depth === 0 ? 600 : isAccount ? 400 : 500,
              cursor: clickable ? "pointer" : undefined,
              "--demo-hover": rgba(c.text, 0.07),
              "--demo-accent": hl,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: size * 0.35, minWidth: 0, paddingLeft: row.depth * size * 1.15, color: row.highlighted ? c.text : nameColor, fontSize: isAccount ? size * 0.94 : size }}>
              {interactive && (row.hasChildren ? (
                <ChevronRight size={size * 0.85} strokeWidth={2.2} style={{ flexShrink: 0, color: c.muted, transition: "transform 200ms", transform: row.expanded ? "rotate(90deg)" : "none" }} />
              ) : (
                <span style={{ width: size * 0.85, flexShrink: 0 }} />
              ))}
              {isAccount && !interactive && <span style={{ width: size * 0.32, height: size * 0.32, borderRadius: 999, background: rgba(c.muted, 0.6), flexShrink: 0 }} />}
              <span title={row.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
              {interactive && isAccount && (
                <span className="demo-ledger" style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: size * 0.3, padding: `${size * 0.12}px ${size * 0.45}px`, borderRadius: 999, background: rgba(hl, 0.16), color: hl, fontSize: size * 0.68, fontWeight: 700 }}>
                  <BookOpen size={size * 0.7} strokeWidth={2.2} />
                  razão
                </span>
              )}
            </span>
            {showTrend && (
              <span style={{ display: "flex", justifyContent: "center" }}>
                <Spark values={row.series} color={row.highlighted ? hl : c.muted} width={layout.trendW - 6} height={size * 1.2} />
              </span>
            )}
            {columns.map((col) => {
              const value = row.values[col.id];
              const pct = row.percents?.[col.id];
              return [
                <span key={col.id} style={{ textAlign: "right", whiteSpace: "nowrap", color: Number(value) < -0.004 ? c.negative : undefined }}>
                  {row.isHeading ? "" : formatDemoValue(value, numberStyle)}
                </span>,
                showPercent ? (
                  <span key={`${col.id}%`} style={{ textAlign: "right", whiteSpace: "nowrap", color: c.muted, fontSize: size * 0.82 }}>
                    {pct == null || row.isHeading ? "" : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`}
                  </span>
                ) : null,
              ];
            })}
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ padding: `${size * 0.4}px ${size * 0.6}px 0`, color: c.muted, fontSize: size * 0.78 }}>+{extra} linhas — na apresentação dá pra rolar ou abrir em “Explorar”.</div>
      )}
    </div>
  );
}

// Linhas que acabaram de aparecer (pra entrarem com animação).
export function useNewRowKeys(rows) {
  const previous = useRef(null);
  const keys = useMemo(() => rows.map((row) => row.key), [rows]);
  const fresh = useMemo(() => {
    if (!previous.current) return new Set();
    const before = new Set(previous.current);
    return new Set(keys.filter((key) => !before.has(key)));
  }, [keys]);
  useEffect(() => {
    previous.current = keys;
  }, [keys]);
  return fresh;
}

export function DemoContent({ block, theme, env }) {
  const present = env.mode === "present";
  const interactive = present && block.interactive !== false;
  const [liveOpen, setLiveOpen] = useState(null);
  const open = useMemo(() => liveOpen || block.open || {}, [liveOpen, block.open]);
  const data = useMemo(() => (env.ctx ? demoRows(block, env.ctx, { open }) : null), [block, env.ctx, open]);
  const rows = data?.rows || [];
  const fresh = useNewRowKeys(rows);
  const scroller = useRef(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const node = scroller.current;
    if (!node || !present) return;
    const check = () => setMoreBelow(node.scrollHeight - node.scrollTop - node.clientHeight > 4);
    check();
    node.addEventListener("scroll", check);
    return () => node.removeEventListener("scroll", check);
  }, [present, rows.length]);
  if (!env.ctx) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: theme.colors.muted, fontFamily: fontStack("@body", theme), fontSize: 16 }}>Sem lançamentos no período</div>;
  }
  const c = theme.colors;
  const fontSize = block.fontSize || 15;
  const pad = (block.style?.padding || 0) * 2;
  const innerW = Math.max(120, block.w - pad);
  const innerH = Math.max(80, block.h - pad);
  const title = block.title ? fillTokens(block.title, env.ctx, env.info) : DEMO_TITLES[block.source] || "Demonstrativo";
  const period = env.info ? fillTokens("{periodo}", env.ctx, env.info) : "";
  const titleSize = block.titleSize || fontSize * 1.5;
  const headerH = block.showTitle !== false ? titleSize * 1.35 + (block.showPeriod !== false ? fontSize * 1.3 : 0) + fontSize * 0.8 : 0;
  const layout = demoLayout({ fontSize, columns: data.columns, numberStyle: block.numberStyle, showPercent: block.showPercent && block.source !== "DFC", showTrend: block.showTrend, width: innerW });
  const fit = Math.max(1, Math.floor((innerH - headerH - layout.size * 1.6 - layout.size * 1.4) / layout.rowH));
  const toggle = (row) => {
    setLiveOpen((current) => {
      const next = { ...(current || block.open || {}) };
      if (row.expanded) next[row.code] = false;
      else next[row.code] = "one";
      return next;
    });
  };
  const ledger = (row) => env.onOpenLedger?.({ source: block.source, row: row.node.row, parentCode: row.node.parentCode, name: row.name, months: data.months });
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {block.showTitle !== false && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: fontSize * 0.8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: fontStack(block.titleFont || "@heading", theme), fontSize: titleSize, fontWeight: 700, lineHeight: 1.2, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            {block.showPeriod !== false && period && <div style={{ fontFamily: fontStack("@body", theme), fontSize: fontSize * 0.85, color: c.muted, marginTop: 2 }}>{period}</div>}
          </div>
          {present && env.onExplore && (
            <button
              type="button"
              data-interactive=""
              onClick={(event) => {
                event.stopPropagation();
                env.onExplore({ source: block.source, block: { ...block, open } });
              }}
              className="demo-explore"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: `1px solid ${rgba(c.accent, 0.45)}`, background: rgba(c.accent, 0.12), color: c.accent, fontFamily: fontStack("@body", theme), fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Maximize2 size={14} strokeWidth={2.2} />
              Explorar
            </button>
          )}
        </div>
      )}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div ref={scroller} className={present ? "demo-scroll" : undefined} style={{ position: "relative", flex: 1, minHeight: 0, overflowY: present ? "auto" : "hidden", overflowX: "hidden", "--demo-thumb": rgba(c.text, 0.22) }}>
        <DemoTable
          rows={rows}
          columns={data.columns}
          theme={theme}
          fontSize={fontSize}
          font={block.font}
          numberStyle={block.numberStyle}
          stripe={block.stripe !== false}
          highlightColor={block.highlightColor}
          showPercent={block.showPercent && block.source !== "DFC"}
          showTrend={block.showTrend}
          interactive={interactive}
          onToggle={toggle}
          onLedger={env.onOpenLedger ? ledger : undefined}
          maxRows={present ? null : fit}
          width={innerW}
          animateKeys={present ? fresh : undefined}
        />
      </div>
      {present && moreBelow && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 6, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
          <span style={{ padding: "4px 12px", borderRadius: 999, background: c.surface || c.bg, border: `1px solid ${rgba(c.text, 0.12)}`, boxShadow: "0 6px 18px rgba(0, 0, 0, 0.18)", color: c.muted, fontFamily: fontStack("@body", theme), fontSize: 11.5, fontWeight: 600 }}>role pra ver mais ↓</span>
        </div>
      )}
      </div>
    </div>
  );
}
