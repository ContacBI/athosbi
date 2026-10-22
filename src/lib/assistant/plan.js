// O roteirista do assistente: junta o que a pessoa pediu (parse.js) com o
// que os números dizem (analysis.js) e decide quais slides entram, em que
// ordem e com qual desenho. `resolvePlan` devolve o roteiro (pra tela
// mostrar e a pessoa ajustar); `buildDeck` transforma o roteiro em slides
// de verdade, com os mesmos blocos do editor — gráficos e números do B.I.
// continuam vivos, os textos são a leitura do assistente.

import { SLIDE_W, makeBlock, makeSlide, newId, slideParts, applyBrand, themeById, friendlyPeriod } from "../presentations.js";
import { state } from "../../data/useStore.js";
import { ancestorCodes } from "../slideDemo.js";
import { AUDIENCES, OCCASIONS, TOPIC_BY_ID, GLOSSARY, norm } from "./vocab.js";
import { fmtMoney, fmtPct } from "./analysis.js";

const { M, header, kpi, widget } = slideParts;
const CW = SLIDE_W - M * 2; // 1120

// ---------------------------------------------------------------------------
// O que cada assunto mostra.

const VIEW = {
  visao: { special: true },
  receita: { kpis: ["dre_receita_bruta", "dre_receita_liquida"], chart: "chart_receita_evolucao", demo: { source: "DRE", open: { "DRE.01": "one" } }, glossary: "" },
  composicaoReceita: { chart: "chart_receita_composicao", demo: { source: "DRE", open: { "DRE.01": "all" } } },
  deducoes: { layout: "demo", demo: { source: "DRE", open: { "DRE.02": "all" } } },
  custos: { kpis: ["dre_custos", "ratio_margem_bruta"], chart: "chart_receita_custo_despesa", demo: { source: "DRE", open: { "DRE.04": "one" } }, glossary: "margemBruta" },
  despesas: { kpis: ["dre_despesas_adm", "dre_despesas_comerciais"], chart: "chart_despesas_composicao", demo: { source: "DRE", open: { "DRE.06": "one", "DRE.07": "one", "DRE.08": "one" } } },
  pessoal: { layout: "demo", demo: { source: "DRE", open: { "DRE.07": "one" } } },
  pareto: { layout: "staticChart" },
  margens: { kpis: ["ratio_margem_bruta", "ratio_margem_ebitda", "ratio_margem_liquida"], chart: "chart_margens_evolucao", glossary: "margemLiquida" },
  resultado: { kpis: ["dre_resultado_liquido", "ratio_margem_liquida"], chart: "chart_dre_cascata", demo: { source: "DRE", depth: 0 } },
  ebitda: { kpis: ["ratio_ebitda", "ratio_margem_ebitda"], chart: "chart_ebitda_evolucao", demo: { source: "DRE", depth: 0 }, glossary: "ebitda" },
  financeiro: { layout: "demo", demo: { source: "DRE", open: { "DRE.13": "all" } } },
  tributos: { layout: "demo", demo: { source: "DRE", open: { "DRE.02": "all", "DRE.08": "one", "DRE.16": "one" } } },
  caixa: { kpis: ["bp_disponibilidades", "ratio_liquidez_corrente"], chart: "chart_caixa_evolucao", demo: { source: "BP", open: { "01": "one", "01.01": "one", "01.01.01": "all" }, highlight: ["01.01.01"] } },
  fluxo: { chart: "chart_dfc_cascata", demo: { source: "DFC", depth: 1 }, glossary: "dfc" },
  endividamento: { kpis: ["ratio_endividamento", "ratio_composicao_endividamento", "bp_passivo_circulante"], chart: "chart_capital_giro_vs_divida", demo: { source: "BP", open: { "02": "one", "02.01": "one", "02.02": "one" } }, glossary: "endividamento" },
  liquidez: { kpis: ["ratio_liquidez_corrente", "ratio_liquidez_geral", "ratio_capital_giro"], chart: "chart_liquidez_evolucao", glossary: "liquidez" },
  capitalGiro: { layout: "prazos", chart: "chart_ncg_evolucao", glossary: "ciclo" },
  recebiveis: { layout: "demo", demo: { source: "BP", open: { "01": "one", "01.01": "one", "01.01.02": "all" }, highlight: ["01.01.02"] } },
  fornecedores: { layout: "demo", demo: { source: "BP", open: { "02": "one", "02.01": "one", "02.01.01": "all" }, highlight: ["02.01.01"] } },
  estoques: { layout: "demo", demo: { source: "BP", open: { "01": "one", "01.01": "one", "01.01.03": "all" }, highlight: ["01.01.03"] } },
  investimentos: { layout: "demo", demo: { source: "BP", open: { "01": "one", "01.02": "one", "01.02.03": "one" }, highlight: ["01.02.03"] } },
  balanco: { kpis: ["bp_ativo", "bp_passivo", "bp_pl"], chart: "table_bp_resumo", demo: { source: "BP", depth: 1, showPrevious: true }, glossary: "pl" },
  pl: { kpis: ["bp_pl", "ratio_roe"], chart: "chart_pl_evolucao", glossary: "pl" },
  distribuicao: { layout: "kpisText", kpis: ["dre_resultado_liquido", "bp_disponibilidades", "ratio_capital_giro"] },
  indicadores: { kpis: ["ratio_roe", "ratio_roa", "ratio_margem_operacional"], chart: "chart_radar_indicadores", glossary: "roe" },
  equilibrio: { chart: "chart_ponto_equilibrio", glossary: "equilibrio" },
  sazonalidade: { layout: "twoCharts", charts: ["chart_receita_custo_despesa", "chart_lucro_evolucao"] },
  comparativo: { layout: "comparativo" },
  grupo: { chart: "chart_comparativo_empresas" },
};

