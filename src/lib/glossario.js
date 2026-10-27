// O que cada número e cada alerta do resumo quer dizer, em linguagem de
// dono de empresa — a explicação que abre por cima ao clicar num item do
// cartão no Início do cliente (components/ExplicaItem.jsx).
//   oque:     o que é, em uma ou duas frases;
//   calculo:  de onde sai, com os nomes da DRE/balanço;
//   leitura:  como interpretar (o que é bom, o que preocupa).

export const GLOSSARIO = {
  lucro: {
    titulo: "Lucro (resultado líquido)",
    oque: "O que sobrou no mês depois de pagar tudo: custos, despesas, juros e os impostos sobre o lucro.",
    calculo: "Receita líquida − custos − despesas operacionais ± resultado financeiro ± outras receitas e despesas − IRPJ e CSLL.",
    leitura: "Lucro é apurado por competência: entra quando a venda acontece, não quando o dinheiro chega. Por isso pode haver lucro com o caixa caindo (veja “Do lucro ao caixa”).",
  },
  lucroAno: {
    titulo: "Lucro no ano",
    oque: "O lucro somado de janeiro até o último mês fechado.",
    calculo: "Soma do resultado líquido de cada mês do ano.",
    leitura: "Mostra a tendência do ano sem o sobe e desce de um mês isolado — um mês fraco pesa menos no acumulado.",
  },
  receita: {
    titulo: "Receita líquida",
    oque: "O que a empresa vendeu no mês, já sem os impostos sobre a venda, devoluções e descontos.",
    calculo: "Receita bruta − deduções (PIS, COFINS, ICMS, ISS, devoluções e abatimentos).",
    leitura: "É a base de todas as margens. O ideal é a receita crescer sem que custos e despesas cresçam no mesmo ritmo.",
  },
  receitaAno: {
    titulo: "Receita no ano",
    oque: "A receita líquida somada de janeiro até o último mês fechado.",
    calculo: "Soma da receita líquida de cada mês do ano.",
    leitura: "Bom para comparar com o orçamento e com o mesmo período do ano passado.",
  },
  receitaBruta: {
    titulo: "Receita bruta",
    oque: "Tudo o que foi faturado no mês, antes de descontar impostos sobre a venda, devoluções e descontos.",
    calculo: "Soma das vendas de mercadorias, produtos e serviços.",
    leitura: "A diferença entre a bruta e a líquida mostra quanto da venda fica com impostos e devoluções.",
  },
  despesas: {
    titulo: "Despesas operacionais",
    oque: "Os gastos para manter a empresa funcionando que não dependem de cada venda: pessoal do administrativo, aluguel, sistemas, contabilidade, marketing, despesas comerciais e taxas.",
    calculo: "Despesas comerciais + administrativas + tributárias + outras despesas operacionais.",
    leitura: "Aqui, cair é bom. Despesa crescendo mais rápido que a receita aperta a margem mês a mês.",
  },
  custos: {
    titulo: "Custos",
    oque: "O custo direto do que foi vendido: mercadoria revendida, matéria-prima, mão de obra da produção ou de quem presta o serviço.",
    calculo: "CMV (mercadorias), CPV (produtos) ou CSP (serviços).",
    leitura: "Custos acompanham as vendas. O que importa é a proporção: custo subindo mais que a receita indica preço defasado ou compra mais cara.",
  },
  lucroBruto: {
    titulo: "Lucro bruto",
    oque: "O que sobra da venda depois do custo direto do que foi vendido — o que fica para pagar a estrutura e gerar lucro.",
    calculo: "Receita líquida − custos.",
    leitura: "Margem bruta (lucro bruto ÷ receita) baixa mostra preço apertado ou custo alto; com ela fraca, sobra pouco para as despesas.",
  },
  ebitda: {
    titulo: "EBITDA",
    oque: "Quanto a operação gera de resultado antes de juros, impostos sobre o lucro, depreciação e amortização. Mostra se o negócio, em si, se paga — sem o efeito de dívidas e da contabilização dos bens.",
    calculo: "Lucro operacional + depreciação e amortização (fora o resultado financeiro, IRPJ e CSLL).",
    leitura: "EBITDA positivo: a operação gera caixa. A margem EBITDA (EBITDA ÷ receita) permite comparar meses e empresas de tamanhos diferentes.",
  },
  margem: {
    titulo: "Margem líquida",
    oque: "De cada R$ 100 vendidos, quantos viraram lucro no fim.",
    calculo: "Lucro líquido ÷ receita líquida.",
    leitura: "Varia muito por setor. Mais importante que o número isolado é a tendência: margem caindo mês a mês pede atenção a preços e despesas.",
  },
  caixa: {
    titulo: "Caixa no fim do mês",
    oque: "O dinheiro disponível no último dia do mês: caixa, contas bancárias e aplicações de resgate imediato.",
    calculo: "Saldo das contas de caixa e equivalentes de caixa no balanço.",
    leitura: "Compare com o que vence nos próximos meses (fornecedores, salários, impostos, parcelas). Lucro não é caixa — veja “Do lucro ao caixa”.",
  },
  ponteCaixa: {
    titulo: "Do lucro ao caixa",
    oque: "Explica por que o dinheiro em caixa não mudou na mesma medida do lucro do mês.",
    calculo: "Lucro do mês ± o que ficou preso ou foi liberado em clientes a receber, estoques, fornecedores, impostos a pagar, empréstimos, investimentos e distribuição de lucros.",
    leitura: "Vender a prazo, comprar estoque ou pagar dívidas consome caixa mesmo com lucro; receber atrasados ou alongar prazos com fornecedores libera caixa.",
  },
  orcamento: {
    titulo: "Orçamento",
    oque: "O que foi realizado comparado com o que foi planejado para o ano.",
    calculo: "Realizado acumulado ÷ orçado para o mesmo período.",
    leitura: "Receita abaixo do orçado ou despesa acima pedem revisão do plano para os meses que faltam.",
  },
};

