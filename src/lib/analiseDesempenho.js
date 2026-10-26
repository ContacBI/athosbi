import { directChildren } from "./reportTree.js";

// Análise de desempenho (o que mais pesa no faturamento): o cálculo, usado pela página (pages/AnaliseDesempenho.jsx) e pelos widgets do B.I./slides.
// Base = receita bruta do período do contexto (ctx do painel). Despesa é negativa na DRE; aqui vira "consumo" positivo da receita.
export const DEPARTAMENTOS = [
  { code: "DRE.04", curto: "Custos", nome: "Custos", cor: "#2563eb" },
  { code: "DRE.06", curto: "Comerciais", nome: "Despesas comerciais", cor: "#0891b2" },
  { code: "DRE.07", curto: "Administrativas", nome: "Despesas administrativas", cor: "#7c3aed" },
  { code: "DRE.08", curto: "Tributos op.", nome: "Tributos e provisões operacionais", cor: "#f59e0b" },
  { code: "DRE.09", curto: "Indedutíveis", nome: "Despesas indedutíveis", cor: "#dc2626" },
  { code: "DRE.10", curto: "Outros result.", nome: "Outros resultados operacionais", cor: "#64748b" },
  { code: "DRE.12", curto: "Deprec.", nome: "Depreciação e amortização", cor: "#84cc16" },
  { code: "DRE.14", curto: "Financeiro", nome: "Resultado financeiro", cor: "#14b8a6" },
  { code: "DRE.15", curto: "Não operac.", nome: "Resultados não operacionais", cor: "#a855f7" },
  { code: "DRE.17", curto: "IRPJ/CSLL", nome: "IRPJ e CSLL", cor: "#ea580c" },
];
export const COR_DEDUCOES = "#db2777";
export const COR_RESULTADO = "#16a34a";
export const COR_RECEITA = "#2563eb";

export function corDoDepto(code) {
  return DEPARTAMENTOS.find((d) => code === d.code || code.startsWith(`${d.code}.`))?.cor || (code.startsWith("DRE.02") ? COR_DEDUCOES : "#64748b");
}

// "Está pesando mais?": % da receita no último mês com receita contra a média dos meses anteriores do período.
export function tendencia(pctMeses) {
  const validos = pctMeses.map((v, i) => ({ v, i })).filter((p) => p.v != null);
  if (validos.length < 3) return null;
  const ultimo = validos[validos.length - 1].v;
  const anteriores = validos.slice(0, -1).map((p) => p.v);
  const media = anteriores.reduce((t, v) => t + v, 0) / anteriores.length;
  return { ultimo, media, delta: ultimo - media };
}

export function montarAnalise(ctx) {
  if (!ctx) return null;
  const dre = ctx.dre || [];
  const meses = ctx.months || [];
  const porCodigo = new Map(dre.map((row) => [row.codigo_gerencial, row]));
  const serie = (row) => meses.map((m) => Number(row?.monthValues?.[m] || 0));
  const receitaRow = porCodigo.get("DRE.01");
  const receita = Number(receitaRow?.saldo || 0);
  const receitaMes = serie(receitaRow);
  const valorPeriodo = (row) => {
    const mv = serie(row);
    return meses.length ? mv.reduce((t, v) => t + v, 0) : Number(row?.saldo || 0);
  };
  const pctMeses = (row) => serie(row).map((v, i) => (receitaMes[i] ? (-v / receitaMes[i]) * 100 : null));
  const montar = (row, extra = {}) => {
    const consumo = -valorPeriodo(row);
    return {
      code: row.codigo_gerencial,
      nome: row.categoria_gerencial || row.nome || row.codigo_gerencial,
      consumo,
      pct: receita ? (consumo / receita) * 100 : null,
      pctMeses: pctMeses(row),
      tend: tendencia(pctMeses(row)),
      row,
      ...extra,
    };
  };
  const deptos = DEPARTAMENTOS.map((d) => {
    const row = porCodigo.get(d.code);
    return row ? montar(row, { nome: d.nome, curto: d.curto, cor: d.cor }) : null;
  }).filter((d) => d && Math.abs(d.consumo) >= 0.005);
  const deducoesRow = porCodigo.get("DRE.02");
  const deducoes = deducoesRow ? montar(deducoesRow, { nome: "Deduções da receita bruta", cor: COR_DEDUCOES }) : null;
  const resultadoRow = porCodigo.get("DRE.18");
  const resultado = resultadoRow ? valorPeriodo(resultadoRow) : 0;
  return { dre, meses, porCodigo, receita, receitaMes, deptos, deducoes, resultado, montar, valorPeriodo, pctMeses };
}

