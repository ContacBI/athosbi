import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ImageIcon, Maximize2, Table2 } from "lucide-react";
import { WidgetBody, WidgetFillContext } from "../dashboard/WidgetGrid.jsx";
import { formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { describeIndicatorFormula, isSingleLineFormula } from "../../lib/indicatorFormula.js";
import { SLIDE_H, SLIDE_W, compactValue, fillTokens, fontStack, isDark, kpiSeries, mix, patternCss, resolveColor, rgba, shadowCss, widgetDefinition } from "../../lib/presentations.js";
import { BUILTIN_LOGOS, brandLogoFor } from "../../lib/brand.js";
import { SLIDE_ICONS } from "./slideIcons.js";
import { DemoContent } from "./DemoBlock.jsx";

// Um slide desenhado no palco fixo de 1280×720. O mesmo componente serve o
// editor, a miniatura, o modo apresentação e o PDF — `mode` só muda
// detalhes: no editor o conteúdo não recebe clique (quem recebe é o bloco,
// pra selecionar/arrastar), a miniatura troca gráficos por um ícone (são
// dezenas de miniaturas, e a DFC por exemplo é pesada de montar) e o PDF
// desliga as animações dos gráficos.

export function slideBackground(slide, theme) {
  const bg = slide.bg || { type: "theme" };
  if ((!bg.type || bg.type === "theme") && theme.background) return slideBackground({ bg: theme.background }, theme);
  const c1 = resolveColor(bg.color, theme) || theme.colors.bg;
  if (bg.type === "solid") return { base: c1, css: { background: c1 } };
  if (bg.type === "gradient") {
    const c2 = resolveColor(bg.color2, theme) || theme.colors.accent;
    const image = bg.gradType === "radial" ? `radial-gradient(circle at 30% 30%, ${c1}, ${c2})` : `linear-gradient(${bg.angle ?? 135}deg, ${c1}, ${c2})`;
    return { base: mix(c1, c2, 0.5), css: { backgroundImage: image } };
  }
  if (bg.type === "mesh") {
    const spots = ["20% 15%", "85% 10%", "75% 95%", "10% 90%"];
    const alpha = (bg.intensity ?? 40) / 100;
    const layers = (bg.colors || [])
      .map((value) => resolveColor(value, theme))
      .map((color, i) => (color ? `radial-gradient(at ${spots[i % spots.length]}, ${rgba(color, alpha)} 0, transparent 55%)` : null))
      .filter(Boolean);
    return { base: c1, css: { backgroundColor: c1, backgroundImage: layers.join(", ") || undefined } };
  }
  if (bg.type === "pattern") {
    const ink = rgba(resolveColor(bg.patternColor, theme) || theme.colors.muted, (bg.patternOpacity ?? 20) / 100);
    return { base: c1, css: { backgroundColor: c1, ...patternCss(bg.pattern, ink, bg.patternSize) } };
  }
  if (bg.type === "image" && bg.image) {
    return { base: resolveColor(bg.overlayColor, theme) || "#000000", css: { backgroundColor: c1, backgroundImage: `url(${bg.image})`, backgroundSize: "cover", backgroundPosition: "center" } };
  }
  return { base: theme.colors.bg, css: { background: theme.colors.bg } };
}

export function Decoration({ id, theme }) {
  const uid = useId().replace(/:/g, "");
  const a = theme.colors.accent;
  const b = theme.colors.accent2;
  const common = { position: "absolute", inset: 0, width: SLIDE_W, height: SLIDE_H, pointerEvents: "none" };
  const svg = (children) => (
    <svg viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} style={common} aria-hidden="true">
      {children}
    </svg>
  );
  switch (id) {
    case "barra":
      return svg(
        <>
          <rect x="0" y="0" width="14" height={SLIDE_H} fill={a} />
          <rect x="1104" y="674" width="96" height="5" rx="2.5" fill={a} />
        </>
      );
    case "faixa":
      return svg(
        <>
          <rect x="0" y="682" width={SLIDE_W} height="38" fill={b} />
          <rect x="0" y="678" width={SLIDE_W} height="4" fill={a} />
        </>
      );
    case "circulos":
      return svg(
        <>
          <circle cx="1210" cy="40" r="230" fill={a} opacity="0.12" />
          <circle cx="1120" cy="150" r="120" fill={b} opacity="0.12" />
          <circle cx="40" cy="700" r="150" fill={a} opacity="0.08" />
        </>
      );
    case "ondas":
      return svg(
        <>
          <path d="M0 640 C 240 590, 420 712, 690 652 S 1110 590, 1280 636 L1280 720 L0 720 Z" fill={a} opacity="0.16" />
          <path d="M0 676 C 300 640, 520 724, 820 680 S 1160 650, 1280 676 L1280 720 L0 720 Z" fill={b} opacity="0.14" />
        </>
      );
    case "diagonal":
      return svg(
        <>
          <polygon points="1090,0 1280,0 1280,720 950,720" fill={a} opacity="0.08" />
          <polygon points="1196,0 1214,0 1074,720 1056,720" fill={a} opacity="0.55" />
        </>
      );
    case "moldura":
      return svg(
        <>
          <rect x="24" y="24" width={SLIDE_W - 48} height={SLIDE_H - 48} fill="none" stroke={a} strokeWidth="1.5" opacity="0.45" />
          <path d="M24 84 V24 H84 M1196 24 H1256 V84 M1256 636 V696 H1196 M84 696 H24 V636" fill="none" stroke={a} strokeWidth="6" />
        </>
      );
    case "pontos":
      return svg(
        <>
          {Array.from({ length: 6 }).flatMap((_, row) =>
            Array.from({ length: 9 }).map((__, col) => <circle key={`a${row}-${col}`} cx={1060 + col * 22} cy={36 + row * 22} r="3" fill={a} opacity="0.45" />)
          )}
          {Array.from({ length: 4 }).flatMap((_, row) =>
            Array.from({ length: 6 }).map((__, col) => <circle key={`b${row}-${col}`} cx={36 + col * 22} cy={636 + row * 22} r="3" fill={b} opacity="0.3" />)
          )}
        </>
      );
    case "canto":
      return svg(
        <>
          <polygon points="0,0 190,0 0,190" fill={a} />
          <polygon points="1280,720 1090,720 1280,530" fill={b} />
        </>
      );
    case "painel": {
      // O painel cinza do site: ocupa a direita, cantos bem arredondados.
      // Meio-termo entre o fundo e os cartões: um cartão em cima do painel
      // continua aparecendo (com a cor exata dos cartões ele sumia).
      const panel = mix(theme.colors.bg, theme.colors.surface, 0.55);
      return svg(<rect x="780" y="-120" width="640" height="800" rx="110" fill={panel} />);
    }
    case "degraus": {
      const cells = [
        [2, 0, 1],
        [1, 1, 0.75],
        [2, 1, 0.85],
        [0, 2, 0.45],
        [1, 2, 0.55],
        [2, 2, 0.65],
      ];
      return svg(
        <>
          {cells.map(([col, row, alpha]) => (
            <rect key={`${col}-${row}`} x={1206 + col * 18} y={24 + row * 18} width="15" height="15" rx="3" fill={a} opacity={alpha} />
          ))}
        </>
      );
    }
    case "aura":
      // Brilho vindo do canto de cima, com um anel fino — a "luz" dos temas
      // premium.
      return svg(
        <>
          <defs>
            <radialGradient id={`au1${uid}`}>
              <stop offset="0" stopColor={a} stopOpacity="0.42" />
              <stop offset="0.55" stopColor={a} stopOpacity="0.1" />
              <stop offset="1" stopColor={a} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`au2${uid}`}>
              <stop offset="0" stopColor={theme.colors.accent3} stopOpacity="0.2" />
              <stop offset="1" stopColor={theme.colors.accent3} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="1190" cy="-70" r="600" fill={`url(#au1${uid})`} />
          <circle cx="-120" cy="790" r="480" fill={`url(#au2${uid})`} />
          <circle cx="1190" cy="-70" r="400" fill="none" stroke={a} strokeOpacity="0.22" strokeWidth="1" />
          <circle cx="1190" cy="-70" r="520" fill="none" stroke={a} strokeOpacity="0.1" strokeWidth="1" />
        </>
      );
    case "arcos":
      return svg(
        <>
          {[240, 340, 440, 540, 640].map((r, i) => (
            <circle key={r} cx="1280" cy="720" r={r} fill="none" stroke={a} strokeOpacity={0.4 - i * 0.07} strokeWidth="1.2" />
          ))}
          <circle cx="1280" cy="720" r="140" fill={a} opacity="0.12" />
        </>
      );
    case "editorial":
      return svg(
        <>
          <line x1="80" y1="34" x2="1200" y2="34" stroke={theme.colors.text} strokeOpacity="0.16" strokeWidth="1" />
          <rect x="80" y="32" width="56" height="4" fill={a} />
          <line x1="80" y1="668" x2="1200" y2="668" stroke={theme.colors.text} strokeOpacity="0.16" strokeWidth="1" />
        </>
      );
    case "brilho":
      return svg(
        <>
          <defs>
            <radialGradient id={`g1${uid}`}>
              <stop offset="0" stopColor={a} stopOpacity="0.35" />
              <stop offset="1" stopColor={a} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g2${uid}`}>
              <stop offset="0" stopColor={b} stopOpacity="0.28" />
              <stop offset="1" stopColor={b} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="1150" cy="80" r="420" fill={`url(#g1${uid})`} />
          <circle cx="80" cy="700" r="380" fill={`url(#g2${uid})`} />
        </>
      );
    default:
      return null;
  }
}