const SPECIAL = new Set(["visao", "alertas", "positivos", "proximos", "conclusao", "metas"]);
const CHAPTERS = { resultado: "Resultado", patrimonio: "Patrimônio e caixa", fechamento: "Indicadores e próximos passos" };
const DEFAULT_TOPICS = ["visao", "receita", "resultado", "margens", "despesas", "caixa", "endividamento", "alertas", "proximos"];

// Onde uma linha citada no pedido "mora" (pra abrir o demonstrativo certo).
function topicForLine(line) {
  const code = line.code || "";
  if (line.source === "BP") {
    if (code.startsWith("01.01.01")) return "caixa";
    if (code.startsWith("01.01.02")) return "recebiveis";
    if (code.startsWith("01.01.03")) return "estoques";
    if (code.startsWith("01.02.03")) return "investimentos";
    if (code.startsWith("02.01.01")) return "fornecedores";
    if (code.startsWith("02.01.02") || code.startsWith("02.02.01")) return "endividamento";
    if (code.startsWith("03")) return "pl";
    return "balanco";
  }
  if (code.startsWith("DRE.01")) return "receita";
  if (code.startsWith("DRE.02")) return "deducoes";
  if (code.startsWith("DRE.04")) return "custos";
  if (code.startsWith("DRE.13")) return "financeiro";
  if (code.startsWith("DRE.16")) return "tributos";
  if (/^DRE\.0[6-9]/.test(code)) return "despesas";
  return "resultado";
}

// ---------------------------------------------------------------------------
// O roteiro.

const SOURCE_LABEL = { voce: "você incluiu", pedido: "pedido", dados: "pelos números", ocasiao: "da ocasião", publico: "do público", padrao: "padrão" };

