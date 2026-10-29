import { GLOSSARIO, explicacaoDoAssunto } from "./glossario.js";

// Conteúdos do hub (pedido do Izaias, 29/10/2026): guias curtos sobre os
// demonstrativos e os indicadores que o B.I. mostra, em linguagem de dono
// de empresa. O que cada número é vem do mesmo glossário das explicações do
// Início (lib/glossario.js) — o portal fala de um jeito só. Pra publicar mais
// um, é só acrescentar um item na lista: o cartão e a página saem sozinhos.
// Os desenhos ficam em hub/ilustracoes.jsx, chamados pelo `id`.
//
//   slug, categoria, titulo (com a palavra `italico` dentro), resumo,
//   miniatura (desenho do cartão), intro, secoes, comoLer, noBi,
//   relacionados (slugs de outros conteúdos).
//   Cada seção: { id, titulo, paragrafos?, ilustracao?, legenda?,
//   formulas?: [{ nome, conta, exemplo?, texto? }], itens?: [{ nome, texto }] }
//
// Os exemplos usam sempre a mesma empresa fictícia, de números redondos:
// receita líquida de 1.000, lucro bruto de 450, EBITDA de 180, lucro líquido
// de 80, ativo de 1.000 (circulante 600), passivo de 600 (circulante 400) e
// patrimônio líquido de 400.

const assunto = (topico) => explicacaoDoAssunto(topico);
// Frase do glossário encaixada no meio de outra: só a primeira letra muda.
const minuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

export const CATEGORIAS_DE_CONTEUDO = ["Demonstrativos", "Indicadores"];