// Textura granulada bem leve por cima do fundo (papel/filme) — tira o
// aspecto "chapado" dos fundos lisos e degradês.
function Grain({ amount }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} style={{ position: "absolute", inset: 0, width: SLIDE_W, height: SLIDE_H, pointerEvents: "none", opacity: Math.min(1, amount / 100) * 0.55, mixBlendMode: "overlay" }} aria-hidden="true">
      <filter id={`gr${uid}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={SLIDE_W} height={SLIDE_H} filter={`url(#gr${uid})`} />
    </svg>
  );
}

// Cores dos gráficos/tabelas do B.I. dentro do bloco: os widgets do painel
// pintam tudo com variáveis CSS (--color-accent-500 etc.), então basta
// redefinir essas variáveis no bloco pra eles assumirem o tema do slide —
// inclusive num fundo escuro.
function widgetVars(theme, base, chartColors) {
  const c = theme.colors;
  const [c1, c2, c3, pos, neg] = (chartColors || []).map((value) => resolveColor(value, theme));
  const accent = c1 || c.accent;
  const text = c.text;
  const muted = c.muted;
  return {
    color: text,
    "--color-accent-500": accent,
    "--color-accent-600": accent,
    "--color-accent-300": mix(accent, base, 0.45),
    "--color-accent-50": mix(accent, base, 0.88),
    "--color-navy-700": c2 || c.accent2,
    "--color-navy-950": c2 || c.accent2,
    "--color-warning-500": c3 || c.accent3,
    "--color-success-500": pos || c.positive,
    "--color-success-600": pos || c.positive,
    "--color-danger-500": neg || c.negative,
    "--color-danger-600": neg || c.negative,
    "--color-ink-900": text,
    "--color-ink-800": mix(text, base, 0.1),
    "--color-ink-700": mix(text, base, 0.2),
    "--color-ink-600": mix(text, base, 0.3),
    "--color-ink-500": mix(text, base, 0.42),
    "--color-ink-400": muted,
    "--color-ink-300": mix(muted, base, 0.4),
    "--color-line": mix(text, base, 0.86),
    "--color-line-strong": mix(text, base, 0.74),
    "--color-surface-card": base,
    "--color-surface-muted": mix(text, base, 0.94),
    "--color-surface-page": mix(text, base, 0.96),
  };
}