export function resolvePlan(request, analysis, overrides = {}) {
  const notices = [];
  const audienceDef = AUDIENCES.find((item) => item.id === (overrides.audience ?? request.audience?.id)) || null;
  const occasionDef = OCCASIONS.find((item) => item.id === (overrides.occasion ?? request.occasion?.id)) || null;
  const tones = overrides.tones || request.tones || [];
  const excluded = new Set([...(request.excluded || []), ...(overrides.removeTopics || [])]);
  const typed = (request.topics || []).filter((topic) => !excluded.has(topic.id));
  const emphasis = new Set(typed.filter((topic) => topic.emphasis).map((topic) => topic.id));
  (overrides.emphasis || []).forEach((id) => emphasis.add(id));
  const only = typed.some((topic) => topic.typed) && /\b(so|apenas|somente|unicamente|exclusivamente)\b/.test(norm(request.text || ""));

  // Candidatos: o que foi pedido entra sempre; o resto vai numa fila, do
  // mais pro menos importante, e entra enquanto couber.
  const sourceOf = new Map();
  const required = [];
  const queue = [];
  const valid = (id) => TOPIC_BY_ID[id] && !excluded.has(id);
  const need = (id, source) => {
    if (!valid(id) || sourceOf.has(id)) return;
    sourceOf.set(id, source);
    required.push(id);
  };
  const maybe = (id, source) => {
    if (!valid(id) || sourceOf.has(id)) return;
    sourceOf.set(id, source);
    queue.push(id);
  };
  typed.forEach((topic) => need(topic.id, "pedido"));
  (overrides.addTopics || []).forEach((id) => need(id, "voce"));
  if (request.monthly) need("sazonalidade", "pedido");
  const typedReal = typed.filter((topic) => topic.typed);
  const dataAlerts = [];
  if (!only) {
    const occasionTopics = occasionDef?.topics || [];
    const audienceTopics = audienceDef?.topics || [];
    const defaults = !occasionDef && !audienceDef && typedReal.length < 3 ? DEFAULT_TOPICS : ["visao", "alertas", "proximos"];
    const pool = new Set([...occasionTopics, ...audienceTopics, ...defaults]);
    if (pool.has("visao")) maybe("visao", occasionTopics.includes("visao") ? "ocasiao" : audienceTopics.includes("visao") ? "publico" : "padrao");
    // O que os números gritam entra mesmo sem ninguém pedir.
    (analysis?.alerts || [])
      .filter((alert) => alert.severity >= 3 && VIEW[alert.topic] && valid(alert.topic) && !sourceOf.has(alert.topic))
      .forEach((alert) => {
        if (dataAlerts.length >= 2 || dataAlerts.some((item) => item.topic === alert.topic)) return;
        dataAlerts.push(alert);
        maybe(alert.topic, "dados");
      });
    ["alertas", "proximos"].forEach((id) => pool.has(id) && maybe(id, occasionTopics.includes(id) ? "ocasiao" : audienceTopics.includes(id) ? "publico" : "padrao"));
    occasionTopics.forEach((id) => maybe(id, "ocasiao"));
    audienceTopics.forEach((id) => maybe(id, "publico"));
    defaults.forEach((id) => maybe(id, "padrao"));
  }

  // Assuntos que dependem de dado que não existe.
  const drop = (id, notice) => {
    const inRequired = required.indexOf(id);
    const inQueue = queue.indexOf(id);
    if (inRequired < 0 && inQueue < 0) return;
    if (inRequired >= 0) required.splice(inRequired, 1);
    if (inQueue >= 0) queue.splice(inQueue, 1);
    if (notice) notices.push(notice);
  };
  if (!analysis?.comparison) drop("comparativo", overrides.compareLabel ? { kind: "aviso", text: `Não há lançamentos em ${overrides.compareLabel} para comparar — deixei a comparação de fora.` } : null);
  if (!analysis?.facts?.group?.length) drop("grupo", { kind: "aviso", text: "Comparação entre empresas só existe quando um grupo está aberto." });
  if (!(request.goals || []).length) drop("metas", { kind: "dica", text: 'Para um slide de metas, escreva o valor: "meta de faturamento de 1,5 milhão".' });
  if (analysis?.facts?.empty) notices.push({ kind: "aviso", text: "Não encontrei lançamentos nesse período — os slides vão sair zerados." });

  // Tamanho.
  const explicit = overrides.size ?? (request.size?.source === "numero" ? request.size.target : null);
  let target = explicit ?? request.size?.target ?? occasionDef?.size ?? (audienceDef ? 10 : 9);
  target = Math.max(4, Math.min(30, target));
  const lines = (request.lines || []).slice(0, 3);
  const goals = request.goals || [];

  let budget = target - 2 - lines.length - required.length;
  if (budget < 0) {
    const needed = target - budget;
    if (explicit) notices.push({ kind: "aviso", text: `Você pediu ${explicit} slides, mas para cobrir tudo o que pediu usei ${needed}.` });
    target = needed;
    budget = 0;
  }
  const chosen = [...required];
  queue.forEach((id) => {
    if (budget <= 0) return;
    chosen.push(id);
    budget -= 1;
    const alert = dataAlerts.find((item) => item.topic === id);
    if (alert) notices.push({ kind: "info", text: `Incluí "${TOPIC_BY_ID[id].label}" porque os números pedem atenção: ${alert.title.toLowerCase()}.` });
  });

  const topics = chosen
    .map((id) => ({ id, source: sourceOf.get(id), label: TOPIC_BY_ID[id].label, emphasis: emphasis.has(id), rank: TOPIC_BY_ID[id].rank, group: TOPIC_BY_ID[id].group }))
    .sort((a, b) => a.rank - b.rank);
  const has = (id) => topics.some((topic) => topic.id === id);

  // Sobrou espaço: pauta, mensagem final, número de destaque, pontos
  // positivos, o demonstrativo aberto dos destacados e os capítulos.
  const optional = [];
  const take = (id, condition) => {
    if (budget > 0 && condition) {
      optional.push(id);
      budget -= 1;
    }
  };
  take("pauta", target >= 8);
  take("conclusao", target >= 10 && !has("conclusao"));
  take("destaque", target >= 11);
  take("positivos", target >= 13 && !has("positivos") && (analysis?.positives || []).length >= 3);
  const details = [];
  topics
    .filter((topic) => topic.emphasis && VIEW[topic.id]?.demo && VIEW[topic.id].layout !== "demo")
    .forEach((topic) => {
      if (budget <= 0) return;
      details.push(topic.id);
      budget -= 1;
    });
  const groups = [...new Set(topics.filter((topic) => !SPECIAL.has(topic.id) && topic.group !== "abertura").map((topic) => topic.group))];
  const withSections = target >= 14 && groups.length >= 2 && budget >= groups.length;
  if (withSections) budget -= groups.length;
  topics
    .filter((topic) => !topic.emphasis && VIEW[topic.id]?.demo && VIEW[topic.id].layout !== "demo" && !details.includes(topic.id))
    .forEach((topic) => {
      if (budget <= 0) return;
      details.push(topic.id);
      budget -= 1;
    });

  // Monta a sequência.
  const outline = [];
  const push = (item) => outline.push({ key: `${item.kind}:${item.topic || item.line?.code || outline.length}`, ...item });
  push({ kind: "capa", label: "Capa" });
  if (optional.includes("pauta")) push({ kind: "pauta", label: "Pauta" });
  if (has("visao")) push({ kind: "visao", topic: "visao", label: "Visão geral" });
  if (optional.includes("destaque")) push({ kind: "destaque", label: "Número de destaque" });
  let chapterNumber = 0;
  let lastGroup = "";
  const lineSlidesDone = new Set();
  topics
    .filter((topic) => !SPECIAL.has(topic.id))
    .forEach((topic) => {
      if (withSections && topic.group !== lastGroup && topic.group !== "abertura") {
        chapterNumber += 1;
        push({ kind: "secao", group: topic.group, number: String(chapterNumber).padStart(2, "0"), label: `Capítulo: ${CHAPTERS[topic.group] || topic.group}` });
      }
      lastGroup = topic.group;
      push({ kind: "topic", topic: topic.id, label: topic.label, emphasis: topic.emphasis, source: topic.source });
      if (details.includes(topic.id)) push({ kind: "detalhe", topic: topic.id, label: `${topic.label} — demonstrativo` });
      lines.forEach((line) => {
        if (topicForLine(line) === topic.id && !lineSlidesDone.has(line)) {
          lineSlidesDone.add(line);
          push({ kind: "linha", line, label: `Em destaque: ${line.name}` });
        }
      });
    });
  lines.forEach((line) => {
    if (!lineSlidesDone.has(line)) push({ kind: "linha", line, label: `Em destaque: ${line.name}` });
  });
  if (has("metas") && goals.length) push({ kind: "metas", topic: "metas", label: "Metas" });
  if (has("positivos") || optional.includes("positivos")) push({ kind: "positivos", topic: "positivos", label: "Pontos positivos" });
  if (has("alertas") || optional.includes("alertas")) push({ kind: "alertas", topic: "alertas", label: "Pontos de atenção" });
  if (has("proximos") || optional.includes("proximos")) push({ kind: "proximos", topic: "proximos", label: "Próximos passos" });
  if (has("conclusao") || optional.includes("conclusao")) push({ kind: "conclusao", topic: "conclusao", label: "Mensagem final" });
  push({ kind: "encerramento", label: "Encerramento" });

  return {
    audience: audienceDef,
    occasion: occasionDef,
    tones,
    target,
    explicit,
    topics: topics.map((topic) => ({ ...topic, sourceLabel: SOURCE_LABEL[topic.source] })),
    excluded: [...excluded],
    outline,
    notices,
  };
}

