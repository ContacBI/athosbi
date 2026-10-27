import { compactValue } from "./presentations.js";
import { fmtPct } from "./assistant/analysis.js";

// Resumo no celular configurável por empresa/grupo (Celular.jsx): quais
// blocos aparecem e em que ordem, quais números vão nos quadrinhos, quantos
// alertas, quais tipos de alerta ficam de fora e um recado do escritório.
// Fica no workspace (company.resumoCelular / group.resumoCelular, igual a
// orcamentos); null = o padrão, que é o resumo como ele sempre foi — com uma
// diferença: os alertas técnicos (De/Para pendente, balanço que não fecha…)
// passam a ser só da equipe, o cliente não vê.

export const BLOCOS = [
  { id: "recado", nome: "Recado do escritório", descricao: "Uma mensagem sua no topo do resumo (só aparece se tiver texto)" },
  { id: "resultado", nome: "Lucro do período", descricao: "O número em destaque, com a margem e a comparação" },
  { id: "numeros", nome: "Números principais", descricao: "Os quadrinhos com receita, despesas, EBITDA…" },
  { id: "tendencia", nome: "Resultado mês a mês", descricao: "Gráfico dos últimos 6 meses" },
  { id: "atencao", nome: "Pede atenção", descricao: "Alertas automáticos e pontos positivos do período" },
  { id: "caixa", nome: "Do lucro ao caixa", descricao: "Uma frase explicando por que o caixa difere do lucro" },
  { id: "orcamento", nome: "Orçamento", descricao: "Receita e resultado contra o orçado (quando houver)" },
  { id: "apresentacao", nome: "Última apresentação", descricao: "Atalho para a apresentação mais recente" },
];

// Quadrinhos possíveis (`metrica` = a chave na comparação de analyze()).
export const NUMEROS = [
  { id: "receita", nome: "Receita líquida", metrica: "receita" },
  { id: "despesas", nome: "Despesas operacionais", metrica: "despesas" },
  { id: "ebitda", nome: "EBITDA", metrica: "ebitda" },
  { id: "caixa", nome: "Caixa no fim", metrica: "caixa" },
  { id: "lucroBruto", nome: "Lucro bruto", metrica: "lucroBruto" },
  { id: "margem", nome: "Margem líquida", metrica: "margemLiquida" },
  { id: "custos", nome: "Custos", metrica: "custos" },
  { id: "receitaBruta", nome: "Receita bruta", metrica: "receitaBruta" },
];

// Os quadrinhos possíveis com os valores do período (facts/cmp de
// analyze()): { id: { id, label, value, sub, metric } }. Vazio sem facts.
export function tilesDoResumo(facts, cmp) {
  if (!facts) return {};
  const daReceita = (valor) => (facts.receitaLiquida > 0.5 ? `${fmtPct(valor)} da receita` : "");
  return {
    receita: { id: "receita", label: "Receita líquida", value: compactValue(facts.receitaLiquida, "money"), metric: cmp?.receita },
    despesas: { id: "despesas", label: "Despesas operacionais", value: compactValue(Math.abs(facts.despesasOp), "money"), metric: cmp?.despesas },
    ebitda: { id: "ebitda", label: "EBITDA", value: compactValue(facts.ebitda, "money"), sub: daReceita(facts.margemEbitda), metric: cmp?.ebitda },
    caixa: { id: "caixa", label: "Caixa no fim", value: compactValue(facts.caixa.end, "money"), metric: cmp?.caixa },
    lucroBruto: { id: "lucroBruto", label: "Lucro bruto", value: compactValue(facts.lucroBruto, "money"), sub: daReceita(facts.margemBruta), metric: cmp?.lucroBruto },
    margem: { id: "margem", label: "Margem líquida", value: fmtPct(facts.margemLiquida), metric: cmp?.margemLiquida },
    custos: { id: "custos", label: "Custos", value: compactValue(Math.abs(facts.custos), "money"), metric: cmp?.custos },
    receitaBruta: { id: "receitaBruta", label: "Receita bruta", value: compactValue(facts.receitaBruta, "money"), metric: cmp?.receitaBruta },
  };
}