const CARD_KINDS = new Set(["kpi", "widget", "chart", "table", "meta", "demo"]);

// Cartão "do tema" (preenchimento @surface): o estilo vem do tema —
// sólido, elevado (sombra longa e suave + fio de borda), contorno fino ou
// vidro (translúcido com reflexo, deixa o brilho do fundo aparecer).
function applyCardStyle(css, block, theme, fill, alpha) {
  const s = block.style || {};
  const style = s.cardStyle ?? theme.cardStyle ?? "solid";
  const dark = isDark(theme.colors.bg);
  const hasShadow = s.shadow != null;
  if (style === "elevated") {
    if (!hasShadow) css.boxShadow = dark ? "0 18px 44px rgba(0, 0, 0, 0.45)" : "0 1px 2px rgba(15, 23, 42, 0.05), 0 14px 36px rgba(15, 23, 42, 0.10)";
    css.border = css.border || `1px solid ${rgba(theme.colors.text, dark ? 0.08 : 0.06)}`;
  } else if (style === "outline") {
    css.backgroundColor = rgba(fill, 0.3 * alpha);
    css.border = css.border || `1px solid ${rgba(theme.colors.text, 0.16)}`;
    if (!hasShadow) css.boxShadow = "none";
  } else if (style === "glass") {
    css.backgroundColor = rgba(fill, (dark ? 0.55 : 0.6) * alpha);
    css.backgroundImage = dark
      ? "linear-gradient(150deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.02) 55%)"
      : "linear-gradient(150deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.45) 60%)";
    css.border = css.border || `1px solid ${dark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.85)"}`;
    if (!hasShadow) css.boxShadow = dark ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.35)" : "0 12px 34px rgba(15, 23, 42, 0.10)";
  }
}

function boxStyle(block, theme) {
  const s = block.style || {};
  const fill = resolveColor(s.fill, theme);
  const fill2 = resolveColor(s.fill2, theme);
  const alpha = (s.fillOpacity ?? 100) / 100;
  const css = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    borderRadius: s.radius ?? theme.radius,
    boxShadow: shadowCss(s.shadow ?? theme.shadow, theme),
    padding: s.padding || 0,
  };
  if (fill && fill !== "transparent") {
    if (fill2) css.backgroundImage = `linear-gradient(${s.gradAngle ?? 135}deg, ${rgba(fill, alpha)}, ${rgba(fill2, alpha)})`;
    else css.backgroundColor = rgba(fill, alpha);
  }
  if (s.border && s.borderWidth > 0) css.border = `${s.borderWidth}px ${s.borderStyle || "solid"} ${resolveColor(s.border, theme)}`;
  if (CARD_KINDS.has(block.kind) && s.fill === "@surface" && !s.fill2) applyCardStyle(css, block, theme, fill, alpha);
  return { css, base: fill && fill !== "transparent" ? fill : null };
}

const VALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" };
const LIST_MARKERS = { bullet: "●", dash: "–", check: "✓", arrow: "→" };

