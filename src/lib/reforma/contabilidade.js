import { readCompanyJournal } from "../persistence.js";
import { novoId } from "./calculo.js";

// "Trazer da contabilidade": ponto de partida da simulação a partir dos
// lançamentos da empresa no B.I. — média mensal dos últimos 12 meses com
// movimento, agrupada pelas linhas do plano gerencial (DRE). Vendas por
// tipo de receita, compras/despesas que geram crédito e as alíquotas
// efetivas de hoje (tributo ÷ receita). Folha de pagamento fica de fora:
// não gera crédito nem paga IBS/CBS.

const VENDAS = [
  { prefixos: ["DRE.01.01"], descricao: "Venda de mercadorias", tipo: "mercadoria" },
  { prefixos: ["DRE.01.02"], descricao: "Venda de produtos fabricados", tipo: "mercadoria", industria: true },
  { prefixos: ["DRE.01.03"], descricao: "Prestação de serviços", tipo: "servico" },
  { prefixos: ["DRE.01.04"], descricao: "Locações, assinaturas e outras receitas", tipo: "servico" },
];

const TRIBUTOS = {
  pis: "DRE.02.01.01.01",
  cofins: "DRE.02.01.01.02",
  ipi: "DRE.02.01.01.03",
  das: "DRE.02.01.01.04",
  icms: "DRE.02.01.02.01",
  iss: "DRE.02.01.03.01",
};

// Ordem importa: o primeiro grupo cujo prefixo casar fica com o valor.
const COMPRAS = [
  { prefixos: ["DRE.04.01.02", "DRE.04.01.05"], descricao: "Compras de mercadorias e fretes", tipo: "mercadoria" },
  { prefixos: ["DRE.04.02.01"], descricao: "Matéria-prima e insumos", tipo: "insumo" },
  { prefixos: ["DRE.04.02.03.02", "DRE.07.02.02.01"], descricao: "Energia elétrica", tipo: "energia", aliquota: 18, creditoIcms: false },
  { prefixos: ["DRE.07.02.02.03"], descricao: "Telefone e internet", tipo: "energia", aliquota: 18, creditoIcms: false },
  { prefixos: ["DRE.07.02.01.01"], descricao: "Aluguel de imóvel", tipo: "aluguel", categoria: "red70" },
  { prefixos: ["DRE.07.02.01"], descricao: "Aluguel de equipamentos", tipo: "aluguel" },
  { prefixos: ["DRE.04.03.05", "DRE.07.03.01"], descricao: "Softwares e licenças", tipo: "servico", aliquota: 3 },
  {
    prefixos: ["DRE.04.02.04", "DRE.04.02.03.03", "DRE.04.03.02.01", "DRE.04.03.02.02", "DRE.07.02.03", "DRE.07.03.03", "DRE.07.04", "DRE.06.02.01", "DRE.07.07.04.04", "DRE.07.06.02.03", "DRE.06.03.03"],
    descricao: "Serviços de terceiros, manutenção e publicidade",
    tipo: "servico",
    aliquota: 5,
  },
  { prefixos: ["DRE.06.03.01", "DRE.07.07.04.09", "DRE.04.03.04", "DRE.06.03.01.02"], descricao: "Fretes e transportes", tipo: "outros", aliquota: 12 },
  { prefixos: ["DRE.07.06.02.01"], descricao: "Combustíveis", tipo: "outros", aliquota: 18 },
  { prefixos: ["DRE.04.03.03", "DRE.07.05", "DRE.06.02.02"], descricao: "Materiais de uso e consumo", tipo: "outros", aliquota: 18 },
];

