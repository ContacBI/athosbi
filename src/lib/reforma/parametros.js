// Parâmetros da simulação da Reforma Tributária (EC 132/2023 e LC 214/2025).
// Valores padrão do código; o escritório (reforma_escritorio) pode alterar
// em Parâmetros › Reforma Tributária, e o que for salvo em
// public.reforma_parametros vale por cima destes (ver mesclarParametros).
// Arquivo puro (sem Supabase) — testado em node.

// Alíquotas de referência em % — ESTIMATIVAS (o Senado ainda fixa as
// definitivas). CBS federal; IBS estadual + municipal.
export const PARAMETROS_PADRAO = {
  versao: 1,
  cbs: 8.8,
  ibs: 17.7,
  // PIS/Cofins de hoje: cumulativo (Lucro Presumido) e não cumulativo
  // (Lucro Real).
  pisCofinsCumulativo: 3.65,
  pisCofinsNaoCumulativo: 9.25,
  // PIS/Cofins que o fornecedor do regime normal embute no preço — usado
  // pra estimar o valor das compras sem tributo. Mercadoria: fornecedor
  // típico do Lucro Real; serviço: do Presumido.
  pisCofinsFornecedorMercadoria: 9.25,
  pisCofinsFornecedorServico: 3.65,
  // Crédito de IBS/CBS que a compra de um fornecedor que FICA no Simples
  // gera — é o IBS/CBS que ele paga dentro do DAS, uma fração pequena do
  // valor (estimativa média; depende do anexo e da faixa dele).
  creditoFornecedorSimples: 4,
  // Calendário de transição. cbs/ibs: fração da alíquota de referência
  // (cbsFixo/ibsFixo, quando preenchidos, valem em % absoluto); icmsIss:
  // % do ICMS/ISS de hoje que continua; pisCofins/ipi: se ainda existem;
  // seletivo: Imposto Seletivo em vigor; compensado: ano-teste em que a
  // CBS/IBS é abatida do PIS/Cofins (não aumenta a carga).
  transicao: [
    { ano: 2026, cbsFixo: 0.9, ibsFixo: 0.1, cbsFracao: 0, ibsFracao: 0, cbsAbatimento: 0, icmsIss: 100, pisCofins: true, ipi: true, seletivo: false, compensado: true },
    { ano: 2027, cbsFixo: null, ibsFixo: 0.1, cbsFracao: 1, ibsFracao: 0, cbsAbatimento: 0.1, icmsIss: 100, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2028, cbsFixo: null, ibsFixo: 0.1, cbsFracao: 1, ibsFracao: 0, cbsAbatimento: 0.1, icmsIss: 100, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2029, cbsFixo: null, ibsFixo: null, cbsFracao: 1, ibsFracao: 0.1, cbsAbatimento: 0, icmsIss: 90, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2030, cbsFixo: null, ibsFixo: null, cbsFracao: 1, ibsFracao: 0.2, cbsAbatimento: 0, icmsIss: 80, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2031, cbsFixo: null, ibsFixo: null, cbsFracao: 1, ibsFracao: 0.3, cbsAbatimento: 0, icmsIss: 70, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2032, cbsFixo: null, ibsFixo: null, cbsFracao: 1, ibsFracao: 0.4, cbsAbatimento: 0, icmsIss: 60, pisCofins: false, ipi: false, seletivo: true, compensado: false },
    { ano: 2033, cbsFixo: null, ibsFixo: null, cbsFracao: 1, ibsFracao: 1, cbsAbatimento: 0, icmsIss: 0, pisCofins: false, ipi: false, seletivo: true, compensado: false },
  ],
};

export const ANOS = PARAMETROS_PADRAO.transicao.map((linha) => linha.ano);

// Categorias de alíquota na reforma (redução sobre a alíquota de
// referência). Os exemplos são os mais comuns da LC 214 — a lista completa
// (por NCM/NBS) está nos anexos da lei.
export const CATEGORIAS = [
  { id: "padrao", nome: "Alíquota padrão", reducao: 0, exemplo: "A maioria dos bens e serviços" },
  { id: "red30", nome: "Redução de 30%", reducao: 30, exemplo: "Profissões regulamentadas (contador, advogado, engenheiro…)" },
  { id: "red50", nome: "Redução de 50%", reducao: 50, exemplo: "Venda e outras operações com imóveis" },
  { id: "red60", nome: "Redução de 60%", reducao: 60, exemplo: "Saúde, educação, dispositivos médicos, medicamentos, insumos agro, alimentos…" },
  { id: "red70", nome: "Redução de 70%", reducao: 70, exemplo: "Locação de imóveis" },
  { id: "zero", nome: "Alíquota zero", reducao: 100, exemplo: "Cesta básica nacional, alguns medicamentos, transporte coletivo…" },
];

