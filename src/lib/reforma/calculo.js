// Motor de cálculo da simulação da Reforma Tributária — puro (sem React nem
// Supabase), testado em node (scripts/test-reforma.mjs).
//
// Valores MENSAIS em R$. A comparação parte de uma premissa só, explícita
// na tela: cada empresa da cadeia mantém o seu valor SEM tributos sobre
// consumo ("preço neutro"). Daí sai, ano a ano:
//   • tributos sobre consumo a recolher (débitos − créditos);
//   • quanto o preço ao cliente muda pra manter a margem (consumidor final
//     e cliente empresa, que toma crédito);
//   • o efeito no resultado se o preço for mantido (absorvendo a diferença)
//     e o efeito das compras (custo líquido de créditos).
//
// Regras de hoje: ICMS, ISS e PIS/Cofins "por dentro" (no preço), IPI "por
// fora"; PIS/Cofins sem o ICMS na base (Tema 69 do STF). Reforma: CBS e IBS
// "por fora", sobre o valor sem tributos (ICMS/ISS/PIS/Cofins/IPI fora da
// base na transição). Simples: o DAS fica igual pra quem permanece; quem
// opta por recolher IBS/CBS por fora ("híbrido") tira do DAS a parte de
// PIS/Cofins (a partir de 2027) e a parte do ICMS/ISS que virou IBS.

import { ANOS, REDUCAO, aliquotasDoAno, simplesAliquota } from "./parametros.js";

const pct = (value) => (Number(value) || 0) / 100;
const num = (value) => Math.max(0, Number(value) || 0);
const TRIBUTOS_DEBITO = ["pisCofins", "icms", "iss", "ipi", "das", "cbs", "ibs", "seletivo"];
const TRIBUTOS_CREDITO = ["pisCofins", "icms", "ipi", "cbs", "ibs"];
const zeros = (campos) => Object.fromEntries(campos.map((campo) => [campo, 0]));
const soma = (obj) => Object.values(obj).reduce((total, valor) => total + valor, 0);

export function dadosIniciais() {
  return { versao: 1, regime: "presumido", rbt12: 0, anexoPadrao: "I", vendas: [], compras: [] };
}

// Ponto de partida de uma simulação nova: cópia da configuração que o
// escritório fez pra empresa (regime, Simples, produtos e compras).
export function dadosDaConfig(config) {
  const base = { ...dadosIniciais(), ...(config || {}) };
  return JSON.parse(JSON.stringify({ ...base, vendas: base.vendas || [], compras: base.compras || [] }));
}

let sequencia = 0;
export const novoId = (prefixo) => `${prefixo}_${Date.now().toString(36)}${(sequencia += 1).toString(36)}`;

// Item novo com valores de partida razoáveis (o cliente ajusta).
export function novaVenda(dados, tipo = "mercadoria") {
  return { id: novoId("v"), descricao: "", tipo, codigo: "", receita: 0, b2b: 50, anexo: dados?.anexoPadrao || "I", icms: tipo === "servico" ? 0 : 18, iss: tipo === "servico" ? 5 : 0, ipi: 0, pisCofins: "normal", icmsSt: false, categoria: "padrao", seletivo: 0 };
}

export function novaCompra(tipo = "mercadoria") {
  return { id: novoId("c"), descricao: "", ...padraoCompra(tipo), valor: 0, fornecedor: "normal", ipi: 0, creditoPisCofins: true, categoria: "padrao" };
}

// Valores de partida por tipo de compra (alíquota do ICMS/ISS embutido e se
// toma crédito de ICMS hoje).
export function padraoCompra(tipo) {
  if (tipo === "servico") return { tipo, aliquota: 5, creditoIcms: false };
  if (tipo === "energia") return { tipo, aliquota: 18, creditoIcms: false };
  if (tipo === "aluguel") return { tipo, aliquota: 0, creditoIcms: false };
  if (tipo === "outros") return { tipo, aliquota: 18, creditoIcms: false };
  return { tipo, aliquota: 18, creditoIcms: true };
}

