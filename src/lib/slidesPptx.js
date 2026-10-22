import { captureSlide } from "./slidesPdf.js";
import { SLIDE_H, SLIDE_W, resolveColor } from "./presentations.js";

// PowerPoint (.pptx) das apresentações: cada slide do app vira um slide
// 16:9 do PowerPoint com
//  - o fundo (tema, decoração, formas e cartões dos textos) como imagem de
//    fundo — não sai do lugar sem querer;
//  - cada gráfico, KPI, tabela, demonstrativo, ícone e logo como uma imagem
//    própria, recortada de um print em escala 2 (nítida no projetor) e no
//    mesmo lugar — dá para mover e redimensionar;
//  - cada texto como caixa de texto de verdade (editável), com fonte,
//    tamanho, cor, alinhamento, negrito/itálico e marcadores do app;
//  - as anotações do apresentador nas notas do slide.
// Os prints usam o mesmo slide montado fora da tela do PDF (ver
// SlidesExporter em PresentMode.jsx): um com os textos escondidos e outro
// também sem os blocos que viram imagem — o segundo é o fundo.

const WIDE_W = 13.333;
const WIDE_H = 7.5;
const SCALE = 2;
const IMAGE_KINDS = new Set(["kpi", "widget", "image", "icon", "table", "chart", "meta", "demo"]);
const BULLETS = { bullet: true, dash: { characterCode: "2013" }, check: { characterCode: "2713" }, arrow: { characterCode: "2192" }, number: { type: "number" } };

const inchX = (value) => (value / SLIDE_W) * WIDE_W;
const inchY = (value) => (value / SLIDE_H) * WIDE_H;
const points = (pixels) => Math.round(pixels * 0.75 * 10) / 10;

// "rgb(1, 2, 3)" / "rgba(…)" / "#rrggbb" → "RRGGBB" (null se transparente).
export function hexColor(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.slice(1).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) return text.slice(1).split("").map((c) => c + c).join("").toUpperCase();
  const match = text.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const [r, g, b, a = "1"] = match[1].split(/[,\s/]+/).filter(Boolean);
  if (Number(a) === 0) return null;
  return [r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// '"Fraunces Variable", Georgia, serif' → "Fraunces".
export function firstFont(family) {
  const first = String(family || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  return first.replace(/\s+Variable$/i, "") || "Calibri";
}

// As linhas do texto como estão desenhadas no slide (com {empresa},
// {periodo}, {kpi:…} já trocados e **negrito**/*itálico* já aplicados):
// [{ runs: [{ text, bold?, italic? }] }]. Nas listas, o marcador (primeiro
// <span>) fica de fora — vira o marcador do PowerPoint.
export function domLines(root, { list = false } = {}) {
  return [...root.children].map((lineNode) => {
    const content = list && lineNode.children.length >= 2 ? lineNode.children[1] : lineNode;
    const runs = [];
    content.childNodes.forEach((child) => {
      const text = child.textContent || "";
      if (!text) return;
      const tag = child.nodeType === 1 ? child.tagName : "";
      runs.push({ text, ...(tag === "STRONG" || tag === "B" ? { bold: true } : {}), ...(tag === "EM" || tag === "I" ? { italic: true } : {}) });
    });
    return { runs: runs.some((run) => run.text.trim()) ? runs : [] };
  });
}

// Linhas → trechos do pptxgenjs: um parágrafo por linha (breakLine no
// último trecho), com o marcador da lista em cada linha com texto.
export function paragraphs(lines, { list = "", uppercase = false } = {}, base = {}) {
  const bullet = BULLETS[list] || null;
  const out = [];
  lines.forEach((line, index) => {
    const last = index === lines.length - 1;
    const runs = line.runs.length ? line.runs : [{ text: " " }];
    runs.forEach((run, runIndex) => {
      const options = { ...base };
      if (run.bold) options.bold = true;
      if (run.italic) options.italic = true;
      if (bullet && line.runs.length) options.bullet = bullet;
      if (runIndex === runs.length - 1 && !last) options.breakLine = true;
      out.push({ text: uppercase ? run.text.toUpperCase() : run.text, options });
    });
  });
  return out;
}

function crop(canvas, rect) {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w * SCALE));
  out.height = Math.max(1, Math.round(rect.h * SCALE));
  out.getContext("2d").drawImage(canvas, rect.x * SCALE, rect.y * SCALE, rect.w * SCALE, rect.h * SCALE, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.9);
}

const stripDataPrefix = (url) => url.replace(/^data:/, "");

// Onde o bloco está desenhado (já com rotação), dentro do slide.
function blockRect(node, element) {
  const slideRect = node.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const x = Math.max(0, rect.left - slideRect.left);
  const y = Math.max(0, rect.top - slideRect.top);
  const right = Math.min(SLIDE_W, rect.right - slideRect.left);
  const bottom = Math.min(SLIDE_H, rect.bottom - slideRect.top);
  return { x, y, w: right - x, h: bottom - y };
}