// **negrito** e *itálico* dentro do texto.
function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Texto em degradê (da cor do texto até a cor escolhida em "gradient").
function gradientText(block, theme) {
  const to = resolveColor(block.gradient, theme);
  if (!to) return {};
  const from = resolveColor(block.color, theme) || theme.colors.text;
  return {
    backgroundImage: `linear-gradient(${block.gradientAngle ?? 90}deg, ${from}, ${to})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

function TextContent({ block, theme, env }) {
  const text = fillTokens(block.text, env.ctx, env.info);
  const lines = text.split("\n");
  const marker = LIST_MARKERS[block.list];
  const markerColor = resolveColor(block.listColor, theme) || theme.colors.accent;
  let counter = 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: VALIGN[block.valign] || "flex-start",
        height: "100%",
        fontFamily: fontStack(block.font, theme),
        fontSize: block.size,
        fontWeight: block.weight,
        fontStyle: block.italic ? "italic" : "normal",
        textDecoration: block.underline ? "underline" : "none",
        textTransform: block.uppercase ? "uppercase" : "none",
        textAlign: block.align,
        lineHeight: block.lineHeight,
        letterSpacing: block.letterSpacing ? `${block.letterSpacing}px` : undefined,
        color: resolveColor(block.color, theme) || theme.colors.text,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        // Títulos com as linhas do mesmo tamanho (sem uma palavra sozinha
        // na última linha).
        textWrap: block.size >= 30 ? "balance" : "pretty",
        ...gradientText(block, theme),
      }}
    >
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index}>{" "}</div>;
        if (block.list === "number" || marker) {
          counter += 1;
          return (
            <div key={index} style={{ display: "flex", gap: "0.55em", justifyContent: block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start" }}>
              <span style={{ color: markerColor, WebkitTextFillColor: markerColor, flexShrink: 0, fontWeight: 700, fontSize: block.list === "bullet" ? "0.6em" : "1em", lineHeight: block.list === "bullet" ? `${block.lineHeight / 0.6}` : undefined }}>
                {block.list === "number" ? `${counter}.` : marker}
              </span>
              <span>{inline(line)}</span>
            </div>
          );
        }
        return <div key={index}>{inline(line)}</div>;
      })}
    </div>
  );
}

// Minigráfico do indicador mês a mês: linha com área em degradê e o último
// ponto marcado.
function Sparkline({ values, color, width, height }) {
  const uid = useId().replace(/:/g, "");
  const points = values.map((value, i) => [i, value]).filter(([, value]) => value != null && Number.isFinite(value));
  if (points.length < 2) return null;
  const W = Math.max(40, width);
  const H = Math.max(16, height);
  const min = Math.min(...points.map(([, v]) => v));
  const max = Math.max(...points.map(([, v]) => v));
  const span = max - min || 1;
  const last = values.length - 1 || 1;
  const xy = points.map(([i, v]) => [(i / last) * W, H - 6 - ((v - min) / span) * (H - 12)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block", overflow: "visible" }} aria-hidden="true">
      <defs>
        <linearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill={color} />
    </svg>
  );
}

// Variação do último mês contra o anterior: em pontos percentuais pra
// margens (%), em % pro resto.
function monthDelta(series, format) {
  const values = series.filter((value) => value != null && Number.isFinite(value));
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (format === "percent") {
    const diff = last - prev;
    return { up: diff >= 0, text: `${Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` };
  }
  if (!prev) return null;
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(pct)) return null;
  return { up: pct >= 0, text: `${Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` };
}

function KpiContent({ block, theme, env }) {
  const definition = widgetDefinition(block.widgetId);
  if (!definition) return <Missing label="Indicador não encontrado" theme={theme} />;
  let value = 0;
  let format = "money";
  try {
    if (env.ctx) ({ value, format } = definition.value(env.ctx));
  } catch {
    value = null;
  }
  const display = env.ctx && value != null ? (block.numberStyle === "compact" ? compactValue(value, format) : formatWidgetValue(value, format)) : "—";
  const numeric = Number(value || 0);
  let valueColor = theme.colors.text;
  if (block.valueColor === "auto") valueColor = numeric < 0 ? theme.colors.negative : theme.colors.text;
  else if (block.valueColor === "sign") valueColor = numeric < 0 ? theme.colors.negative : numeric > 0 ? theme.colors.positive : theme.colors.text;
  else valueColor = resolveColor(block.valueColor, theme) || theme.colors.text;
  const Icon = definition.icon;
  const label = block.label || definition.label;
  const caption = block.showCaption && definition.formula && !isSingleLineFormula(definition.formula) ? describeIndicatorFormula(definition.formula) : "";
  const pad = (block.style?.padding || 0) * 2;
  const innerW = Math.max(40, block.w - pad);
  const innerH = Math.max(40, block.h - pad);
  // Valor comprido (R$ 12.345.678,90) num cartão estreito: diminui a letra
  // até caber, em vez de cortar o número.
  const valueSize = Math.min(block.valueSize, innerW / (display.length * 0.6));
  const center = block.align === "center";
  const series = env.ctx && (block.trend || block.delta) ? kpiSeries(definition, env.ctx) : [];
  const delta = block.delta ? monthDelta(series, format) : null;
  const accent = resolveColor(block.iconColor, theme) || theme.colors.accent;
  const sparkH = Math.max(22, Math.min(64, innerH * 0.26));
  const showSpark = block.trend && series.filter((v) => v != null).length >= 2 && innerH > 120;
  const deltaColor = delta ? (delta.up ? theme.colors.positive : theme.colors.negative) : "";
  const labelSize = block.labelSize;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: showSpark ? "space-between" : "center", alignItems: center ? "center" : block.align === "right" ? "flex-end" : "flex-start", height: "100%", textAlign: block.align, fontFamily: fontStack(block.font, theme), gap: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: center ? "center" : block.align === "right" ? "flex-end" : "flex-start" }}>
        {block.showIcon && Icon && center && (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: rgba(accent, 0.14), color: accent }}>
            <Icon size={22} strokeWidth={1.9} />
          </span>
        )}
        {(block.showLabel || (block.showIcon && !center)) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : "space-between", gap: 10, width: "100%" }}>
            {block.showLabel ? (
              <span style={{ fontFamily: fontStack(block.labelFont || "@body", theme), fontSize: labelSize, color: resolveColor(block.labelColor, theme) || theme.colors.muted, fontWeight: 500, lineHeight: 1.25, flex: center ? undefined : 1 }}>{fillTokens(label, env.ctx, env.info)}</span>
            ) : (
              <span />
            )}
            {block.showIcon && Icon && !center && (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: rgba(accent, 0.14), color: accent }}>
                <Icon size={18} strokeWidth={1.9} />
              </span>
            )}
          </div>
        )}
        <span style={{ fontSize: valueSize, fontWeight: 700, color: valueColor, lineHeight: 1.05, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", letterSpacing: valueSize > 30 ? "-0.025em" : undefined }}>{display}</span>
        {delta && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fontStack("@body", theme), fontSize: Math.max(11, labelSize * 0.8, valueSize * 0.15), lineHeight: 1 }}>
            <span style={{ padding: "4px 8px", borderRadius: 999, background: rgba(deltaColor, 0.14), color: deltaColor, fontWeight: 700 }}>
              {delta.up ? "▲" : "▼"} {delta.text}
            </span>
            <span style={{ color: theme.colors.muted }}>no último mês</span>
          </span>
        )}
        {caption && <span style={{ fontFamily: fontStack("@body", theme), fontSize: Math.max(11, labelSize * 0.75), color: theme.colors.muted, lineHeight: 1.3 }}>{caption}</span>}
      </div>
      {showSpark && <Sparkline values={series} color={accent} width={innerW} height={sparkH} />}
    </div>
  );
}

function Missing({ label, theme, icon: Icon = BarChart3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", color: theme.colors.muted, fontFamily: fontStack("@body", theme), fontSize: 16, textAlign: "center" }}>
      <Icon size={36} strokeWidth={1.5} />
      <span>{label}</span>
    </div>
  );
}

// Linhas que cabem numa tabela/lista do B.I. com a altura do bloco — a
// tabela é cortada pela QUANTIDADE de linhas (com "+N linhas"), nunca por
// overflow: cortar texto com CSS no print do PDF (foreignObject) saía com
// letras sobrepostas (ver PrintableWidgetGrid em WidgetGrid.jsx).
function rowsThatFit(block, base) {
  if (block.maxRows > 0) return block.maxRows;
  const innerH = (block.h - (block.style?.padding || 0) * 2) / (block.zoom || 1);
  const header = (block.showTitle ? 32 : 0) + (block.tableColumns === "meses" ? 20 : 0);
  return Math.max(1, Math.floor((innerH - header - 22) / base));
}

function WidgetContent({ block, theme, env, base }) {
  const definition = widgetDefinition(block.widgetId);
  if (!definition) return <Missing label="Gráfico não encontrado" theme={theme} />;
  if (env.mode === "thumb") {
    return <Missing label={definition.label} theme={theme} icon={definition.type === "table" ? Table2 : definition.icon || BarChart3} />;
  }
  if (!env.ctx) return <Missing label="Sem lançamentos no período" theme={theme} />;
  const zoom = block.zoom || 1;
  const isRows = definition.type === "table" || definition.type === "list";
  const maxRows = isRows ? rowsThatFit(block, definition.type === "list" ? 30 : 26) : undefined;
  return (
    <WidgetFillContext.Provider value={{ fill: true, animate: env.mode !== "export", tableColumns: block.tableColumns }}>
      <div style={{ position: "relative", width: "100%", height: "100%", fontFamily: fontStack("@body", theme), ...widgetVars(theme, base, block.chartColors) }}>
        <div
          className={block.showTitle ? "" : "slide-hide-title"}
          style={{ position: "absolute", left: 0, top: 0, width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "flex", flexDirection: "column" }}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <WidgetBody definition={definition} ctx={env.ctx} maxRows={maxRows} />
          </div>
        </div>
        {/* Na apresentação, a tabela resumida do B.I. abre o demonstrativo
            inteiro na janela "Explorar" (PresentOverlays.jsx). */}
        {env.mode === "present" && definition.type === "table" && env.onExplore && (
          <button
            type="button"
            data-interactive=""
            onClick={(event) => {
              event.stopPropagation();
              env.onExplore({ source: definition.table === "bp" ? "BP" : String(definition.table).startsWith("dfc_") ? "DFC" : "DRE" });
            }}
            style={{ position: "absolute", top: 0, right: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${rgba(theme.colors.accent, 0.45)}`, background: rgba(theme.colors.accent, 0.12), color: theme.colors.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            <Maximize2 size={13} strokeWidth={2.2} />
            Explorar
          </button>
        )}
      </div>
    </WidgetFillContext.Provider>
  );
}