// Itens com valores normalizados (número, faixa) — o que vem da tela pode
// ter string vazia, campo faltando etc.
export function normalizarDados(dados) {
  const regime = ["simples", "presumido", "real"].includes(dados?.regime) ? dados.regime : "presumido";
  return {
    regime,
    rbt12: num(dados?.rbt12),
    anexoPadrao: dados?.anexoPadrao || "I",
    vendas: (dados?.vendas || []).map((item) => ({
      id: item.id,
      descricao: String(item.descricao || "").trim() || "Item sem nome",
      tipo: item.tipo === "servico" ? "servico" : "mercadoria",
      codigo: String(item.codigo || "").trim(),
      receita: num(item.receita),
      b2b: Math.min(100, num(item.b2b)),
      anexo: item.anexo || dados?.anexoPadrao || "I",
      icms: item.tipo === "servico" ? 0 : num(item.icms),
      iss: item.tipo === "servico" ? num(item.iss) : 0,
      ipi: item.tipo === "servico" ? 0 : num(item.ipi),
      pisCofins: ["normal", "monofasico", "zero"].includes(item.pisCofins) ? item.pisCofins : "normal",
      icmsSt: Boolean(item.icmsSt),
      categoria: REDUCAO[item.categoria] !== undefined ? item.categoria : "padrao",
      seletivo: num(item.seletivo),
    })),
    compras: (dados?.compras || []).map((item) => ({
      id: item.id,
      descricao: String(item.descricao || "").trim() || "Compra sem nome",
      tipo: ["mercadoria", "insumo", "servico", "energia", "aluguel", "outros"].includes(item.tipo) ? item.tipo : "mercadoria",
      valor: num(item.valor),
      fornecedor: ["normal", "simples", "semCredito"].includes(item.fornecedor) ? item.fornecedor : "normal",
      aliquota: num(item.aliquota),
      ipi: num(item.ipi),
      creditoPisCofins: item.creditoPisCofins !== false,
      // Crédito de ICMS de hoje: mercadoria pra revenda e insumo, sim;
      // energia só na indústria — por isso é uma opção do item.
      creditoIcms: item.creditoIcms !== undefined ? Boolean(item.creditoIcms) : ["mercadoria", "insumo"].includes(item.tipo),
      categoria: REDUCAO[item.categoria] !== undefined ? item.categoria : "padrao",
    })),
  };
}

// ── Vendas ────────────────────────────────────────────────────────────────

// Regime normal (Presumido/Real) e a parte "por fora" do híbrido. `b` = valor
// sem tributos sobre consumo, fixo em todos os anos (preço neutro).
function vendaRegular(item, a, regime, params) {
  const R = item.receita;
  const icms = pct(item.icms);
  const iss = pct(item.iss);
  const pcRate = item.pisCofins === "normal" ? pct(regime === "real" ? params.pisCofinsNaoCumulativo : params.pisCofinsCumulativo) : 0;
  const b = R - R * icms - (R - R * icms) * pcRate - R * iss;

  const ri = icms * a.icmsIss;
  const rs = iss * a.icmsIss;
  const rpc = a.pisCofins ? pcRate : 0;
  const V = b / (1 - (ri + rs + rpc * (1 - ri)));
  const icmsValor = ri * V;
  const issValor = rs * V;
  const pcValor = rpc * (V - icmsValor);
  const ipiValor = a.ipi ? pct(item.ipi) * V : 0;
  const fator = 1 - REDUCAO[item.categoria];
  const cbs = a.compensado ? 0 : a.cbs * fator * b;
  const ibs = a.compensado ? 0 : a.ibs * fator * b;
  const seletivo = a.seletivo ? pct(item.seletivo) * b : 0;
  const preco = V + ipiValor + cbs + ibs + seletivo;
  // Cliente empresa do regime normal (não cumulativo): crédito de ICMS,
  // PIS/Cofins (9,25%, enquanto existir), IPI e, na reforma, todo o
  // CBS/IBS destacado (mesmo com redução de alíquota).
  const pcCliente = a.pisCofins && item.pisCofins === "normal" ? pct(params.pisCofinsNaoCumulativo) * (V - icmsValor) : 0;
  const creditoCliente = icmsValor + pcCliente + ipiValor + cbs + ibs;
  return {
    b,
    preco,
    creditoCliente,
    debitos: { pisCofins: pcValor, icms: icmsValor, iss: issValor, ipi: ipiValor, das: 0, cbs, ibs, seletivo },
  };
}

function partesSimples(item, rbt12) {
  const simples = simplesAliquota(item.anexo, rbt12);
  const partes = { ...simples.rep };
  // Monofásico/alíquota zero e ICMS-ST: a parte desses tributos sai do DAS
  // (segregação da receita, LC 123 art. 18 § 4º-A).
  if (item.pisCofins !== "normal") {
    partes.pis = 0;
    partes.cofins = 0;
  }
  if (item.icmsSt) partes.icms = 0;
  return { simples, partes };
}