// Cascata: receita bruta (100%) → deduções → cada departamento (do maior pro menor) → resultado.
export function cascataDeDepartamentos(dados) {
  const { receita, deptos, deducoes, resultado } = dados;
  const ordenados = [...deptos].sort((a, b) => b.consumo - a.consumo);
  const passos = [];
  let corrente = 100;
  const deducoesPct = deducoes?.pct || 0;
  if (deducoes && Math.abs(deducoes.consumo) >= 0.005) {
    corrente -= deducoesPct;
    passos.push({ nome: "Deduções", completo: "Deduções da receita bruta", code: "DRE.02", base: corrente, valor: deducoesPct, cor: COR_DEDUCOES, pct: deducoesPct, consumo: deducoes.consumo });
  }
  ordenados.forEach((d) => {
    const p = d.pct || 0;
    if (p >= 0) {
      corrente -= p;
      passos.push({ nome: d.curto || d.nome, completo: d.nome, code: d.code, base: Math.max(corrente, 0), valor: p, cor: d.cor, pct: p, consumo: d.consumo });
    } else {
      passos.push({ nome: d.curto || d.nome, completo: d.nome, code: d.code, base: Math.max(corrente, 0), valor: -p, cor: "#10b981", pct: p, consumo: d.consumo, ganho: true });
      corrente -= p;
    }
  });
  return [
    { nome: "Receita bruta", completo: "Receita bruta", code: null, base: 0, valor: 100, cor: COR_RECEITA, pct: 100, consumo: receita },
    ...passos,
    { nome: "Resultado", completo: "Resultado do período", code: null, base: 0, valor: Math.max((resultado / receita) * 100, 0), cor: COR_RESULTADO, pct: (resultado / receita) * 100, consumo: resultado },
  ];
}

// Itens (linhas analíticas do DRE) que mais pesam, com % acumulado (Pareto). `foco` limita a um departamento/grupo.
export function itensPareto(dados, { foco = null, limite = 20 } = {}) {
  const { dre, deptos, porCodigo, montar, valorPeriodo } = dados;
  const raizes = foco ? [foco] : ["DRE.02", ...deptos.map((d) => d.code)];
  const folhas = dre
    .filter((row) => !row.hasSyntheticChildren && raizes.some((r) => row.codigo_gerencial === r || row.codigo_gerencial.startsWith(`${r}.`)) && Math.abs(valorPeriodo(row)) >= 0.005)
    .map((row) => montar(row, { cor: corDoDepto(row.codigo_gerencial), grupoNome: porCodigo.get(row.codigo_gerencial.split(".").slice(0, -1).join("."))?.categoria_gerencial || "" }))
    .filter((f) => f.consumo > 0.005)
    .sort((a, b) => b.consumo - a.consumo);
  const total = folhas.reduce((t, f) => t + f.consumo, 0);
  let acumulado = 0;
  const lista = folhas.slice(0, limite).map((f) => {
    acumulado += f.consumo;
    return { ...f, acum: total ? (acumulado / total) * 100 : 0 };
  });
  return { folhas, lista, total, corte80: lista.findIndex((f) => f.acum >= 80) };
}

// Linhas analíticas das deduções da receita bruta (Simples/DAS, ISS, PIS, COFINS, abatimentos…).
export function folhasDeDeducoes(dados) {
  const { dre, porCodigo, montar, valorPeriodo } = dados;
  return dre
    .filter((row) => !row.hasSyntheticChildren && row.codigo_gerencial.startsWith("DRE.02.") && Math.abs(valorPeriodo(row)) >= 0.005)
    .map((row) => montar(row, { cor: COR_DEDUCOES, grupoNome: porCodigo.get(row.codigo_gerencial.split(".").slice(0, -1).join("."))?.categoria_gerencial || "" }))
    .sort((a, b) => b.consumo - a.consumo);
}

export { directChildren };