// ---------------------------------------------------------------------------
// Desenho dos slides.

function headingSize(text) {
  const length = String(text || "").length;
  if (length <= 38) return 42;
  if (length <= 48) return 36;
  if (length <= 60) return 30;
  return 26;
}

// Maior fonte (de max até min) em que os tópicos cabem na caixa — conta
// por cima quantas linhas cada tópico ocupa.
function fitSize(texts, width, height, max = 22, min = 14, lineHeight = 1.45) {
  for (let size = max; size >= min; size -= 1) {
    const perLine = Math.max(8, Math.floor(width / (size * 0.53)));
    const lines = texts.reduce((sum, text) => sum + Math.max(1, Math.ceil(String(text).length / perLine)), 0);
    if (lines * size * lineHeight + texts.length * size * 0.35 <= height) return size;
  }
  return min;
}

function heading(kicker, titleText, message, status) {
  const blocks = header(kicker, titleText, { size: headingSize(titleText) });
  if (message) blocks.push(makeBlock("text", { x: M, y: 140, w: CW, h: 34, text: message, size: message.length > 105 ? 16 : 19, color: "@muted", lineHeight: 1.3 }));
  if (status === "alerta" || status === "bom") {
    const color = status === "alerta" ? "@negative" : "@positive";
    blocks.push(
      makeBlock("shape", { x: SLIDE_W - M - 210, y: 50, w: 210, h: 30, style: { fill: color, fillOpacity: 12, border: color, borderWidth: 1, radius: 999 } }),
      makeBlock("text", { x: SLIDE_W - M - 210, y: 50, w: 210, h: 30, text: status === "alerta" ? "Ponto de atenção" : "Destaque positivo", size: 12, weight: 700, color, uppercase: true, letterSpacing: 1.5, align: "center", valign: "middle" })
    );
  }
  return blocks;
}

function reading(x, y, w, h, bullets, { label = "Leitura", list = "check", max = 21 } = {}) {
  if (!bullets.length) return [];
  const size = fitSize(bullets, w - 30, h - 34, max, 14);
  return [
    makeBlock("text", { x, y, w, h: 24, text: label, size: 13, weight: 700, color: "@muted", uppercase: true, letterSpacing: 3 }),
    makeBlock("text", { x, y: y + 34, w, h: h - 34, text: bullets.join("\n"), size, list, lineHeight: 1.45, anim: "right" }),
  ];
}

function explainBox(x, y, w, h, text) {
  if (!text) return [];
  return [
    makeBlock("shape", { x, y, w, h, style: { fill: "@accent", fillOpacity: 9, radius: 14 } }),
    makeBlock("icon", { x: x + 16, y: y + (h - 36) / 2, w: 36, h: 36, icon: "Lightbulb", color: "@accent", style: { fill: "", radius: 999 }, iconScale: 70 }),
    makeBlock("text", { x: x + 64, y: y + 8, w: w - 80, h: h - 16, text, size: fitSize([text], w - 80, h - 16, 16, 12, 1.35), color: "@text", lineHeight: 1.35, valign: "middle" }),
  ];
}

function demoBlock(view, x, y, w, h, extra = {}) {
  const { source, open = {}, highlight = [], depth, showPrevious } = view;
  return makeBlock("demo", {
    x,
    y,
    w,
    h,
    source,
    open: { ...open },
    highlight: [...highlight],
    depth: depth ?? (source === "DRE" ? 0 : 1),
    showPrevious: Boolean(showPrevious),
    showTitle: false,
    fontSize: 15,
    anim: "fade",
    ...extra,
  });
}

function bulletsFor(section, tones, max) {
  const limit = max ?? (tones.includes("direto") || tones.includes("visual") ? 3 : tones.includes("tecnico") ? 6 : tones.includes("didatico") ? 4 : 5);
  return (section?.bullets || []).slice(0, limit);
}

function notesFor(section, label, extra = "") {
  const parts = [];
  if (section?.message) parts.push(section.message);
  if (section?.bullets?.length) parts.push(section.bullets.map((item) => `• ${item}`).join("\n"));
  if (section?.note) parts.push(section.note);
  if (extra) parts.push(extra);
  parts.push(`Texto escrito pelo assistente com os números de ${label}. Os gráficos e indicadores se atualizam sozinhos; os textos não — revise se mudar o período.`);
  return parts.join("\n\n");
}

function slide(blocks, notes = "", extra = {}) {
  return { id: newId("s"), bg: { type: "theme" }, decoration: "@theme", hideFooter: false, hidden: false, transition: "@deck", notes, blocks, ...extra };
}