// Simples Nacional. `hibrido`: a partir de 2027 recolhe CBS/IBS por fora.
function vendaSimples(item, a, rbt12, params, hibrido) {
  const R = item.receita;
  const { simples, partes } = partesSimples(item, rbt12);
  const aliq = simples.efetiva;
  const pc = (partes.pis + partes.cofins) / 100;
  const icmsIss = (partes.icms + partes.iss) / 100;
  const consumoHoje = pc + icmsIss + partes.ipi / 100;
  // Faixa 6: ICMS/ISS fora do DAS, pelas regras normais (mantido constante
  // na simulação — limitação conhecida, caso raro).
  const fora = simples.faixa === 6 ? R * pct(item.icms) + R * pct(item.iss) : 0;
  const b = R - R * aliq * consumoHoje - fora;
  const reformaAtiva = !a.pisCofins; // 2027 em diante
  const fator = 1 - REDUCAO[item.categoria];
  const seletivo = a.seletivo ? pct(item.seletivo) * b : 0;
  const pcClienteHoje = a.pisCofins && item.pisCofins === "normal" ? pct(params.pisCofinsNaoCumulativo) * R : 0;

  if (!hibrido || !reformaAtiva) {
    // Permanece no Simples: DAS igual; CBS/IBS de dentro do DAS (a parte que
    // era PIS/Cofins e, aos poucos, a do ICMS/ISS) é o crédito do cliente.
    const das = R * aliq * consumoHoje;
    const cbsDentro = reformaAtiva ? R * aliq * pc : 0;
    const ibsDentro = R * aliq * icmsIss * (1 - a.icmsIss);
    const icmsCreditavel = R * aliq * (partes.icms / 100) * a.icmsIss;
    return {
      b,
      preco: R + seletivo,
      creditoCliente: icmsCreditavel + pcClienteHoje + cbsDentro + ibsDentro,
      debitos: { pisCofins: 0, icms: simples.faixa === 6 ? R * pct(item.icms) : 0, iss: simples.faixa === 6 ? R * pct(item.iss) : 0, ipi: 0, das, cbs: 0, ibs: 0, seletivo },
      simples,
    };
  }
  // Híbrido: DAS sem PIS/Cofins e sem a parte do ICMS/ISS que virou IBS;
  // CBS/IBS por fora, com crédito integral pro cliente.
  const dasConsumo = R * aliq * (consumoHoje - pc - icmsIss * (1 - a.icmsIss));
  const cbs = a.compensado ? 0 : a.cbs * fator * b;
  const ibs = a.compensado ? 0 : a.ibs * fator * b;
  const icmsCreditavel = R * aliq * (partes.icms / 100) * a.icmsIss;
  return {
    b,
    preco: b + dasConsumo + fora + cbs + ibs + seletivo,
    creditoCliente: icmsCreditavel + cbs + ibs,
    debitos: { pisCofins: 0, icms: simples.faixa === 6 ? R * pct(item.icms) : 0, iss: simples.faixa === 6 ? R * pct(item.iss) : 0, ipi: 0, das: dasConsumo, cbs, ibs, seletivo },
    simples,
  };
}

// ── Compras ───────────────────────────────────────────────────────────────

const TIPOS_COM_ICMS = new Set(["mercadoria", "insumo", "energia"]);