// O clone do html2canvas leva o estilo calculado de cada elemento (inclusive
// "visibility: visible" nos filhos) — por isso some com opacidade 0, que
// os filhos não conseguem desfazer.
const hide = (element) => element?.style.setProperty("opacity", "0", "important");

function hideInClone(clone, slide, { texts, images }) {
  slide.blocks.forEach((block) => {
    const element = clone.querySelector(`[data-block-id="${block.id}"]`);
    if (!element) return;
    if (texts && block.kind === "text") hide(element.firstElementChild?.lastElementChild);
    if (images && IMAGE_KINDS.has(block.kind)) hide(element);
  });
}

function textBox(slideNode, block, theme) {
  const element = slideNode.querySelector(`[data-block-id="${block.id}"]`);
  const root = element?.firstElementChild?.lastElementChild?.firstElementChild;
  if (!root) return null;
  const computed = getComputedStyle(root);
  const box = getComputedStyle(element.firstElementChild);
  // Texto em degradê fica transparente na tela: usa a cor de partida.
  const color = hexColor(computed.color) || hexColor(resolveColor(block.color, theme)) || hexColor(theme.colors.text) || "161616";
  const padding = parseFloat(box.paddingTop) || 0;
  const base = {
    fontFace: firstFont(computed.fontFamily),
    fontSize: points(parseFloat(computed.fontSize) || block.size || 18),
    color,
    bold: Number(computed.fontWeight) >= 600,
    italic: computed.fontStyle === "italic",
    underline: block.underline ? { style: "sng" } : undefined,
    align: ["left", "center", "right", "justify"].includes(block.align) ? block.align : "left",
    // Espaçamento entre letras + transparência faz o LibreOffice cortar o
    // fim da linha — com transparência, fica sem o espaçamento (detalhe).
    charSpacing: block.letterSpacing && !(block.opacity != null && block.opacity < 100) ? points(block.letterSpacing) : undefined,
  };
  const lines = domLines(root, { list: Boolean(BULLETS[block.list]) });
  if (!lines.some((line) => line.runs.length)) return null;
  // Folga na largura: no computador sem a fonte do tema, o PowerPoint usa
  // uma parecida (às vezes mais larga) e a linha não pode quebrar por isso.
  // O texto continua no mesmo lugar (cresce para o lado livre).
  const slack = Math.min(48, Math.max(12, block.w * 0.06));
  const left = block.align === "center" ? block.x - slack / 2 : block.align === "right" ? block.x - slack : block.x;
  return {
    runs: paragraphs(lines, { list: block.list, uppercase: computed.textTransform === "uppercase" }, base),
    options: {
      x: inchX(Math.max(0, left)),
      y: inchY(block.y),
      w: inchX(Math.min(SLIDE_W - Math.max(0, left), block.w + slack)),
      h: inchY(block.h),
      valign: block.valign === "middle" ? "middle" : block.valign === "bottom" ? "bottom" : "top",
      margin: points(padding),
      lineSpacingMultiple: block.lineHeight || 1.2,
      rotate: block.rotation || undefined,
      transparency: block.opacity != null && block.opacity < 100 ? 100 - block.opacity : undefined,
      fit: "shrink",
      wrap: true,
      paraSpaceBefore: 0,
      paraSpaceAfter: 0,
    },
  };
}

export async function exportSlidesPptx({ nodes, slides, deck, info, fileLabel, fontCss, onProgress }) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.name || "Apresentação";
  pptx.company = info?.empresa || "";
  pptx.author = "AthosBI";
  await new Promise((resolve) => setTimeout(resolve, 450));
  for (let i = 0; i < nodes.length; i += 1) {
    onProgress?.(i + 1, nodes.length);
    const node = nodes[i];
    const model = slides[i];
    const visible = model.blocks.filter((block) => !block.hidden);
    const content = await captureSlide(node, SCALE, fontCss, (clone) => hideInClone(clone, model, { texts: true }));
    const background = await captureSlide(node, SCALE, fontCss, (clone) => hideInClone(clone, model, { texts: true, images: true }));
    const slide = pptx.addSlide();
    slide.background = { data: stripDataPrefix(background.toDataURL("image/jpeg", 0.92)) };
    visible.forEach((block) => {
      if (!IMAGE_KINDS.has(block.kind)) return;
      const element = node.querySelector(`[data-block-id="${block.id}"]`);
      if (!element) return;
      const rect = blockRect(node, element);
      if (rect.w < 2 || rect.h < 2) return;
      slide.addImage({ data: stripDataPrefix(crop(content, rect)), x: inchX(rect.x), y: inchY(rect.y), w: inchX(rect.w), h: inchY(rect.h), altText: block.kind });
    });
    visible.forEach((block) => {
      if (block.kind !== "text" || !String(block.text || "").trim()) return;
      const box = textBox(node, block, deck.theme);
      if (box) slide.addText(box.runs, box.options);
    });
    if (model.notes) slide.addNotes(String(model.notes));
  }
  await pptx.writeFile({ fileName: `${fileLabel}.pptx` });
}
