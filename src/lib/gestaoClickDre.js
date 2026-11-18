import { supabase } from "./supabaseClient.js";

// DRE Gerencial (grupo Anjos): totais mensais por Plano de contas vindos do Gestão Click (tabela gestaoclick_dre; a Central manda só o que foi VALIDADO lá).
// Cada ano de cada empresa: dados.meses["1".."12"] = { receita, vendas, qtdVendas, pagamentos: { plano: valor }, recebimentos: { plano: valor }, parcial, coletadoEm }.
export async function fetchGestaoClickDre(companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase.from("gestaoclick_dre").select("ano, dados, synced_at").eq("company_id", companyId).order("ano", { ascending: false });
  if (error) throw error;
  return data || [];
}

const norm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Estrutura da DRE = a mesma da planilha gerencial das lojas (validada contra o Gestão Click em jan–out/2026, 50 meses). Os nomes das linhas são os planos de contas
// do Gestão Click. Despesas entram NEGATIVAS (como na planilha).
export const GRUPOS = [
  { id: "variaveis", nome: "Custos variáveis", linhas: ["Compras", "Compra antecipada", "Impostos - Simples Nacional", "Impostos GRPR", "Frete sobre compra", "Frete sobre venda", "Comissão de vendedores"] },
  {
    id: "fixas",
    nome: "Custos e despesas fixas",
    linhas: [
      "Aluguel", "Combustivel e translados", "Assessorias e associações", "Contabilidade", "Encargos funcionários - alimentação", "Encargos funcionários - assist. médica e odontol.",
      "Encargos funcionários - exames pré e demissionais", "Encargos funcionários - FGTS", "Encargos funcionários - INSS", "Encargos funcionários - vale transporte", "Encargos - rescisões trabalhistas",
      "Manutenção equipamentos", "Marketing e publicidade", "Material de escritório", "Remuneração funcionários", "Segurança", "Telefonia e internet", "Transportadora", "Serviço Tomado",
      "Uso e consumo", "Doações", "Seguro", "Fretes", "Taxas e Contribuições", "Cartão de credito", "Condomínio", "Comissão de Arquiteto", "Sindicato", "Reembolso", "Compra de carro",
      "Despesas bancárias", "Confraternizações", "Cursos e treinamentos", "Energia elétrica + água", "Impostos - IPTU", "Licença ou aluguel de softwares", "Limpeza", "Supermercado",
      "Estorno de vendas", "Encargos funcionários - Férias", "Certificado Digital", "Hospedagem", "ISS TOMADOS", "JUROS", "Encargos funcionários - horas extras", "Devolução de vendas",
      "Evento", "Taxa de Cartão", "Encargos - IRRF", "Troco produtos vendidos", "Ajuda de Custo", "Patrocínios",
    ],
  },
  { id: "financiamento", nome: "Financiamento", linhas: ["Retirada de Sócios", "Empréstimos"] },
  { id: "outras", nome: "Outras receitas / despesas", linhas: ["Adiantamento - funcionários", "Bonificação"] },
];
// Rendimento de aplicação vem dos RECEBIMENTOS do fluxo de caixa (plano "Aplicações financeiras"); o resto da DRE vem dos pagamentos.
const INVESTIMENTO = "Aplicações financeiras";
// Mesmo plano com outro nome em lojas diferentes (conferido: somam igual, ao centavo)
const ALIAS = { [norm("Empréstimos Bancários")]: "Empréstimos" };
// Decisão do Izaias (18/11/2026): o que a planilha nunca usou vai numa linha "Fora da DRE".
//  - movimentações internas (dinheiro que só muda de lugar): fora do resultado;
//  - despesas de verdade sem linha na DRE: aparecem como "Despesas não classificadas", abaixo do resultado.
export const INTERNAS = ["Retirada banco", "Ajuste de caixa", "Transferências"];
export const NAO_CLASSIFICADAS = ["Despesas financeiras", "Despesas a identificar", "Outras despesas", "Despesas administrativas e comerciais"];

const INDICE = new Map();
for (const g of GRUPOS) for (const l of g.linhas) INDICE.set(norm(l), { grupo: g.id, nome: l });
const SET_INTERNAS = new Set(INTERNAS.map(norm));
const SET_NAOCLASS = new Set(NAO_CLASSIFICADAS.map(norm));

const zeros = () => Array(12).fill(0);
const soma = (arrs) => arrs.reduce((s, a) => s.map((v, i) => v + (a?.[i] || 0)), zeros());