// `regime` de quem COMPRA: presumido/real (normal), simples (permanece, não
// toma crédito) ou hibrido (só CBS/IBS, a partir de 2027).
function compraAno(item, a, regime, params) {
  const Vc = item.valor;
  const creditos = zeros(TRIBUTOS_CREDITO);
  const reformaAtiva = !a.pisCofins;
  if (item.fornecedor === "semCredito") return { custo: Vc, creditos };

  const tomaCreditoAntigo = regime === "presumido" || regime === "real";
  const tomaCbsIbs = tomaCreditoAntigo || (regime === "hibrido" && reformaAtiva);

  if (item.fornecedor === "simples") {
    // Fornecedor que fica no Simples: preço igual; crédito = ICMS destacado
    // (parte que ainda existe) + o CBS/IBS que ele paga dentro do DAS.
    const cs = pct(params.creditoFornecedorSimples);
    const pesoCbs = (Number(params.cbs) || 0) / ((Number(params.cbs) || 0) + (Number(params.ibs) || 0) || 1);
    if (tomaCreditoAntigo) {
      if (item.creditoIcms && TIPOS_COM_ICMS.has(item.tipo)) creditos.icms = Vc * pct(item.aliquota) * a.icmsIss;
      if (regime === "real" && item.creditoPisCofins && a.pisCofins) creditos.pisCofins = Vc * pct(params.pisCofinsNaoCumulativo);
    }
    if (tomaCbsIbs && !a.compensado) {
      creditos.cbs = reformaAtiva ? Vc * cs * pesoCbs : 0;
      creditos.ibs = Vc * cs * (1 - pesoCbs) * (1 - a.icmsIss);
    }
    return { custo: Vc - soma(creditos), creditos };
  }

  // Fornecedor do regime normal, mantendo o valor sem tributos dele.
  const servico = item.tipo === "servico";
  const icms = servico ? 0 : pct(item.aliquota);
  const iss = servico ? pct(item.aliquota) : 0;
  const pcF = pct(servico ? params.pisCofinsFornecedorServico : params.pisCofinsFornecedorMercadoria);
  const ipi = servico ? 0 : pct(item.ipi);
  const semIpi = Vc / (1 + ipi);
  const bc = semIpi - semIpi * icms - (semIpi - semIpi * icms) * pcF - semIpi * iss;

  const ri = icms * a.icmsIss;
  const rs = iss * a.icmsIss;
  const rpc = a.pisCofins ? pcF : 0;
  const V = bc / (1 - (ri + rs + rpc * (1 - ri)));
  const icmsValor = ri * V;
  const ipiValor = a.ipi ? ipi * V : 0;
  const fator = 1 - REDUCAO[item.categoria];
  const cbs = a.compensado ? 0 : a.cbs * fator * bc;
  const ibs = a.compensado ? 0 : a.ibs * fator * bc;
  const preco = V + ipiValor + cbs + ibs;
  if (tomaCreditoAntigo) {
    if (item.creditoIcms && TIPOS_COM_ICMS.has(item.tipo)) creditos.icms = icmsValor;
    if (item.tipo === "insumo") creditos.ipi = ipiValor;
    if (regime === "real" && item.creditoPisCofins && a.pisCofins) creditos.pisCofins = pct(params.pisCofinsNaoCumulativo) * (V - icmsValor);
  }
  if (tomaCbsIbs) {
    creditos.cbs = cbs;
    creditos.ibs = ibs;
  }
  return { custo: preco - soma(creditos), creditos };
}

// ── Cenário (um regime, todos os anos) ────────────────────────────────────

function cenario(dados, params, modo) {
  const regimeVenda = modo === "hibrido" ? "simples" : dados.regime;
  const regimeCompra = modo === "hibrido" ? "hibrido" : dados.regime;
  const calcularVenda = (item, a) =>
    regimeVenda === "simples" ? vendaSimples(item, a, dados.rbt12, params, modo === "hibrido") : vendaRegular(item, a, regimeVenda, params);

  const anos = ["hoje", ...ANOS].map((ano) => {
    const a = aliquotasDoAno(params, ano);
    const debitos = zeros(TRIBUTOS_DEBITO);
    const creditos = zeros(TRIBUTOS_CREDITO);
    let receitaHoje = 0;
    let preco = 0;
    let precoConsumidor = 0;
    let custoClienteEmpresa = 0;
    let margemPrecoMantido = 0;
    const vendas = dados.vendas.map((item) => {
      const hoje = calcularVenda(item, aliquotasDoAno(params, "hoje"));
      const v = calcularVenda(item, a);
      TRIBUTOS_DEBITO.forEach((campo) => {
        debitos[campo] += v.debitos[campo];
      });
      const b2b = pct(item.b2b);
      receitaHoje += item.receita;
      preco += v.preco;
      precoConsumidor += v.preco * (1 - b2b);
      custoClienteEmpresa += (v.preco - v.creditoCliente) * b2b;
      // Preço mantido: o valor sem tributo encolhe na proporção do preço.
      if (v.preco > 0) margemPrecoMantido += v.b * (hoje.preco / v.preco - 1);
      return { id: item.id, preco: v.preco, b: v.b, creditoCliente: v.creditoCliente, tributos: soma(v.debitos) };
    });
    let custoCompras = 0;
    const compras = dados.compras.map((item) => {
      const c = compraAno(item, a, regimeCompra, params);
      TRIBUTOS_CREDITO.forEach((campo) => {
        creditos[campo] += c.creditos[campo];
      });
      custoCompras += c.custo;
      return { id: item.id, custo: c.custo, creditos: soma(c.creditos) };
    });
    return {
      ano,
      debitos,
      creditos,
      aRecolher: soma(debitos) - soma(creditos),
      receitaHoje,
      preco,
      precoConsumidor,
      custoClienteEmpresa,
      custoCompras,
      margemPrecoMantido,
      vendas,
      compras,
    };
  });

  const base = anos[0];
  anos.forEach((linha) => {
    linha.carga = base.receitaHoje > 0 ? linha.aRecolher / base.receitaHoje : 0;
    linha.precoVar = base.preco > 0 ? linha.preco / base.preco - 1 : 0;
    linha.precoConsumidorVar = base.precoConsumidor > 0 ? linha.precoConsumidor / base.precoConsumidor - 1 : null;
    linha.custoClienteEmpresaVar = base.custoClienteEmpresa > 0 ? linha.custoClienteEmpresa / base.custoClienteEmpresa - 1 : null;
    // Efeito no resultado do mês: compras mais baratas (crédito amplo) e,
    // com preço mantido, a margem que se ganha/perde nas vendas.
    linha.efeitoCompras = base.custoCompras - linha.custoCompras;
    linha.efeitoPrecoRepassado = linha.efeitoCompras;
    linha.efeitoPrecoMantido = linha.margemPrecoMantido + linha.efeitoCompras;
  });
  return { modo, anos };
}