const casa = (codigo, prefixo) => codigo === prefixo || codigo.startsWith(`${prefixo}.`);
const arredonda = (valor, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;

export async function dadosDaContabilidade(company, { meses = 12 } = {}) {
  const journal = await readCompanyJournal(company.id);
  if (!journal.length) return null;
  const destino = new Map((company.mappings || []).map((row) => [row.classificacao, row.codigo_gerencial]));
  const todosMeses = [...new Set(journal.map((entry) => String(entry.data || "").slice(0, 7)).filter(Boolean))].sort();
  const usados = todosMeses.slice(-meses);
  const naJanela = new Set(usados);
  // Débito − crédito por linha gerencial (receita sai negativa).
  const porCodigo = new Map();
  journal.forEach((entry) => {
    if (!naJanela.has(String(entry.data || "").slice(0, 7))) return;
    const codigo = entry.codigo_gerencial || destino.get(entry.classificacao);
    if (!codigo) return;
    porCodigo.set(codigo, (porCodigo.get(codigo) || 0) + (Number(entry.debito) || 0) - (Number(entry.credito) || 0));
  });
  const n = Math.max(1, usados.length);
  const total = (prefixos) => [...porCodigo].reduce((soma, [codigo, valor]) => (prefixos.some((prefixo) => casa(codigo, prefixo)) ? soma + valor : soma), 0) / n;

  const tributos = Object.fromEntries(Object.entries(TRIBUTOS).map(([nome, prefixo]) => [nome, Math.max(0, total([prefixo]))]));
  const vendasBrutas = VENDAS.map((grupo) => ({ ...grupo, valor: Math.max(0, -total(grupo.prefixos)) })).filter((grupo) => grupo.valor >= 1);
  const receitaTotal = vendasBrutas.reduce((soma, grupo) => soma + grupo.valor, 0);
  const receitaBens = vendasBrutas.filter((grupo) => grupo.tipo === "mercadoria").reduce((soma, grupo) => soma + grupo.valor, 0);
  const receitaServicos = receitaTotal - receitaBens;
  const receitaIndustria = vendasBrutas.filter((grupo) => grupo.industria).reduce((soma, grupo) => soma + grupo.valor, 0);
  const icms = receitaBens > 0 ? arredonda((100 * tributos.icms) / receitaBens) : 0;
  const iss = receitaServicos > 0 ? arredonda((100 * tributos.iss) / receitaServicos) : 0;
  const ipi = receitaIndustria > 0 ? arredonda((100 * tributos.ipi) / receitaIndustria) : 0;
  const pisCofins = receitaTotal > 0 ? (100 * (tributos.pis + tributos.cofins)) / receitaTotal : 0;
  const regime = tributos.das > 0 ? "simples" : pisCofins > 4.5 ? "real" : "presumido";

  const vendas = vendasBrutas.map((grupo) => ({
    id: novoId("v"),
    descricao: `${grupo.descricao} (contabilidade)`,
    tipo: grupo.tipo,
    codigo: "",
    receita: arredonda(grupo.valor),
    b2b: 50,
    icms: grupo.tipo === "mercadoria" ? icms : 0,
    iss: grupo.tipo === "servico" ? iss : 0,
    ipi: grupo.industria ? ipi : 0,
    pisCofins: "normal",
    icmsSt: false,
    categoria: "padrao",
    seletivo: 0,
  }));
  // Mercadoria/insumo: ICMS da compra estimado pelo das vendas (sem outro
  // dado na contabilidade) — a tela pede pra conferir.
  const compras = [];
  const jaUsado = new Set();
  COMPRAS.forEach((grupo) => {
    const codigos = [...porCodigo.keys()].filter((codigo) => !jaUsado.has(codigo) && grupo.prefixos.some((prefixo) => casa(codigo, prefixo)));
    const valor = codigos.reduce((soma, codigo) => soma + porCodigo.get(codigo), 0) / n;
    codigos.forEach((codigo) => jaUsado.add(codigo));
    if (valor < 1) return;
    compras.push({
      id: novoId("c"),
      descricao: `${grupo.descricao} (contabilidade)`,
      tipo: grupo.tipo,
      valor: arredonda(valor),
      fornecedor: "normal",
      aliquota: grupo.aliquota ?? (icms || 12),
      ipi: 0,
      creditoIcms: grupo.creditoIcms ?? ["mercadoria", "insumo"].includes(grupo.tipo),
      creditoPisCofins: true,
      categoria: grupo.categoria || "padrao",
    });
  });
  return {
    meses: usados,
    regime,
    rbt12: arredonda(receitaTotal * 12),
    vendas,
    compras,
    aliquotas: { icms, iss, ipi, pisCofins: arredonda(pisCofins), das: receitaTotal > 0 ? arredonda((100 * tributos.das) / receitaTotal) : 0 },
  };
}