// Logo da marca (brand): a versão certa pro fundo atrás dela.
export function brandSrc(brand, base) {
  if (brand === "athos" || brand === "contac") return brandLogoFor(brand, isDark(base || "#ffffff")).src;
  return BUILTIN_LOGOS.find((logo) => logo.id === brand)?.src || "";
}

function ImageContent({ block, theme, env, base }) {
  const src = block.brand ? brandSrc(block.brand, base) : block.src;
  if (!src) {
    if (env.mode !== "edit" && env.mode !== "thumb") return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: "100%", border: `2px dashed ${rgba(theme.colors.muted, 0.6)}`, borderRadius: "inherit", color: theme.colors.muted, fontFamily: fontStack("@body", theme), fontSize: 16, background: rgba(theme.colors.muted, 0.08) }}>
        <ImageIcon size={40} strokeWidth={1.4} />
        <span>Escolha uma imagem no painel à direita</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: block.fit,
        objectPosition: `${block.focusX ?? 50}% ${block.focusY ?? 50}%`,
        filter: `grayscale(${block.grayscale || 0}%) brightness(${block.brightness ?? 100}%)`,
        transform: block.flipX ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

function starPoints() {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 50 : 21;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export const SHAPES = [
  { id: "rect", label: "Retângulo" },
  { id: "ellipse", label: "Círculo" },
  { id: "triangle", label: "Triângulo", points: "50,0 100,100 0,100" },
  { id: "diamond", label: "Losango", points: "50,0 100,50 50,100 0,50" },
  { id: "hexagon", label: "Hexágono", points: "25,0 75,0 100,50 75,100 25,100 0,50" },
  { id: "star", label: "Estrela", points: starPoints() },
  { id: "arrow", label: "Seta", points: "0,30 62,30 62,0 100,50 62,100 62,70 0,70" },
  { id: "chevron", label: "Divisa", points: "0,0 70,0 100,50 70,100 0,100 30,50" },
  { id: "plus", label: "Mais", points: "35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35" },
  { id: "line", label: "Linha" },
];

function ShapeSvg({ block, theme }) {
  const uid = useId().replace(/:/g, "");
  const s = block.style || {};
  const shape = SHAPES.find((item) => item.id === block.shape) || SHAPES[0];
  const fill = resolveColor(s.fill, theme);
  const fill2 = resolveColor(s.fill2, theme);
  const alpha = (s.fillOpacity ?? 100) / 100;
  const stroke = s.border && s.borderWidth > 0 ? resolveColor(s.border, theme) : "none";
  const paint = fill2 ? `url(#sg${uid})` : fill || "none";
  const shadow = shadowCss(s.shadow ?? "none", theme);
  const style = { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", filter: shadow !== "none" ? `drop-shadow(${shadow})` : undefined };
  const defs = fill2 ? (
    <defs>
      <linearGradient id={`sg${uid}`} gradientTransform={`rotate(${(s.gradAngle ?? 135) - 90} 0.5 0.5)`}>
        <stop offset="0" stopColor={fill} />
        <stop offset="1" stopColor={fill2} />
      </linearGradient>
    </defs>
  ) : null;
  if (shape.id === "line") {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={style} aria-hidden="true">
        {defs}
        <line x1="0" y1="50" x2="100" y2="50" stroke={paint === "none" ? theme.colors.text : paint} strokeOpacity={alpha} strokeWidth={Math.max(1, s.borderWidth || 4)} vectorEffect="non-scaling-stroke" strokeDasharray={s.borderStyle === "dashed" ? "12 8" : s.borderStyle === "dotted" ? "2 6" : undefined} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={style} aria-hidden="true">
      {defs}
      <polygon points={shape.points} fill={paint} fillOpacity={alpha} stroke={stroke} strokeWidth={s.borderWidth || 0} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray={s.borderStyle === "dashed" ? "10 6" : undefined} />
    </svg>
  );
}

function IconContent({ block, theme }) {
  const Icon = SLIDE_ICONS[block.icon] || SLIDE_ICONS.Star;
  const size = (Math.min(block.w, block.h) - (block.style?.padding || 0) * 2) * ((block.iconScale || 55) / 100);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: resolveColor(block.color, theme) || theme.colors.accent }}>
      <Icon size={Math.max(8, size)} strokeWidth={block.strokeWidth || 2} />
    </div>
  );
}

