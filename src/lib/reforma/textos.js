// Explicações que aparecem ao passar o mouse nas telas da Reforma
// Tributária (componente Dica). Um lugar só, pra manter a mesma linguagem.

export const AJUDA = {
  // ── Vendas ──
  vendaDescricao: "Nome do produto ou serviço — ou de um grupo com a mesma tributação (mesmo NCM). Vindo da Domínio, é o produto que mais vendeu naquele NCM; o \"+N itens\" diz quantos outros produtos estão somados na linha.",
  vendaTipo: "Produto paga ICMS (e às vezes IPI); serviço paga ISS. Na reforma os dois passam a pagar CBS (federal) e IBS (estados e municípios).",
  vendaCodigo: "Código fiscal do item: NCM (8 dígitos) pra produto, NBS (9 dígitos) pra serviço. É por ele que a LC 214 diz se o item tem alíquota reduzida ou zero.",
  vendaReceita: "Quanto a empresa vende desse item por mês (média), com os tributos de hoje já dentro do preço.",
  vendaB2b: "Quanto desse item vai pra outras empresas, que tomam crédito do IBS/CBS. Pra elas o imposto é repassado e recuperado; pra consumidor final (CPF), ele vira custo de verdade.",
  vendaIcmsIss: "Alíquota efetiva que a empresa paga hoje sobre o faturamento desse item (ICMS no produto, ISS no serviço). Vindo da Domínio, é o ICMS/ISS destacado ÷ valor vendido. Vai sumindo de 2029 a 2032.",
  vendaIpi: "IPI destacado por fora do preço. Zera em 2027 (exceto produtos da Zona Franca de Manaus).",
  vendaPisCofins: "Como o PIS/Cofins incide hoje: Normal (3,65% no Presumido, 9,25% no Real), Monofásico (o fabricante já pagou pela cadeia) ou Alíquota zero. Acaba em 2027, quando entra a CBS.",
  vendaAnexo: "Anexo do Simples Nacional desse item — define a alíquota do DAS e quanto dela é de cada tributo.",
  vendaIcmsSt: "ICMS pago antes por substituição tributária: essa parte sai do DAS (segregação de receita).",
  vendaCategoria:
    "Como o IBS/CBS incide sobre o item a partir de 2027: alíquota padrão (≈26,5% em 2033), reduzida em 30%, 50%, 60% ou 70%, ou zero. O AthosBI sugere pelo NCM/NBS a partir dos anexos da LC 214/2025 — confira a descrição do item do anexo.",
  vendaSeletivo: "Imposto Seletivo (a partir de 2027): só bebidas alcoólicas e açucaradas, cigarros, veículos, embarcações, aeronaves, bens minerais e apostas. Informe a alíquota se o item tiver.",

  // ── Compras ──
  compraDescricao: "O que a empresa compra: mercadoria pra revender, insumo, serviço, energia, aluguel… Folha de pagamento não entra — não tem IBS/CBS nem gera crédito.",
  compraTipo: "Define os créditos de hoje: mercadoria e insumo dão crédito de ICMS; serviço tomado e uso e consumo, em geral, não. Na reforma quase tudo passa a dar crédito de IBS/CBS.",
  compraNcm: "NCM do produto comprado. Serve pra puxar a categoria da LC 214: o crédito é o IBS/CBS que o fornecedor destaca — se ele vende com redução, o crédito também é reduzido.",
  compraValor: "Quanto a empresa paga por mês nessa compra, com os tributos do fornecedor e o IPI.",
  compraFornecedor: "Regime normal: crédito integral do IBS/CBS que ele destaca. Do Simples: crédito só da parte que ele paga dentro do DAS (cerca de 4% do valor). Pessoa física: sem crédito nenhum.",
  compraAliquota: "ICMS (produto/energia) ou ISS (serviço) que vem embutido no preço do fornecedor. Serve pra achar o valor da compra sem tributo — a base do crédito na reforma.",
  compraIpi: "IPI destacado na nota do fornecedor.",
  compraCreditoIcms: "Marcado = a empresa já se credita hoje do ICMS dessa compra.",
  compraCreditoPisCofins: "Marcado = gera crédito de PIS/Cofins hoje (Lucro Real). Produto revendido com PIS/Cofins zero ou monofásico não gera.",
  compraCategoria: "Categoria do IBS/CBS que o FORNECEDOR cobra nessa compra — o crédito é o que ele destaca. Muda junto quando você muda a venda do mesmo NCM.",

  // ── Resultado ──
  tributosHoje: "ICMS, ISS, PIS/Cofins e IPI que ainda existem naquele ano (no Simples, o DAS fica em coluna própria).",
  das: "Parte do DAS que corresponde a tributos sobre consumo (PIS/Cofins, ICMS, ISS, IPI). IRPJ, CSLL e CPP ficam de fora da simulação.",
  cbs: "Contribuição sobre Bens e Serviços (federal). Substitui PIS/Cofins e IPI: 0,9% de teste em 2026 (compensado) e cheia a partir de 2027.",
  ibs: "Imposto sobre Bens e Serviços (estados e municípios). Substitui ICMS e ISS: 0,1% em 2027–2028 e cresce de 2029 a 2033.",
  seletivo: "Imposto Seletivo sobre os itens com alíquota informada na aba Vendas.",
  creditos: "Tributos pagos nas compras que a empresa abate do que deve (hoje: ICMS, PIS/Cofins, IPI; na reforma: CBS e IBS de quase tudo).",
  aRecolher: "Débitos menos créditos: o que sai do caixa por mês em tributos sobre consumo.",
  carga: "A recolher ÷ preço ao cliente. Quanto do que o cliente paga vai pra tributo sobre consumo.",
  precoVar: "Quanto o preço teria de subir (ou poderia cair) pra empresa ficar com o mesmo valor líquido de hoje, considerando também o custo das compras.",
  efeitoPrecoMantido: "Efeito no resultado do mês se a empresa NÃO mexer no preço ao cliente: a diferença de tributo (e do custo das compras) sai da margem.",
  creditoCliente: "Quanto um cliente empresa (regime normal) recupera de crédito a cada R$ 100 que paga — hoje e em 2033. Quanto maior, mais competitivo o preço pra empresas.",
  cargaItem: "Tributos sobre consumo do item ÷ preço ao cliente.",
};

// Uma frase por categoria (aparece no seletor "Na reforma").
export const AJUDA_CATEGORIA = {
  padrao: "Alíquota cheia de CBS + IBS (≈26,5% em 2033).",
  red30: "Redução de 30%: profissionais liberais regulamentados (advogado, contador, engenheiro…).",
  red50: "Redução de 50%: operações com bens imóveis (venda, construção).",
  red60: "Redução de 60%: saúde, educação, dispositivos médicos, medicamentos, alimentos, higiene, insumos agropecuários, cultura (anexos da LC 214).",
  red70: "Redução de 70%: locação e administração de imóveis.",
  zero: "Alíquota zero: cesta básica, hortícolas, alguns dispositivos médicos e medicamentos, acessibilidade (anexos da LC 214).",
};
