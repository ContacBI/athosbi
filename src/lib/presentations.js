import { setData, state } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";
import { WIDGET_CATALOG, formatWidgetValue } from "./dashboardWidgets.js";
import { treeFor } from "./indicatorFormula.js";
import { accumulatedBalanceValue } from "./reportColumns.js";
import { activeWorkspaceName } from "./groups.js";
import { brandById } from "./brand.js";

// Apresentações (slides) de cada empresa/grupo. Ficam no próprio registro
// da empresa (ou do grupo), como as abas do painel — ver `presentations`
// em companies.js/groups.js. Tudo é desenhado num palco fixo de 1280×720
// (16:9); a tela só aumenta/diminui esse palco, então o que se vê no editor,
// no modo apresentação e no PDF é exatamente a mesma coisa.
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

// ---------------------------------------------------------------------------
// Fontes. As "premium" vêm embutidas no app (ver lib/slideFonts.js — e
// vão dentro do PDF também); `family` é o nome delas no @font-face. As do
// sistema (Windows/Mac) continuam valendo pra quem já usou.
export const FONTS = [
  { id: "sora", label: "Sora", group: "premium", family: "Sora Variable", stack: '"Sora Variable", "Century Gothic", sans-serif' },
  { id: "inter", label: "Inter", group: "premium", family: "Inter Variable", stack: '"Inter Variable", "Segoe UI", sans-serif' },
  { id: "manrope", label: "Manrope", group: "premium", family: "Manrope Variable", stack: '"Manrope Variable", "Segoe UI", sans-serif' },
  { id: "jakarta", label: "Plus Jakarta Sans", group: "premium", family: "Plus Jakarta Sans Variable", stack: '"Plus Jakarta Sans Variable", "Segoe UI", sans-serif' },
  { id: "montserrat", label: "Montserrat", group: "premium", family: "Montserrat Variable", stack: '"Montserrat Variable", "Segoe UI", sans-serif' },
  { id: "outfit", label: "Outfit", group: "premium", family: "Outfit Variable", stack: '"Outfit Variable", "Century Gothic", sans-serif' },
  { id: "grotesk", label: "Space Grotesk", group: "premium", family: "Space Grotesk Variable", stack: '"Space Grotesk Variable", "Segoe UI", sans-serif' },
  { id: "dmsans", label: "DM Sans", group: "premium", family: "DM Sans Variable", stack: '"DM Sans Variable", "Segoe UI", sans-serif' },
  { id: "playfair", label: "Playfair Display", group: "premium", family: "Playfair Display Variable", stack: '"Playfair Display Variable", Georgia, serif' },
  { id: "fraunces", label: "Fraunces", group: "premium", family: "Fraunces Variable", stack: '"Fraunces Variable", Georgia, serif' },
  { id: "dmserif", label: "DM Serif Display", group: "premium", family: "DM Serif Display", stack: '"DM Serif Display", Georgia, serif' },
  { id: "lora", label: "Lora", group: "premium", family: "Lora Variable", stack: '"Lora Variable", Georgia, serif' },
  { id: "bebas", label: "Bebas Neue", group: "premium", family: "Bebas Neue", stack: '"Bebas Neue", Impact, sans-serif' },
  { id: "jetbrains", label: "JetBrains Mono", group: "premium", family: "JetBrains Mono Variable", stack: '"JetBrains Mono Variable", Consolas, monospace' },
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
  { id: "aura", label: "Aura (brilho de canto)" },
  { id: "arcos", label: "Arcos finos" },
  { id: "editorial", label: "Editorial (linhas finas)" },
];

// Estilo dos cartões (número, gráfico, tabela, meta) — vale pros cartões
// com o preenchimento do tema; cada cartão pode trocar o seu.
export const CARD_STYLES = [
  { id: "solid", label: "Sólido" },
  { id: "elevated", label: "Elevado" },
  { id: "outline", label: "Contorno fino" },
  { id: "glass", label: "Vidro" },
];