/**
 * Junta os meses (um ou mais membros = empresa ou grupo) e devolve a DRE:
 *  linhas: receita, grupos (com as linhas de despesa), subtotais, resultado, fora da DRE — cada um com `v` (12 meses, só os de mesDe..mesAte) e `t` (total).
 *  meses: por mês, quantas lojas têm dado e se o mês é parcial (ainda aberto).
 */
export function montarDre({ membros, brutos, ano, mesDe, mesAte }) {
  const receita = zeros();
  const invest = zeros();
  const porLinha = new Map(); // norm(nome) -> { nome, grupo, v }
  const internas = new Map();
  const naoClass = new Map();
  const naoMapeados = new Map();
  const meses = Array.from({ length: 12 }, () => ({ lojas: 0, parcial: false }));
  const add = (mapa, chave, nome, i, valor, extra = {}) => {
    const x = mapa.get(chave) || { nome, v: zeros(), ...extra };
    x.v[i] += valor;
    mapa.set(chave, x);
  };

  for (const membro of membros) {
    const linhaAno = (brutos?.[membro.id] || []).find((item) => item.ano === ano);
    const dm = linhaAno?.dados?.meses || {};
    for (const [mesTxt, m] of Object.entries(dm)) {
      const mes = Number(mesTxt);
      if (mes < mesDe || mes > mesAte) continue;
      const i = mes - 1;
      meses[i].lojas += 1;
      if (m.parcial) meses[i].parcial = true;
      receita[i] += Number(m.receita) || 0;
      for (const [plano, valor] of Object.entries(m.recebimentos || {})) if (norm(plano) === norm(INVESTIMENTO)) invest[i] += Number(valor) || 0;
      for (const [plano, valorBruto] of Object.entries(m.pagamentos || {})) {
        const valor = Number(valorBruto) || 0;
        const chave = norm(plano);
        if (chave === norm(INVESTIMENTO)) { invest[i] -= valor; continue; }
        const destino = INDICE.get(ALIAS[chave] ? norm(ALIAS[chave]) : chave);
        if (destino) add(porLinha, norm(destino.nome), destino.nome, i, -valor, { grupo: destino.grupo });
        else if (SET_INTERNAS.has(chave)) add(internas, chave, plano, i, -valor);
        else if (SET_NAOCLASS.has(chave)) add(naoClass, chave, plano, i, -valor);
        else add(naoMapeados, chave, plano, i, -valor); // plano novo no Gestão Click: aparece avisado, nunca some
      }
    }
  }

  const corta = (v) => v.map((x, i) => (i + 1 >= mesDe && i + 1 <= mesAte ? x : 0));
  const total = (v) => v.reduce((s, x) => s + x, 0);
  const grupos = GRUPOS.map((g) => {
    const linhas = g.linhas.map((nome) => porLinha.get(norm(nome))).filter((l) => l && total(l.v) !== 0).map((l) => ({ nome: l.nome, v: corta(l.v), t: total(l.v) }));
    const v = soma(linhas.map((l) => l.v));
    return { id: g.id, nome: g.nome, v, t: total(v), linhas };
  });
  const gv = (id) => grupos.find((g) => g.id === id).v;
  const margem = soma([receita, gv("variaveis")]);
  const operacional = soma([margem, gv("fixas")]);
  const resultado = soma([operacional, invest, gv("financiamento"), gv("outras")]);
  const fora = {
    internas: [...internas.values()].map((l) => ({ nome: l.nome, v: corta(l.v), t: total(l.v) })).sort((a, b) => a.t - b.t),
    naoClass: [...naoClass.values()].map((l) => ({ nome: l.nome, v: corta(l.v), t: total(l.v) })).sort((a, b) => a.t - b.t),
    naoMapeados: [...naoMapeados.values()].map((l) => ({ nome: l.nome, v: corta(l.v), t: total(l.v) })).sort((a, b) => a.t - b.t),
  };
  const naoClassTotal = soma(fora.naoClass.map((l) => l.v));
  const t = (v) => total(corta(v));
  return {
    meses,
    receita: { v: corta(receita), t: t(receita) },
    variaveis: grupos[0],
    margem: { v: corta(margem), t: t(margem) },
    fixas: grupos[1],
    operacional: { v: corta(operacional), t: t(operacional) },
    investimento: { v: corta(invest), t: t(invest) },
    financiamento: grupos[2],
    outras: grupos[3],
    resultado: { v: corta(resultado), t: t(resultado) },
    fora,
    resultadoAposNaoClass: { v: corta(soma([resultado, naoClassTotal])), t: t(soma([resultado, naoClassTotal])) },
    internasTotal: (() => { const v = soma(fora.internas.map((l) => l.v)); return { v, t: total(v) }; })(),
    temDados: meses.some((m) => m.lojas > 0),
  };
}