// Assunto de um alerta/ponto positivo (topic de analyze()) → o conceito que
// ajuda a entender.
const CONCEITO_DO_ASSUNTO = {
  resultado: "lucro",
  margens: "margem",
  ebitda: "ebitda",
  caixa: "caixa",
  fluxo: "ponteCaixa",
  receita: "receita",
  despesas: "despesas",
  pareto: "despesas",
  composicaoReceita: "receita",
  metas: "orcamento",
  comparativo: "lucro",
};

const ASSUNTOS = {
  endividamento: {
    titulo: "Endividamento",
    oque: "Quanto a empresa deve (fornecedores, empréstimos, impostos, salários a pagar) comparado com o patrimônio dos sócios.",
    calculo: "Passivo circulante + não circulante, comparado com o patrimônio líquido.",
    leitura: "Acima de 1x, a empresa deve mais do que vale para os sócios. Dívida de curto prazo concentrada aperta o caixa dos próximos meses.",
  },
  liquidez: {
    titulo: "Liquidez corrente",
    oque: "Se o que a empresa tem para receber e em caixa no curto prazo cobre o que ela tem para pagar no mesmo prazo.",
    calculo: "Ativo circulante ÷ passivo circulante.",
    leitura: "Acima de 1: folga para pagar as contas de até 12 meses. Abaixo de 1: atenção ao caixa.",
  },
  capitalGiro: {
    titulo: "Capital de giro",
    oque: "O dinheiro que fica girando na operação: estoques e clientes a receber, menos fornecedores e contas a pagar.",
    calculo: "Ativo circulante − passivo circulante.",
    leitura: "Negativo indica que as obrigações de curto prazo são maiores que os recursos de curto prazo.",
  },
  estoques: {
    titulo: "Estoques",
    oque: "Mercadorias e materiais parados à espera de venda ou uso.",
    calculo: "Saldo de estoques no balanço; o prazo médio compara com o custo das vendas.",
    leitura: "Estoque crescendo mais que as vendas é dinheiro parado na prateleira.",
  },
  recebiveis: {
    titulo: "Prazo de recebimento",
    oque: "Quantos dias, em média, os clientes levam para pagar.",
    calculo: "Saldo médio de clientes a receber ÷ receita × dias do período.",
    leitura: "Quanto maior o prazo, mais a empresa financia o cliente com o próprio caixa.",
  },
  financeiro: {
    titulo: "Resultado financeiro",
    oque: "Juros e tarifas pagos menos rendimentos de aplicações.",
    calculo: "Receitas financeiras − despesas financeiras.",
    leitura: "Juros consumindo boa parte do EBITDA indicam dívida cara ou alta.",
  },
  distribuicao: {
    titulo: "Distribuição de lucros",
    oque: "Lucros já destinados aos sócios e ainda não pagos.",
    calculo: "Saldo de lucros/dividendos a pagar no passivo.",
    leitura: "Valores altos a pagar no curto prazo competem com o caixa da operação.",
  },
  sazonalidade: {
    titulo: "Resultado mês a mês",
    oque: "Como o resultado varia ao longo dos meses.",
    calculo: "Resultado líquido de cada mês do período.",
    leitura: "Meses negativos podem ser sazonais ou lançamentos pontuais — vale entender a causa.",
  },
  equilibrio: {
    titulo: "Ponto de equilíbrio",
    oque: "A receita mínima para cobrir todos os custos e despesas sem lucro nem prejuízo.",
    calculo: "Despesas fixas ÷ margem de contribuição.",
    leitura: "Quanto mais a receita fica acima do ponto de equilíbrio, mais folga a empresa tem.",
  },
  pl: {
    titulo: "Patrimônio líquido",
    oque: "O que pertence aos sócios: o que a empresa tem menos o que deve.",
    calculo: "Ativo − passivo.",
    leitura: "Negativo significa que as dívidas superam os bens.",
  },
  indicadores: {
    titulo: "Indicadores",
    oque: "Medidas que resumem a saúde da empresa (margens, retorno, liquidez).",
    calculo: "Cada indicador compara dois números do balanço ou da DRE.",
    leitura: "Mais do que o valor isolado, importa a tendência e a comparação com a meta.",
  },
};

export function explicacaoDoAssunto(topic) {
  const conceito = CONCEITO_DO_ASSUNTO[topic];
  return (conceito && GLOSSARIO[conceito]) || ASSUNTOS[topic] || null;
}