// Os tipos de alerta de analyze() (lib/assistant/analysis.js). `tecnico`:
// coisa de conferência contábil, que não faz sentido pro cliente.
export const ALERTAS = [
  { id: "prejuizo", nome: "Prejuízo no período" },
  { id: "margem_apertada", nome: "Margem apertada / abaixo da meta" },
  { id: "ebitda_negativo", nome: "Operação não se paga (EBITDA negativo)" },
  { id: "lucro_fora_operacao", nome: "Lucro veio de fora da operação" },
  { id: "caixa_caiu", nome: "Caixa caiu no período" },
  { id: "lucro_sem_caixa", nome: "Lucro não virou caixa" },
  { id: "folego_curto", nome: "Fôlego de caixa curto" },
  { id: "liquidez_baixa", nome: "Liquidez baixa" },
  { id: "capital_giro_negativo", nome: "Capital de giro negativo" },
  { id: "descasamento_prazos", nome: "Recebe depois de pagar" },
  { id: "prazo_recebimento", nome: "Prazo de recebimento longo" },
  { id: "estoque_subiu", nome: "Estoques subiram" },
  { id: "endividamento_alto", nome: "Endividamento elevado" },
  { id: "divida_curto_prazo", nome: "Obrigações concentradas no curto prazo" },
  { id: "divida_ebitda", nome: "Dívida alta para a geração de caixa" },
  { id: "juros_pesados", nome: "Juros pesando no resultado" },
  { id: "distribuicoes_pagar", nome: "Distribuições a pagar pesam" },
  { id: "pl_negativo", nome: "Patrimônio líquido negativo" },
  { id: "receita_caindo", nome: "Receita em queda" },
  { id: "despesa_cresce", nome: "Despesas crescendo mais que a receita" },
  { id: "despesa_concentrada", nome: "Uma despesa pesa muito" },
  { id: "receita_concentrada", nome: "Receita concentrada" },
  { id: "lucro_oscila", nome: "Resultado oscilando / meses no prejuízo" },
  { id: "abaixo_equilibrio", nome: "Abaixo do ponto de equilíbrio / pouca folga" },
  { id: "orcamento", nome: "Orçamento e projeção do ano" },
  { id: "comparativo", nome: "Piora contra o período de comparação" },
  { id: "balanco_nao_fecha", nome: "Balanço não fecha", tecnico: true },
  { id: "sem_depara", nome: "Contas sem De/Para", tecnico: true },
  { id: "pme_estranho", nome: "Estoque alto para o custo apurado (CMV)", tecnico: true },
];

// Os pontos positivos de analyze() (o lado bom do "Pede atenção").
export const POSITIVOS = [
  { id: "lucro", nome: "Período no lucro / lucro com boa margem" },
  { id: "ebitda", nome: "Operação gera caixa (EBITDA)" },
  { id: "margem_bruta", nome: "Margem bruta forte" },
  { id: "receita_cresce", nome: "Receita em alta" },
  { id: "caixa_subiu", nome: "Caixa cresceu" },
  { id: "conversao", nome: "Lucro virando caixa" },
  { id: "liquidez", nome: "Folga no curto prazo" },
  { id: "endividamento", nome: "Endividamento baixo" },
  { id: "caixa_liquido", nome: "Caixa maior que a dívida" },
  { id: "financeiro", nome: "Resultado financeiro positivo" },
  { id: "pmr", nome: "Recebimento rápido" },
  { id: "equilibrio", nome: "Folga sobre o ponto de equilíbrio" },
  { id: "roe", nome: "Bom retorno para os sócios (ROE)" },
  { id: "melhor_mes", nome: "Fechou no melhor mês" },
  { id: "pl_cresceu", nome: "Patrimônio cresceu" },
  { id: "metas_ok", nome: "Indicadores dentro das metas" },
  { id: "orcamento", nome: "Dentro do orçamento / projeção" },
  { id: "comparativo", nome: "Melhora contra o período de comparação" },
];

// Alguns tipos agrupam mais de um alerta de analyze() (mesmo assunto).
const GRUPO_DO_ALERTA = {
  meses_negativos: "lucro_oscila",
  margem_seguranca: "abaixo_equilibrio",
  orc_receita: "orcamento",
  orc_despesas: "orcamento",
  orc_resultado: "orcamento",
  projecao_prejuizo: "orcamento",
  projecao_orcado: "orcamento",
  cmp_receita: "comparativo",
  cmp_lucro: "comparativo",
  cmp_margem: "comparativo",
  cmp_despesas: "comparativo",
};
export const tipoDoAlerta = (id) => GRUPO_DO_ALERTA[id] || id;
// Os positivos usam os mesmos agrupamentos (orc_*, projecao_*, cmp_*).
export const tipoDoPositivo = tipoDoAlerta;

const TECNICOS = new Set(ALERTAS.filter((item) => item.tecnico).map((item) => item.id));

export const PADRAO = {
  ordem: BLOCOS.map((bloco) => bloco.id),
  ocultos: [],
  numeros: ["receita", "despesas", "ebitda", "caixa"],
  maxAlertas: 3,
  positivos: true,
  maxPositivos: 2,
  alertasOcultos: [],
  positivosOcultos: [],
  tecnicosSoEquipe: true,
  recado: "",
};

const idsDe = (lista) => new Set(lista.map((item) => item.id));
const BLOCO_IDS = idsDe(BLOCOS);
const NUMERO_IDS = idsDe(NUMEROS);
const ALERTA_IDS = idsDe(ALERTAS);
const POSITIVO_IDS = idsDe(POSITIVOS);
const soValidos = (lista, validos) => [...new Set((Array.isArray(lista) ? lista : []).filter((id) => validos.has(id)))];