function topicSlide(topicId, section, ctx) {
  const { tones, label, months } = ctx;
  const view = VIEW[topicId] || {};
  const kicker = TOPIC_BY_ID[topicId]?.label || "";
  const titleText = section?.title || kicker;
  const message = section?.message || "";
  const status = section?.status;
  const didacticText = tones.includes("didatico") && view.glossary ? GLOSSARY[view.glossary] : "";
  const bullets = bulletsFor(section, tones);
  const notes = notesFor(section, label, view.glossary && !didacticText ? GLOSSARY[view.glossary] : "");
  const top = message ? 190 : 176;
  const bottom = 660;
  const explainH = didacticText ? 86 : 0;
  const visual = tones.includes("visual") || tones.includes("direto");

  const layout = view.layout || (view.kpis?.length && !visual ? "kpisChart" : "chart");
  let blocks = heading(kicker, titleText, message, status);

  if (layout === "demo") {
    const demo = { ...view.demo };
    if (topicId === "pessoal" && section?.pessoalCodes?.length) demo.open = Object.fromEntries(section.pessoalCodes.flatMap((code) => [...ancestorCodes(code).map((a) => [a, "one"]), [code, "all"]]));
    const columns = demo.source === "DRE" && months.length > 1 && months.length <= 4 ? "meses_total" : "total";
    blocks.push(demoBlock(demo, M, top, 700, bottom - top - explainH, { columns, showPercent: demo.source === "DRE" && columns === "total" }));
    blocks.push(...reading(812, top + 8, SLIDE_W - M - 812, bottom - top - 8 - explainH, bullets));
    blocks.push(...explainBox(M, bottom - explainH + 12, CW, explainH - 12, didacticText));
  } else if (layout === "staticChart") {
    if (section?.chartData) {
      blocks.push(makeBlock("chart", { x: M, y: top, w: 720, h: bottom - top - explainH, title: "", data: section.chartData, chartType: "barh", format: "money", showLegend: false, showValues: true, showGrid: false, fontSize: 13, anim: "fade" }));
    }
    blocks.push(...reading(830, top + 8, SLIDE_W - M - 830, bottom - top - 8, bullets, { label: "Ranking" }));
  } else if (layout === "prazos") {
    if (section?.table && section.table.split("\n").length > 1) {
      blocks.push(makeBlock("table", { x: M, y: top, w: 440, h: Math.min(260, 52 * section.table.split("\n").length), data: section.table, fontSize: 18, lastRowBold: true, anim: "fade" }));
    }
    blocks.push(...reading(M, top + 290, 440, bottom - top - 290, bullets.slice(0, 3), { max: 18 }));
    blocks.push(widget(view.chart, M + 470, top, CW - 470, bottom - top - explainH, { anim: "fade" }));
    if (didacticText) blocks.push(...explainBox(M + 470, bottom - explainH + 12, CW - 470, explainH - 12, didacticText));
  } else if (layout === "twoCharts") {
    const [a, b] = view.charts;
    const h = bottom - top - 120;
    blocks.push(widget(a, M, top, 550, h, { anim: "rise" }), widget(b, M + 570, top, 550, h, { anim: "rise" }));
    blocks.push(makeBlock("text", { x: M, y: top + h + 20, w: CW, h: 96, text: bullets.slice(0, 3).join("\n"), size: fitSize(bullets.slice(0, 3), CW / 1.2, 96, 19, 14), list: "check", lineHeight: 1.4, anim: "fade" }));
  } else if (layout === "kpisText") {
    const ids = view.kpis;
    const gap = 20;
    const w = (CW - gap * (ids.length - 1)) / ids.length;
    ids.forEach((id, i) => blocks.push(kpi(id, M + i * (w + gap), top, w, 170, { anim: "rise", valueSize: 36, trend: false })));
    blocks.push(...reading(M, top + 200, CW, bottom - top - 200 - explainH, bullets, { label: "Para decidir" }));
    blocks.push(...explainBox(M, bottom - explainH + 12, CW, explainH - 12, didacticText));
  } else if (layout === "comparativo") {
    if (section?.table) blocks.push(makeBlock("table", { x: M, y: top, w: 640, h: 340, data: section.table, fontSize: 15, lastRowBold: false, anim: "fade" }));
    if (section?.chartData) blocks.push(makeBlock("chart", { x: M + 660, y: top, w: CW - 660, h: 340, title: "", data: section.chartData, chartType: "bar", format: "money", showLegend: true, showValues: false, fontSize: 12, anim: "fade" }));
    blocks.push(makeBlock("text", { x: M, y: top + 360, w: CW, h: bottom - top - 360, text: bullets.slice(0, 3).join("\n"), size: fitSize(bullets.slice(0, 3), CW / 1.15, bottom - top - 360, 18, 13), list: "check", lineHeight: 1.4 }));
  } else if (layout === "kpisChart") {
    const ids = (view.kpis || []).slice(0, 3);
    const gap = 16;
    const leftW = 720;
    const w = (leftW - gap * (ids.length - 1)) / ids.length;
    ids.forEach((id, i) => blocks.push(kpi(id, M + i * (w + gap), top, w, 124, { anim: "rise", valueSize: 30, labelSize: 14, trend: false })));
    const chartTop = top + 140;
    blocks.push(widget(view.chart, M, chartTop, leftW, bottom - chartTop - explainH, { anim: "fade", showTitle: false }));
    blocks.push(...reading(830, top + 8, SLIDE_W - M - 830, bottom - top - 8 - explainH, bullets));
    blocks.push(...explainBox(M, bottom - explainH + 12, CW, explainH - 12, didacticText));
  } else {
    const chartW = visual ? 800 : 720;
    blocks.push(widget(view.chart, M, top, chartW, bottom - top - explainH, { anim: "fade", showTitle: false }));
    blocks.push(...reading(M + chartW + 30, top + 8, CW - chartW - 30, bottom - top - 8 - explainH, bullets));
    blocks.push(...explainBox(M, bottom - explainH + 12, CW, explainH - 12, didacticText));
  }
  return slide(blocks, notes);
}

