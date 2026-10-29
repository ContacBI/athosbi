// Reforma Tributária no hub, só informação (hub/HubReforma.jsx — pedido do
// Izaias, 29/10/2026: "incremente mais coisas", sem simulador): o calendário
// ano a ano, o antes e depois dos tributos, o que muda por tipo de empresa,
// o glossário, a lista do que fazer agora e as fontes oficiais. Tudo a partir
// da EC 132/2023 e da LC 214/2025; o que ainda depende de regulamentação vem
// dito assim, sem número cravado. O resumo em quatro marcos (Início e topo da
// página) continua em lib/hub.js (LINHA_DA_REFORMA).

// icmsIss: quanto das alíquotas de hoje de ICMS e ISS vale em cada ano.
export const ANOS_DA_REFORMA = [
  {
    ano: 2026,
    titulo: "Ano de teste",
    icmsIss: 100,
    pontos: [
      "CBS de 0,9% e IBS de 0,1% aparecem destacados na nota fiscal.",
      "O valor pode ser compensado com o PIS e a Cofins devidos.",
      "Quem cumpre as obrigações acessórias fica dispensado de recolher.",
      "PIS, Cofins, IPI, ICMS e ISS seguem como hoje.",
    ],
  },
  {
    ano: 2027,
    titulo: "A CBS para valer",
    icmsIss: 100,
    pontos: [
      "PIS e Cofins acabam; a CBS passa a ser cobrada inteira.",
      "O IPI vai a zero, salvo produtos com industrialização incentivada na Zona Franca de Manaus.",
      "Começa o Imposto Seletivo.",
      "O IBS segue em teste, a 0,1%.",
    ],
  },
  {
    ano: 2028,
    titulo: "O IBS ainda em teste",
    icmsIss: 100,
    pontos: ["CBS inteira e IBS a 0,1%, como em 2027.", "ICMS e ISS ainda com as alíquotas de hoje."],
  },
  { ano: 2029, titulo: "Começa a troca", icmsIss: 90, pontos: ["ICMS e ISS caem para 90% das alíquotas de hoje.", "O IBS sobe para ocupar o espaço."] },
  { ano: 2030, titulo: "Segundo degrau", icmsIss: 80, pontos: ["ICMS e ISS a 80% das alíquotas de hoje.", "O IBS continua subindo."] },
  { ano: 2031, titulo: "Terceiro degrau", icmsIss: 70, pontos: ["ICMS e ISS a 70% das alíquotas de hoje.", "O IBS continua subindo."] },
  { ano: 2032, titulo: "Último ano da convivência", icmsIss: 60, pontos: ["ICMS e ISS a 60% das alíquotas de hoje.", "Último ano em que os dois sistemas andam juntos."] },
  { ano: 2033, titulo: "Sistema novo completo", icmsIss: 0, pontos: ["ICMS e ISS deixam de existir.", "Ficam a CBS e o IBS — o IVA dual — e o Imposto Seletivo."] },
];

export const ANTES_E_DEPOIS = [
  {
    hoje: [
      { sigla: "PIS", esfera: "federal" },
      { sigla: "Cofins", esfera: "federal" },
      { sigla: "IPI", esfera: "federal" },
    ],
    depois: { sigla: "CBS", nome: "Contribuição sobre Bens e Serviços", esfera: "federal" },
    quando: "PIS e Cofins acabam em 2027. O IPI vai a zero no mesmo ano, salvo para produtos com industrialização incentivada na Zona Franca de Manaus.",
  },
  {
    hoje: [
      { sigla: "ICMS", esfera: "estadual" },
      { sigla: "ISS", esfera: "municipal" },
    ],
    depois: { sigla: "IBS", nome: "Imposto sobre Bens e Serviços", esfera: "estados e municípios" },
    quando: "Caem aos poucos de 2029 a 2032 e deixam de existir em 2033. O IBS é administrado em conjunto pelo Comitê Gestor do IBS.",
  },
  {
    hoje: [],
    depois: { sigla: "IS", nome: "Imposto Seletivo", esfera: "federal" },
    quando: "Novo, a partir de 2027 — só sobre produtos prejudiciais à saúde ou ao meio ambiente.",
  },
];

export const ALVOS_DO_SELETIVO = ["Produtos de tabaco", "Bebidas alcoólicas", "Bebidas açucaradas", "Veículos", "Embarcações e aeronaves", "Extração mineral", "Apostas e concursos de prognósticos"];