export const CONTEUDOS = [
  {
    slug: "como-ler-a-dre",
    categoria: "Demonstrativos",
    titulo: "Como ler a DRE",
    italico: "DRE",
    resumo: "A demonstração do resultado, degrau por degrau: da venda ao lucro, e o que cada linha conta sobre a empresa.",
    miniatura: "dre",
    intro:
      "A DRE — Demonstração do Resultado do Exercício — conta a história de um período: quanto a empresa vendeu, quanto custou entregar o que vendeu, quanto gastou para funcionar e quanto sobrou no fim. Ela é lida de cima para baixo, como uma escada: cada degrau tira alguma coisa da receita até chegar ao lucro.",
    secoes: [
      {
        id: "a-escada",
        titulo: "A escada, do faturamento ao lucro",
        paragrafos: [
          "Na DRE, as linhas marcadas com (−) subtraem e as marcadas com (=) são subtotais. Os subtotais são os pontos de parada que importam: receita líquida, lucro bruto, resultado operacional e, no fim, o lucro líquido.",
          "Cada degrau responde a uma pergunta diferente. A receita líquida diz quanto da venda ficou com a empresa. O lucro bruto diz se o preço cobre o custo do que foi vendido. O resultado operacional diz se a estrutura cabe na receita. E o lucro líquido diz o que sobrou para os sócios depois de tudo.",
        ],
        ilustracao: "dre",
        legenda:
          "Uma empresa que faturou 1.200 e terminou com 80 de lucro líquido. O EBITDA não é uma linha obrigatória da DRE — aqui ele aparece entre as despesas e a depreciação para mostrar onde fica; no B.I., ele tem um demonstrativo próprio.",
      },
      {
        id: "linha-a-linha",
        titulo: "Linha a linha",
        paragrafos: ["Os nomes podem variar um pouco de uma empresa para outra, mas a ordem é sempre esta:"],
        itens: [
          { nome: GLOSSARIO.receitaBruta.titulo, texto: GLOSSARIO.receitaBruta.oque },
          { nome: "Deduções", texto: "Os impostos sobre a venda (como ICMS, ISS, PIS e Cofins), as devoluções e os descontos concedidos. No Simples Nacional, o DAS costuma aparecer aqui." },
          { nome: GLOSSARIO.receita.titulo, texto: GLOSSARIO.receita.oque },
          { nome: GLOSSARIO.custos.titulo, texto: GLOSSARIO.custos.oque },
          { nome: GLOSSARIO.lucroBruto.titulo, texto: GLOSSARIO.lucroBruto.oque },
          { nome: GLOSSARIO.despesas.titulo, texto: GLOSSARIO.despesas.oque },
          { nome: "Depreciação e amortização", texto: "O desgaste dos bens da empresa — máquinas, veículos, computadores, reformas — lançado aos poucos, ao longo da vida útil de cada um. É despesa, mas não sai do caixa no mês: o dinheiro saiu quando o bem foi comprado." },
          { nome: assunto("financeiro").titulo, texto: assunto("financeiro").oque },
          { nome: "IRPJ e CSLL", texto: "Os impostos sobre o lucro. No Simples Nacional eles já vêm dentro do DAS, junto com os impostos sobre a venda." },
          { nome: GLOSSARIO.lucro.titulo, texto: GLOSSARIO.lucro.oque },
        ],
      },
      {
        id: "competencia",
        titulo: "Lucro não é dinheiro no banco",
        paragrafos: [
          "A DRE segue o regime de competência: a venda entra no mês em que aconteceu, mesmo que o cliente pague só daqui a 60 dias; a despesa entra no mês a que se refere, mesmo que seja paga depois.",
          "Por isso uma empresa pode ter lucro e, ao mesmo tempo, ver o caixa cair — vendeu a prazo, comprou estoque ou pagou uma dívida. Quem explica essa diferença é o fluxo de caixa.",
        ],
      },
      {
        id: "tres-perguntas",
        titulo: "Três perguntas para fazer à DRE",
        itens: [
          { nome: "Estou vendendo mais?", texto: "Compare a receita líquida com o mesmo mês do ano passado, e não só com o mês anterior: muitos negócios têm meses fortes e fracos todo ano." },
          { nome: "Estou ganhando na venda?", texto: "Olhe a margem bruta (lucro bruto ÷ receita líquida). Se ela cai, o custo está subindo mais rápido que o preço." },
          { nome: "A estrutura cabe na receita?", texto: "Compare as despesas operacionais com a receita. Despesa crescendo mais rápido que a venda aperta o resultado mês a mês." },
        ],
      },
    ],
    comoLer: {
      bons: [
        "Receita crescendo com custos e despesas crescendo menos — as margens sobem.",
        "Lucro bruto estável ou subindo em relação à receita.",
        "Resultado financeiro pequeno perto do EBITDA: pouco juro pesando.",
        "Lucro positivo na maioria dos meses e no acumulado do ano.",
      ],
      alertas: [
        "Custo subindo mais rápido que a receita: preço defasado ou compra mais cara.",
        "Despesas fixas crescendo sem a receita acompanhar.",
        "Juros consumindo boa parte do EBITDA.",
        "Lucro que só aparece por receitas fora da operação, como a venda de um bem.",
      ],
      depende:
        "Margens e proporções mudam muito de um setor para outro: um supermercado vive com margem baixa e muito volume; uma consultoria, com margem alta e pouco custo direto. Compare a empresa com ela mesma ao longo do tempo e com empresas parecidas — não com uma média geral.",
    },
    noBi: "Em Demonstrativos, a DRE mês a mês e o acumulado do período; nos Gráficos, a cascata do resultado.",
    relacionados: ["margens", "ebitda-sem-misterio", "fluxo-de-caixa"],
  },
  {
    slug: "balanco-patrimonial",
    categoria: "Demonstrativos",
    titulo: "Balanço patrimonial em 5 minutos",
    italico: "5 minutos",
    resumo: "Uma foto da empresa num dia: o que ela tem, o que deve e o que é dos sócios.",
    miniatura: "balanco",
    intro:
      "Se a DRE é o filme do período, o balanço é a foto do último dia. De um lado, tudo o que a empresa tem e tem a receber — o ativo. Do outro, de onde veio o dinheiro para ter isso: de terceiros (o passivo) ou dos próprios sócios (o patrimônio líquido). Os dois lados sempre fecham no mesmo valor — daí o nome balanço.",
    secoes: [
      {
        id: "os-dois-lados",
        titulo: "Os dois lados",
        paragrafos: [
          "Toda a lógica do balanço cabe numa conta: ativo = passivo + patrimônio líquido. Se a empresa tem 1.000 em bens e direitos, esses 1.000 vieram de algum lugar — de fornecedores que deram prazo, de bancos, de impostos e salários ainda não pagos, ou do dinheiro dos sócios.",
        ],
        ilustracao: "balanco",
        legenda: "A empresa do exemplo tem 1.000 em bens e direitos; 600 vieram de terceiros (400 a pagar no curto prazo e 200 no longo) e 400 são dos sócios.",
      },
      {
        id: "curto-e-longo-prazo",
        titulo: "Curto e longo prazo",
        paragrafos: [
          "Os dois lados são divididos pelo prazo. Circulante é o que vira dinheiro (no ativo) ou precisa ser pago (no passivo) em até 12 meses. Não circulante é o que fica para depois disso.",
          "É essa divisão que permite saber se a empresa tem folga para as contas do ano — a conta dos indicadores de liquidez e do capital de giro.",
        ],
      },
      {
        id: "o-que-mora-em-cada-grupo",
        titulo: "O que mora em cada grupo",
        itens: [
          { nome: "Ativo circulante", texto: "Caixa e bancos, aplicações de resgate rápido, clientes a receber, estoques e impostos a recuperar." },
          { nome: "Ativo não circulante", texto: "Os bens de uso (máquinas, imóveis, veículos, computadores), os intangíveis (como marcas e sistemas), valores a receber depois de 12 meses e participações em outras empresas." },
          { nome: "Passivo circulante", texto: "Fornecedores, salários e encargos, impostos a pagar e as parcelas de empréstimos que vencem nos próximos 12 meses." },
          { nome: "Passivo não circulante", texto: "Empréstimos, financiamentos e parcelamentos que vencem depois de 12 meses." },
          { nome: assunto("pl").titulo, texto: `${assunto("pl").oque} Na prática: o capital que os sócios colocaram mais os lucros que ficaram na empresa (ou menos os prejuízos).` },
        ],
      },
      {
        id: "balanco-e-dre",
        titulo: "Como o balanço conversa com a DRE",
        paragrafos: [
          "O lucro do período não some: o que não é distribuído aos sócios vai para o patrimônio líquido, como lucros acumulados ou reservas. Um prejuízo faz o caminho inverso e diminui o patrimônio.",
          "Por isso um patrimônio líquido que cresce de um ano para o outro costuma ser sinal de uma empresa que gera resultado e guarda parte dele para crescer.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "Ativo circulante maior que o passivo circulante: folga para as contas do ano.",
        "Patrimônio líquido positivo e crescendo.",
        "Dívidas concentradas no longo prazo, com parcelas que cabem no caixa.",
        "Clientes a receber e estoques crescendo no mesmo ritmo das vendas.",
      ],
      alertas: [
        `Patrimônio líquido negativo: ${assunto("pl").leitura.replace(/^Negativo significa que /, "")}`,
        "Empréstimos de curto prazo crescendo mês a mês.",
        "Estoques ou clientes a receber crescendo bem mais rápido que as vendas.",
        "Impostos a pagar se acumulando no passivo.",
      ],
      depende:
        "Indústria e transporte têm muitos bens de uso; o comércio, muito estoque; empresas de serviço, quase só caixa e clientes a receber. A estrutura certa depende do negócio — o que mais diz é a evolução de um balanço para o outro.",
    },
    noBi: "Em Demonstrativos, o balanço de cada mês, com ativo, passivo e patrimônio líquido; nos Gráficos, a composição do balanço.",
    relacionados: ["indicadores-de-liquidez", "endividamento-e-roe", "capital-de-giro"],
  },
  {
    slug: "fluxo-de-caixa",
    categoria: "Demonstrativos",
    titulo: "Fluxo de caixa: de onde vem e para onde vai o dinheiro",
    italico: "dinheiro",
    resumo: "As entradas e saídas de dinheiro separadas em operação, investimentos e financiamentos — e a ponte do lucro ao caixa.",
    miniatura: "dfc",
    intro:
      "A Demonstração dos Fluxos de Caixa (DFC) mostra por onde o dinheiro entrou e saiu no período e explica por que o saldo do banco mudou. Ela separa o movimento em três blocos: o que a operação gerou, o que foi investido e o que veio de bancos e sócios — ou voltou para eles.",
    secoes: [
      {
        id: "do-inicio-ao-fim",
        titulo: "Do caixa inicial ao caixa final",
        paragrafos: ["A DFC começa no saldo de caixa do início do período, soma e subtrai os três blocos e termina no saldo do fim — que tem de bater com o caixa do balanço."],
        ilustracao: "dfc",
        legenda: "A operação gerou 110. A empresa investiu 50 numa máquina e, nos financiamentos, entraram 40 de um empréstimo novo e saíram 30 de parcelas e 30 de lucros distribuídos (−20 no total). O caixa foi de 60 para 100.",
      },
      {
        id: "os-tres-blocos",
        titulo: "Os três blocos",
        itens: [
          { nome: "Atividades operacionais", texto: "O dinheiro do dia a dia: o que entrou dos clientes menos o que saiu para fornecedores, salários, impostos e despesas. É o bloco mais importante — mostra se o negócio, em si, gera caixa." },
          { nome: "Atividades de investimento", texto: "Compra e venda de bens de longo prazo: máquinas, veículos, imóveis, sistemas, participações em outras empresas. Investir costuma consumir caixa hoje para gerar resultado depois." },
          { nome: "Atividades de financiamento", texto: "O dinheiro que vem de fora ou volta para fora: empréstimos tomados e pagos, dinheiro que os sócios colocam e lucros distribuídos a eles." },
        ],
      },
      {
        id: "do-lucro-ao-caixa",
        titulo: "Do lucro ao caixa",
        paragrafos: [
          `A ponte do lucro ao caixa ${minuscula(GLOSSARIO.ponteCaixa.oque)} O caminho parte do lucro, soma o que foi despesa mas não saiu do caixa (como a depreciação) e ajusta o que ficou preso ou foi liberado em clientes, estoques e fornecedores.`,
          GLOSSARIO.ponteCaixa.leitura,
        ],
        ilustracao: "lucroAoCaixa",
        legenda: "Lucro de 80, mais 30 de depreciação (despesa que não sai do caixa), menos 20 que ficaram a receber dos clientes, mais 20 de prazo a mais com fornecedores: 110 de caixa gerado pela operação.",
      },
      {
        id: "direta-ou-indireta",
        titulo: "Direta ou indireta?",
        paragrafos: [
          "Há dois jeitos de montar a DFC. A direta lista os recebimentos e os pagamentos, como um extrato organizado por assunto. A indireta parte do lucro e faz os ajustes até chegar no mesmo caixa — é a ponte do desenho acima. O saldo final é o mesmo; muda só o caminho.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "Caixa da operação positivo e, de preferência, perto do lucro ou acima dele.",
        "Investimentos pagos com o caixa da operação, sem depender de empréstimo.",
        "Distribuição de lucros que cabe no que a operação gerou.",
        "Saldo final suficiente para os compromissos dos próximos meses.",
      ],
      alertas: [
        "Caixa da operação negativo por vários meses seguidos, mesmo com lucro.",
        "Operação no vermelho coberta por empréstimos novos.",
        "Distribuição de lucros maior que o caixa gerado.",
        "Clientes a receber crescendo e consumindo o caixa.",
      ],
      depende:
        "Empresa crescendo rápido costuma ter caixa da operação menor que o lucro, porque financia mais clientes e mais estoque. E um ano de investimento pesado pode deixar o caixa total no negativo de propósito. Leia os três blocos juntos e ao longo de vários meses.",
    },
    noBi: "Em Demonstrativos, o fluxo de caixa nas formas direta e indireta; nos Gráficos, a cascata do fluxo de caixa e a ponte do lucro ao caixa.",
    relacionados: ["como-ler-a-dre", "capital-de-giro", "ebitda-sem-misterio"],
  },
  {
    slug: "ebitda-sem-misterio",
    categoria: "Indicadores",
    titulo: "EBITDA sem mistério",
    italico: "sem mistério",
    resumo: "O que a operação gera antes de juros, impostos sobre o lucro e depreciação — e o que ele não conta.",
    miniatura: "ebitda",
    intro: `EBITDA é a sigla, em inglês, de lucro antes de juros, impostos, depreciação e amortização (em português, às vezes se diz LAJIDA): o resultado da operação antes desses quatro itens. ${GLOSSARIO.ebitda.oque.slice(GLOSSARIO.ebitda.oque.indexOf("Mostra"))}`,
    secoes: [
      {
        id: "de-onde-sai",
        titulo: "De onde sai o número",
        paragrafos: [
          "Há dois caminhos que chegam ao mesmo lugar. De cima para baixo: a receita líquida menos os custos e as despesas operacionais, sem contar a depreciação e a amortização. De baixo para cima: o lucro líquido com os impostos sobre o lucro, o resultado financeiro e a depreciação somados de volta.",
        ],
        formulas: [
          { nome: "EBITDA", conta: GLOSSARIO.ebitda.calculo, exemplo: "150 + 30 = 180" },
          { nome: "Margem EBITDA", conta: "EBITDA ÷ receita líquida.", exemplo: "180 ÷ 1.000 = 18%" },
        ],
        ilustracao: "ebitda",
        legenda: "O lucro líquido de 80 com o que o EBITDA deixa de fora somado de volta: 40 de IR e CSLL, 30 de resultado financeiro (juros, no exemplo) e 30 de depreciação. EBITDA de 180 — 18% da receita líquida de 1.000.",
      },
      {
        id: "por-que-tirar",
        titulo: "Por que deixar juros, impostos e depreciação de fora?",
        itens: [
          { nome: "Juros", texto: "Dependem de como a empresa se financia, não de como ela opera. Duas lojas iguais, uma com empréstimo e outra sem, têm o mesmo EBITDA." },
          { nome: "IRPJ e CSLL", texto: "Dependem do regime tributário (Simples, Lucro Presumido ou Lucro Real). Sem eles, dá para comparar a operação de empresas em regimes diferentes." },
          { nome: "Depreciação e amortização", texto: "São despesas que não saem do caixa no mês — o dinheiro saiu lá atrás, quando o bem foi comprado." },
        ],
      },
      {
        id: "o-que-nao-mostra",
        titulo: "O que o EBITDA não mostra",
        paragrafos: [
          "EBITDA não é caixa. Ele não enxerga o dinheiro que fica preso em clientes e estoques, as parcelas de empréstimos, os impostos sobre o lucro nem o que é preciso investir para repor máquinas e equipamentos. Uma empresa pode ter EBITDA bonito e caixa apertado.",
          "Também não é lucro: quem tem muita dívida pode ter EBITDA positivo e prejuízo no fim, porque os juros ficam fora da conta.",
        ],
      },
      {
        id: "no-dia-a-dia",
        titulo: "Para que bancos e investidores usam",
        paragrafos: [
          "Bancos usam o EBITDA para medir a capacidade de pagar dívidas — por exemplo, comparando a dívida com o EBITDA de um ano, para saber quantos anos de geração ela representa. E é a base mais comum para estimar o valor de uma empresa, em múltiplos de EBITDA.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "EBITDA positivo e estável ou crescendo: a operação, sozinha, se paga.",
        "Margem EBITDA estável ou subindo: a operação ficando mais eficiente.",
        "Juros pequenos perto do EBITDA.",
      ],
      alertas: [
        "EBITDA negativo: a operação, sozinha, não se paga.",
        "Margem EBITDA caindo mesmo com a receita subindo.",
        "EBITDA alto e caixa da operação baixo por muito tempo — dinheiro preso em clientes e estoques.",
        "Dívida que levaria muitos anos de EBITDA para ser paga.",
      ],
      depende:
        "Não existe uma margem EBITDA ideal: negócios com muito investimento em máquinas e instalações costumam ter margens EBITDA maiores (a depreciação, que é grande, fica de fora), enquanto comércio e serviços vivem com margens menores. Compare com o histórico da própria empresa e com o setor.",
    },
    noBi: "Em Demonstrativos, o EBITDA mês a mês; em Indicadores, a margem EBITDA; nos Gráficos, a evolução dos dois.",
    relacionados: ["margens", "como-ler-a-dre", "endividamento-e-roe"],
  },
  {
    slug: "indicadores-de-liquidez",
    categoria: "Indicadores",
    titulo: "Indicadores de liquidez",
    italico: "liquidez",
    resumo: "Corrente, seca e imediata: se o que a empresa tem no curto prazo cobre o que ela deve no mesmo prazo.",
    miniatura: "liquidez",
    intro: `Liquidez é a capacidade de pagar as contas em dia. Os indicadores de liquidez respondem a uma pergunta só, com mais ou menos rigor: ${minuscula(assunto("liquidez").oque)}`,
    secoes: [
      {
        id: "o-circulante",
        titulo: "O ponto de partida: o circulante",
        paragrafos: [
          "Todos comparam pedaços do balanço: o que vira dinheiro em até 12 meses (o ativo circulante) contra o que vence no mesmo prazo (o passivo circulante). O que muda de um indicador para o outro é quanto do ativo entra na conta.",
        ],
        ilustracao: "liquidez",
        legenda: "Ativo circulante de 600 (caixa 100, clientes 300, estoques 200) contra 400 a pagar em até 12 meses (fornecedores 180, empréstimos 120 e outras 100, como salários e impostos).",
      },
      {
        id: "os-tres-indicadores",
        titulo: "Os três indicadores",
        formulas: [
          { nome: "Liquidez corrente", conta: assunto("liquidez").calculo, exemplo: "600 ÷ 400 = 1,5", texto: "Para cada R$ 1 que vence no ano, a empresa tem R$ 1,50 em caixa, clientes e estoques." },
          { nome: "Liquidez seca", conta: "(Ativo circulante − estoques) ÷ passivo circulante.", exemplo: "400 ÷ 400 = 1,0", texto: "Tira os estoques, que ainda precisam ser vendidos (e recebidos) para virar dinheiro." },
          { nome: "Liquidez imediata", conta: "Caixa e equivalentes ÷ passivo circulante.", exemplo: "100 ÷ 400 = 0,25", texto: "Só o que já está no banco. É normal ficar bem abaixo de 1: as contas do ano não vencem todas hoje." },
        ],
      },
      {
        id: "liquidez-geral",
        titulo: "E a liquidez geral?",
        paragrafos: [
          "Faz a mesma comparação com o longo prazo incluído: tudo o que a empresa tem contra tudo o que ela deve a terceiros. Ajuda a ver a folga de forma mais ampla, mas o aperto do dia a dia aparece primeiro na corrente e na seca.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "Liquidez corrente acima de 1: folga para pagar as contas de até 12 meses.",
        "Liquidez seca perto de 1 ou acima: a empresa não depende de vender o estoque para pagar as contas.",
        "Indicadores estáveis ou subindo ao longo dos meses.",
      ],
      alertas: [
        "Liquidez corrente abaixo de 1: atenção ao caixa.",
        "Distância grande entre a corrente e a seca: a folga depende do estoque girar.",
        "Liquidez caindo mês a mês, sobretudo por empréstimos de curto prazo.",
      ],
      depende:
        "Negócios que recebem à vista e pagam a prazo, como muitos supermercados e restaurantes, convivem bem com liquidez abaixo de 1. Quem vende a prazo e tem estoque alto precisa de mais folga. E liquidez alta demais pode indicar dinheiro parado, que renderia mais no próprio negócio.",
    },
    noBi: "Em Indicadores, a liquidez corrente e a geral; nos Gráficos, a evolução da liquidez. As contas da seca e da imediata saem do mesmo balanço.",
    relacionados: ["capital-de-giro", "balanco-patrimonial", "endividamento-e-roe"],
  },
  {
    slug: "margens",
    categoria: "Indicadores",
    titulo: "Margens: bruta, EBITDA e líquida",
    italico: "Margens",
    resumo: "De cada R$ 100 vendidos, quanto sobra em cada etapa — e o que cada margem revela sobre o negócio.",
    miniatura: "margens",
    intro:
      "Margem é uma porcentagem: quanto de cada real vendido sobra depois de uma etapa de gastos. As três mais usadas acompanham a DRE de cima para baixo e, juntas, mostram onde o dinheiro da venda fica pelo caminho.",
    secoes: [
      {
        id: "de-cada-100",
        titulo: "De cada R$ 100 vendidos",
        paragrafos: ["Todas as margens usam a mesma base — a receita líquida — e por isso podem ser comparadas entre meses e entre empresas de tamanhos diferentes."],
        ilustracao: "margens",
        legenda: "A mesma empresa da DRE do exemplo: receita líquida de 1.000, lucro bruto de 450, EBITDA de 180 e lucro líquido de 80.",
      },
      {
        id: "as-tres-margens",
        titulo: "As três margens",
        formulas: [
          { nome: "Margem bruta", conta: "Lucro bruto ÷ receita líquida.", exemplo: "450 ÷ 1.000 = 45%", texto: "Mostra se o preço cobre bem o custo do que é vendido — é a margem do produto ou do serviço." },
          { nome: "Margem EBITDA", conta: "EBITDA ÷ receita líquida.", exemplo: "180 ÷ 1.000 = 18%", texto: "Mostra quanto a operação inteira gera, já pagando a estrutura (pessoal, aluguel, sistemas), antes de juros, impostos sobre o lucro e depreciação." },
          { nome: GLOSSARIO.margem.titulo, conta: GLOSSARIO.margem.calculo, exemplo: "80 ÷ 1.000 = 8%", texto: GLOSSARIO.margem.oque },
        ],
      },
      {
        id: "lendo-juntas",
        titulo: "Lendo as margens juntas",
        itens: [
          { nome: "Margem bruta baixa", texto: "O problema está no preço ou no custo direto: negociação com fornecedores, desperdício, preço que ficou para trás." },
          { nome: "Bruta boa, EBITDA baixa", texto: "A estrutura está pesada para o tamanho da receita — pessoal, aluguel e outras despesas fixas." },
          { nome: "EBITDA boa, líquida baixa", texto: "Juros, depreciação ou impostos sobre o lucro estão pesando. Vale olhar a dívida." },
        ],
      },
      {
        id: "em-reais",
        titulo: "Margem também se mede em reais",
        paragrafos: [
          "Uma margem estável com a receita caindo significa menos dinheiro no fim do mês. E uma margem um pouco menor com muito mais volume pode deixar mais lucro em reais. Olhe sempre a porcentagem e o valor juntos.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "Margens estáveis ou subindo mês a mês.",
        "Margem bruta firme mesmo com aumento de custos — sinal de preço bem ajustado.",
        "Distância entre a margem EBITDA e a líquida pequena e estável.",
      ],
      alertas: [
        "Margem bruta caindo: custo subindo mais que o preço.",
        "Margem EBITDA caindo com a receita subindo: a estrutura cresceu demais.",
        "Margem líquida negativa por vários meses.",
      ],
      depende: `${GLOSSARIO.margem.leitura} Um atacado pode viver bem com margem líquida de poucos por cento vendendo muito volume; uma empresa de serviços especializados costuma precisar de margens maiores.`,
    },
    noBi: "Em Indicadores, as margens bruta, EBITDA e líquida; nos Gráficos, a evolução e o comparativo das margens.",
    relacionados: ["como-ler-a-dre", "ebitda-sem-misterio", "endividamento-e-roe"],
  },
  {
    slug: "endividamento-e-roe",
    categoria: "Indicadores",
    titulo: "Endividamento e rentabilidade (ROE)",
    italico: "rentabilidade",
    resumo: "Quanto da empresa é financiado por dívidas e quanto o dinheiro dos sócios está rendendo.",
    miniatura: "endividamento",
    intro:
      "Toda empresa se financia com duas fontes: dinheiro de terceiros (fornecedores, bancos, impostos e salários a pagar) e dinheiro dos sócios (o patrimônio líquido). O endividamento mostra o equilíbrio entre as duas; o ROE mostra quanto o dinheiro dos sócios rendeu.",
    secoes: [
      {
        id: "de-onde-vem",
        titulo: "De onde vem o dinheiro",
        paragrafos: [`O endividamento mostra ${minuscula(assunto("endividamento").oque)} O ROE pega o lucro e divide pelo patrimônio líquido — o quanto rendeu cada real que os sócios têm na empresa.`],
        ilustracao: "endividamento",
        legenda: "O lado direito do balanço do exemplo: 600 de terceiros e 400 dos sócios. Com lucro líquido de 80 no ano, o ROE é de 20%.",
      },
      {
        id: "os-indicadores",
        titulo: "Os indicadores",
        formulas: [
          { nome: "Endividamento (passivo ÷ PL)", conta: "Passivo circulante + não circulante, dividido pelo patrimônio líquido.", exemplo: "600 ÷ 400 = 1,5", texto: assunto("endividamento").leitura },
          { nome: "Composição do endividamento", conta: "Passivo circulante ÷ passivo total.", exemplo: "400 ÷ 600 = 67%", texto: "Quanto da dívida vence em até 12 meses. Quanto maior, mais pressão sobre o caixa do ano." },
          { nome: "ROE (retorno sobre o patrimônio líquido)", conta: "Lucro líquido ÷ patrimônio líquido.", exemplo: "80 ÷ 400 = 20%", texto: "Quanto o dinheiro dos sócios rendeu no período. Compare com o que ele renderia numa aplicação segura." },
          { nome: "ROA (retorno sobre o ativo)", conta: "Lucro líquido ÷ ativo total.", exemplo: "80 ÷ 1.000 = 8%", texto: "Quanto a empresa rende sobre tudo o que tem, não importa de quem veio o dinheiro." },
        ],
      },
      {
        id: "divida-e-ruim",
        titulo: "Dívida é ruim?",
        paragrafos: [
          "Não necessariamente. Dívida com juro menor do que a empresa ganha na operação aumenta o retorno dos sócios — é a chamada alavancagem. O risco aparece quando a dívida é cara, vence no curto prazo ou é grande demais para o caixa que a operação gera.",
          "Por isso endividamento e ROE se leem juntos: um ROE alto com endividamento alto rende bem, mas deixa menos margem para um ano ruim.",
        ],
      },
      {
        id: "cuidado-com-o-roe",
        titulo: "Um cuidado com o ROE",
        paragrafos: [
          "Se o patrimônio líquido é pequeno ou negativo, o ROE perde o sentido — um número enorme ou negativo não quer dizer muita coisa. E o ROE de poucos meses não é o do ano inteiro: compare sempre períodos do mesmo tamanho.",
        ],
      },
    ],
    comoLer: {
      bons: [
        "Endividamento estável ou caindo, com as dívidas mais no longo prazo.",
        "ROE acima do que o dinheiro renderia numa aplicação de baixo risco.",
        "Patrimônio líquido crescendo com lucros que ficam na empresa.",
      ],
      alertas: [
        `Patrimônio líquido negativo: ${assunto("pl").leitura.replace(/^Negativo significa que /, "")}`,
        "Endividamento subindo mês a mês, sobretudo no curto prazo.",
        "ROE baixo ou negativo por muito tempo: o dinheiro dos sócios renderia mais fora do negócio.",
        assunto("financeiro").leitura,
      ],
      depende:
        "Negócios que precisam de muito estoque ou de equipamentos caros costumam operar mais endividados. E empresas com pouco capital registrado podem mostrar um ROE alto sem que isso signifique folga. Olhe a evolução e converse com a sua equipe na Athos antes de tirar conclusões.",
    },
    noBi: "Em Indicadores, o endividamento, a composição do endividamento, o ROE e o ROA; nos Gráficos, a evolução de cada um.",
    relacionados: ["balanco-patrimonial", "margens", "indicadores-de-liquidez"],
  },
  {
    slug: "capital-de-giro",
    categoria: "Indicadores",
    titulo: "Capital de giro e ciclo de caixa",
    italico: "ciclo de caixa",
    resumo: "Quantos dias o dinheiro fica preso entre pagar o fornecedor e receber do cliente — e quanto isso pesa no caixa.",
    miniatura: "ciclo",
    intro: `Capital de giro é ${minuscula(assunto("capitalGiro").oque)} E o ciclo de caixa diz por quantos dias esse dinheiro fica preso antes de voltar.`,
    secoes: [
      {
        id: "o-ciclo",
        titulo: "O ciclo do dinheiro",
        paragrafos: [
          "Pense numa mercadoria: ela é comprada, fica um tempo no estoque, é vendida e, depois de um prazo, o cliente paga. Enquanto isso, o fornecedor também deu um prazo para receber. O ciclo de caixa — também chamado de ciclo financeiro — é a diferença entre esses tempos.",
        ],
        ilustracao: "ciclo",
        legenda: "A empresa compra no dia 0 e paga o fornecedor no dia 35. A mercadoria fica 40 dias no estoque e o cliente paga 30 dias depois da venda, no dia 70. Do dia 35 ao 70, quem financia a operação é o caixa da empresa.",
      },
      {
        id: "os-prazos",
        titulo: "Os prazos médios",
        formulas: [
          { nome: "Prazo médio de recebimento (PMR)", conta: "Saldo médio de clientes a receber ÷ receita bruta × dias do período.", exemplo: "30 dias", texto: assunto("recebiveis").leitura },
          { nome: "Prazo médio de estoque (PME)", conta: "Estoque médio ÷ custo das vendas × dias do período.", exemplo: "40 dias", texto: `Quanto tempo a mercadoria ou o material fica parado até ser vendido. ${assunto("estoques").leitura}` },
          { nome: "Prazo médio de pagamento (PMP)", conta: "Saldo médio de fornecedores ÷ compras (ou custo das vendas) × dias do período.", exemplo: "35 dias", texto: "Quanto tempo, em média, a empresa leva para pagar os fornecedores." },
          { nome: "Ciclo de caixa", conta: "PMR + PME − PMP.", exemplo: "30 + 40 − 35 = 35 dias", texto: "Quantos dias o dinheiro fica preso entre pagar os fornecedores e receber dos clientes. Sem o PMP, a soma PMR + PME é o ciclo operacional (70 dias no exemplo)." },
        ],
      },
      {
        id: "em-reais",
        titulo: "E o capital de giro em reais",
        paragrafos: [
          "Quanto maior o ciclo de caixa, mais dinheiro a empresa precisa ter girando. E quanto mais ela vende, mais capital de giro precisa — é por isso que crescer rápido pode apertar o caixa mesmo com lucro.",
        ],
        formulas: [{ nome: assunto("capitalGiro").titulo, conta: assunto("capitalGiro").calculo, exemplo: "600 − 400 = 200", texto: assunto("capitalGiro").leitura }],
        ilustracao: "capitalDeGiro",
        legenda: "O mesmo balanço do exemplo: 600 no ativo circulante e 400 no passivo circulante. Sobram 200 de capital de giro.",
      },
      {
        id: "como-encurtar",
        titulo: "Como encurtar o ciclo",
        itens: [
          { nome: "Receber mais cedo", texto: "Rever os prazos dados aos clientes, incentivar o pagamento à vista ou por Pix e cobrar os atrasados em dia." },
          { nome: "Girar o estoque", texto: "Comprar mais perto da venda, reduzir os itens parados e acompanhar o que encalha." },
          { nome: "Negociar com fornecedores", texto: "Prazos maiores, sem pagar mais caro por isso." },
          { nome: "Antecipar com cuidado", texto: "Antecipar recebíveis encurta o ciclo, mas tem custo — e o custo aparece no resultado financeiro." },
        ],
      },
    ],
    comoLer: {
      bons: [
        "Ciclo de caixa estável ou encurtando.",
        "Prazo de recebimento menor ou parecido com o de pagamento.",
        "Capital de giro positivo e acompanhando o crescimento das vendas.",
      ],
      alertas: [
        "Ciclo de caixa aumentando mês a mês.",
        "Prazo de estoque subindo: mercadoria parada.",
        "Capital de giro negativo junto com empréstimos de curto prazo crescendo.",
      ],
      depende:
        "Ciclo de caixa negativo é ótimo, e comum para quem vende à vista e paga a prazo, como muitos varejistas e restaurantes. Indústrias com estoque longo costumam ter ciclos maiores. Em empresas de serviço quase não há estoque, e o prazo de recebimento é o que mais pesa.",
    },
    noBi: "Em Indicadores, o capital de giro, os prazos médios e o ciclo financeiro; nos Gráficos, a evolução dos prazos e do capital de giro. Meses com o custo mal apurado podem distorcer o prazo de estoque — o cartão avisa quando isso acontece.",
    relacionados: ["indicadores-de-liquidez", "fluxo-de-caixa", "balanco-patrimonial"],
  },
];

export function conteudoPorSlug(slug) {
  return CONTEUDOS.find((conteudo) => conteudo.slug === slug) || null;
}

// Minutos de leitura contados do próprio texto (200 palavras por minuto,
// mais meio minuto por desenho), pra continuar certo quando o texto mudar.
export function tempoDeLeitura(conteudo) {
  const textos = [conteudo.intro, conteudo.comoLer?.depende, ...(conteudo.comoLer?.bons || []), ...(conteudo.comoLer?.alertas || [])];
  let desenhos = 0;
  for (const secao of conteudo.secoes || []) {
    textos.push(secao.titulo, secao.legenda, ...(secao.paragrafos || []));
    for (const item of secao.itens || []) textos.push(item.nome, item.texto);
    for (const formula of secao.formulas || []) textos.push(formula.nome, formula.conta, formula.exemplo, formula.texto);
    if (secao.ilustracao) desenhos += 1;
  }
  const palavras = textos.filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(palavras / 200 + desenhos * 0.5));
}