// Famílias de fonte usadas pela apresentação — pra embutir no PDF.
export function deckFontFamilies(deck) {
  const ids = new Set([deck.theme.headingFont, deck.theme.bodyFont, deck.footer?.font]);
  deck.slides.forEach((slide) =>
    slide.blocks.forEach((block) => {
      [block.font, block.labelFont, block.titleFont].forEach((id) => id && ids.add(id));
    })
  );
  const families = [...ids]
    .map((id) => (id === "@heading" ? deck.theme.headingFont : id === "@body" ? deck.theme.bodyFont : id))
    .map((id) => FONTS.find((font) => font.id === id)?.family)
    .filter(Boolean);
  return [...new Set(families)];
}

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
  // arredondados, laranja e a mesma letra geométrica do site (Sora).
  {
    id: "athos",
    name: "Athos",
    colors: { bg: "#161616", surface: "#2c2c2c", text: "#ffffff", muted: "#a8a8ad", accent: "#f15a24", accent2: "#d4d4d8", accent3: "#f7931e", positive: "#34d399", negative: "#f87171", cover: "#111111", onCover: "#ffffff" },
    headingFont: "sora",
    bodyFont: "sora",
    radius: 28,
    shadow: "none",
    cardStyle: "solid",
    grain: 0,
    decoration: "painel",
  },
  // A versão "de gala" da Athos: brilho laranja vindo do canto, textura
  // granulada e cartões de vidro.
  {
    id: "athos-premium",
    name: "Athos Premium",
    colors: { bg: "#0e0e10", surface: "#1c1c1f", text: "#ffffff", muted: "#a1a1aa", accent: "#f15a24", accent2: "#e4e4e7", accent3: "#f7931e", positive: "#4ade80", negative: "#fb7185", cover: "#09090b", onCover: "#ffffff" },
    headingFont: "sora",
    bodyFont: "inter",
    radius: 24,
    shadow: "none",
    cardStyle: "glass",
    grain: 35,
    decoration: "aura",
    background: { type: "mesh", color: "@bg", colors: ["@accent", "", "@accent3", ""], intensity: 16 },
  },
  {
    id: "athos-claro",
    name: "Athos claro",
    colors: { bg: "#ffffff", surface: "#f4f4f5", text: "#161616", muted: "#6b6b70", accent: "#f15a24", accent2: "#3f3f46", accent3: "#f7931e", positive: "#16a34a", negative: "#dc2626", cover: "#161616", onCover: "#ffffff" },
    headingFont: "sora",
    bodyFont: "sora",
    radius: 24,
    shadow: "sm",
    cardStyle: "elevated",
    grain: 0,
    decoration: "degraus",
  },
  // Contac (contaccontabil.com.br): o azul-marinho do "CONTAC" e os tons
  // azul-acinzentados do anel da logo.
  {
    id: "contac",
    name: "Contac",
    colors: { bg: "#ffffff", surface: "#f1f5f6", text: "#101f26", muted: "#5d737b", accent: "#4f7380", accent2: "#101f26", accent3: "#97abb2", positive: "#2e8b67", negative: "#c0473f", cover: "#101f26", onCover: "#ffffff" },
    headingFont: "manrope",
    bodyFont: "inter",
    radius: 18,
    shadow: "sm",
    cardStyle: "elevated",
    grain: 0,
    decoration: "arcos",
  },
  {
    id: "contac-escuro",
    name: "Contac escuro",
    colors: { bg: "#0d1a20", surface: "#16272f", text: "#ffffff", muted: "#9fb2b8", accent: "#8fb3bf", accent2: "#d2dcdd", accent3: "#6b8891", positive: "#4ade80", negative: "#fb7185", cover: "#09141a", onCover: "#ffffff" },
    headingFont: "manrope",
    bodyFont: "inter",
    radius: 22,
    shadow: "none",
    cardStyle: "glass",
    grain: 20,
    decoration: "aura",
    background: { type: "mesh", color: "@bg", colors: ["@accent3", "", "@accent", ""], intensity: 14 },
  },
  {
    id: "onix",
    name: "Ônix e ouro",
    colors: { bg: "#0b0b0c", surface: "#151517", text: "#f5f1e8", muted: "#a39e93", accent: "#c9a45c", accent2: "#e8d5a3", accent3: "#7d6a45", positive: "#86c59a", negative: "#e07a6b", cover: "#070708", onCover: "#f5f1e8" },
    headingFont: "playfair",
    bodyFont: "manrope",
    radius: 6,
    shadow: "none",
    cardStyle: "outline",
    grain: 30,
    decoration: "arcos",
  },
  {
    id: "perola",
    name: "Pérola",
    colors: { bg: "#f7f5f0", surface: "#ffffff", text: "#1c1b19", muted: "#77736b", accent: "#1c1b19", accent2: "#b89b5e", accent3: "#8c8a85", positive: "#3f7d58", negative: "#b5473a", cover: "#1c1b19", onCover: "#f7f5f0" },
    headingFont: "fraunces",
    bodyFont: "inter",
    radius: 18,
    shadow: "md",
    cardStyle: "elevated",
    grain: 18,
    decoration: "editorial",
  },
  {
    id: "athosbi",
    name: "AthosBI",
    colors: { bg: "#ffffff", surface: "#f3f5f8", text: "#13202f", muted: "#5f6e80", accent: "#e8691f", accent2: "#0c2b4a", accent3: "#2f80c2", positive: "#1d9e75", negative: "#d8493a", cover: "#081d33", onCover: "#ffffff" },
    headingFont: "jakarta",
    bodyFont: "inter",
    radius: 18,
    shadow: "sm",
    cardStyle: "elevated",
    grain: 0,
    decoration: "barra",
  },
  {
    id: "marinho",
    name: "Marinho",
    colors: { bg: "#0b2239", surface: "#12304f", text: "#f4f7fb", muted: "#9db1c7", accent: "#ff8a3d", accent2: "#5ab0ff", accent3: "#ffd166", positive: "#3ddc97", negative: "#ff6b6b", cover: "#061526", onCover: "#ffffff" },
    headingFont: "grotesk",
    bodyFont: "inter",
    radius: 20,
    shadow: "none",
    cardStyle: "glass",
    grain: 20,
    decoration: "circulos",
    background: { type: "mesh", color: "@bg", colors: ["@accent2", "", "@accent", ""], intensity: 14 },
  },
  {
    id: "executivo",
    name: "Executivo",
    colors: { bg: "#fbfaf7", surface: "#ffffff", text: "#1d2733", muted: "#6b7380", accent: "#b08d3c", accent2: "#1f3a5f", accent3: "#7a8fa6", positive: "#2e8b57", negative: "#b03a2e", cover: "#1f3a5f", onCover: "#fdf8ec" },
    headingFont: "playfair",
    bodyFont: "inter",
    radius: 6,
    shadow: "md",
    cardStyle: "elevated",
    grain: 0,
    decoration: "moldura",
  },
  {
    id: "grafite",
    name: "Grafite",
    colors: { bg: "#18191d", surface: "#23252b", text: "#f2f2f3", muted: "#9a9da6", accent: "#f5a524", accent2: "#4fd1c5", accent3: "#a78bfa", positive: "#4ade80", negative: "#f87171", cover: "#0f1013", onCover: "#ffffff" },
    headingFont: "outfit",
    bodyFont: "inter",
    radius: 14,
    shadow: "none",
    cardStyle: "outline",
    grain: 25,
    decoration: "pontos",
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    colors: { bg: "#f4faf7", surface: "#ffffff", text: "#0f2f26", muted: "#5b7a70", accent: "#0f9b6c", accent2: "#0f2f26", accent3: "#f2b134", positive: "#0f9b6c", negative: "#d14b3d", cover: "#0f2f26", onCover: "#eafff6" },
    headingFont: "fraunces",
    bodyFont: "dmsans",
    radius: 16,
    shadow: "sm",
    cardStyle: "elevated",
    grain: 0,
    decoration: "ondas",
  },
  {
    id: "oceano",
    name: "Oceano",
    colors: { bg: "#ffffff", surface: "#eef6fb", text: "#0d2b3e", muted: "#5a7486", accent: "#0096c7", accent2: "#023e8a", accent3: "#48cae4", positive: "#2a9d8f", negative: "#e76f51", cover: "#023e8a", onCover: "#ffffff" },
    headingFont: "manrope",
    bodyFont: "manrope",
    radius: 18,
    shadow: "sm",
    cardStyle: "solid",
    grain: 0,
    decoration: "ondas",
  },
  {
    id: "vinho",
    name: "Vinho",
    colors: { bg: "#fffaf8", surface: "#ffffff", text: "#2c0f17", muted: "#7a5c63", accent: "#9b2242", accent2: "#2c0f17", accent3: "#d4a373", positive: "#3a7d44", negative: "#b3261e", cover: "#5c0f24", onCover: "#fff4f0" },
    headingFont: "dmserif",
    bodyFont: "lora",
    radius: 10,
    shadow: "md",
    cardStyle: "elevated",
    grain: 12,
    decoration: "canto",
  },
  {
    id: "minimal",
    name: "Minimalista",
    colors: { bg: "#ffffff", surface: "#f4f4f5", text: "#111111", muted: "#71717a", accent: "#111111", accent2: "#52525b", accent3: "#a1a1aa", positive: "#16a34a", negative: "#dc2626", cover: "#111111", onCover: "#ffffff" },
    headingFont: "inter",
    bodyFont: "inter",
    radius: 8,
    shadow: "none",
    cardStyle: "outline",
    grain: 0,
    decoration: "nenhuma",
  },
  {
    id: "por-do-sol",
    name: "Pôr do sol",
    colors: { bg: "#fff8f1", surface: "#ffffff", text: "#2a1a12", muted: "#8a6d5c", accent: "#ff6b35", accent2: "#7b2cbf", accent3: "#ffb703", positive: "#2a9d8f", negative: "#e63946", cover: "#3c096c", onCover: "#ffffff" },
    headingFont: "outfit",
    bodyFont: "dmsans",
    radius: 22,
    shadow: "md",
    cardStyle: "elevated",
    grain: 0,
    decoration: "circulos",
  },
  {
    id: "neon",
    name: "Neon",
    colors: { bg: "#0d0b1e", surface: "#1a1638", text: "#ffffff", muted: "#a7a3c9", accent: "#00e5ff", accent2: "#ff3d9a", accent3: "#b4ff39", positive: "#39ffb4", negative: "#ff5470", cover: "#070614", onCover: "#ffffff" },
    headingFont: "bebas",
    bodyFont: "grotesk",
    radius: 16,
    shadow: "glow",
    cardStyle: "glass",
    grain: 25,
    decoration: "diagonal",
    background: { type: "mesh", color: "@bg", colors: ["@accent", "@accent2", "", ""], intensity: 18 },
  },
];