export const POR_TIPO_DE_EMPRESA = [
  {
    id: "comercio",
    titulo: "Comércio",
    resumo: "Crédito em quase tudo o que entra e imposto que acompanha a mercadoria até o destino.",
    pontos: [
      "O imposto pago na compra das mercadorias vira crédito — e o crédito passa a valer também para o que é usado no negócio, como energia, aluguel e fretes. Fica de fora o que é de uso pessoal.",
      "Nas vendas para outros estados e municípios, o imposto fica com o lugar de quem compra (princípio do destino).",
      "O IBS e a CBS são calculados por fora do preço e vêm destacados na nota: vale revisar a formação de preço e a margem de cada linha de produto.",
      "A substituição tributária do ICMS vai junto com o ICMS: convive com o sistema novo até 2032.",
    ],
  },
  {
    id: "industria",
    titulo: "Indústria",
    resumo: "Crédito amplo nos insumos, fim do IPI na maior parte dos produtos e o Seletivo para alguns.",
    pontos: [
      "Matéria-prima, embalagens, energia e as máquinas usadas na produção geram crédito.",
      "O IPI vai a zero em 2027, salvo para produtos com industrialização incentivada na Zona Franca de Manaus.",
      "Quem fabrica itens do Imposto Seletivo — como bebidas açucaradas e veículos — passa a ter esse tributo a partir de 2027.",
      "Exportações continuam sem IBS e CBS, com direito de manter os créditos das compras.",
    ],
  },
  {
    id: "servicos",
    titulo: "Serviços",
    resumo: "As mesmas regras de crédito dos produtos — mas a folha, o maior custo, não gera crédito.",
    pontos: [
      "No sistema novo, os serviços seguem a mesma regra de crédito amplo dos produtos: o imposto pago nas compras do negócio vira crédito.",
      "A folha de salários, o maior custo de muitos serviços, não gera crédito — por isso o efeito da alíquota nova costuma pesar mais aqui.",
      "Saúde e educação têm redução de 60%; profissões intelectuais regulamentadas, como contadores, advogados e engenheiros, de 30%.",
      "Para clientes que são empresas, o imposto destacado na nota vira crédito — o que pode deixar o preço mais competitivo do que parece.",
    ],
  },
  {
    id: "agro",
    titulo: "Agro",
    resumo: "Reduções para insumos e alimentos e um caminho próprio para o pequeno produtor.",
    pontos: [
      "Insumos agropecuários e alimentos destinados ao consumo humano têm redução de 60%; os da Cesta Básica Nacional, alíquota zero.",
      "O produtor rural com receita abaixo do limite da lei fica fora do IBS e da CBS, a não ser que opte por entrar — e quem compra dele pode ter direito a um crédito presumido.",
      "Exportações continuam sem IBS e CBS.",
      "O cadastro dos produtos (NCM) bem feito é o que garante a redução certa em cada item.",
    ],
  },
  {
    id: "simples",
    titulo: "Simples Nacional",
    resumo: "O Simples continua — com uma escolha nova para quem vende para outras empresas.",
    pontos: [
      "O Simples Nacional continua, e o MEI também. Por padrão, IBS e CBS ficam dentro da guia única (o DAS).",
      "Quem compra de uma empresa do Simples só aproveita como crédito o que ela recolheu no DAS — um crédito menor que o do regime regular.",
      "A empresa pode optar por recolher IBS e CBS por fora, pelo regime regular, para o cliente aproveitar o crédito inteiro.",
      "Costuma fazer sentido para quem vende para outras empresas; para quem vende ao consumidor final, ficar no DAS tende a ser o mais simples. É uma decisão para estudar com o escritório.",
    ],
  },
];

export const GLOSSARIO_DA_REFORMA = [
  { termo: "CBS", definicao: "Contribuição sobre Bens e Serviços. O tributo federal que substitui PIS, Cofins e IPI. Em teste em 2026 e cobrada inteira a partir de 2027." },
  { termo: "IBS", definicao: "Imposto sobre Bens e Serviços. O tributo de estados e municípios que substitui ICMS e ISS, cobrado no destino. Em teste até 2028, sobe de 2029 a 2032 e fica completo em 2033." },
  { termo: "Imposto Seletivo (IS)", definicao: "Tributo federal sobre produtos prejudiciais à saúde ou ao meio ambiente, como cigarros, bebidas alcoólicas e açucaradas, veículos, extração mineral e apostas. Começa em 2027." },
  { termo: "IVA dual", definicao: "O nome do modelo: um imposto sobre o valor agregado dividido em dois — a CBS, federal, e o IBS, de estados e municípios —, com as mesmas regras de base e de crédito." },
  { termo: "Não cumulatividade (crédito amplo)", definicao: "O imposto pago em cada compra vira crédito para abater do imposto da venda, e cada etapa paga só sobre o valor que agregou. É amplo porque vale para quase tudo o que a empresa compra — fica de fora o que é de uso ou consumo pessoal." },
  { termo: "Princípio do destino", definicao: "O imposto fica com o estado e o município onde o bem ou o serviço é consumido, e não onde foi produzido." },
  { termo: "Split payment", definicao: "Recolhimento na hora do pagamento: quando o cliente paga por um meio eletrônico, a parte do imposto pode ser separada na liquidação e enviada direto ao fisco. A implantação é gradual." },
  { termo: "Cashback", definicao: "Devolução de parte da CBS e do IBS às famílias de baixa renda inscritas no CadÚnico." },
  { termo: "Comitê Gestor do IBS", definicao: "Órgão formado por estados e municípios que administra o IBS em conjunto — arrecada, distribui o dinheiro entre eles e uniformiza as regras." },
  { termo: "CST e cClassTrib", definicao: "Códigos que vão em cada item da nota fiscal desde 2026 para dizer como ele é tributado no IBS e na CBS: o CST indica a situação tributária (tributação integral, redução, isenção…) e o cClassTrib, a classificação detalhada, que aponta a regra da lei aplicada." },
  { termo: "Alíquota de referência", definicao: "A alíquota que serve de base para a União, os estados e os municípios durante a transição, calibrada para manter a arrecadação. Ainda não está fixada; as estimativas do Ministério da Fazenda têm ficado entre 26% e 28%, somando CBS e IBS." },
  { termo: "Cesta Básica Nacional", definicao: "Lista de alimentos definida em lei complementar que fica com alíquota zero de IBS e CBS." },
  { termo: "NCM e NBS", definicao: "Os códigos que classificam produtos (NCM) e serviços (NBS). É por eles que a lei diz se um item tem alíquota cheia, reduzida ou zero." },
  { termo: "Obrigações acessórias", definicao: "As declarações e os documentos que a empresa entrega além de pagar o imposto — como a nota fiscal com os campos certos. Em 2026, cumpri-las é o que dispensa o recolhimento do teste." },
];