function detailSlide(topicId, section, ctx, highlights = []) {
  const view = VIEW[topicId];
  const kicker = `${TOPIC_BY_ID[topicId]?.label || ""} · demonstrativo`;
  const months = ctx.months;
  const columns = view.demo.source !== "BP" && months.length > 1 && months.length <= 6 ? "meses_total" : "total";
  const extraBullets = (section?.bullets || []).slice(ctx.tones.includes("tecnico") ? 0 : 1, 5);
  const blocks = [
    ...heading(kicker, "Abrindo os números", "Toque nas linhas durante a apresentação para abrir até as contas.", null),
    demoBlock({ ...view.demo, highlight: [...(view.demo.highlight || []), ...highlights] }, M, 190, columns === "meses_total" ? CW : 760, 470, { columns, showPercent: view.demo.source === "DRE" && columns === "total", showTrend: columns === "total" && view.demo.source !== "BP" }),
  ];
  if (columns !== "meses_total") blocks.push(...reading(870, 198, SLIDE_W - M - 870, 462, extraBullets, { label: "Destaques" }));
  return slide(blocks, notesFor(section, ctx.label));
}

function lineSlide(line, info, ctx) {
  const source = line.source === "BP" ? "BP" : "DRE";
  const open = {};
  ancestorCodes(line.code).forEach((code) => {
    open[code] = "one";
  });
  open[line.code] = line.kind === "account" ? "one" : "all";
  const highlight = [line.kind === "account" ? `acc:${line.classificacao}` : line.code];
  const title = info?.title || `Em destaque: ${line.name}`;
  const blocks = [
    ...heading("Em destaque", title, info?.message || "", null),
    demoBlock({ source, open, highlight, depth: source === "BP" ? 1 : 0, showPrevious: source === "BP" }, M, 190, 720, 470, { columns: "total" }),
    ...reading(832, 198, SLIDE_W - M - 832, 462, (info?.bullets || []).slice(0, 5), { label: "Números" }),
  ];
  return slide(blocks, notesFor(info, ctx.label, "A linha pedida aparece destacada e aberta até as contas; o resto do demonstrativo fica no resumo."));
}

function cardsSlide(kicker, titleText, items, { icon, color, withAction }, notes) {
  const shown = items.slice(0, 4);
  const cols = shown.length <= 2 ? Math.max(1, shown.length) : 2;
  const rows = Math.ceil(shown.length / cols);
  const gap = 24;
  const cardW = (CW - gap * (cols - 1)) / cols;
  const areaTop = 176;
  const cardH = rows === 1 ? 400 : (660 - areaTop - gap) / 2;
  const blocks = [...heading(kicker, titleText, "", null)];
  shown.forEach((item, i) => {
    const x = M + (i % cols) * (cardW + gap);
    const y = areaTop + Math.floor(i / cols) * (cardH + gap);
    const itemColor = typeof color === "function" ? color(item) : color;
    blocks.push(
      makeBlock("shape", { x, y, w: cardW, h: cardH, style: { fill: "@surface", radius: 20, border: itemColor, borderWidth: 1, shadow: "sm" }, anim: "rise" }),
      makeBlock("icon", { x: x + 22, y: y + 22, w: 48, h: 48, icon, color: itemColor, style: { fill: itemColor, fillOpacity: 14, radius: 999 }, iconScale: 52, anim: "rise" }),
      makeBlock("text", { x: x + 86, y: y + 22, w: cardW - 108, h: 48, text: item.title, size: fitSize([item.title], cardW - 108, 48, 21, 15, 1.15), weight: 700, valign: "middle", lineHeight: 1.15, anim: "rise" }),
      makeBlock("text", { x: x + 22, y: y + 84, w: cardW - 44, h: cardH - 84 - (withAction ? 58 : 18), text: item.text, size: fitSize([item.text], cardW - 44, cardH - 84 - (withAction ? 58 : 18), 18, 13, 1.4), color: "@muted", lineHeight: 1.4, anim: "rise" })
    );
    if (withAction && item.action) blocks.push(makeBlock("text", { x: x + 22, y: y + cardH - 54, w: cardW - 44, h: 40, text: `→ ${item.action}`, size: fitSize([item.action], cardW - 60, 40, 15, 12, 1.25), weight: 600, color: "@accent", lineHeight: 1.25, valign: "middle", anim: "rise" }));
  });
  return slide(blocks, notes);
}

function stepsSlide(actions, label) {
  const steps = actions.slice(0, 4);
  const span = CW / steps.length;
  const blocks = [...heading("Plano de ação", "Próximos passos", "", null)];
  if (steps.length > 1) blocks.push(makeBlock("shape", { x: M + span / 2, y: 300, w: span * (steps.length - 1), h: 2, style: { fill: "@muted", fillOpacity: 35 } }));
  steps.forEach((step, i) => {
    const cx = M + span * i + span / 2;
    blocks.push(
      makeBlock("shape", { shape: "ellipse", x: cx - 34, y: 267, w: 68, h: 68, style: i === 0 ? { fill: "@accent", fill2: "@accent3", gradAngle: 135 } : { fill: "@surface", border: "@accent", borderWidth: 2 }, anim: "zoom" }),
      makeBlock("text", { x: cx - 34, y: 281, w: 68, h: 40, text: String(i + 1).padStart(2, "0"), font: "@heading", size: 24, weight: 700, color: i === 0 ? "@onAccent" : "@accent", align: "center", valign: "middle", anim: "zoom" }),
      makeBlock("text", { x: cx - span / 2 + 14, y: 360, w: span - 28, h: 200, text: step, size: fitSize([step], span - 28, 200, 21, 15, 1.35), weight: 600, align: "center", lineHeight: 1.35, anim: "rise" })
    );
  });
  const rest = actions.slice(4, 7);
  if (rest.length) blocks.push(makeBlock("text", { x: M, y: 580, w: CW, h: 80, text: `Também: ${rest.join(" · ")}`, size: fitSize([rest.join(" · ")], CW, 80, 16, 12, 1.4), color: "@muted", align: "center", lineHeight: 1.4 }));
  return slide(blocks, `${actions.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\nAções sugeridas pelo assistente a partir dos pontos de atenção de ${label}. Combine responsável e prazo de cada uma na reunião.`);
}