export const REDUCAO = Object.fromEntries(CATEGORIAS.map((categoria) => [categoria.id, categoria.reducao / 100]));

// Simples Nacional (LC 123/2006, Anexos I a V): faixas de receita bruta
// dos últimos 12 meses (RBT12), alíquota nominal, parcela a deduzir e a
// repartição do DAS entre os tributos (% do DAS). Na faixa 6 o ICMS/ISS
// sai do DAS e é pago por fora.
const faixa = (ate, nominal, deducao, rep) => ({ ate, nominal, deducao, rep });
const rep = (irpj, csll, cofins, pis, cpp, icms, ipi, iss) => ({ irpj, csll, cofins, pis, cpp, icms, ipi, iss });

export const SIMPLES_ANEXOS = {
  I: {
    nome: "Anexo I — Comércio",
    faixas: [
      faixa(180000, 4, 0, rep(5.5, 3.5, 12.74, 2.76, 41.5, 34, 0, 0)),
      faixa(360000, 7.3, 5940, rep(5.5, 3.5, 12.74, 2.76, 41.5, 34, 0, 0)),
      faixa(720000, 9.5, 13860, rep(5.5, 3.5, 12.74, 2.76, 42, 33.5, 0, 0)),
      faixa(1800000, 10.7, 22500, rep(5.5, 3.5, 12.74, 2.76, 42, 33.5, 0, 0)),
      faixa(3600000, 14.3, 87300, rep(5.5, 3.5, 12.74, 2.76, 42, 33.5, 0, 0)),
      faixa(4800000, 19, 378000, rep(13.5, 10, 28.27, 6.13, 42.1, 0, 0, 0)),
    ],
  },
  II: {
    nome: "Anexo II — Indústria",
    faixas: [
      faixa(180000, 4.5, 0, rep(5.5, 3.5, 11.51, 2.49, 37.5, 32, 7.5, 0)),
      faixa(360000, 7.8, 5940, rep(5.5, 3.5, 11.51, 2.49, 37.5, 32, 7.5, 0)),
      faixa(720000, 10, 13860, rep(5.5, 3.5, 11.51, 2.49, 37.5, 32, 7.5, 0)),
      faixa(1800000, 11.2, 22500, rep(5.5, 3.5, 11.51, 2.49, 37.5, 32, 7.5, 0)),
      faixa(3600000, 14.7, 85500, rep(5.5, 3.5, 11.51, 2.49, 37.5, 32, 7.5, 0)),
      faixa(4800000, 30, 720000, rep(8.5, 7.5, 20.96, 4.54, 23.5, 0, 35, 0)),
    ],
  },
  III: {
    nome: "Anexo III — Serviços (folha ≥ 28% ou atividades do anexo)",
    faixas: [
      faixa(180000, 6, 0, rep(4, 3.5, 12.82, 2.78, 43.4, 0, 0, 33.5)),
      faixa(360000, 11.2, 9360, rep(4, 3.5, 14.05, 3.05, 43.4, 0, 0, 32)),
      faixa(720000, 13.5, 17640, rep(4, 3.5, 13.64, 2.96, 43.4, 0, 0, 32.5)),
      faixa(1800000, 16, 35640, rep(4, 3.5, 13.64, 2.96, 43.4, 0, 0, 32.5)),
      faixa(3600000, 21, 125640, rep(4, 3.5, 12.82, 2.78, 43.4, 0, 0, 33.5)),
      faixa(4800000, 33, 648000, rep(35, 15, 16.03, 3.47, 30.5, 0, 0, 0)),
    ],
  },
  IV: {
    nome: "Anexo IV — Serviços (CPP fora do DAS)",
    faixas: [
      faixa(180000, 4.5, 0, rep(18.8, 15.2, 17.67, 3.83, 0, 0, 0, 44.5)),
      faixa(360000, 9, 8100, rep(19.8, 15.2, 20.55, 4.45, 0, 0, 0, 40)),
      faixa(720000, 10.2, 12420, rep(20.8, 15.2, 19.73, 4.27, 0, 0, 0, 40)),
      faixa(1800000, 14, 39780, rep(17.8, 19.2, 18.9, 4.1, 0, 0, 0, 40)),
      faixa(3600000, 22, 183780, rep(18.8, 19.2, 18.08, 3.92, 0, 0, 0, 40)),
      faixa(4800000, 33, 828000, rep(53.5, 21.5, 20.55, 4.45, 0, 0, 0, 0)),
    ],
  },
  V: {
    nome: "Anexo V — Serviços (folha < 28%)",
    faixas: [
      faixa(180000, 15.5, 0, rep(25, 15, 14.1, 3.05, 28.85, 0, 0, 14)),
      faixa(360000, 18, 4500, rep(23, 15, 14.1, 3.05, 27.85, 0, 0, 17)),
      faixa(720000, 19.5, 9900, rep(24, 15, 14.92, 3.23, 23.85, 0, 0, 19)),
      faixa(1800000, 20.5, 17100, rep(21, 15, 15.74, 3.41, 23.85, 0, 0, 21)),
      faixa(3600000, 23, 62100, rep(23, 12.5, 14.1, 3.05, 23.85, 0, 0, 23.5)),
      faixa(4800000, 30.5, 540000, rep(35, 15.5, 16.44, 3.56, 29.5, 0, 0, 0)),
    ],
  },
};