// O que vale para a tela: o salvo por cima do padrão, sem ids estranhos.
// Bloco novo (que não existia quando a config foi salva) entra na posição
// padrão dele, visível.
export function configResumo(salvo) {
  const s = salvo && typeof salvo === "object" ? salvo : {};
  const ordem = soValidos(s.ordem, BLOCO_IDS);
  PADRAO.ordem.forEach((id, posicao) => {
    if (ordem.includes(id)) return;
    const antes = PADRAO.ordem.slice(0, posicao).filter((item) => ordem.includes(item));
    const ancora = antes.length ? ordem.indexOf(antes[antes.length - 1]) + 1 : 0;
    ordem.splice(ancora, 0, id);
  });
  const numeros = Array.isArray(s.numeros) ? soValidos(s.numeros, NUMERO_IDS).slice(0, 6) : PADRAO.numeros;
  const max = Number(s.maxAlertas);
  const maxPos = Number(s.maxPositivos);
  return {
    ordem,
    ocultos: soValidos(s.ocultos, BLOCO_IDS),
    numeros,
    maxAlertas: Number.isFinite(max) ? Math.min(6, Math.max(1, Math.round(max))) : PADRAO.maxAlertas,
    positivos: s.positivos !== false,
    maxPositivos: Number.isFinite(maxPos) ? Math.min(6, Math.max(1, Math.round(maxPos))) : PADRAO.maxPositivos,
    alertasOcultos: soValidos(s.alertasOcultos, ALERTA_IDS),
    positivosOcultos: soValidos(s.positivosOcultos, POSITIVO_IDS),
    tecnicosSoEquipe: s.tecnicosSoEquipe !== false,
    recado: String(s.recado || "").slice(0, 500),
  };
}

// Os blocos na ordem, só os visíveis (o recado só com texto).
export function blocosVisiveis(config) {
  return config.ordem.filter((id) => !config.ocultos.includes(id) && (id !== "recado" || config.recado.trim()));
}

// Os alertas que aparecem: tira os tipos escondidos e — para o cliente —
// os técnicos; ordena pela gravidade e corta no máximo. Para a equipe, um
// alerta técnico que o cliente não vê vem marcado com `soEquipe`.
export function alertasDoResumo(analysis, config, { equipe = false } = {}) {
  const ocultos = new Set(config.alertasOcultos);
  const alertas = (analysis?.alerts || [])
    .filter((alerta) => !ocultos.has(tipoDoAlerta(alerta.id)))
    .filter((alerta) => equipe || !config.tecnicosSoEquipe || !TECNICOS.has(alerta.id))
    .map((alerta) => (config.tecnicosSoEquipe && TECNICOS.has(alerta.id) ? { ...alerta, soEquipe: true } : alerta))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, config.maxAlertas);
  const positivosOcultos = new Set(config.positivosOcultos);
  const positivos = config.positivos ? (analysis?.positives || []).filter((item) => !positivosOcultos.has(tipoDoPositivo(item.id))).slice(0, config.maxPositivos) : [];
  return { alertas, positivos };
}

// Pro painel de configuração: TODAS as análises que o período gerou (não só
// as que aparecem), cada uma com o motivo de estar fora quando estiver —
// é nesta lista que a equipe marca o que o cliente vê.
export function analisesDoPeriodo(analysis, config) {
  const visiveis = alertasDoResumo(analysis, config, { equipe: false });
  const naTela = new Set([...visiveis.alertas.map((item) => `a:${item.id}`), ...visiveis.positivos.map((item) => `p:${item.id}`)]);
  const alertas = [...(analysis?.alerts || [])]
    .sort((a, b) => b.severity - a.severity)
    .map((item) => {
      const tipo = tipoDoAlerta(item.id);
      const escondido = config.alertasOcultos.includes(tipo);
      const tecnico = config.tecnicosSoEquipe && TECNICOS.has(item.id);
      return { ...item, tipo, marcado: !escondido, aparece: naTela.has(`a:${item.id}`), motivo: escondido ? "" : tecnico ? "só a equipe vê" : naTela.has(`a:${item.id}`) ? "" : `não cabe: limite de ${config.maxAlertas} alertas` };
    });
  const positivos = (analysis?.positives || []).map((item) => {
    const tipo = tipoDoPositivo(item.id);
    const escondido = config.positivosOcultos.includes(tipo);
    return { ...item, tipo, marcado: !escondido, aparece: naTela.has(`p:${item.id}`), motivo: escondido ? "" : !config.positivos ? "pontos positivos desligados" : naTela.has(`p:${item.id}`) ? "" : `não cabe: limite de ${config.maxPositivos} positivos` };
  });
  return { alertas, positivos };
}

// A config que vai pra outra empresa ao replicar: a mesma, mas com o recado
// dela mesma (o atual daquela empresa) — a não ser que peçam pra levar o
// recado também.
export function configParaReplicar(origem, atualDoDestino, { levarRecado = false } = {}) {
  const recado = levarRecado ? configResumo(origem).recado : configResumo(atualDoDestino).recado;
  return paraGravar({ ...configResumo(origem), recado });
}

// Pra gravar: só o que difere do padrão (null = tudo no padrão).
export function paraGravar(config) {
  const c = configResumo(config);
  const out = {};
  Object.keys(PADRAO).forEach((chave) => {
    if (JSON.stringify(c[chave]) !== JSON.stringify(PADRAO[chave])) out[chave] = c[chave];
  });
  return Object.keys(out).length ? out : null;
}