export function parseRows(data) {
  return String(data || "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => (line.includes("\t") ? line.split("\t") : line.includes(";") ? line.split(";") : line.split("|")).map((cell) => cell.trim()));
}

function looksNumeric(text) {
  return /\d/.test(text) && /^[-+−(]?\s*(R\$)?\s*[-\d.,\s]+%?\)?$/.test(text);
}

export function parseNumber(text) {
  let clean = String(text ?? "").replace(/R\$|%|\s/g, "").replace("−", "-");
  const negative = /^\(.*\)$/.test(clean);
  clean = clean.replace(/[()]/g, "");
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, "");
  const value = Number(clean);
  return Number.isFinite(value) ? (negative ? -value : value) : 0;
}

function TableContent({ block, theme, env }) {
  const rows = parseRows(block.data);
  if (!rows.length) return <Missing label="Escreva a tabela no painel à direita" theme={theme} icon={Table2} />;
  const cols = Math.max(...rows.map((row) => row.length));
  const lineColor = rgba(resolveColor(block.lineColor, theme) || theme.colors.muted, 0.3);
  const stripe = resolveColor(block.stripeColor, theme) || theme.colors.surface;
  const radius = block.style?.radius ?? theme.radius;
  return (
    <table style={{ width: "100%", height: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: fontStack(block.font, theme), fontSize: block.fontSize, color: resolveColor(block.color, theme) || theme.colors.text, tableLayout: "fixed" }}>
      <tbody>
        {rows.map((row, r) => {
          const isHeader = r === 0;
          const isLast = r === rows.length - 1 && rows.length > 2;
          return (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => {
                const text = fillTokens(row[c] ?? "", env.ctx, env.info);
                const numeric = !isHeader && c > 0 && looksNumeric(text);
                const negative = numeric && /^[-−(]/.test(text);
                const cellStyle = {
                  padding: "0.45em 0.8em",
                  textAlign: numeric ? "right" : c === 0 ? "left" : "center",
                  fontWeight: isHeader || (block.firstColBold && c === 0) || (block.lastRowBold && isLast) ? 700 : 400,
                  borderBottom: isHeader ? "none" : `1px solid ${lineColor}`,
                  fontVariantNumeric: "tabular-nums",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                };
                if (isHeader) {
                  cellStyle.background = resolveColor(block.headerFill, theme) || "transparent";
                  cellStyle.color = resolveColor(block.headerColor, theme) || theme.colors.text;
                  if (c === 0) cellStyle.borderTopLeftRadius = radius;
                  if (c === cols - 1) cellStyle.borderTopRightRadius = radius;
                } else if (block.stripe && r % 2 === 0) {
                  cellStyle.background = stripe;
                }
                if (negative) cellStyle.color = theme.colors.negative;
                return (
                  <td key={c} style={cellStyle}>
                    {text}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatChartValue(value, format) {
  if (format === "money") {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
    if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
  if (format === "percent") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function ChartContent({ block, theme, env, base }) {
  const uid = useId().replace(/:/g, "");
  const rows = parseRows(block.data);
  const animate = env.mode === "present" || env.mode === "edit";
  if (rows.length < 2) return <Missing label="Cole os dados do gráfico no painel à direita" theme={theme} />;
  const [header, ...body] = rows;
  const series = header.slice(1).filter(Boolean);
  const data = body.map((row) => {
    const item = { name: row[0] };
    series.forEach((name, i) => {
      item[name] = parseNumber(row[i + 1]);
    });
    return item;
  });
  const colors = (block.colors || []).map((value) => resolveColor(value, theme)).filter(Boolean);
  const palette = colors.length ? colors : [theme.colors.accent, theme.colors.accent2, theme.colors.accent3, theme.colors.positive, theme.colors.negative];
  const colorAt = (i) => palette[i % palette.length];
  const horizontal = block.chartType === "barh";
  const paintAt = (i) => `url(#cg${uid}${i})`;
  const gradients = (
    <defs>
      {series.map((name, i) => (
        <linearGradient key={name} id={`cg${uid}${i}`} x1="0" y1={horizontal ? "0" : "0"} x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
          <stop offset="0" stopColor={colorAt(i)} stopOpacity={block.chartType === "area" ? 0.45 : horizontal ? 0.6 : 1} />
          <stop offset="1" stopColor={colorAt(i)} stopOpacity={block.chartType === "area" ? 0.02 : horizontal ? 1 : 0.62} />
        </linearGradient>
      ))}
    </defs>
  );
  const text = theme.colors.text;
  const grid = mix(text, base, 0.86);
  const tick = { fontSize: block.fontSize, fill: theme.colors.muted, fontFamily: fontStack(block.font || "@body", theme) };
  const fmt = (value) => formatChartValue(Number(value || 0), block.format);
  const tooltip = <Tooltip formatter={(value) => fmt(value)} contentStyle={{ fontSize: 13, borderRadius: 8 }} />;
  const labels = block.showValues ? <LabelList position="top" formatter={fmt} style={{ fontSize: block.fontSize * 0.85, fill: text }} /> : null;
  const isPie = block.chartType === "pie" || block.chartType === "donut";
  const total = isPie ? data.reduce((sum, item) => sum + Math.abs(item[series[0]] || 0), 0) : 0;
  let chart;
  if (isPie) {
    chart = (
      <PieChart>
        <Pie isAnimationActive={animate} data={data} dataKey={series[0]} nameKey="name" innerRadius={block.chartType === "donut" ? "52%" : 0} outerRadius="88%" paddingAngle={block.chartType === "donut" ? 2 : 0} stroke={base}>
          {data.map((item, i) => (
            <Cell key={item.name} fill={colorAt(i)} />
          ))}
        </Pie>
        {tooltip}
      </PieChart>
    );
  } else if (block.chartType === "line" || block.chartType === "area") {
    const Chart = block.chartType === "line" ? LineChart : AreaChart;
    chart = (
      <Chart data={data} margin={{ top: 18, right: 16, left: 4, bottom: 0 }}>
        {gradients}
        {block.showGrid && <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />}
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: grid }} tickLine={false} />
        <YAxis tick={tick} tickFormatter={fmt} axisLine={false} tickLine={false} width={block.format === "money" ? 92 : 56} />
        {tooltip}
        {series.map((name, i) =>
          block.chartType === "line" ? (
            <Line isAnimationActive={animate} key={name} dataKey={name} stroke={colorAt(i)} strokeWidth={3} dot={{ r: 4, fill: colorAt(i) }}>
              {labels}
            </Line>
          ) : (
            <Area isAnimationActive={animate} key={name} dataKey={name} stroke={colorAt(i)} strokeWidth={2.5} fill={paintAt(i)} fillOpacity={1} stackId={block.stacked ? "s" : undefined}>
              {labels}
            </Area>
          )
        )}
      </Chart>
    );
  } else {
    chart = (
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 18, right: 16, left: 4, bottom: 0 }} barGap={6}>
        {gradients}
        {block.showGrid && <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={grid} strokeDasharray="3 5" />}
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick} tickFormatter={fmt} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={tick} axisLine={false} tickLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={tick} axisLine={{ stroke: grid }} tickLine={false} />
            <YAxis tick={tick} tickFormatter={fmt} axisLine={false} tickLine={false} width={block.format === "money" ? 92 : 56} />
          </>
        )}
        {tooltip}
        {series.map((name, i) => (
          <Bar isAnimationActive={animate} key={name} dataKey={name} fill={paintAt(i)} radius={block.stacked ? 0 : horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]} stackId={block.stacked ? "s" : undefined} maxBarSize={56}>
            {block.showValues && <LabelList position={horizontal ? "right" : "top"} formatter={fmt} style={{ fontSize: block.fontSize * 0.85, fill: text }} />}
          </Bar>
        ))}
      </BarChart>
    );
  }
  const legendItems = isPie ? data.map((item) => item.name) : series;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: fontStack(block.font || "@body", theme), color: text }}>
      {block.title && <div style={{ fontFamily: fontStack(block.titleFont || "@heading", theme), fontSize: block.titleSize || block.fontSize * 1.35, fontWeight: 700, marginBottom: 8 }}>{fillTokens(block.title, env.ctx, env.info)}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      {block.showLegend && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", marginTop: 8, fontSize: block.fontSize, color: theme.colors.muted }}>
          {legendItems.map((name, i) => (
            <span key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: colorAt(i) }} />
              {name}
              {isPie && total > 0 && <span style={{ color: text, fontWeight: 600 }}>{` ${((Math.abs(data[i][series[0]] || 0) / total) * 100).toFixed(0)}%`}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaContent({ block, theme, env }) {
  let current = Number(block.current || 0);
  let format = block.format;
  if (block.source === "kpi") {
    const definition = widgetDefinition(block.widgetId);
    try {
      const result = definition && env.ctx ? definition.value(env.ctx) : null;
      current = Number(result?.value || 0);
      format = result?.format || format;
    } catch {
      current = 0;
    }
  }
  const target = Number(block.target || 0);
  const pct = target ? (current / target) * 100 : 0;
  const color = resolveColor(block.barColor, theme) || theme.colors.accent;
  const track = rgba(theme.colors.muted, 0.2);
  const show = (value) => (format === "percent" ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : format === "money" ? formatWidgetValue(value, "money") : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
  const label = fillTokens(block.label, env.ctx, env.info);
  const pctText = `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  const font = fontStack(block.font, theme);
  if (block.variant === "anel") {
    const size = Math.min(block.w, block.h) - (block.style?.padding || 0) * 2 - 40;
    const r = 42;
    const length = 2 * Math.PI * r;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6, fontFamily: font, color: theme.colors.text }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="10" />
            <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(Math.min(100, Math.max(0, pct)) / 100) * length} ${length}`} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.24, fontWeight: 800 }}>{pctText}</div>
        </div>
        <div style={{ fontSize: Math.max(13, size * 0.1), color: theme.colors.muted, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 12, fontFamily: font, color: theme.colors.text }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: block.labelSize || 20, fontWeight: 600, color: theme.colors.muted }}>{label}</span>
        <span style={{ fontSize: block.valueSize || 40, fontWeight: 800, color }}>{pctText}</span>
      </div>
      <div style={{ height: block.barHeight || 16, borderRadius: 999, background: track, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <div style={{ fontSize: Math.max(11, (block.labelSize || 20) * 0.8), color: theme.colors.muted, fontFamily: fontStack("@body", theme) }}>
        {show(current)} de {show(target)}
      </div>
    </div>
  );
}

// Texto sempre legível: se o fundo atrás do bloco (o preenchimento dele ou o
// fundo do slide) tem o mesmo "tom" do texto do tema — texto escuro num
// fundo escuro, claro num claro —, as cores de texto do tema viram as
// opostas só ali. Vale pra quem usa a cor do tema ("@text", "@muted"); uma
// cor fixa escolhida a dedo fica como está.
export function readableTheme(theme, base) {
  if (!base) return theme;
  const baseDark = isDark(base);
  if (isDark(theme.colors.text) !== baseDark) return theme;
  const text = baseDark ? "#ffffff" : "#161616";
  return { ...theme, colors: { ...theme.colors, text, muted: mix(text, base, 0.35) } };
}

const ANIM_CLASS = { fade: "slide-anim-fade", rise: "slide-anim-rise", left: "slide-anim-left", right: "slide-anim-right", zoom: "slide-anim-zoom" };

export function BlockView({ block, theme: theme0, env, slideBase, animIndex = 0, hiddenContent = false }) {
  const isSvgShape = block.kind === "shape" && block.shape !== "rect" && block.shape !== "ellipse";
  const box = boxStyle(block, theme0);
  if (block.kind === "shape" && block.shape === "ellipse") box.css.borderRadius = "50%";
  if (block.kind === "text" || block.kind === "image") {
    if (block.style?.radius == null) box.css.borderRadius = 0;
    if (block.style?.shadow == null) box.css.boxShadow = "none";
  }
  if (isSvgShape) {
    delete box.css.backgroundColor;
    delete box.css.backgroundImage;
    delete box.css.border;
    box.css.boxShadow = "none";
    box.css.overflow = "visible";
  }
  const base = box.base || slideBase;
  const theme = readableTheme(theme0, base);
  const animate = env.mode === "present" && block.anim && block.anim !== "none";
  const outer = {
    position: "absolute",
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
    opacity: (block.opacity ?? 100) / 100 * (env.mode === "edit" && block.hidden ? 0.35 : 1),
    animationDelay: animate ? `${150 + animIndex * 130}ms` : undefined,
  };
  let content = null;
  if (!hiddenContent) {
    if (block.kind === "text") content = <TextContent block={block} theme={theme} env={env} />;
    else if (block.kind === "kpi") content = <KpiContent block={block} theme={theme} env={env} />;
    else if (block.kind === "widget") content = <WidgetContent block={block} theme={theme} env={env} base={base} />;
    else if (block.kind === "image") content = <ImageContent block={block} theme={theme} env={env} base={base} />;
    else if (block.kind === "icon") content = <IconContent block={block} theme={theme} />;
    else if (block.kind === "table") content = <TableContent block={block} theme={theme} env={env} />;
    else if (block.kind === "chart") content = <ChartContent block={block} theme={theme} env={env} base={base} />;
    else if (block.kind === "meta") content = <MetaContent block={block} theme={theme} env={env} />;
    else if (block.kind === "demo") content = env.mode === "thumb" && block.source === "DFC" ? <Missing label="Fluxo de caixa" theme={theme} icon={Table2} /> : <DemoContent block={block} theme={theme} env={env} />;
  }
  return (
    <div data-block-id={block.id} className={animate ? ANIM_CLASS[block.anim] : undefined} style={outer}>
      <div style={box.css}>
        {isSvgShape && <ShapeSvg block={block} theme={theme} />}
        {content && <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: env.mode === "present" ? "auto" : "none" }}>{content}</div>}
      </div>
    </div>
  );
}

// O slide inteiro: fundo, decoração do tema, blocos e rodapé. `number` é a
// posição entre os slides visíveis (o rodapé mostra "3 / 9").
export default function SlideView({ slide, deck, env, number, total, editingId, transient }) {
  const theme = deck.theme;
  const bg = slideBackground(slide, theme);
  const decoration = slide.decoration === "@theme" || !slide.decoration ? theme.decoration : slide.decoration;
  const overlay = slide.bg?.type === "image" && slide.bg?.image ? (slide.bg.overlay ?? 40) / 100 : 0;
  const grain = slide.bg?.grain ?? theme.grain ?? 0;
  const footer = deck.footer || {};
  const showFooter = footer.show !== false && !slide.hideFooter;
  const footerTheme = readableTheme(theme, bg.base);
  const footerColor = resolveColor(footer.color, footerTheme) || footerTheme.colors.muted;
  const footerLogo = !footer.logo || footer.logo === "none" ? "" : footer.logo.startsWith("data:") ? footer.logo : brandSrc(footer.logo, bg.base);
  let animIndex = 0;
  return (
    <div
      data-theme="light"
      className="slide-stage"
      style={{ position: "relative", width: SLIDE_W, height: SLIDE_H, overflow: "hidden", fontFamily: fontStack("@body", theme), color: theme.colors.text, ...bg.css }}
    >
      {overlay > 0 && <div style={{ position: "absolute", inset: 0, background: rgba(resolveColor(slide.bg.overlayColor, theme) || "#000000", overlay) }} />}
      {grain > 0 && env.mode !== "thumb" && <Grain amount={grain} />}
      <Decoration id={decoration} theme={theme} />
      {slide.blocks.map((block) => {
        if (block.hidden && env.mode !== "edit") return null;
        const live = transient?.[block.id] ? { ...block, ...transient[block.id] } : block;
        const index = block.anim && block.anim !== "none" ? animIndex++ : 0;
        return <BlockView key={block.id} block={live} theme={theme} env={env} slideBase={bg.base} animIndex={index} hiddenContent={editingId === block.id} />;
      })}
      {showFooter && (footer.text || footer.pageNumber || footerLogo) && (
        <div style={{ position: "absolute", left: 48, right: 48, bottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: footer.size || 14, fontFamily: fontStack(footer.font || "@body", theme), color: footerColor, pointerEvents: "none" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {footerLogo && <img src={footerLogo} alt="" style={{ height: (footer.size || 14) * 1.7, width: "auto", display: "block" }} />}
            {footer.text ? fillTokens(footer.text, env.ctx, env.info) : ""}
          </span>
          {footer.pageNumber && number ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{`${number} / ${total}`}</span> : <span />}
        </div>
      )}
    </div>
  );
}