export const O_QUE_FAZER_AGORA = [
  { id: "notas", texto: "Confirmar que o sistema emissor já preenche IBS e CBS na nota", detalhe: "Os campos CST e cClassTrib de cada item, que a nota traz desde 2026." },
  { id: "cadastro", texto: "Revisar o cadastro de produtos e serviços", detalhe: "NCM, NBS e a classificação tributária de cada item — é deles que sai a alíquota certa." },
  { id: "creditos", texto: "Mapear o que a empresa compra e o que vai gerar crédito", detalhe: "E guardar as notas dos fornecedores em ordem: o crédito sai delas." },
  { id: "fornecedores", texto: "Conversar com os principais fornecedores", detalhe: "O regime de cada um (Simples ou regular) muda o crédito que você recebe." },
  { id: "preco", texto: "Revisar a formação de preço dos principais produtos e serviços", detalhe: "Com crédito amplo e alíquotas novas, o custo das compras e o preço de venda mudam." },
  { id: "contratos", texto: "Reler os contratos longos", detalhe: "Aluguel, fornecimento e serviços que passam de 2027: veja as cláusulas de tributos e de reajuste." },
  { id: "simples", texto: "Se a empresa é do Simples, avaliar recolher IBS e CBS por fora", detalhe: "Pode valer a pena para quem vende para outras empresas." },
  { id: "caixa", texto: "Planejar o caixa para o split payment", detalhe: "Com o imposto separado no pagamento, esse dinheiro deixa de passar pelo caixa da empresa." },
  { id: "acompanhar", texto: "Acompanhar as regulamentações com a sua equipe na Athos", detalhe: "Alíquotas e detalhes ainda serão publicados ao longo da transição." },
];

export const FONTES_OFICIAIS = [
  {
    titulo: "Emenda Constitucional 132/2023",
    descricao: "Aprova a Reforma Tributária do consumo. Promulgada em 20/12/2023.",
    site: "planalto.gov.br",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
  },
  {
    titulo: "Lei Complementar 214/2025",
    descricao: "Institui o IBS, a CBS e o Imposto Seletivo e traz as regras da transição. Sancionada em 16/01/2025.",
    site: "planalto.gov.br",
    url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
  },
  {
    titulo: "Reforma Tributária no Ministério da Fazenda",
    descricao: "A página oficial do governo federal sobre a reforma.",
    site: "gov.br",
    url: "https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria",
  },
];

// O que já foi marcado na lista "O que fazer agora": só uma conveniência de
// quem está lendo, guardada neste navegador. Sem armazenamento (aba anônima,
// site bloqueado), a lista funciona igual e só não lembra na próxima visita.
const CHAVE_DOS_FEITOS = "athosbi.hub.reforma.feitos.v1";

export function lerFeitos(armazenamento) {
  try {
    const lugar = armazenamento ?? globalThis.localStorage;
    const lista = JSON.parse(lugar?.getItem(CHAVE_DOS_FEITOS) || "[]");
    const validos = new Set(O_QUE_FAZER_AGORA.map((item) => item.id));
    return Array.isArray(lista) ? lista.filter((id) => validos.has(id)) : [];
  } catch {
    return [];
  }
}

export function gravarFeitos(ids, armazenamento) {
  try {
    const lugar = armazenamento ?? globalThis.localStorage;
    lugar?.setItem(CHAVE_DOS_FEITOS, JSON.stringify(ids));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}