// Resultado completo. `cenarios.atual` sempre; `cenarios.hibrido` só pra
// empresa do Simples (comparar ficar no Simples × recolher CBS/IBS por fora).
export function calcularSimulacao(dadosBrutos, params) {
  const dados = normalizarDados(dadosBrutos);
  const cenarios = { atual: cenario(dados, params, "atual") };
  if (dados.regime === "simples") cenarios.hibrido = cenario(dados, params, "hibrido");

  const atual = cenarios.atual.anos;
  const hoje = atual[0];
  const final = atual[atual.length - 1];
  // Por item de venda: carga sobre o preço hoje × 2033 e o crédito que o
  // cliente empresa toma a cada R$ 100 comprados.
  const itens = dados.vendas.map((item, index) => {
    const h = hoje.vendas[index];
    const f = final.vendas[index];
    return {
      id: item.id,
      descricao: item.descricao,
      codigo: item.codigo,
      tipo: item.tipo,
      categoria: item.categoria,
      receita: item.receita,
      cargaHoje: h.preco > 0 ? h.tributos / h.preco : 0,
      carga2033: f.preco > 0 ? f.tributos / f.preco : 0,
      precoVar: h.preco > 0 ? f.preco / h.preco - 1 : 0,
      creditoClienteHoje: h.preco > 0 ? (100 * h.creditoCliente) / h.preco : 0,
      creditoCliente2033: f.preco > 0 ? (100 * f.creditoCliente) / f.preco : 0,
      creditoCliente2033Hibrido: cenarios.hibrido
        ? (() => {
            const hf = cenarios.hibrido.anos[cenarios.hibrido.anos.length - 1].vendas[index];
            return hf.preco > 0 ? (100 * hf.creditoCliente) / hf.preco : 0;
          })()
        : null,
    };
  });
  const simples = dados.regime === "simples" && dados.vendas.length ? simplesAliquota(dados.anexoPadrao, dados.rbt12) : null;
  return { dados, cenarios, itens, simples, resumo: resumir(cenarios) };
}

// Números principais pro painel do escritório (vai junto em
// reforma_simulacoes.resumo a cada salvamento).
export function resumir(cenarios) {
  const linha = (anos, ano) => anos.find((item) => item.ano === ano);
  const atual = cenarios.atual.anos;
  const hoje = linha(atual, "hoje");
  const fim = linha(atual, 2033);
  const resumo = {
    receitaMensal: hoje.receitaHoje,
    aRecolherHoje: hoje.aRecolher,
    aRecolher2033: fim.aRecolher,
    cargaHoje: hoje.carga,
    carga2033: fim.carga,
    precoVar2033: fim.precoVar,
    efeitoPrecoMantido2033: fim.efeitoPrecoMantido,
    efeitoCompras2033: fim.efeitoCompras,
  };
  if (cenarios.hibrido) {
    const hib = linha(cenarios.hibrido.anos, 2033);
    resumo.hibrido = { aRecolher2033: hib.aRecolher, carga2033: hib.carga, precoVar2033: hib.precoVar, custoClienteEmpresaVar2033: hib.custoClienteEmpresaVar };
    resumo.custoClienteEmpresaVar2033 = fim.custoClienteEmpresaVar;
  }
  return resumo;
}
