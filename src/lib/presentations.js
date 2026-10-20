import { setData, state } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";
import { WIDGET_CATALOG, formatWidgetValue } from "./dashboardWidgets.js";
import { activeWorkspaceName } from "./groups.js";

// Apresentações (slides) de cada empresa/grupo. Ficam no próprio registro
// da empresa (ou do grupo), como as abas do painel — ver `presentations`
// em companies.js/groups.js. Tudo é desenhado num palco fixo de 1280×720
// (16:9); a tela só aumenta/diminui esse palco, então o que se vê no editor,
// no modo apresentação e no PDF é exatamente a mesma coisa.
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

// ---------------------------------------------------------------------------
// Fontes — só fontes que já vêm no Windows/Mac (o app não baixa fonte
// nenhuma): assim o PDF sai com a mesma letra da tela, sem depender de
// internet.
export const FONTS = [
  { id: "padrao", label: "Padrão do app", stack: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { id: "moderna", label: "Moderna", stack: '"Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif' },
  { id: "geometrica", label: "Geométrica", stack: '"Century Gothic", "Futura", "Avenir Next", "Trebuchet MS", sans-serif' },
  { id: "corporativa", label: "Corporativa", stack: '"Calibri", "Carlito", "Helvetica Neue", Arial, sans-serif' },
  { id: "humanista", label: "Humanista", stack: '"Candara", "Optima", "Trebuchet MS", sans-serif' },
  { id: "classica", label: "Clássica (serifa)", stack: '"Georgia", "Cambria", "Times New Roman", serif' },
  { id: "elegante", label: "Elegante (serifa)", stack: '"Palatino Linotype", "Book Antiqua", Palatino, "Baskerville", serif' },
  { id: "impacto", label: "Impacto", stack: '"Impact", "Haettenschweiler", "Arial Black", sans-serif' },
  { id: "franklin", label: "Jornal", stack: '"Franklin Gothic Medium", "Arial Narrow", "Helvetica Neue", sans-serif' },
  { id: "manuscrita", label: "Manuscrita", stack: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' },
  { id: "tecnica", label: "Técnica (mono)", stack: 'ui-monospace, "Cascadia Code", Consolas, "SF Mono", monospace' },
];

export function fontStack(value, theme) {
  const id = value === "@heading" ? theme.headingFont : value === "@body" ? theme.bodyFont : value;
  return (FONTS.find((font) => font.id === id) || FONTS[0]).stack;
}

// ---------------------------------------------------------------------------
// Cores. Um bloco guarda ou uma cor fixa ("#rrggbb") ou uma referência ao
// tema ("@accent") — trocar o tema recolore tudo que usa referência, igual
// ao PowerPoint. "" = sem cor.
export const THEME_COLOR_KEYS = [
  { key: "bg", label: "Fundo" },
  { key: "surface", label: "Cartões" },
  { key: "text", label: "Texto" },
  { key: "muted", label: "Texto suave" },
  { key: "accent", label: "Destaque" },
  { key: "accent2", label: "Destaque 2" },
  { key: "accent3", label: "Destaque 3" },
  { key: "positive", label: "Positivo" },
  { key: "negative", label: "Negativo" },
  { key: "cover", label: "Fundo da capa" },
  { key: "onCover", label: "Texto da capa" },
];

export const SHADOWS = [
  { id: "none", label: "Nenhuma" },
  { id: "sm", label: "Suave" },
  { id: "md", label: "Média" },
  { id: "lg", label: "Forte" },
  { id: "glow", label: "Brilho" },
];

export const DECORATIONS = [
  { id: "nenhuma", label: "Nenhuma" },
  { id: "barra", label: "Barra lateral" },
  { id: "faixa", label: "Faixa inferior" },
  { id: "circulos", label: "Círculos" },
  { id: "ondas", label: "Ondas" },
  { id: "diagonal", label: "Diagonal" },
  { id: "moldura", label: "Moldura" },
  { id: "pontos", label: "Pontilhado" },
  { id: "canto", label: "Cantos" },
  { id: "brilho", label: "Brilho" },
  { id: "painel", label: "Painel (site Athos)" },
  { id: "degraus", label: "Degraus Athos" },
];

export const TRANSITIONS = [
  { id: "fade", label: "Esmaecer" },
  { id: "slide", label: "Deslizar" },
  { id: "zoom", label: "Aproximar" },
  { id: "none", label: "Nenhuma" },
];

export const ANIMATIONS = [
  { id: "none", label: "Nenhuma" },
  { id: "fade", label: "Aparecer" },
  { id: "rise", label: "Subir" },
  { id: "left", label: "Da esquerda" },
  { id: "right", label: "Da direita" },
  { id: "zoom", label: "Crescer" },
];

export const THEMES = [
  // Visual do site da Athos: fundo quase preto, painel cinza de cantos bem
  // arredondados, laranja em degradê e letra geométrica.
  {
    id: "athos",
    name: "Athos",
    colors: { bg: "#161616", surface: "#2c2c2c", text: "#ffffff", muted: "#a8a8ad", accent: "#f15a24", accent2: "#d4d4d8", accent3: "#f7931e", positive: "#34d399", negative: "#f87171", cover: "#111111", onCover: "#ffffff" },
    headingFont: "geometrica",
    bodyFont: "geometrica",
    radius: 28,
    shadow: "none",
    decoration: "painel",
  },
  {
    id: "athos-claro",
    name: "Athos claro",
    colors: { bg: "#ffffff", surface: "#f4f4f5", text: "#161616", muted: "#6b6b70", accent: "#f15a24", accent2: "#3f3f46", accent3: "#f7931e", positive: "#16a34a", negative: "#dc2626", cover: "#161616", onCover: "#ffffff" },
    headingFont: "geometrica",
    bodyFont: "geometrica",
    radius: 24,
    shadow: "sm",
    decoration: "degraus",
  },
  {
    id: "athosbi",
    name: "AthosBI",
    colors: { bg: "#ffffff", surface: "#f3f5f8", text: "#13202f", muted: "#5f6e80", accent: "#e8691f", accent2: "#0c2b4a", accent3: "#2f80c2", positive: "#1d9e75", negative: "#d8493a", cover: "#081d33", onCover: "#ffffff" },
    headingFont: "padrao",
    bodyFont: "padrao",
    radius: 18,
    shadow: "sm",
    decoration: "barra",
  },
  {
    id: "marinho",
    name: "Marinho",
    colors: { bg: "#0b2239", surface: "#12304f", text: "#f4f7fb", muted: "#9db1c7", accent: "#ff8a3d", accent2: "#5ab0ff", accent3: "#ffd166", positive: "#3ddc97", negative: "#ff6b6b", cover: "#061526", onCover: "#ffffff" },
    headingFont: "moderna",
    bodyFont: "padrao",
    radius: 20,
    shadow: "none",
    decoration: "circulos",
  },
  {
    id: "executivo",
    name: "Executivo",
    colors: { bg: "#fbfaf7", surface: "#ffffff", text: "#1d2733", muted: "#6b7380", accent: "#b08d3c", accent2: "#1f3a5f", accent3: "#7a8fa6", positive: "#2e8b57", negative: "#b03a2e", cover: "#1f3a5f", onCover: "#fdf8ec" },
    headingFont: "elegante",
    bodyFont: "padrao",
    radius: 6,
    shadow: "md",
    decoration: "moldura",
  },
  {
    id: "grafite",
    name: "Grafite",
    colors: { bg: "#18191d", surface: "#23252b", text: "#f2f2f3", muted: "#9a9da6", accent: "#f5a524", accent2: "#4fd1c5", accent3: "#a78bfa", positive: "#4ade80", negative: "#f87171", cover: "#0f1013", onCover: "#ffffff" },
    headingFont: "geometrica",
    bodyFont: "padrao",
    radius: 14,
    shadow: "none",
    decoration: "pontos",
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    colors: { bg: "#f4faf7", surface: "#ffffff", text: "#0f2f26", muted: "#5b7a70", accent: "#0f9b6c", accent2: "#0f2f26", accent3: "#f2b134", positive: "#0f9b6c", negative: "#d14b3d", cover: "#0f2f26", onCover: "#eafff6" },
    headingFont: "humanista",
    bodyFont: "padrao",
    radius: 16,
    shadow: "sm",
    decoration: "ondas",
  },
  {
    id: "oceano",
    name: "Oceano",
    colors: { bg: "#ffffff", surface: "#eef6fb", text: "#0d2b3e", muted: "#5a7486", accent: "#0096c7", accent2: "#023e8a", accent3: "#48cae4", positive: "#2a9d8f", negative: "#e76f51", cover: "#023e8a", onCover: "#ffffff" },
    headingFont: "padrao",
    bodyFont: "padrao",
    radius: 18,
    shadow: "sm",
    decoration: "ondas",
  },
  {
    id: "vinho",
    name: "Vinho",
    colors: { bg: "#fffaf8", surface: "#ffffff", text: "#2c0f17", muted: "#7a5c63", accent: "#9b2242", accent2: "#2c0f17", accent3: "#d4a373", positive: "#3a7d44", negative: "#b3261e", cover: "#5c0f24", onCover: "#fff4f0" },
    headingFont: "classica",
    bodyFont: "padrao",
    radius: 10,
    shadow: "md",
    decoration: "canto",
  },
  {
    id: "minimal",
    name: "Minimalista",
    colors: { bg: "#ffffff", surface: "#f4f4f5", text: "#111111", muted: "#71717a", accent: "#111111", accent2: "#52525b", accent3: "#a1a1aa", positive: "#16a34a", negative: "#dc2626", cover: "#111111", onCover: "#ffffff" },
    headingFont: "moderna",
    bodyFont: "padrao",
    radius: 8,
    shadow: "none",
    decoration: "nenhuma",
  },
  {
    id: "por-do-sol",
    name: "Pôr do sol",
    colors: { bg: "#fff8f1", surface: "#ffffff", text: "#2a1a12", muted: "#8a6d5c", accent: "#ff6b35", accent2: "#7b2cbf", accent3: "#ffb703", positive: "#2a9d8f", negative: "#e63946", cover: "#3c096c", onCover: "#ffffff" },
    headingFont: "geometrica",
    bodyFont: "padrao",
    radius: 22,
    shadow: "md",
    decoration: "circulos",
  },
  {
    id: "neon",
    name: "Neon",
    colors: { bg: "#0d0b1e", surface: "#1a1638", text: "#ffffff", muted: "#a7a3c9", accent: "#00e5ff", accent2: "#ff3d9a", accent3: "#b4ff39", positive: "#39ffb4", negative: "#ff5470", cover: "#070614", onCover: "#ffffff" },
    headingFont: "impacto",
    bodyFont: "padrao",
    radius: 16,
    shadow: "glow",
    decoration: "diagonal",
  },
];

export function themeById(id) {
  const preset = THEMES.find((theme) => theme.id === id) || THEMES[0];
  return { ...preset, colors: { ...preset.colors } };
}

export function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

// Mistura a→b (t=0 dá a, t=1 dá b) — pra derivar tons (linhas de grade,
// fundos suaves) a partir das cores do tema.
export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isDark(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

// "@onAccent"/"@onAccent2": branco ou quase preto, o que der contraste com
// a cor de destaque do tema (texto em cima de um botão/cabeçalho laranja,
// cinza-claro, ciano…).
export function resolveColor(value, theme) {
  if (!value) return "";
  if (value === "transparent") return "transparent";
  if (value === "@onAccent") return isDark(theme.colors.accent) ? "#ffffff" : "#161616";
  if (value === "@onAccent2") return isDark(theme.colors.accent2) ? "#ffffff" : "#161616";
  if (value.startsWith("@")) return theme.colors[value.slice(1)] || "";
  return value;
}

export function shadowCss(id, theme) {
  if (id === "sm") return "0 2px 10px rgba(15, 23, 42, 0.08)";
  if (id === "md") return "0 10px 28px rgba(15, 23, 42, 0.14)";
  if (id === "lg") return "0 22px 54px rgba(15, 23, 42, 0.24)";
  if (id === "glow") return `0 0 28px ${rgba(theme.colors.accent, 0.45)}`;
  return "none";
}

// ---------------------------------------------------------------------------
// Fundos. Tipos: "theme" (fundo do tema), "solid", "gradient" (linear ou
// radial), "mesh" (manchas de cor sobrepostas), "pattern" (pontos, grade,
// listras… sobre uma cor) e "image" (foto com película por cima).
export const PATTERNS = [
  { id: "pontos", label: "Pontos" },
  { id: "grade", label: "Grade" },
  { id: "listras", label: "Listras" },
  { id: "xadrez", label: "Xadrez" },
  { id: "linhas", label: "Linhas" },
];

export function patternCss(pattern, color, size = 24) {
  const s = Math.max(6, size);
  if (pattern === "grade") return { backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: `${s * 1.6}px ${s * 1.6}px` };
  if (pattern === "listras") return { backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px ${s * 0.75}px)` };
  if (pattern === "xadrez") return { backgroundImage: `linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%), linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%)`, backgroundSize: `${s * 2}px ${s * 2}px`, backgroundPosition: `0 0, ${s}px ${s}px` };
  if (pattern === "linhas") return { backgroundImage: `repeating-linear-gradient(0deg, ${color} 0 1px, transparent 1px ${s}px)` };
  return { backgroundImage: `radial-gradient(${color} 1.6px, transparent 1.8px)`, backgroundSize: `${s}px ${s}px` };
}

// Sugestões de fundo: as primeiras usam as cores do tema (acompanham a
// troca de tema), as outras são paletas prontas.
export function backgroundSuggestions() {
  return [
    { label: "Do tema", bg: { type: "theme" } },
    { label: "Cartão", bg: { type: "solid", color: "@surface" } },
    { label: "Capa", bg: { type: "solid", color: "@cover" } },
    { label: "Destaque", bg: { type: "gradient", color: "@accent", color2: "@accent3", angle: 135 } },
    { label: "Profundo", bg: { type: "gradient", gradType: "radial", color: "@accent", color2: "@cover" } },
    { label: "Luz", bg: { type: "gradient", gradType: "radial", color: "@bg", color2: "@surface" } },
    { label: "Malha do tema", bg: { type: "mesh", color: "@bg", colors: ["@accent", "@accent2", "@accent3"], intensity: 35 } },
    { label: "Malha escura", bg: { type: "mesh", color: "@cover", colors: ["@accent", "@accent2", "@accent3"], intensity: 55 } },
    { label: "Pontilhado", bg: { type: "pattern", color: "@bg", patternColor: "@muted", pattern: "pontos", patternOpacity: 22, patternSize: 26 } },
    { label: "Grade", bg: { type: "pattern", color: "@bg", patternColor: "@accent2", pattern: "grade", patternOpacity: 8, patternSize: 26 } },
    { label: "Listras", bg: { type: "pattern", color: "@surface", patternColor: "@accent", pattern: "listras", patternOpacity: 10, patternSize: 22 } },
    { label: "Aurora", bg: { type: "mesh", color: "#0b1026", colors: ["#7c3aed", "#06b6d4", "#22c55e"], intensity: 60 } },
    { label: "Pôr do sol", bg: { type: "gradient", color: "#ff7e5f", color2: "#7b2cbf", angle: 135 } },
    { label: "Oceano", bg: { type: "gradient", color: "#0f2027", color2: "#2c7da0", angle: 160 } },
    { label: "Menta", bg: { type: "mesh", color: "#f0fdf4", colors: ["#86efac", "#67e8f9", "#fde68a"], intensity: 45 } },
    { label: "Lavanda", bg: { type: "mesh", color: "#faf5ff", colors: ["#c4b5fd", "#f9a8d4", "#a5b4fc"], intensity: 45 } },
    { label: "Papel", bg: { type: "pattern", color: "#fbf8f1", patternColor: "#b8a88a", pattern: "linhas", patternOpacity: 14, patternSize: 34 } },
    { label: "Grafite", bg: { type: "gradient", gradType: "radial", color: "#3a3f47", color2: "#121417" } },
    { label: "Dourado", bg: { type: "gradient", color: "#1c1917", color2: "#a16207", angle: 145 } },
    { label: "Céu", bg: { type: "gradient", color: "#e0f2fe", color2: "#ffffff", angle: 180 } },
    { label: "Coral", bg: { type: "mesh", color: "#fff7ed", colors: ["#fb923c", "#f472b6", "#facc15"], intensity: 40 } },
    { label: "Noite", bg: { type: "pattern", color: "#0f172a", patternColor: "#94a3b8", pattern: "pontos", patternOpacity: 25, patternSize: 30 } },
  ];
}

// ---------------------------------------------------------------------------
// Textos com dados: "{empresa}", "{periodo}", "{kpi:dre_receita_liquida}"…
// são trocados na hora de desenhar, então o slide se atualiza sozinho quando
// muda o período ou chegam lançamentos novos.
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function friendlyPeriod(start, end) {
  if (!start || !end) return "Período completo";
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me] = end.split("-").map(Number);
  const lastDay = new Date(ye, me, 0).getDate();
  const wholeMonths = ds === 1 && Number(end.slice(8, 10)) === lastDay;
  if (!wholeMonths) return `${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}`;
  if (ys === ye && ms === me) return `${capitalize(MONTHS[ms - 1])} de ${ys}`;
  if (ys === ye && ms === 1 && me === 12) return `Ano de ${ys}`;
  if (ys === ye) return `${capitalize(MONTHS[ms - 1])} a ${MONTHS[me - 1]} de ${ys}`;
  return `${capitalize(MONTHS[ms - 1].slice(0, 3))}/${ys} a ${MONTHS[me - 1].slice(0, 3)}/${ye}`;
}

export const TEXT_TOKENS = [
  { token: "{empresa}", label: "Nome da empresa/grupo" },
  { token: "{periodo}", label: "Período (ex.: Janeiro a agosto de 2026)" },
  { token: "{inicio}", label: "Início do período" },
  { token: "{fim}", label: "Fim do período" },
  { token: "{mes}", label: "Mês final do período" },
  { token: "{ano}", label: "Ano do período" },
  { token: "{hoje}", label: "Data de hoje" },
];

export function tokenInfo() {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  return {
    empresa: activeWorkspaceName(),
    cnpj: state.activeGroupId ? "" : company?.cnpj || "",
    start: state.periodStart || "",
    end: state.periodEnd || "",
  };
}

const catalogCache = { size: -1, map: new Map() };
function catalogEntry(id) {
  // WIDGET_CATALOG é corrigido no lugar por lib/indicators.js (indicadores
  // editados/criados) — o tamanho muda quando alguém cria um indicador; os
  // editados são o mesmo objeto, então o mapa continua certo.
  if (catalogCache.size !== WIDGET_CATALOG.length) {
    catalogCache.map = new Map(WIDGET_CATALOG.map((item) => [item.id, item]));
    catalogCache.size = WIDGET_CATALOG.length;
  }
  return catalogCache.map.get(id);
}

export function widgetDefinition(id) {
  return catalogEntry(id) || null;
}

export function kpiText(id, ctx) {
  const definition = catalogEntry(id);
  if (!definition || definition.type !== "kpi" || !ctx) return "—";
  try {
    const { value, format } = definition.value(ctx);
    return formatWidgetValue(value, format);
  } catch {
    return "—";
  }
}

export function fillTokens(text, ctx, info) {
  return String(text ?? "").replace(/\{([a-z]+)(?::([a-z0-9_]+))?\}/gi, (match, name, arg) => {
    const key = name.toLowerCase();
    if (key === "empresa") return info.empresa;
    if (key === "cnpj") return info.cnpj;
    if (key === "periodo") return friendlyPeriod(info.start, info.end);
    if (key === "inicio") return info.start ? info.start.split("-").reverse().join("/") : "";
    if (key === "fim") return info.end ? info.end.split("-").reverse().join("/") : "";
    if (key === "mes") return info.end ? capitalize(MONTHS[Number(info.end.slice(5, 7)) - 1]) : "";
    if (key === "ano") return info.end ? info.end.slice(0, 4) : String(new Date().getFullYear());
    if (key === "hoje") return new Date().toLocaleDateString("pt-BR");
    if (key === "kpi" && arg) return kpiText(arg, ctx);
    return match;
  });
}

// ---------------------------------------------------------------------------
// Blocos
export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const BASE_STYLE = { fill: "", fillOpacity: 100, fill2: "", gradAngle: 135, border: "", borderWidth: 0, borderStyle: "solid", radius: 0, shadow: "none", padding: 0 };
// Cartões (KPI, gráfico, tabela…) seguem o canto e a sombra do TEMA
// (null = "do tema") — trocar o tema troca os cartões junto.
const CARD_STYLE = { ...BASE_STYLE, fill: "@surface", radius: null, shadow: null, padding: 24 };

const KIND_DEFAULTS = {
  text: () => ({
    w: 560,
    h: 120,
    style: { ...BASE_STYLE },
    text: "Clique duas vezes para escrever",
    font: "@body",
    size: 28,
    weight: 400,
    color: "@text",
    align: "left",
    valign: "top",
    italic: false,
    underline: false,
    uppercase: false,
    lineHeight: 1.3,
    letterSpacing: 0,
    list: "none",
    listColor: "@accent",
  }),
  kpi: () => ({
    w: 260,
    h: 150,
    style: { ...CARD_STYLE },
    widgetId: "dre_receita_liquida",
    label: "",
    showLabel: true,
    showIcon: true,
    showCaption: false,
    align: "left",
    font: "@heading",
    labelFont: "@body",
    valueSize: 40,
    labelSize: 16,
    valueColor: "auto",
    labelColor: "@muted",
    iconColor: "@accent",
  }),
  widget: () => ({
    w: 640,
    h: 400,
    style: { ...CARD_STYLE },
    widgetId: "chart_receita_evolucao",
    zoom: 1.3,
    showTitle: true,
    tableColumns: "total",
    maxRows: 0,
    chartColors: null,
  }),
  image: () => ({ w: 480, h: 320, style: { ...BASE_STYLE, radius: 16 }, src: "", brand: "", fit: "cover", focusX: 50, focusY: 50, grayscale: 0, brightness: 100, flipX: false }),
  shape: () => ({ w: 240, h: 240, style: { ...BASE_STYLE, fill: "@accent" }, shape: "rect" }),
  icon: () => ({ w: 96, h: 96, style: { ...BASE_STYLE, fill: "@surface", radius: 999 }, icon: "TrendingUp", color: "@accent", strokeWidth: 2, iconScale: 55 }),
  table: () => ({
    w: 640,
    h: 300,
    style: { ...CARD_STYLE, padding: 0, fill: "" },
    data: "Item;Previsto;Realizado\nReceita;1.000.000;1.120.000\nDespesas;600.000;580.000\nResultado;400.000;540.000",
    font: "@body",
    fontSize: 18,
    color: "@text",
    headerFill: "@accent",
    headerColor: "@onAccent",
    stripe: true,
    stripeColor: "@surface",
    lineColor: "@muted",
    firstColBold: true,
    lastRowBold: true,
  }),
  chart: () => ({
    w: 640,
    h: 380,
    style: { ...CARD_STYLE },
    title: "Meta x realizado",
    data: "Mês;Meta;Realizado\nJan;100;92\nFev;100;104\nMar;110;118\nAbr;110;101",
    chartType: "bar",
    stacked: false,
    showLegend: true,
    showValues: false,
    showGrid: true,
    format: "number",
    font: "@body",
    titleFont: "@heading",
    titleSize: 20,
    fontSize: 14,
    colors: ["@accent", "@accent2", "@accent3", "@positive", "@negative"],
  }),
  meta: () => ({
    w: 360,
    h: 200,
    style: { ...CARD_STYLE },
    label: "Meta de receita",
    source: "manual",
    widgetId: "dre_receita_liquida",
    current: 72,
    target: 100,
    format: "percent",
    variant: "barra",
    labelSize: 20,
    valueSize: 40,
    barHeight: 16,
    barColor: "@accent",
    font: "@heading",
  }),
};

export const BLOCK_KINDS = [
  { kind: "text", label: "Texto" },
  { kind: "kpi", label: "Número (indicador)" },
  { kind: "widget", label: "Gráfico / tabela do B.I." },
  { kind: "chart", label: "Gráfico próprio" },
  { kind: "table", label: "Tabela livre" },
  { kind: "meta", label: "Meta / progresso" },
  { kind: "image", label: "Imagem" },
  { kind: "shape", label: "Forma" },
  { kind: "icon", label: "Ícone" },
];

export function makeBlock(kind, props = {}) {
  const defaults = KIND_DEFAULTS[kind]();
  const { style, ...rest } = props;
  return {
    id: newId("b"),
    kind,
    x: 80,
    y: 80,
    rotation: 0,
    opacity: 100,
    locked: false,
    hidden: false,
    anim: "none",
    ...defaults,
    ...rest,
    style: { ...defaults.style, ...(style || {}) },
  };
}

export function cloneBlock(block, offset = 24) {
  return { ...structuredClone(block), id: newId("b"), x: block.x + offset, y: block.y + offset };
}

// ---------------------------------------------------------------------------
// Layouts de slide — pontos de partida; depois de criado, tudo no slide é
// livre (mover, redimensionar, recolorir, apagar).
const M = 80; // margem lateral

// Logo da Athos que acompanha o fundo (texto claro no escuro e vice-versa)
// — ver brand.js e ImageContent em SlideView.jsx.
function brandLogo(x, y, h) {
  return makeBlock("image", { brand: "athos", x, y, w: Math.round(h * (210 / 51)), h, fit: "contain", style: { radius: 0 } });
}

function title(text, extra = {}) {
  return makeBlock("text", { x: M, y: 52, w: SLIDE_W - M * 2, h: 64, text, font: "@heading", size: 40, weight: 700, ...extra });
}

function subtitle(text, extra = {}) {
  return makeBlock("text", { x: M, y: 114, w: SLIDE_W - M * 2, h: 36, text, size: 20, color: "@muted", ...extra });
}

function kpi(widgetId, x, y, w, h, extra = {}) {
  return makeBlock("kpi", { widgetId, x, y, w, h, ...extra });
}

function widget(widgetId, x, y, w, h, extra = {}) {
  return makeBlock("widget", { widgetId, x, y, w, h, ...extra });
}

export const LAYOUTS = [
  {
    id: "capa",
    label: "Capa",
    build: ({ heading = "Reunião de resultados" } = {}) => ({
      bg: { type: "solid", color: "@cover" },
      decoration: "@theme",
      hideFooter: true,
      blocks: [
        brandLogo(96, 72, 46),
        makeBlock("image", { brand: "athos-marca", x: 96, y: 262, w: 30, h: 30, style: { radius: 0 } }),
        makeBlock("text", { x: 138, y: 258, w: 940, h: 40, text: heading, size: 22, weight: 700, color: "@accent", valign: "middle" }),
        makeBlock("text", { x: 96, y: 310, w: 620, h: 170, text: "{empresa}", font: "@heading", size: 60, weight: 700, color: "@onCover", lineHeight: 1.1 }),
        makeBlock("shape", { shape: "line", x: 96, y: 492, w: 470, h: 4, style: { fill: "@accent", borderWidth: 2 } }),
        makeBlock("text", { x: 96, y: 512, w: 600, h: 44, text: "{periodo}", size: 24, color: "@onCover", opacity: 85 }),
      ],
    }),
  },
  {
    id: "secao",
    label: "Abertura de seção",
    build: ({ number = "01", heading = "Resultado do período", text = "O que aconteceu com receita, custos e lucro" } = {}) => ({
      blocks: [
        makeBlock("text", { x: 96, y: 170, w: 420, h: 200, text: number, font: "@heading", size: 180, weight: 800, color: "@accent", lineHeight: 1, opacity: 90 }),
        makeBlock("shape", { x: 96, y: 390, w: 84, h: 8, style: { fill: "@accent2", radius: 4 } }),
        makeBlock("text", { x: 96, y: 420, w: 1000, h: 80, text: heading, font: "@heading", size: 52, weight: 700 }),
        makeBlock("text", { x: 96, y: 504, w: 1000, h: 44, text, size: 24, color: "@muted" }),
      ],
    }),
  },
  {
    id: "titulo-texto",
    label: "Título e tópicos",
    build: ({ heading = "Destaques do período", text = "Receita cresceu no período\nMargens sob controle\nCaixa suficiente para os próximos meses" } = {}) => ({
      blocks: [title(heading), makeBlock("text", { x: M, y: 170, w: 1080, h: 440, text, size: 30, list: "bullet", lineHeight: 1.6 })],
    }),
  },
  {
    id: "kpis-4",
    label: "4 números",
    build: ({ heading = "Números do período", ids = ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "ratio_margem_liquida"] } = {}) => {
      const gap = 24;
      const w = (SLIDE_W - M * 2 - gap * 3) / 4;
      return {
        blocks: [
          title(heading),
          subtitle("{periodo}"),
          ...ids.map((id, i) => kpi(id, M + i * (w + gap), 190, w, 190, { anim: "rise" })),
          makeBlock("text", { x: M, y: 420, w: SLIDE_W - M * 2, h: 200, text: "Escreva aqui a leitura dos números: o que melhorou, o que piorou e por quê.", size: 24, color: "@muted", list: "none" }),
        ],
      };
    },
  },
  {
    id: "titulo-grafico",
    label: "Título e gráfico",
    build: ({ heading = "Evolução da receita", id = "chart_receita_evolucao" } = {}) => ({
      blocks: [title(heading), widget(id, M, 150, SLIDE_W - M * 2, 500, { showTitle: false })],
    }),
  },
  {
    id: "grafico-comentario",
    label: "Gráfico e comentário",
    build: ({ heading = "Evolução da receita", id = "chart_receita_evolucao", text = "Ponto alto do período\nO que explica a variação\nO que esperar dos próximos meses" } = {}) => ({
      blocks: [
        title(heading),
        widget(id, M, 150, 760, 500, { showTitle: false }),
        makeBlock("text", { x: 880, y: 160, w: 320, h: 480, text, size: 22, list: "check", lineHeight: 1.55 }),
      ],
    }),
  },
  {
    id: "dois-graficos",
    label: "Dois gráficos",
    build: ({ heading = "Resultado", ids = ["chart_dre_cascata", "chart_margens_evolucao"] } = {}) => ({
      blocks: [title(heading), widget(ids[0], M, 150, 548, 500), widget(ids[1], M + 572, 150, 548, 500)],
    }),
  },
  {
    id: "kpis-grafico",
    label: "Números e gráfico",
    build: ({ heading = "Caixa", ids = ["bp_disponibilidades", "ratio_liquidez_corrente", "ratio_capital_giro"], chart = "chart_caixa_evolucao" } = {}) => ({
      blocks: [
        title(heading),
        ...ids.map((id, i) => kpi(id, M, 150 + i * 172, 320, 152, { anim: "left" })),
        widget(chart, M + 344, 150, SLIDE_W - M * 2 - 344, 500, { anim: "fade" }),
      ],
    }),
  },
  {
    id: "tabela-texto",
    label: "Tabela e comentário",
    build: ({ heading = "DRE resumida", id = "table_dre_resumo", text = "Comente aqui as linhas que mais chamaram atenção." } = {}) => ({
      blocks: [
        title(heading),
        widget(id, M, 150, 720, 510, { showTitle: false, zoom: 1.25 }),
        makeBlock("text", { x: 840, y: 160, w: 360, h: 480, text, size: 22, color: "@muted", lineHeight: 1.5 }),
      ],
    }),
  },
  {
    id: "comparativo",
    label: "Comparativo",
    build: ({ heading = "Antes e depois", left = "Antes", right = "Depois" } = {}) => ({
      blocks: [
        title(heading),
        makeBlock("shape", { x: M, y: 160, w: 548, h: 480, style: { fill: "@surface", radius: 20 } }),
        makeBlock("shape", { x: M + 572, y: 160, w: 548, h: 480, style: { fill: "@accent", fillOpacity: 12, radius: 20 } }),
        makeBlock("text", { x: M + 36, y: 190, w: 476, h: 50, text: left, font: "@heading", size: 32, weight: 700, color: "@muted" }),
        makeBlock("text", { x: M + 608, y: 190, w: 476, h: 50, text: right, font: "@heading", size: 32, weight: 700, color: "@accent" }),
        makeBlock("text", { x: M + 36, y: 260, w: 476, h: 340, text: "Ponto 1\nPonto 2\nPonto 3", size: 24, list: "dash", lineHeight: 1.6 }),
        makeBlock("text", { x: M + 608, y: 260, w: 476, h: 340, text: "Ponto 1\nPonto 2\nPonto 3", size: 24, list: "check", lineHeight: 1.6 }),
      ],
    }),
  },
  {
    id: "linha-tempo",
    label: "Linha do tempo",
    build: ({ heading = "Próximos passos", steps = ["Fechar o mês", "Rever custos", "Renegociar prazos", "Nova reunião"] } = {}) => {
      const span = (SLIDE_W - M * 2) / steps.length;
      return {
        blocks: [
          title(heading),
          makeBlock("shape", { x: M + span / 2, y: 330, w: span * (steps.length - 1), h: 4, style: { fill: "@muted", fillOpacity: 40 } }),
          ...steps.flatMap((step, i) => {
            const cx = M + span * i + span / 2;
            return [
              makeBlock("shape", { shape: "ellipse", x: cx - 36, y: 296, w: 72, h: 72, style: { fill: i === 0 ? "@accent" : "@accent2" }, anim: "zoom" }),
              makeBlock("text", { x: cx - 36, y: 312, w: 72, h: 40, text: String(i + 1), font: "@heading", size: 28, weight: 700, color: i === 0 ? "@onAccent" : "@onAccent2", align: "center", valign: "middle", anim: "zoom" }),
              makeBlock("text", { x: cx - span / 2 + 12, y: 392, w: span - 24, h: 120, text: step, size: 22, weight: 600, align: "center", anim: "rise" }),
            ];
          }),
        ],
      };
    },
  },
  {
    id: "numeros-grandes",
    label: "Números gigantes",
    build: ({ heading = "Em números", ids = ["dre_receita_liquida", "ratio_margem_ebitda", "dre_resultado_liquido"] } = {}) => {
      const w = (SLIDE_W - M * 2) / ids.length;
      return {
        blocks: [
          title(heading, { align: "center" }),
          ...ids.map((id, i) =>
            kpi(id, M + i * w + 12, 230, w - 24, 260, {
              align: "center",
              valueSize: 58,
              labelSize: 20,
              showIcon: false,
              anim: "rise",
              style: { fill: "", shadow: "none", padding: 8 },
            })
          ),
        ],
      };
    },
  },
  {
    id: "texto-imagem",
    label: "Texto e imagem",
    build: ({ heading = "Nossa empresa", text = "Conte aqui a história, os produtos ou o momento da empresa." } = {}) => ({
      blocks: [
        makeBlock("text", { x: M, y: 170, w: 540, h: 80, text: heading, font: "@heading", size: 44, weight: 700 }),
        makeBlock("text", { x: M, y: 270, w: 520, h: 300, text, size: 24, color: "@muted", lineHeight: 1.5 }),
        makeBlock("image", { x: 680, y: 80, w: 520, h: 560, style: { radius: 24 } }),
      ],
    }),
  },
  {
    id: "citacao",
    label: "Frase de destaque",
    build: ({ text = "“Uma frase que resume o período.”" } = {}) => ({
      blocks: [
        makeBlock("icon", { icon: "Quote", x: 590, y: 150, w: 100, h: 100, color: "@accent", style: { fill: "", radius: 0 }, iconScale: 90 }),
        makeBlock("text", { x: 160, y: 280, w: 960, h: 200, text, font: "@heading", size: 44, weight: 600, align: "center", valign: "middle", italic: true, lineHeight: 1.3 }),
        makeBlock("text", { x: 160, y: 500, w: 960, h: 40, text: "— Nome, cargo", size: 22, color: "@muted", align: "center" }),
      ],
    }),
  },
  {
    id: "encerramento",
    label: "Encerramento",
    build: ({ heading = "Obrigado!", text = "Dúvidas? Fale com a gente." } = {}) => ({
      bg: { type: "solid", color: "@cover" },
      decoration: "circulos",
      hideFooter: true,
      blocks: [
        brandLogo(540, 150, 48),
        makeBlock("text", { x: 140, y: 250, w: 1000, h: 120, text: heading, font: "@heading", size: 88, weight: 800, color: "@onCover", align: "center", valign: "middle", anim: "zoom" }),
        makeBlock("shape", { x: 598, y: 384, w: 84, h: 8, style: { fill: "@accent", radius: 4 } }),
        makeBlock("text", { x: 140, y: 414, w: 1000, h: 50, text, size: 26, color: "@onCover", align: "center", opacity: 80 }),
      ],
    }),
  },
  {
    id: "branco",
    label: "Em branco",
    build: () => ({ blocks: [] }),
  },
];

export function makeSlide(layoutId = "branco", args) {
  const layout = LAYOUTS.find((item) => item.id === layoutId) || LAYOUTS[LAYOUTS.length - 1];
  const built = layout.build(args);
  return {
    id: newId("s"),
    bg: built.bg || { type: "theme" },
    decoration: built.decoration || "@theme",
    hideFooter: Boolean(built.hideFooter),
    hidden: false,
    transition: "@deck",
    notes: "",
    blocks: built.blocks,
  };
}

export function cloneSlide(slide) {
  return { ...structuredClone(slide), id: newId("s"), blocks: slide.blocks.map((block) => ({ ...structuredClone(block), id: newId("b") })) };
}

// ---------------------------------------------------------------------------
// Modelos de apresentação inteira
export const DECK_TEMPLATES = [
  {
    id: "resultados",
    label: "Reunião de resultados",
    description: "Capa, pauta, números, receita, resultado, balanço, caixa, próximos passos e encerramento.",
    slides: () => [
      makeSlide("capa", { heading: "Reunião de resultados" }),
      makeSlide("titulo-texto", { heading: "Pauta", text: "Números do período\nEvolução da receita\nResultado\nBalanço patrimonial\nCaixa\nPróximos passos" }),
      makeSlide("kpis-4", { heading: "Números do período" }),
      makeSlide("grafico-comentario", { heading: "Evolução da receita", id: "chart_receita_evolucao" }),
      makeSlide("dois-graficos", { heading: "Resultado", ids: ["chart_dre_cascata", "table_dre_resumo"] }),
      makeSlide("kpis-grafico", { heading: "Balanço patrimonial", ids: ["ratio_liquidez_corrente", "ratio_endividamento", "ratio_capital_giro"], chart: "table_bp_resumo" }),
      makeSlide("kpis-grafico", { heading: "Caixa", ids: ["bp_disponibilidades", "ratio_liquidez_corrente", "ratio_capital_giro"], chart: "chart_dfc_cascata" }),
      makeSlide("linha-tempo", { heading: "Próximos passos" }),
      makeSlide("encerramento"),
    ],
  },
  {
    id: "executivo",
    label: "Resumo executivo",
    description: "Quatro slides diretos: capa, números, gráfico com comentário e encerramento.",
    slides: () => [
      makeSlide("capa", { heading: "Resumo executivo" }),
      makeSlide("numeros-grandes", { heading: "O período em números" }),
      makeSlide("grafico-comentario", { heading: "Receita e resultado", id: "chart_resultado" }),
      makeSlide("encerramento"),
    ],
  },
  {
    id: "branco",
    label: "Em branco",
    description: "Uma capa e liberdade total pra montar do seu jeito.",
    slides: () => [makeSlide("capa", { heading: "Apresentação" })],
  },
];

export function makePresentation({ name, templateId = "resultados", themeId = "athos" }) {
  const template = DECK_TEMPLATES.find((item) => item.id === templateId) || DECK_TEMPLATES[0];
  const now = new Date().toISOString();
  return {
    id: newId("pr"),
    name: name || template.label,
    createdAt: now,
    updatedAt: now,
    createdBy: state.userEmail || "",
    theme: themeById(themeId),
    footer: { show: true, text: "{empresa} · {periodo}", pageNumber: true, color: "@muted", font: "@body", size: 14, logo: "athos" },
    transition: "fade",
    period: state.periodStart && state.periodEnd ? { start: state.periodStart, end: state.periodEnd } : null,
    slides: template.slides(),
  };
}

// ---------------------------------------------------------------------------
// Gravação — igual às abas do painel: muda o estado e grava o registro da
// empresa (ou do grupo) ativo.
export function savePresentations(presentations) {
  setData({ presentations });
  return persistActiveCompany();
}

export function upsertPresentation(presentation) {
  const list = state.presentations || [];
  const stamped = { ...presentation, updatedAt: new Date().toISOString() };
  const exists = list.some((item) => item.id === presentation.id);
  return savePresentations(exists ? list.map((item) => (item.id === presentation.id ? stamped : item)) : [...list, stamped]);
}

export function deletePresentation(id) {
  return savePresentations((state.presentations || []).filter((item) => item.id !== id));
}

export function duplicatePresentation(id) {
  const source = (state.presentations || []).find((item) => item.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy = {
    ...structuredClone(source),
    id: newId("pr"),
    name: `${source.name} (cópia)`,
    createdAt: now,
    updatedAt: now,
    slides: source.slides.map(cloneSlide),
  };
  savePresentations([...(state.presentations || []), copy]);
  return copy;
}

// Imagens entram no próprio registro (não há bucket de arquivos no app):
// reduz pra no máximo 1600px e JPEG — uma foto de celular de 4 MB vira uns
// 200 KB. PNG com transparência (logo) fica PNG, só redimensionado.
export function compressImage(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Esse arquivo não parece uma imagem."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        const keepAlpha = file.type === "image/png" || file.type === "image/svg+xml" || file.type === "image/webp";
        resolve({ src: keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