function visaoSlide(analysis, plan, ctx) {
  const ids = plan.audience?.kpis || ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "bp_disponibilidades"];
  const gap = 20;
  const w = (CW - gap * 3) / 4;
  const section = analysis.sections.visao;
  const text = analysis.conclusion.headline;
  const blocks = [
    ...header("Visão geral", "Os números do período"),
    makeBlock("text", { x: M, y: 140, w: CW, h: 32, text: "{periodo}", size: 20, color: "@muted" }),
    ...ids.slice(0, 4).map((id, i) => kpi(id, M + i * (w + gap), 200, w, 220, { anim: "rise", valueSize: 36 })),
    makeBlock("shape", { x: M, y: 468, w: 4, h: 142, style: { fill: "@accent", radius: 2 } }),
    makeBlock("text", { x: M + 24, y: 464, w: CW - 24, h: 150, text, size: fitSize([text], CW - 24, 150, 26, 17, 1.45), color: "@muted", lineHeight: 1.45, valign: "middle", anim: "fade" }),
  ];
  return slide(blocks, notesFor(section, ctx.label));
}

function destaqueSlide(analysis, plan, ctx) {
  const emphasized = plan.topics.find((topic) => topic.emphasis && VIEW[topic.id]?.kpis?.length);
  const id = emphasized ? VIEW[emphasized.id].kpis[0] : "dre_resultado_liquido";
  const section = emphasized ? analysis.sections[emphasized.id] : analysis.sections.resultado;
  const text = section?.message || section?.title || "";
  const blocks = [
    makeBlock("text", { x: M, y: 170, w: CW, h: 24, text: emphasized ? emphasized.label : "Destaque do período", size: 14, weight: 700, color: "@accent", uppercase: true, letterSpacing: 3, align: "center" }),
    kpi(id, 140, 210, 1000, 220, { align: "center", valueSize: 132, showLabel: false, showIcon: false, trend: false, delta: true, font: "@heading", style: { fill: "", shadow: "none", padding: 0 }, anim: "zoom" }),
    makeBlock("text", { x: 200, y: 450, w: 880, h: 110, text, size: fitSize([text], 880, 110, 26, 18, 1.4), color: "@muted", align: "center", lineHeight: 1.4, anim: "fade" }),
  ];
  return slide(blocks, notesFor(section, ctx.label));
}

function metasSlide(goals, analysis, ctx) {
  const f = analysis.facts;
  const currentOf = { receita_bruta: f.receitaBruta, receita_liquida: f.receitaLiquida, lucro: f.lucro, ebitda: f.ebitda, margem_bruta: f.margemBruta, margem_liquida: f.margemLiquida, margem_ebitda: f.margemEbitda, caixa: f.caixa.end };
  const shown = goals.slice(0, 3);
  const blocks = [...heading("Metas", shown.length === 1 ? shown[0].label : "Metas x realizado", "", null)];
  const rowH = Math.min(150, 470 / shown.length - 16);
  const bullets = [];
  shown.forEach((goal, i) => {
    const current = Number(currentOf[goal.metricId] || 0);
    const fmt = (value) => (goal.format === "percent" ? fmtPct(value) : fmtMoney(value));
    const pct = goal.target ? (current / goal.target) * 100 : 0;
    blocks.push(makeBlock("meta", { x: M, y: 186 + i * (rowH + 16), w: 700, h: rowH, label: goal.label, source: "kpi", widgetId: goal.widgetId, target: goal.target, format: goal.format, variant: "barra", anim: "rise" }));
    bullets.push(`${goal.label}: ${fmt(goal.target)} — realizado ${fmt(current)} (${fmtPct(pct, 0)})${pct >= 100 ? ", meta batida" : `, faltam ${fmt(goal.target - current)}`}`);
  });
  blocks.push(...reading(812, 194, SLIDE_W - M - 812, 460, bullets, { label: "Situação" }));
  return slide(blocks, `${bullets.join("\n")}\n\nAs barras se atualizam com os números; o texto ao lado foi escrito com os números de ${ctx.label}.`);
}

function pautaSlide(outline) {
  const items = [...new Set(outline.filter((item) => ["topic", "metas", "alertas", "positivos", "proximos", "visao"].includes(item.kind)).map((item) => (item.kind === "visao" ? "Visão geral" : item.label)))];
  const text = items.slice(0, 10).join("\n");
  return makeSlide("titulo-texto", { kicker: "Pauta", heading: "O que vamos ver hoje", text });
}

// ---------------------------------------------------------------------------

