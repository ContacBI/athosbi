import { novoId, padraoCompra } from "./calculo.js";

// Converte o resumo das notas fiscais da Domínio (tabela dominio_fiscal,
// mandado pela Central — ver supabase/functions/dominio-sync) em itens de
// venda e de compra da simulação, com valores MENSAIS (média do período) e
// alíquotas efetivas (tributo destacado ÷ valor). Puro: sem banco, pra dar
// pra testar (scripts/test-reforma.mjs).

const MAX_VENDAS = 40;
const MAX_COMPRAS_POR_TIPO = 15;
const COBERTURA = 0.98;

const arred = (valor, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;
const pctDe = (parte, total) => (total > 0 ? arred(((Number(parte) || 0) / total) * 100, 2) : 0);
const somar = (linhas, campo) => linhas.reduce((total, linha) => total + (Number(linha[campo]) || 0), 0);

// NBS (serviço) vem com 9 dígitos: 1.1103.22.00.
export const nbsFormatado = (nbs) => (/^\d{9}$/.test(String(nbs || "")) ? `${nbs[0]}.${nbs.slice(1, 5)}.${nbs.slice(5, 7)}.${nbs.slice(7)}` : String(nbs || ""));
export const ncmFormatado = (ncm) => (/^\d{8}$/.test(String(ncm || "")) ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : String(ncm || ""));

// As maiores linhas até cobrir 98% do valor (no máximo `max`, contando a
// linha de "demais"); o resto vai somado numa linha só.
function principais(linhas, max) {
  const ordenadas = [...linhas].sort((a, b) => b.valor - a.valor);
  const total = somar(ordenadas, "valor");
  const ficam = [];
  let acumulado = 0;
  for (const linha of ordenadas) {
    if (ficam.length >= max - 1 || (ficam.length > 0 && acumulado >= COBERTURA * total)) break;
    ficam.push(linha);
    acumulado += linha.valor;
  }
  const resto = ordenadas.slice(ficam.length);
  return resto.length === 1 ? { ficam: [...ficam, resto[0]], resto: [] } : { ficam, resto };
}

// Junta várias linhas numa só (soma valores; o "jeito" de PIS/Cofins e o
// ICMS-ST ficam com o que for maioria em valor).
function juntar(linhas, extra) {
  const maioria = (campo) => {
    const pesos = new Map();
    linhas.forEach((linha) => pesos.set(linha[campo], (pesos.get(linha[campo]) || 0) + linha.valor));
    return [...pesos].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const campos = ["valor", "valor_pj", "icms", "icms_creditado", "ipi", "iss", "produtos"];
  return { ...Object.fromEntries(campos.map((campo) => [campo, somar(linhas, campo)])), pis_cofins: maioria("pis_cofins"), icms_st: maioria("icms_st"), ...extra };
}

const ehServico = (linha) => Boolean(linha.servico) || (!linha.ncm && Number(linha.iss) > 0);

function nomeVenda(linha) {
  const base = linha.descricao || (ehServico(linha) ? `Serviço ${linha.servico || ""}`.trim() : linha.ncm ? `NCM ${ncmFormatado(linha.ncm)}` : "Produtos sem NCM");
  return linha.produtos > 1 ? `${base} (+${linha.produtos - 1} itens)` : base;
}

export function vendasDaDominio(fiscal, dados = {}) {
  const meses = Math.max(1, Number(fiscal?.meses) || 12);
  const anexoProduto = ["I", "II"].includes(dados.anexoPadrao) ? dados.anexoPadrao : "I";
  const anexoServico = ["III", "IV", "V"].includes(dados.anexoPadrao) ? dados.anexoPadrao : "III";
  const linhas = (fiscal?.vendas || []).filter((linha) => Number(linha.valor) > 0);
  const { ficam, resto } = principais(linhas, MAX_VENDAS);
  const demais = [];
  const produtos = resto.filter((linha) => !ehServico(linha));
  const servicos = resto.filter(ehServico);
  if (produtos.length) demais.push(juntar(produtos, { ncm: "", servico: "", descricao: `Demais produtos (${produtos.length} NCMs)`, produtos: 0 }));
  if (servicos.length) demais.push(juntar(servicos, { ncm: "", servico: "*", descricao: `Demais serviços (${servicos.length} códigos)`, produtos: 0 }));

  return [...ficam, ...demais].map((linha) => {
    const servico = ehServico(linha);
    return {
      id: novoId("v"),
      descricao: nomeVenda(linha).slice(0, 120),
      tipo: servico ? "servico" : "mercadoria",
      codigo: servico ? (linha.servico === "*" ? "" : nbsFormatado(linha.servico)) : ncmFormatado(linha.ncm),
      receita: arred(linha.valor / meses),
      b2b: Math.round(pctDe(linha.valor_pj, linha.valor)),
      anexo: servico ? anexoServico : anexoProduto,
      icms: servico ? 0 : pctDe(linha.icms, linha.valor),
      iss: servico ? pctDe(linha.iss, linha.valor) : 0,
      ipi: servico ? 0 : pctDe(linha.ipi, linha.valor),
      pisCofins: ["normal", "monofasico", "zero"].includes(linha.pis_cofins) ? linha.pis_cofins : "normal",
      icmsSt: Boolean(linha.icms_st),
      categoria: "padrao",
      seletivo: 0,
    };
  });
}

// Tipo da Domínio → tipo da simulação, e o nome da linha quando não tem NCM.
const TIPO_COMPRA = { mercadoria: "mercadoria", insumo: "insumo", uso_consumo: "outros", ativo: "outros", energia: "energia", comunicacao: "energia", servico: "servico", frete: "outros", aluguel: "aluguel", outros: "outros" };
const NOME_COMPRA = {
  mercadoria: "Mercadorias p/ revenda",
  insumo: "Insumos / matéria-prima",
  uso_consumo: "Material de uso e consumo",
  ativo: "Ativo imobilizado",
  energia: "Energia elétrica",
  comunicacao: "Telefone e internet",
  servico: "Serviços tomados",
  frete: "Fretes",
  aluguel: "Aluguel",
  outros: "Outras compras",
};

export function comprasDaDominio(fiscal) {
  const meses = Math.max(1, Number(fiscal?.meses) || 12);
  // Produto que a empresa revende com PIS/Cofins zero ou monofásico não dá
  // crédito de PIS/Cofins na compra (Lei 10.833, art. 3º, § 2º, II) — sem
  // isso o "hoje" do Lucro Real sai com crédito a mais.
  const semCreditoPisCofins = new Set((fiscal?.vendas || []).filter((linha) => linha.ncm && linha.pis_cofins && linha.pis_cofins !== "normal").map((linha) => linha.ncm));
  const linhas = (fiscal?.compras || []).filter((linha) => Number(linha.valor) > 0 && TIPO_COMPRA[linha.tipo]);
  const grupos = new Map(); // tipo|fornecedor → linhas
  linhas.forEach((linha) => {
    const chave = `${linha.tipo}|${linha.fornecedor === "simples" ? "simples" : "normal"}`;
    grupos.set(chave, [...(grupos.get(chave) || []), linha]);
  });

  const itens = [];
  for (const [chave, doGrupo] of grupos) {
    const [tipoDominio, fornecedor] = chave.split("|");
    const porNcm = ["mercadoria", "insumo"].includes(tipoDominio);
    const { ficam, resto } = porNcm ? principais(doGrupo, MAX_COMPRAS_POR_TIPO) : { ficam: [], resto: doGrupo };
    const sufixo = fornecedor === "simples" ? " — fornecedor do Simples" : "";
    const linhasFinais = [
      ...ficam.map((linha) => ({ ...linha, nome: `${linha.descricao || NOME_COMPRA[tipoDominio]}${linha.ncm ? ` (NCM ${ncmFormatado(linha.ncm)})` : ""}` })),
      ...(resto.length ? [{ ...juntar(resto, {}), nome: `${porNcm && ficam.length ? `Demais ${NOME_COMPRA[tipoDominio].toLowerCase()}` : NOME_COMPRA[tipoDominio]}` }] : []),
    ];
    for (const linha of linhasFinais) {
      const tipo = TIPO_COMPRA[tipoDominio];
      const padrao = padraoCompra(tipo);
      const servico = tipo === "servico";
      // Alíquota embutida no preço do fornecedor: ICMS (ou ISS, no serviço)
      // destacado ÷ valor; sem destaque, a de partida do tipo. No serviço
      // tomado a Domínio só guarda o ISS RETIDO — abaixo do mínimo legal (2%)
      // não é a alíquota do fornecedor, então vale a de partida.
      const efetiva = pctDe(servico ? linha.iss : linha.icms, linha.valor);
      const destacado = servico && efetiva < 2 ? 0 : efetiva;
      itens.push({
        id: novoId("c"),
        descricao: `${linha.nome}${sufixo}`.slice(0, 120),
        tipo,
        aliquota: destacado > 0 ? destacado : fornecedor === "simples" ? 0 : padrao.aliquota,
        creditoIcms: !servico && Number(linha.icms_creditado) > 0.5 * Number(linha.icms || 0) && Number(linha.icms_creditado) > 0,
        // Valor da simulação é o que a empresa paga (com o IPI).
        valor: arred((linha.valor + (Number(linha.ipi) || 0)) / meses),
        fornecedor,
        ipi: pctDe(linha.ipi, linha.valor),
        creditoPisCofins: !(linha.ncm && semCreditoPisCofins.has(linha.ncm)),
        categoria: "padrao",
        // NCM da compra (quando veio por NCM) — pra categoria na reforma
        // acompanhar a da venda do mesmo NCM (ver sincronizarCategorias).
        ...(linha.ncm ? { ncm: linha.ncm } : {}),
      });
    }
  }
  return itens.sort((a, b) => b.valor - a.valor);
}

// Mudou a categoria na reforma de uma venda com NCM? A compra do mesmo NCM
// (o produto que a empresa revende) vai junto — senão o crédito da compra
// sairia pela alíquota cheia e a venda pela reduzida. Devolve as compras
// novas, ou as mesmas se nada mudou.
export function sincronizarCategorias(vendasAntes, vendasDepois, compras) {
  const antes = new Map((vendasAntes || []).map((item) => [item.id, item.categoria]));
  const mudou = new Map();
  (vendasDepois || []).forEach((item) => {
    const ncm = String(item.codigo || "").replace(/\D/g, "");
    if (item.tipo !== "servico" && ncm.length === 8 && antes.has(item.id) && antes.get(item.id) !== item.categoria) mudou.set(ncm, item.categoria);
  });
  if (!mudou.size || !(compras || []).some((compra) => mudou.has(compra.ncm))) return compras;
  return compras.map((compra) => (mudou.has(compra.ncm) ? { ...compra, categoria: mudou.get(compra.ncm) } : compra));
}

// Faturamento do ano (média mensal × 12) acima do limite do regime
// escolhido — o regime real da empresa não pode ser esse.
export function avisoDeRegime(fiscal, regime) {
  const anual = resumoFiscal(fiscal).vendasMes * 12;
  if (regime === "presumido" && anual > 78_000_000) return { anual, texto: "acima do limite do Lucro Presumido (R$ 78 milhões/ano) — a empresa é do Lucro Real" };
  if (regime === "simples" && anual > 4_800_000) return { anual, texto: "acima do limite do Simples Nacional (R$ 4,8 milhões/ano)" };
  return null;
}

// Resumo pra tela: período, total por mês e quantas linhas viram.
export function resumoFiscal(fiscal) {
  const meses = Math.max(1, Number(fiscal?.meses) || 12);
  return {
    meses,
    vendasMes: arred(somar(fiscal?.vendas || [], "valor") / meses),
    comprasMes: arred(somar(fiscal?.compras || [], "valor") / meses),
    ncms: new Set((fiscal?.vendas || []).filter((linha) => linha.ncm).map((linha) => linha.ncm)).size,
    servicos: (fiscal?.vendas || []).filter(ehServico).length,
  };
}