// Alíquota efetiva do Simples pela RBT12: (RBT12 × nominal − dedução) ÷
// RBT12. Sem RBT12 (ou zero) usa a 1ª faixa; acima de R$ 4,8 mi a empresa
// não cabe no Simples — devolve a 6ª faixa com `foraDoLimite`.
export function simplesAliquota(anexo, rbt12) {
  const tabela = SIMPLES_ANEXOS[anexo] || SIMPLES_ANEXOS.I;
  const receita = Math.max(0, Number(rbt12) || 0);
  const indice = receita <= 0 ? 0 : tabela.faixas.findIndex((item) => receita <= item.ate);
  const posicao = indice === -1 ? tabela.faixas.length - 1 : indice;
  const linha = tabela.faixas[posicao];
  const efetiva = receita > 0 ? (receita * linha.nominal / 100 - linha.deducao) / receita : linha.nominal / 100;
  return { faixa: posicao + 1, nominal: linha.nominal, deducao: linha.deducao, efetiva: Math.max(0, efetiva), rep: linha.rep, foraDoLimite: indice === -1 };
}

const pct = (value) => (Number(value) || 0) / 100;

// Alíquotas que valem num ano ("hoje" = regras atuais, antes da reforma).
// Em decimal (0,088 = 8,8%).
export function aliquotasDoAno(params, ano) {
  if (ano === "hoje") return { ano, cbs: 0, ibs: 0, icmsIss: 1, pisCofins: true, ipi: true, seletivo: false, compensado: false };
  const linha = params.transicao.find((item) => item.ano === ano);
  if (!linha) throw new Error(`Ano ${ano} fora do calendário de transição.`);
  const cbs = linha.cbsFixo !== null && linha.cbsFixo !== undefined && linha.cbsFixo !== "" ? pct(linha.cbsFixo) : Math.max(0, pct(params.cbs) * Number(linha.cbsFracao || 0) - pct(linha.cbsAbatimento));
  const ibs = linha.ibsFixo !== null && linha.ibsFixo !== undefined && linha.ibsFixo !== "" ? pct(linha.ibsFixo) : pct(params.ibs) * Number(linha.ibsFracao || 0);
  return {
    ano,
    cbs,
    ibs,
    icmsIss: pct(linha.icmsIss),
    pisCofins: Boolean(linha.pisCofins),
    ipi: Boolean(linha.ipi),
    seletivo: Boolean(linha.seletivo),
    compensado: Boolean(linha.compensado),
  };
}

// Parâmetros salvos pelo escritório por cima dos padrões — campo a campo,
// e o calendário ano a ano (ano que não veio fica o padrão).
export function mesclarParametros(salvos) {
  if (!salvos || typeof salvos !== "object") return structuredClone(PARAMETROS_PADRAO);
  const base = structuredClone(PARAMETROS_PADRAO);
  const numeros = ["cbs", "ibs", "pisCofinsCumulativo", "pisCofinsNaoCumulativo", "pisCofinsFornecedorMercadoria", "pisCofinsFornecedorServico", "creditoFornecedorSimples"];
  numeros.forEach((campo) => {
    if (Number.isFinite(Number(salvos[campo])) && salvos[campo] !== null && salvos[campo] !== "") base[campo] = Number(salvos[campo]);
  });
  if (Array.isArray(salvos.transicao)) {
    base.transicao = base.transicao.map((linha) => ({ ...linha, ...(salvos.transicao.find((item) => item?.ano === linha.ano) || {}), ano: linha.ano }));
  }
  return base;
}