export function buildDeck(plan, analysis, { request, brand = "athos", themeId = "athos-premium", name = "", period = null, empresa = "" } = {}) {
  const label = period ? friendlyPeriod(period.start, period.end).toLowerCase() : "período";
  const ctx = { tones: plan.tones || [], label, months: analysis.facts.months || [] };
  const heading = plan.occasion ? OCCASIONS.find((item) => item.id === plan.occasion.id)?.heading : plan.audience?.heading || "Reunião de resultados";
  const slides = [];
  plan.outline.forEach((item) => {
    if (item.kind === "capa") {
      const cover = makeSlide("capa", { heading: heading || "Reunião de resultados" });
      if (request?.title) {
        const big = cover.blocks.find((block) => block.text === "{empresa}");
        if (big) big.text = request.title;
        const sub = cover.blocks.find((block) => block.text === "{periodo}");
        if (sub) sub.text = "{empresa} · {periodo}";
      }
      cover.notes = `Abertura. ${analysis.conclusion.headline}`;
      slides.push(cover);
    } else if (item.kind === "pauta") slides.push(pautaSlide(plan.outline));
    else if (item.kind === "secao") slides.push(makeSlide("secao", { number: item.number, heading: CHAPTERS[item.group] || item.group, text: sectionSubtitle(item.group, plan) }));
    else if (item.kind === "visao") slides.push(visaoSlide(analysis, plan, ctx));
    else if (item.kind === "destaque") slides.push(destaqueSlide(analysis, plan, ctx));
    else if (item.kind === "topic") {
      const section = item.topic === "pessoal" ? { ...analysis.sections.pessoal, pessoalCodes: analysis.facts.pessoalCodes } : analysis.sections[item.topic];
      const highlights = (request?.lines || []).filter((line) => topicForLine(line) === item.topic && line.kind === "line").map((line) => line.code);
      const built = topicSlide(item.topic, section, ctx);
      if (highlights.length) built.blocks.forEach((block) => block.kind === "demo" && (block.highlight = [...new Set([...(block.highlight || []), ...highlights])]));
      slides.push(built);
    } else if (item.kind === "detalhe") {
      const highlights = (request?.lines || []).filter((line) => topicForLine(line) === item.topic && line.kind === "line").map((line) => line.code);
      slides.push(detailSlide(item.topic, analysis.sections[item.topic], ctx, highlights));
    } else if (item.kind === "linha") {
      const info = analysis.lineInfo?.[`${item.line.kind}:${item.line.code}:${item.line.classificacao || ""}`];
      slides.push(lineSlide(item.line, info, ctx));
    } else if (item.kind === "metas") slides.push(metasSlide(request?.goals || [], analysis, ctx));
    else if (item.kind === "alertas") {
      const alerts = analysis.alerts.filter((alert) => alert.severity >= 2).length >= 2 ? analysis.alerts.filter((alert) => alert.severity >= 2) : analysis.alerts;
      if (alerts.length) slides.push(cardsSlide("Pontos de atenção", alerts.length === 1 ? alerts[0].title : `${Math.min(4, alerts.length)} pontos pedem atenção`, alerts, { icon: "TriangleAlert", color: (alert) => (alert.severity >= 3 ? "@negative" : "@accent"), withAction: true }, `${alerts.map((alert) => `• ${alert.title}: ${alert.text} Ação: ${alert.action}.`).join("\n")}\n\nPontos levantados pelo assistente nos números de ${label}.`));
      else slides.push(cardsSlide("Pontos de atenção", "Nenhum alerta relevante no período", [{ title: "Números sob controle", text: "Os indicadores de resultado, caixa e endividamento não acenderam nenhum alerta.", action: "" }], { icon: "CheckCircle2", color: "@positive" }, ""));
    } else if (item.kind === "positivos") {
      const positives = analysis.positives;
      if (positives.length) slides.push(cardsSlide("Pontos positivos", "O que foi bem no período", positives, { icon: "CheckCircle2", color: "@positive" }, positives.map((p) => `• ${p.title}: ${p.text}`).join("\n")));
    } else if (item.kind === "proximos") slides.push(stepsSlide(analysis.actions, label));
    else if (item.kind === "conclusao") {
      const quote = makeSlide("citacao", { text: analysis.conclusion.quote });
      const author = quote.blocks.find((block) => block.text === "Nome, cargo");
      if (author) author.text = "{empresa} · {periodo}";
      const big = quote.blocks.find((block) => block.text === analysis.conclusion.quote);
      if (big) big.size = fitSize([analysis.conclusion.quote], 960, 180, 44, 26, 1.25);
      quote.notes = `${analysis.conclusion.headline}\n\nFoco: ${analysis.conclusion.focus}.`;
      slides.push(quote);
    } else if (item.kind === "encerramento") slides.push(makeSlide("encerramento"));
  });

  const now = new Date().toISOString();
  const deckName = name || request?.title || `${heading || "Apresentação"}${period ? ` — ${friendlyPeriod(period.start, period.end)}` : ""}`;
  return {
    id: newId("pr"),
    name: deckName,
    createdAt: now,
    updatedAt: now,
    createdBy: state.userEmail || "",
    theme: themeById(themeId),
    brand,
    footer: { show: true, text: "{empresa} · {periodo}", pageNumber: true, color: "@muted", font: "@body", size: 14, logo: brand },
    transition: "fade",
    period: period ? { start: period.start, end: period.end } : null,
    assistant: { request: request?.text || "", createdAt: now, empresa },
    slides: applyBrand(slides, brand),
  };
}

function sectionSubtitle(group, plan) {
  const labels = plan.topics.filter((topic) => topic.group === group && !SPECIAL.has(topic.id)).map((topic) => topic.label.toLowerCase());
  if (!labels.length) return "";
  return labels.length === 1 ? labels[0].replace(/^./, (c) => c.toUpperCase()) : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`.replace(/^./, (c) => c.toUpperCase());
}