export function themeById(id) {
  const preset = THEMES.find((theme) => theme.id === id) || THEMES[0];
  return { ...structuredClone(preset), colors: { ...preset.colors } };
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
    { label: "Aura", bg: { type: "mesh", color: "@cover", colors: ["", "@accent", "", "@accent3"], intensity: 30, grain: 30 } },
    { label: "Ônix", bg: { type: "mesh", color: "#0b0b0c", colors: ["", "#c9a45c", "", ""], intensity: 22, grain: 35 } },
    { label: "Champanhe", bg: { type: "mesh", color: "#f7f5f0", colors: ["#e8d5a3", "", "#d6cfc2", ""], intensity: 45, grain: 20 } },
    { label: "Grafite fosco", bg: { type: "gradient", gradType: "radial", color: "#26272b", color2: "#0c0c0e", grain: 40 } },
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

// "R$ 1,88 mi" em vez de "R$ 1.881.222,53" — números grandes ficam mais
// limpos num slide. Percentual e índice não mudam.
export function compactValue(value, format) {
  if (format !== "money") return formatWidgetValue(value, format);
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const fmt = (v, digits) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  // Sinal antes do "R$" ("-R$ 251,7 mil"), igual ao valor por extenso.
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}R$ ${fmt(abs / 1e9, 2)} bi`;
  if (abs >= 1e6) return `${sign}R$ ${fmt(abs / 1e6, 2)} mi`;
  if (abs >= 1e4) return `${sign}R$ ${fmt(abs / 1e3, 1)} mil`;
  return formatWidgetValue(n, format);
}

// O indicador mês a mês (pro minigráfico e o "▲ x% no mês"): as mesmas
// linhas da fórmula, só que pegando o valor de cada mês — movimento do mês
// pra DRE/EBITDA, saldo acumulado até o mês pro Balanço.
export function kpiSeries(definition, ctx) {
  const formula = definition?.formula;
  const months = ctx?.months || [];
  if (!formula || months.length < 2) return [];
  const valueAt = (code, month) => {
    const row = (treeFor(ctx, code) || []).find((item) => item.codigo_gerencial === code);
    if (!row) return 0;
    const isBp = !String(code).startsWith("DRE") && !String(code).startsWith("DEX");
    return isBp ? accumulatedBalanceValue(row, month, months) : Number(row.monthValues?.[month] || 0);
  };
  const sum = (terms, month) => (terms || []).reduce((total, term) => total + valueAt(term.code, month) * (term.sign < 0 ? -1 : 1), 0);
  return months.map((month) => {
    if (formula.kind !== "ratio") return sum(formula.numerator, month);
    const den = sum(formula.denominator, month);
    if (!den) return null;
    const raw = sum(formula.numerator, month) / den;
    return formula.format === "percent" ? raw * 100 : raw;
  });
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
const CARD_STYLE = { ...BASE_STYLE, fill: "@surface", radius: null, shadow: null, padding: 24, cardStyle: null };

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
    gradient: "",
    gradientAngle: 90,
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
    numberStyle: "compact",
    trend: true,
    delta: true,
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
  // "Demonstrativo sob medida" (lib/slideDemo.js, components/slides/
  // DemoBlock.jsx): começa no resumido; open/highlight/hide escolhem o
  // que cada linha mostra.
  demo: () => ({
    w: 780,
    h: 540,
    style: { ...CARD_STYLE },
    source: "BP",
    depth: 1,
    open: {},
    highlight: [],
    hide: [],
    columns: "total",
    showPrevious: false,
    showPercent: false,
    showTrend: false,
    hideZero: true,
    numberStyle: "full",
    title: "",
    showTitle: true,
    showPeriod: true,
    titleFont: "@heading",
    font: "@body",
    fontSize: 16,
    stripe: true,
    highlightColor: "@accent",
    interactive: true,
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

// "Transformar em Demonstrativo sob medida": a tabela resumida do B.I.
// vira o bloco "demo" no mesmo lugar e tamanho (o resto do bloco — posição,
// estilo, animação — fica como estava).
export function widgetToDemo(block) {
  const table = String(widgetDefinition(block.widgetId)?.table || "");
  const source = table === "bp" ? "BP" : table.startsWith("dfc_") ? "DFC" : "DRE";
  // eslint-disable-next-line no-unused-vars
  const { w, h, style, ...defaults } = KIND_DEFAULTS.demo();
  return {
    ...defaults,
    kind: "demo",
    source,
    depth: source === "DRE" ? 0 : 1,
    columns: block.tableColumns === "meses" ? "meses_total" : "total",
    fontSize: Math.max(10, Math.round(13 * (block.zoom || 1))),
    showTitle: block.showTitle !== false,
  };
}

export const BLOCK_KINDS = [
  { kind: "text", label: "Texto" },
  { kind: "kpi", label: "Número (indicador)" },
  { kind: "widget", label: "Gráfico / tabela do B.I." },
  { kind: "demo", label: "Demonstrativo sob medida" },
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

// Cabeçalho "editorial" dos slides: um rótulo pequeno em maiúsculas na cor
// de destaque, o título grande logo abaixo (letras um pouco mais juntas, que
// é o que dá cara de apresentação bem-feita) e, opcional, uma linha de apoio.
function eyebrow(text, extra = {}) {
  return makeBlock("text", { x: M, y: 50, w: SLIDE_W - M * 2, h: 24, text, size: 14, weight: 700, color: "@accent", uppercase: true, letterSpacing: 3, ...extra });
}

function title(text, extra = {}) {
  return makeBlock("text", { x: M, y: 76, w: SLIDE_W - M * 2, h: 60, text, font: "@heading", size: 42, weight: 700, letterSpacing: -1, lineHeight: 1.1, ...extra });
}

function header(kicker, heading, extra = {}) {
  return [eyebrow(kicker, extra.align ? { align: extra.align } : {}), title(heading, extra)];
}

function lede(text, extra = {}) {
  return makeBlock("text", { x: M, y: 140, w: SLIDE_W - M * 2, h: 32, text, size: 20, color: "@muted", ...extra });
}

// Comentário com uma barrinha de destaque na frente — pra "leitura" dos
// números.
function insight(x, y, w, h, text, extra = {}) {
  return [
    makeBlock("shape", { x, y: y + 4, w: 4, h: h - 8, style: { fill: "@accent", radius: 2 } }),
    makeBlock("text", { x: x + 24, y, w: w - 24, h, text, size: 22, color: "@muted", lineHeight: 1.5, valign: "middle", ...extra }),
  ];
}

function kpi(widgetId, x, y, w, h, extra = {}) {
  return makeBlock("kpi", { widgetId, x, y, w, h, ...extra });
}

function widget(widgetId, x, y, w, h, extra = {}) {
  return makeBlock("widget", { widgetId, x, y, w, h, ...extra });
}

// As mesmas peças, pro assistente de apresentação (lib/assistant/plan.js)
// montar slides com o acabamento dos layouts prontos.
export const slideParts = { M, brandLogo, eyebrow, title, header, lede, insight, kpi, widget };

export const LAYOUTS = [
  {
    id: "capa",
    label: "Capa",
    build: ({ heading = "Reunião de resultados" } = {}) => ({
      bg: { type: "solid", color: "@cover" },
      decoration: "@theme",
      hideFooter: true,
      blocks: [
        brandLogo(96, 70, 40),
        makeBlock("shape", { x: 96, y: 228, w: 330, h: 44, style: { fill: "@accent", fillOpacity: 12, border: "@accent", borderWidth: 1, radius: 999 } }),
        makeBlock("text", { x: 96, y: 228, w: 330, h: 44, text: heading, size: 15, weight: 700, color: "@accent", uppercase: true, letterSpacing: 2.5, align: "center", valign: "middle" }),
        makeBlock("text", { x: 92, y: 300, w: 1000, h: 200, text: "{empresa}", font: "@heading", size: 76, weight: 700, color: "@onCover", lineHeight: 1.02, letterSpacing: -2.5, valign: "bottom", anim: "rise" }),
        makeBlock("shape", { x: 96, y: 532, w: 120, h: 4, style: { fill: "@accent", fill2: "@accent3", gradAngle: 90, radius: 2 } }),
        makeBlock("text", { x: 96, y: 556, w: 700, h: 36, text: "{periodo}", size: 24, color: "@onCover", opacity: 85 }),
        makeBlock("text", { x: 96, y: 640, w: 700, h: 24, text: "Preparado pela Athos Consultoria Empresarial", size: 14, color: "@onCover", opacity: 55, letterSpacing: 0.5 }),
      ],
    }),
  },
  {
    id: "secao",
    label: "Abertura de seção",
    build: ({ number = "01", heading = "Resultado do período", text = "O que aconteceu com receita, custos e lucro" } = {}) => ({
      blocks: [
        makeBlock("text", { x: 90, y: 150, w: 520, h: 230, text: number, font: "@heading", size: 220, weight: 800, color: "@accent", gradient: "@accent3", gradientAngle: 135, lineHeight: 1, letterSpacing: -8 }),
        makeBlock("text", { x: 96, y: 400, w: 600, h: 24, text: "Capítulo", size: 14, weight: 700, color: "@muted", uppercase: true, letterSpacing: 3 }),
        makeBlock("text", { x: 96, y: 428, w: 1000, h: 70, text: heading, font: "@heading", size: 56, weight: 700, letterSpacing: -1.5, lineHeight: 1.05, anim: "rise" }),
        makeBlock("text", { x: 96, y: 510, w: 900, h: 40, text, size: 24, color: "@muted", anim: "fade" }),
      ],
    }),
  },
  {
    id: "titulo-texto",
    label: "Título e tópicos",
    build: ({ kicker = "Pauta", heading = "Destaques do período", text = "Receita cresceu no período\nMargens sob controle\nCaixa suficiente para os próximos meses" } = {}) => ({
      blocks: [...header(kicker, heading), makeBlock("text", { x: M, y: 186, w: 1080, h: 440, text, size: 30, list: "number", lineHeight: 1.75, anim: "fade" })],
    }),
  },
  {
    id: "kpis-4",
    label: "4 números",
    build: ({ kicker = "Visão geral", heading = "Números do período", ids = ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "ratio_margem_liquida"] } = {}) => {
      const gap = 20;
      const w = (SLIDE_W - M * 2 - gap * 3) / 4;
      return {
        blocks: [
          ...header(kicker, heading),
          lede("{periodo}"),
          ...ids.map((id, i) => kpi(id, M + i * (w + gap), 200, w, 220, { anim: "rise", valueSize: 38 })),
          ...insight(M, 464, SLIDE_W - M * 2, 150, "Escreva aqui a leitura dos números: o que melhorou, o que piorou e por quê."),
        ],
      };
    },
  },
  {
    id: "destaque",
    label: "Número de destaque",
    build: ({ kicker = "Destaque do período", id = "dre_receita_liquida", text = "de receita líquida — conte em uma frase o que esse número significa." } = {}) => ({
      blocks: [
        eyebrow(kicker, { y: 170, align: "center" }),
        kpi(id, 140, 210, 1000, 220, { align: "center", valueSize: 132, showLabel: false, showIcon: false, trend: false, delta: true, font: "@heading", style: { fill: "", shadow: "none", padding: 0 }, anim: "zoom" }),
        makeBlock("text", { x: 240, y: 450, w: 800, h: 90, text, size: 26, color: "@muted", align: "center", lineHeight: 1.4, anim: "fade" }),
      ],
    }),
  },
  {
    id: "titulo-grafico",
    label: "Título e gráfico",
    build: ({ kicker = "Evolução", heading = "Evolução da receita", id = "chart_receita_evolucao" } = {}) => ({
      blocks: [...header(kicker, heading), widget(id, M, 170, SLIDE_W - M * 2, 480, { showTitle: false, anim: "fade" })],
    }),
  },
  {
    id: "grafico-comentario",
    label: "Gráfico e comentário",
    build: ({ kicker = "Evolução", heading = "Evolução da receita", id = "chart_receita_evolucao", text = "Ponto alto do período\nO que explica a variação\nO que esperar dos próximos meses" } = {}) => ({
      blocks: [
        ...header(kicker, heading),
        widget(id, M, 170, 740, 480, { showTitle: false, anim: "fade" }),
        makeBlock("text", { x: 860, y: 180, w: 340, h: 24, text: "Leitura", size: 14, weight: 700, color: "@muted", uppercase: true, letterSpacing: 3 }),
        makeBlock("text", { x: 860, y: 214, w: 340, h: 420, text, size: 22, list: "check", lineHeight: 1.6, anim: "right" }),
      ],
    }),
  },
  {
    id: "dois-graficos",
    label: "Dois gráficos",
    build: ({ kicker = "Resultado", heading = "Resultado", ids = ["chart_dre_cascata", "chart_margens_evolucao"] } = {}) => ({
      blocks: [...header(kicker, heading), widget(ids[0], M, 170, 550, 480, { anim: "rise" }), widget(ids[1], M + 570, 170, 550, 480, { anim: "rise" })],
    }),
  },
  {
    id: "kpis-grafico",
    label: "Números e gráfico",
    build: ({ kicker = "Liquidez", heading = "Caixa", ids = ["bp_disponibilidades", "ratio_liquidez_corrente", "ratio_capital_giro"], chart = "chart_caixa_evolucao" } = {}) => ({
      blocks: [
        ...header(kicker, heading),
        ...ids.map((id, i) => kpi(id, M, 170 + i * 164, 330, 148, { anim: "left", valueSize: 32, trend: false })),
        widget(chart, M + 350, 170, SLIDE_W - M * 2 - 350, 476, { anim: "fade" }),
      ],
    }),
  },
  {
    id: "tabela-texto",
    label: "Tabela e comentário",
    build: ({ kicker = "Demonstração", heading = "DRE resumida", id = "table_dre_resumo", text = "Comente aqui as linhas que mais chamaram atenção." } = {}) => ({
      blocks: [...header(kicker, heading), widget(id, M, 170, 720, 480, { showTitle: false, zoom: 1.25 }), ...insight(840, 190, 360, 300, text)],
    }),
  },
  {
    id: "comparativo",
    label: "Comparativo",
    build: ({ kicker = "Comparativo", heading = "Antes e depois", left = "Antes", right = "Depois" } = {}) => ({
      blocks: [
        ...header(kicker, heading),
        makeBlock("shape", { x: M, y: 180, w: 550, h: 460, style: { fill: "@surface", radius: 24 } }),
        makeBlock("shape", { x: M + 570, y: 180, w: 550, h: 460, style: { fill: "@accent", fill2: "@accent3", gradAngle: 135, fillOpacity: 14, border: "@accent", borderWidth: 1, radius: 24 } }),
        makeBlock("text", { x: M + 40, y: 214, w: 470, h: 24, text: left, size: 14, weight: 700, color: "@muted", uppercase: true, letterSpacing: 3 }),
        makeBlock("text", { x: M + 610, y: 214, w: 470, h: 24, text: right, size: 14, weight: 700, color: "@accent", uppercase: true, letterSpacing: 3 }),
        makeBlock("text", { x: M + 40, y: 256, w: 470, h: 340, text: "Ponto 1\nPonto 2\nPonto 3", size: 26, list: "dash", lineHeight: 1.7 }),
        makeBlock("text", { x: M + 610, y: 256, w: 470, h: 340, text: "Ponto 1\nPonto 2\nPonto 3", size: 26, list: "check", lineHeight: 1.7 }),
      ],
    }),
  },
  {
    id: "linha-tempo",
    label: "Linha do tempo",
    build: ({ kicker = "Plano de ação", heading = "Próximos passos", steps = ["Fechar o mês", "Rever custos", "Renegociar prazos", "Nova reunião"] } = {}) => {
      const span = (SLIDE_W - M * 2) / steps.length;
      return {
        blocks: [
          ...header(kicker, heading),
          makeBlock("shape", { x: M + span / 2, y: 340, w: span * (steps.length - 1), h: 2, style: { fill: "@muted", fillOpacity: 35 } }),
          ...steps.flatMap((step, i) => {
            const cx = M + span * i + span / 2;
            return [
              makeBlock("shape", { shape: "ellipse", x: cx - 34, y: 307, w: 68, h: 68, style: i === 0 ? { fill: "@accent", fill2: "@accent3", gradAngle: 135 } : { fill: "@surface", border: "@accent", borderWidth: 2 }, anim: "zoom" }),
              makeBlock("text", { x: cx - 34, y: 321, w: 68, h: 40, text: String(i + 1).padStart(2, "0"), font: "@heading", size: 24, weight: 700, color: i === 0 ? "@onAccent" : "@accent", align: "center", valign: "middle", anim: "zoom" }),
              makeBlock("text", { x: cx - span / 2 + 12, y: 400, w: span - 24, h: 110, text: step, size: 22, weight: 600, align: "center", lineHeight: 1.35, anim: "rise" }),
            ];
          }),
        ],
      };
    },
  },
  {
    id: "numeros-grandes",
    label: "Números gigantes",
    build: ({ kicker = "Resumo", heading = "O período em números", ids = ["dre_receita_liquida", "ratio_margem_ebitda", "dre_resultado_liquido"] } = {}) => {
      const w = (SLIDE_W - M * 2) / ids.length;
      return {
        blocks: [
          ...header(kicker, heading, { align: "center" }),
          ...ids.slice(1).map((_, i) => makeBlock("shape", { x: M + (i + 1) * w, y: 256, w: 1, h: 210, style: { fill: "@muted", fillOpacity: 35 } })),
          ...ids.map((id, i) =>
            kpi(id, M + i * w + 16, 236, w - 32, 250, {
              align: "center",
              valueSize: 56,
              labelSize: 18,
              showIcon: false,
              trend: false,
              delta: true,
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
    build: ({ kicker = "Quem somos", heading = "Nossa empresa", text = "Conte aqui a história, os produtos ou o momento da empresa." } = {}) => ({
      blocks: [
        makeBlock("text", { x: M, y: 200, w: 540, h: 24, text: kicker, size: 14, weight: 700, color: "@accent", uppercase: true, letterSpacing: 3 }),
        makeBlock("text", { x: M, y: 230, w: 540, h: 120, text: heading, font: "@heading", size: 48, weight: 700, letterSpacing: -1.5, lineHeight: 1.05 }),
        makeBlock("text", { x: M, y: 360, w: 520, h: 220, text, size: 22, color: "@muted", lineHeight: 1.6 }),
        makeBlock("image", { x: 680, y: 70, w: 520, h: 580, style: { radius: 28 } }),
      ],
    }),
  },
  {
    id: "citacao",
    label: "Frase de destaque",
    build: ({ text = "Uma frase que resume o período." } = {}) => ({
      blocks: [
        makeBlock("text", { x: 140, y: 120, w: 1000, h: 140, text: "“", font: "@heading", size: 200, weight: 700, color: "@accent", align: "center", lineHeight: 1 }),
        makeBlock("text", { x: 160, y: 280, w: 960, h: 180, text, font: "@heading", size: 46, weight: 600, align: "center", valign: "middle", lineHeight: 1.25, letterSpacing: -1, anim: "fade" }),
        makeBlock("shape", { x: 610, y: 488, w: 60, h: 3, style: { fill: "@accent", radius: 2 } }),
        makeBlock("text", { x: 160, y: 508, w: 960, h: 32, text: "Nome, cargo", size: 20, color: "@muted", align: "center", uppercase: true, letterSpacing: 2 }),
      ],
    }),
  },
  {
    id: "encerramento",
    label: "Encerramento",
    build: ({ heading = "Obrigado.", text = "Dúvidas? Fale com a gente." } = {}) => ({
      bg: { type: "solid", color: "@cover" },
      decoration: "@theme",
      hideFooter: true,
      blocks: [
        brandLogo(556, 150, 40),
        makeBlock("text", { x: 140, y: 240, w: 1000, h: 140, text: heading, font: "@heading", size: 110, weight: 700, color: "@onCover", gradient: "", align: "center", valign: "middle", letterSpacing: -4, anim: "zoom" }),
        makeBlock("shape", { x: 580, y: 400, w: 120, h: 4, style: { fill: "@accent", fill2: "@accent3", gradAngle: 90, radius: 2 } }),
        makeBlock("text", { x: 140, y: 428, w: 1000, h: 40, text, size: 24, color: "@onCover", align: "center", opacity: 75 }),
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
    description: "Capa, pauta, números, destaque, receita, resultado, balanço, caixa, próximos passos e encerramento.",
    slides: () => [
      makeSlide("capa", { heading: "Reunião de resultados" }),
      makeSlide("titulo-texto", { kicker: "Pauta", heading: "O que vamos ver hoje", text: "Números do período\nEvolução da receita\nResultado\nBalanço patrimonial\nCaixa\nPróximos passos" }),
      makeSlide("kpis-4", { kicker: "Visão geral", heading: "Números do período" }),
      makeSlide("destaque", { kicker: "Destaque do período", id: "dre_resultado_liquido", text: "de resultado líquido no período — conte em uma frase o que levou a esse número." }),
      makeSlide("grafico-comentario", { kicker: "Receita", heading: "Evolução da receita", id: "chart_receita_evolucao" }),
      makeSlide("dois-graficos", { kicker: "Resultado", heading: "Do faturamento ao lucro", ids: ["chart_dre_cascata", "table_dre_resumo"] }),
      makeSlide("kpis-grafico", { kicker: "Balanço patrimonial", heading: "Solidez e endividamento", ids: ["ratio_liquidez_corrente", "ratio_endividamento", "ratio_capital_giro"], chart: "table_bp_resumo" }),
      makeSlide("kpis-grafico", { kicker: "Caixa", heading: "Geração de caixa", ids: ["bp_disponibilidades", "ratio_liquidez_corrente", "ratio_capital_giro"], chart: "chart_dfc_cascata" }),
      makeSlide("linha-tempo", { kicker: "Plano de ação", heading: "Próximos passos" }),
      makeSlide("encerramento"),
    ],
  },
  {
    id: "executivo",
    label: "Resumo executivo",
    description: "Cinco slides diretos: capa, números, destaque, gráfico com comentário e encerramento.",
    slides: () => [
      makeSlide("capa", { heading: "Resumo executivo" }),
      makeSlide("numeros-grandes", { kicker: "Resumo", heading: "O período em números" }),
      makeSlide("destaque", { kicker: "Destaque do período", id: "dre_receita_liquida" }),
      makeSlide("grafico-comentario", { kicker: "Tendência", heading: "Receita e resultado", id: "chart_resultado" }),
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

// A marca escolhida (Athos ou Contac) nos slides prontos: as logos que
// mudam sozinhas entre clara e escura (com a largura da logo certa) e a
// assinatura da capa.
export function applyBrand(slides, brandId) {
  const brand = brandById(brandId);
  const signatures = new Set(["Preparado pela Athos Consultoria Empresarial", "Preparado pela Contac"]);
  return slides.map((slide) => ({
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (block.kind === "image" && (block.brand === "athos" || block.brand === "contac")) return { ...block, brand: brand.id, w: Math.round(block.h * brand.ratio) };
      if (block.kind === "text" && signatures.has(block.text)) return { ...block, text: brand.signature };
      return block;
    }),
  }));
}

export function makePresentation({ name, templateId = "resultados", themeId = "athos-premium", brand = "athos" }) {
  const template = DECK_TEMPLATES.find((item) => item.id === templateId) || DECK_TEMPLATES[0];
  const now = new Date().toISOString();
  return {
    id: newId("pr"),
    name: name || template.label,
    createdAt: now,
    updatedAt: now,
    createdBy: state.userEmail || "",
    theme: themeById(themeId),
    brand,
    footer: { show: true, text: "{empresa} · {periodo}", pageNumber: true, color: "@muted", font: "@body", size: 14, logo: brand },
    transition: "fade",
    period: state.periodStart && state.periodEnd ? { start: state.periodStart, end: state.periodEnd } : null,
    slides: applyBrand(template.slides(), brand),
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
