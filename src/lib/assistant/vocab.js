// Vocabulário do assistente de apresentação (lib/assistant): tudo que ele
// reconhece num pedido escrito em português — assuntos, públicos,
// ocasiões, tom, tamanho, meses e números por extenso. As expressões
// estão já "normalizadas" (minúsculas, sem acento — ver norm em
// parse.js); cada uma casa como palavra/frase inteira.

export function norm(text) {
  return String(text || "")
    .replace(/º/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Assuntos. `group` agrupa em capítulos (resultado, patrimônio, fechamento);
// `rank` é a ordem natural numa apresentação quando ninguém pediu ordem.

export const TOPICS = [
  {
    id: "visao",
    label: "Visão geral",
    group: "abertura",
    rank: 1,
    words: [
      "visao geral", "panorama", "resumo", "resumao", "overview", "numeros principais", "principais numeros", "principais indicadores",
      "destaques do periodo", "destaques do mes", "como foi o periodo", "como foi o mes", "como foi o trimestre", "como foi o ano", "como foi o semestre",
      "desempenho geral", "situacao geral", "situacao da empresa", "saude financeira", "raio x", "raio-x", "numeros do periodo", "big numbers", "principais resultados",
    ],
  },
  {
    id: "receita",
    label: "Receita",
    group: "resultado",
    rank: 10,
    words: [
      "receita", "receitas", "faturamento", "faturou", "faturamos", "faturar", "venda", "vendas", "vendeu", "vendemos", "vender", "receita bruta",
      "receita liquida", "receita operacional", "top line", "ticket", "ticket medio", "servicos prestados", "prestacao de servicos", "mensalidades",
      "contratos", "volume de vendas", "crescimento de vendas", "queda de vendas", "comercial",
    ],
  },
  {
    id: "composicaoReceita",
    label: "Composição da receita",
    group: "resultado",
    rank: 11,
    words: [
      "composicao da receita", "mix de receita", "mix de vendas", "mix de produtos", "de onde vem a receita", "de onde vem o faturamento", "linhas de receita",
      "fontes de receita", "receita por linha", "receita por tipo", "receita por produto", "receita por servico", "participacao de cada receita", "concentracao de receita",
    ],
  },
  {
    id: "deducoes",
    label: "Deduções da receita",
    group: "resultado",
    rank: 12,
    words: [
      "deducoes", "deducao", "devolucoes", "devolucao", "impostos sobre vendas", "impostos sobre faturamento", "impostos sobre a receita", "abatimentos",
      "cancelamentos", "receita bruta para liquida", "da bruta para a liquida",
    ],
  },
  {
    id: "custos",
    label: "Custos",
    group: "resultado",
    rank: 13,
    words: [
      "custo", "custos", "cmv", "cpv", "csp", "custo das mercadorias", "custo das mercadorias vendidas", "custo dos produtos", "custo dos produtos vendidos",
      "custo dos servicos", "custo dos servicos prestados", "custo de producao", "custos diretos", "custo direto", "insumos", "materia prima", "materias primas",
      "compras", "mao de obra direta", "custo variavel", "custos variaveis", "margem bruta caiu", "producao", "fabrica",
    ],
  },
  {
    id: "despesas",
    label: "Despesas",
    group: "resultado",
    rank: 14,
    words: [
      "despesa", "despesas", "gasto", "gastos", "despesas operacionais", "despesas administrativas", "despesas comerciais", "despesas gerais", "estrutura",
      "overhead", "custo fixo", "custos fixos", "gastos fixos", "despesas fixas", "ocupacao", "aluguel", "alugueis", "tecnologia", "sistemas", "marketing",
      "publicidade", "viagens", "consultorias", "servicos de terceiros", "terceirizados", "energia", "telefone", "manutencao", "corte de gastos", "cortar gastos",
      "reducao de despesas", "reduzir despesas", "enxugar",
    ],
  },
  {
    id: "pessoal",
    label: "Pessoal e folha",
    group: "resultado",
    rank: 15,
    words: [
      "folha", "folha de pagamento", "pessoal", "salario", "salarios", "encargos", "encargos sociais", "beneficios", "funcionarios", "empregados",
      "headcount", "quadro de pessoal", "contratacoes", "demissoes", "rescisoes", "ferias", "decimo terceiro", "fgts", "custo com pessoal", "gasto com pessoal",
    ],
  },
  {
    id: "pareto",
    label: "Maiores despesas",
    group: "resultado",
    rank: 16,
    words: [
      "maiores despesas", "principais despesas", "maiores gastos", "principais gastos", "onde gastamos", "onde estamos gastando", "onde gasta",
      "para onde vai o dinheiro", "pareto", "top despesas", "ranking de despesas", "ranking dos gastos", "curva abc", "despesas que mais pesam", "o que mais pesa",
    ],
  },
  {
    id: "margens",
    label: "Margens",
    group: "resultado",
    rank: 17,
    words: [
      "margem", "margens", "margem bruta", "margem liquida", "margem de contribuicao", "margem operacional", "lucratividade", "rentabilidade das vendas",
      "quanto sobra", "quanto sobra de cada real", "sobra de cada venda",
    ],
  },
  {
    id: "resultado",
    label: "Resultado",
    group: "resultado",
    rank: 18,
    words: [
      "resultado", "resultados", "lucro", "lucros", "prejuizo", "prejuizos", "lucro liquido", "resultado liquido", "resultado do periodo", "resultado do mes",
      "resultado do ano", "ganhou", "perdeu", "deu lucro", "deu prejuizo", "bottom line", "do faturamento ao lucro", "da receita ao lucro", "cascata", "dre",
      "demonstracao do resultado", "demonstrativo de resultado", "lucrou",
    ],
  },
  {
    id: "ebitda",
    label: "EBITDA",
    group: "resultado",
    rank: 19,
    words: ["ebitda", "lajida", "lajir", "ebit", "geracao operacional", "resultado operacional", "desempenho operacional", "operacao", "eficiencia operacional"],
  },
  {
    id: "financeiro",
    label: "Resultado financeiro",
    group: "resultado",
    rank: 20,
    words: [
      "resultado financeiro", "despesas financeiras", "despesa financeira", "receitas financeiras", "receita financeira", "juros", "juros pagos", "juros bancarios",
      "tarifas bancarias", "tarifas", "rendimentos", "rendimento das aplicacoes", "custo da divida", "encargos financeiros", "iof", "multas", "descontos obtidos",
    ],
  },
  {
    id: "caixa",
    label: "Caixa",
    group: "patrimonio",
    rank: 30,
    words: [
      "caixa", "disponibilidades", "disponivel", "saldo em banco", "saldo bancario", "saldo em conta", "saldos bancarios", "dinheiro em caixa", "caixa e equivalentes",
      "bancos", "aplicacoes", "aplicacao financeira", "folego", "folego de caixa", "reserva", "reservas de caixa", "colchao", "dinheiro disponivel", "posicao de caixa",
      "quanto tem em caixa", "quanto temos em caixa",
    ],
  },
  {
    id: "fluxo",
    label: "Fluxo de caixa",
    group: "patrimonio",
    rank: 31,
    words: [
      "fluxo de caixa", "dfc", "geracao de caixa", "gerou caixa", "gera caixa", "queimou caixa", "queima de caixa", "consumo de caixa", "entradas e saidas",
      "de onde veio o dinheiro", "para onde foi o dinheiro", "movimentacao financeira", "recebimentos e pagamentos", "caixa operacional", "fluxo operacional",
    ],
  },
  {
    id: "endividamento",
    label: "Endividamento",
    group: "patrimonio",
    rank: 32,
    words: [
      "endividamento", "endividada", "endividado", "divida", "dividas", "emprestimo", "emprestimos", "financiamento", "financiamentos", "obrigacoes financeiras",
      "alavancagem", "alavancada", "credores", "parcelamento", "parcelamentos", "pronampe", "bndes", "capital de terceiros", "passivo bancario", "divida bancaria",
      "divida liquida", "capacidade de endividamento", "amortizacao", "amortizacoes", "parcelas",
    ],
  },
  {
    id: "liquidez",
    label: "Liquidez",
    group: "patrimonio",
    rank: 33,
    words: [
      "liquidez", "capacidade de pagamento", "solvencia", "consegue pagar", "conseguimos pagar", "pagar as contas", "honrar compromissos", "folga financeira",
      "liquidez corrente", "liquidez geral", "liquidez seca", "liquidez imediata", "aperto de caixa",
    ],
  },
  {
    id: "capitalGiro",
    label: "Capital de giro e prazos",
    group: "patrimonio",
    rank: 34,
    words: [
      "capital de giro", "ncg", "necessidade de capital de giro", "ciclo financeiro", "ciclo de caixa", "ciclo operacional", "prazo medio", "prazos medios",
      "prazo de recebimento", "prazo de pagamento", "prazo de estoque", "pmr", "pmp", "pme", "giro de estoque", "dias de recebimento", "dias de pagamento",
    ],
  },
  {
    id: "recebiveis",
    label: "Clientes e recebíveis",
    group: "patrimonio",
    rank: 35,
    words: ["contas a receber", "recebiveis", "a receber", "inadimplencia", "inadimplentes", "duplicatas a receber", "carteira de clientes", "clientes a receber", "saldo de clientes"],
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    group: "patrimonio",
    rank: 36,
    words: ["fornecedores", "fornecedor", "contas a pagar", "a pagar", "prazo com fornecedores", "dividas com fornecedores"],
  },
  {
    id: "estoques",
    label: "Estoques",
    group: "patrimonio",
    rank: 37,
    words: ["estoque", "estoques", "inventario", "mercadorias em estoque", "giro do estoque", "produtos em estoque", "materia prima em estoque"],
  },
  {
    id: "investimentos",
    label: "Investimentos",
    group: "patrimonio",
    rank: 38,
    words: [
      "investimento", "investimentos", "imobilizado", "capex", "maquinas", "maquinario", "equipamentos", "veiculos", "compra de ativos", "ativo fixo", "expansao",
      "imoveis", "obras", "intangivel", "software",
    ],
  },
  {
    id: "balanco",
    label: "Balanço patrimonial",
    group: "patrimonio",
    rank: 39,
    words: [
      "balanco", "balanco patrimonial", "patrimonio", "ativo", "ativos", "passivo", "passivos", "bens e direitos", "obrigacoes", "solidez", "estrutura patrimonial",
      "estrutura de capital", "posicao patrimonial", "bp",
    ],
  },
  {
    id: "pl",
    label: "Patrimônio líquido",
    group: "patrimonio",
    rank: 40,
    words: ["patrimonio liquido", "pl", "capital social", "lucros acumulados", "prejuizos acumulados", "reservas de lucro", "patrimonio negativo", "aporte de capital"],
  },
  {
    id: "distribuicao",
    label: "Distribuição de lucros",
    group: "patrimonio",
    rank: 41,
    words: [
      "distribuicao de lucros", "distribuicao", "distribuir lucros", "dividendos", "retirada dos socios", "retiradas", "pro labore", "pro-labore", "prolabore",
      "lucros distribuidos", "antecipacao de lucros", "quanto da pra distribuir", "quanto pode distribuir",
    ],
  },
  {
    id: "tributos",
    label: "Impostos",
    group: "resultado",
    rank: 21,
    words: [
      "imposto", "impostos", "tributo", "tributos", "tributacao", "carga tributaria", "fiscal", "icms", "iss", "pis", "cofins", "irpj", "csll", "simples nacional",
      "das", "lucro presumido", "lucro real", "reforma tributaria", "ir e csll", "impostos pagos",
    ],
  },
  {
    id: "indicadores",
    label: "Indicadores e rentabilidade",
    group: "fechamento",
    rank: 50,
    words: [
      "indicador", "indicadores", "indices", "kpi", "kpis", "metricas", "roe", "roa", "retorno sobre", "rentabilidade", "retorno do investimento", "retorno sobre o patrimonio",
      "giro do ativo", "painel de indicadores", "radar",
    ],
  },
  {
    id: "equilibrio",
    label: "Ponto de equilíbrio",
    group: "fechamento",
    rank: 51,
    words: [
      "ponto de equilibrio", "break even", "breakeven", "break-even", "empate", "faturamento minimo", "quanto precisa vender", "quanto precisamos vender",
      "quanto precisa faturar", "margem de seguranca", "pagar a estrutura",
    ],
  },
  {
    id: "sazonalidade",
    label: "Evolução mês a mês",
    group: "fechamento",
    rank: 52,
    words: ["sazonalidade", "sazonal", "tendencia", "tendencias", "evolucao", "evolucao mensal", "historico", "melhor mes", "pior mes", "mes a mes", "mes-a-mes", "mensalmente", "ao longo dos meses"],
  },
  {
    id: "comparativo",
    label: "Comparação com outro período",
    group: "fechamento",
    rank: 53,
    words: [
      "comparar", "comparativo", "comparacao", "versus", "vs", "ano passado", "ano anterior", "mesmo periodo do ano passado", "ano contra ano", "yoy",
      "periodo anterior", "mes anterior", "trimestre anterior", "em relacao ao ano passado", "frente ao ano passado", "contra o ano passado",
    ],
  },
  {
    id: "metas",
    label: "Metas",
    group: "fechamento",
    rank: 54,
    words: ["meta", "metas", "objetivo", "objetivos", "orcamento", "orcado", "previsto", "planejado", "realizado", "budget", "forecast", "projecao", "projecoes", "alvo"],
  },
  {
    id: "grupo",
    label: "Empresas do grupo",
    group: "fechamento",
    rank: 55,
    words: ["empresas do grupo", "consolidado", "cada empresa", "por empresa", "comparar empresas", "comparativo entre empresas", "holding"],
  },
  {
    id: "positivos",
    label: "Pontos positivos",
    group: "fechamento",
    rank: 60,
    words: ["pontos positivos", "o que melhorou", "o que esta bom", "conquistas", "boas noticias", "destaques positivos", "pontos fortes", "o que deu certo", "vitorias"],
  },
  {
    id: "alertas",
    label: "Pontos de atenção",
    group: "fechamento",
    rank: 61,
    words: [
      "pontos de atencao", "ponto de atencao", "alerta", "alertas", "risco", "riscos", "problema", "problemas", "o que preocupa", "preocupacoes", "preocupacao",
      "atencao", "gargalos", "gargalo", "o que esta ruim", "o que piorou", "sinais de alerta", "pontos fracos", "fragilidades", "o que melhorar",
    ],
  },
  {
    id: "proximos",
    label: "Próximos passos",
    group: "fechamento",
    rank: 62,
    words: [
      "proximos passos", "plano de acao", "acoes", "recomendacoes", "recomendacao", "sugestoes", "sugestao", "o que fazer", "proximas etapas", "encaminhamentos",
      "prioridades", "decisoes", "plano", "medidas", "providencias", "o que mudar",
    ],
  },
  {
    id: "conclusao",
    label: "Conclusão",
    group: "fechamento",
    rank: 63,
    words: ["conclusao", "conclusoes", "mensagem final", "recado final", "resumo final", "takeaways", "principais mensagens", "para fechar", "em resumo"],
  },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));

// ---------------------------------------------------------------------------
// Públicos: muda a capa, o tom, os números de abertura e os assuntos que
// entram quando o pedido não diz quais.

export const AUDIENCES = [
  {
    id: "socios",
    label: "Sócios",
    words: ["socios", "socio", "socia", "socias", "donos", "dono", "proprietarios", "proprietario", "familia", "sociedade", "quotistas"],
    heading: "Prestação de contas aos sócios",
    kpis: ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "bp_disponibilidades"],
    topics: ["visao", "receita", "resultado", "margens", "despesas", "caixa", "endividamento", "distribuicao", "alertas", "proximos"],
  },
  {
    id: "diretoria",
    label: "Diretoria",
    words: ["diretoria", "diretores", "diretor", "ceo", "cfo", "presidente", "c-level", "alta gestao", "alta direcao"],
    heading: "Reunião de diretoria",
    kpis: ["dre_receita_liquida", "ratio_margem_ebitda", "dre_resultado_liquido", "bp_disponibilidades"],
    topics: ["visao", "receita", "resultado", "ebitda", "despesas", "caixa", "capitalGiro", "alertas", "proximos"],
  },
  {
    id: "conselho",
    label: "Conselho",
    words: ["conselho", "conselheiros", "conselho de administracao", "conselho consultivo", "comite", "comite financeiro"],
    heading: "Reunião do conselho",
    kpis: ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "ratio_liquidez_corrente"],
    topics: ["visao", "resultado", "ebitda", "margens", "caixa", "endividamento", "balanco", "indicadores", "alertas", "proximos"],
  },
  {
    id: "banco",
    label: "Banco",
    words: [
      "banco", "bancos", "gerente do banco", "gerente da conta", "linha de credito", "instituicao financeira", "cooperativa de credito", "analise de credito",
      "rating", "pedido de credito", "credor", "credores",
    ],
    heading: "Apresentação institucional — crédito",
    kpis: ["ratio_ebitda", "ratio_liquidez_corrente", "ratio_endividamento", "bp_disponibilidades"],
    topics: ["visao", "receita", "ebitda", "resultado", "endividamento", "liquidez", "capitalGiro", "caixa", "fluxo", "balanco"],
  },
  {
    id: "investidores",
    label: "Investidores",
    words: ["investidor", "investidores", "acionistas", "fundo", "fundos", "captacao", "aporte", "valuation", "m&a", "comprador", "compradores", "venda da empresa", "due diligence"],
    heading: "Apresentação a investidores",
    kpis: ["dre_receita_liquida", "ratio_ebitda", "ratio_margem_ebitda", "ratio_roe"],
    topics: ["visao", "receita", "composicaoReceita", "margens", "ebitda", "resultado", "indicadores", "caixa", "endividamento", "sazonalidade"],
  },
  {
    id: "gestao",
    label: "Gestão e equipe",
    words: ["equipe", "time", "gestores", "gerentes", "lideranca", "lideres", "colaboradores", "reuniao interna", "coordenadores", "area financeira", "financeiro interno"],
    heading: "Reunião de gestão",
    kpis: ["dre_receita_liquida", "ratio_margem_bruta", "ratio_margem_liquida", "dre_resultado_liquido"],
    topics: ["visao", "receita", "custos", "despesas", "pareto", "margens", "equilibrio", "metas", "proximos"],
  },
  {
    id: "contador",
    label: "Contabilidade",
    words: ["contador", "contadora", "para a contabilidade", "pra contabilidade", "escritorio contabil", "auditoria", "auditores", "auditor"],
    heading: "Fechamento contábil",
    kpis: ["dre_receita_bruta", "dre_resultado_liquido", "bp_ativo", "bp_pl"],
    topics: ["visao", "resultado", "tributos", "balanco", "pl", "caixa", "fluxo", "alertas"],
  },
  {
    id: "cliente",
    label: "Cliente",
    words: ["para o cliente", "ao cliente", "reuniao com o cliente", "cliente final", "apresentar ao cliente", "entregar ao cliente"],
    heading: "Reunião de resultados",
    kpis: ["dre_receita_liquida", "ratio_ebitda", "dre_resultado_liquido", "bp_disponibilidades"],
    topics: ["visao", "receita", "resultado", "margens", "caixa", "balanco", "alertas", "proximos"],
  },
  {
    id: "assembleia",
    label: "Assembleia",
    words: ["assembleia", "cooperados", "associados", "assembleia geral"],
    heading: "Prestação de contas — assembleia",
    kpis: ["dre_receita_liquida", "dre_resultado_liquido", "bp_disponibilidades", "bp_pl"],
    topics: ["visao", "receita", "resultado", "caixa", "balanco", "pl", "distribuicao", "proximos"],
  },
];

// Ocasião: o "pra quê" — ajusta tamanho, capa e assuntos.
export const OCCASIONS = [
  { id: "mensal", label: "Fechamento do mês", size: 8, words: ["reuniao mensal", "fechamento do mes", "fechamento mensal", "report mensal", "relatorio mensal", "acompanhamento mensal", "resultado do mes"], heading: "Fechamento do mês", topics: ["visao", "receita", "resultado", "caixa", "alertas"] },
  { id: "trimestral", label: "Fechamento do trimestre", size: 10, words: ["reuniao trimestral", "fechamento do trimestre", "report trimestral", "relatorio trimestral", "resultado do trimestre", "balanco trimestral"], heading: "Resultados do trimestre", topics: ["visao", "receita", "resultado", "margens", "caixa", "balanco", "alertas", "proximos"] },
  { id: "anual", label: "Fechamento do ano", size: 13, words: ["fechamento do ano", "fechamento anual", "balanco anual", "resultado do ano", "prestacao de contas anual", "encerramento do exercicio", "fechamento do exercicio", "ano fiscal", "exercicio social"], heading: "Fechamento do exercício", topics: ["visao", "receita", "resultado", "margens", "ebitda", "caixa", "fluxo", "endividamento", "balanco", "indicadores", "alertas", "proximos"] },
  { id: "credito", label: "Pedido de crédito", size: 10, words: ["pedido de credito", "pedir emprestimo", "pedir credito", "solicitar credito", "renegociacao", "renegociar", "aumentar limite", "limite de credito", "novo financiamento", "captar emprestimo", "tomar emprestimo"], heading: "Apresentação para análise de crédito", topics: ["visao", "receita", "ebitda", "resultado", "endividamento", "liquidez", "capitalGiro", "caixa", "fluxo"] },
  { id: "planejamento", label: "Planejamento", size: 9, words: ["planejamento", "planejar", "orcamento", "plano para", "metas para", "budget", "projecao", "projetar", "proximo ano", "ano que vem"], heading: "Planejamento", topics: ["visao", "receita", "custos", "despesas", "equilibrio", "metas", "proximos"] },
  { id: "diagnostico", label: "Diagnóstico financeiro", size: 12, words: ["diagnostico", "raio x", "raio-x", "check-up", "checkup", "avaliacao financeira", "saude financeira", "analise financeira", "analise completa"], heading: "Diagnóstico financeiro", topics: ["visao", "receita", "custos", "despesas", "margens", "resultado", "caixa", "endividamento", "liquidez", "capitalGiro", "alertas", "proximos"] },
  { id: "reestruturacao", label: "Reestruturação", size: 11, words: ["reestruturacao", "reestruturar", "recuperacao", "plano de recuperacao", "turnaround", "crise", "cortar custos", "reducao de custos", "sair do prejuizo", "virar o jogo"], heading: "Plano de reestruturação", topics: ["visao", "resultado", "despesas", "pareto", "custos", "caixa", "endividamento", "equilibrio", "alertas", "proximos"] },
  { id: "prestacao", label: "Prestação de contas", size: 10, words: ["prestacao de contas", "prestar contas", "relatorio aos socios", "relatorio de gestao"], heading: "Prestação de contas", topics: ["visao", "receita", "resultado", "caixa", "balanco", "distribuicao", "proximos"] },
  { id: "captacao", label: "Captação / valuation", size: 11, words: ["captacao", "captar recursos", "valuation", "venda da empresa", "atrair investidor", "rodada"], heading: "Apresentação a investidores", topics: ["visao", "receita", "composicaoReceita", "margens", "ebitda", "indicadores", "caixa", "endividamento"] },
];

// Tom: muda o jeito de escrever e a escolha entre gráfico e tabela.
export const TONES = [
  { id: "formal", label: "Formal", words: ["formal", "institucional", "executivo", "executiva", "corporativo", "corporativa", "profissional", "elegante", "premium"] },
  { id: "didatico", label: "Didático", words: ["didatico", "didatica", "simples", "leigo", "leigos", "explicar", "explicado", "explicando", "facil de entender", "linguagem simples", "sem jargao", "nao entende de contabilidade", "nao entendem de contabilidade", "sem termos tecnicos", "explicativo"] },
  { id: "tecnico", label: "Técnico", words: ["tecnico", "tecnica", "detalhado", "detalhada", "aprofundado", "aprofundada", "analitico", "analitica", "contabil", "minucioso", "completo e tecnico"] },
  { id: "visual", label: "Visual", words: ["visual", "mais graficos", "muitos graficos", "com graficos", "ilustrado", "ilustrada", "pouco texto", "menos texto", "bonito", "bonita", "impactante", "chamativo"] },
  { id: "direto", label: "Direto", words: ["direto", "direta", "objetivo", "objetiva", "curto e grosso", "sem rodeios", "pratico", "pratica", "enxuto", "enxuta", "rapido", "rapida", "sem enrolacao"] },
];

// "foco em X", "principalmente X" — sobe X na fila.
export const EMPHASIS = [
  "foco em", "foco no", "foco na", "focar em", "focar no", "focar na", "focado em", "principalmente", "sobretudo", "enfase em", "enfase no", "enfase na",
  "dar enfase", "destaque para", "destacar", "destacando", "evidenciar", "evidenciando", "mostrar bem", "importante mostrar", "o mais importante e",
  "prioridade", "priorizar", "em especial", "especialmente", "ressaltar", "ressaltando", "chamar atencao para", "aprofundar", "detalhar", "detalhando",
];

// "sem X", "não precisa de X" — tira X.
export const EXCLUDE_BEFORE = /(?:^|\s)(sem|nao precisa(?: de| ter| mostrar| falar(?: de| sobre)?)?|nao quero(?: ver| falar(?: de| sobre)?| mostrar)?|nao mostrar|nao falar(?: de| sobre)?|nao incluir|nao colocar|tirar|tire|tira|exceto|menos|evitar|evite|deixar de fora|fora)\s+(?:(?:o|a|os|as|de|do|da|dos|das|sobre|com|nada de)\s+)*$/;

export const SIZE_SMALL = ["curta", "curto", "rapida", "rapido", "resumida", "resumido", "enxuta", "enxuto", "breve", "pequena", "poucos slides", "poucas paginas", "compacta", "sucinta"];
export const SIZE_LARGE = ["completa", "completo", "detalhada", "detalhado", "aprofundada", "aprofundado", "robusta", "extensa", "longa", "bem completa", "muitos slides", "tudo", "completissima"];

export const NUMBER_WORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, "meia duzia": 6, "uma duzia": 12,
};

export const MONTHS = [
  ["janeiro", "jan"],
  ["fevereiro", "fev"],
  ["marco", "mar"],
  ["abril", "abr"],
  ["maio", "mai"],
  ["junho", "jun"],
  ["julho", "jul"],
  ["agosto", "ago"],
  ["setembro", "set"],
  ["outubro", "out"],
  ["novembro", "nov"],
  ["dezembro", "dez"],
];

// Metas escritas no pedido ("meta de faturamento de 1 milhão").
export const GOAL_METRICS = [
  { id: "receita_bruta", words: ["faturamento", "receita bruta", "vendas", "venda"], widgetId: "dre_receita_bruta", label: "Meta de faturamento", format: "money" },
  { id: "receita_liquida", words: ["receita liquida", "receita"], widgetId: "dre_receita_liquida", label: "Meta de receita líquida", format: "money" },
  { id: "lucro", words: ["lucro liquido", "lucro", "resultado liquido", "resultado"], widgetId: "dre_resultado_liquido", label: "Meta de lucro", format: "money" },
  { id: "ebitda", words: ["ebitda"], widgetId: "ratio_ebitda", label: "Meta de EBITDA", format: "money" },
  { id: "margem_bruta", words: ["margem bruta"], widgetId: "ratio_margem_bruta", label: "Meta de margem bruta", format: "percent" },
  { id: "margem_liquida", words: ["margem liquida", "margem"], widgetId: "ratio_margem_liquida", label: "Meta de margem líquida", format: "percent" },
  { id: "margem_ebitda", words: ["margem ebitda"], widgetId: "ratio_margem_ebitda", label: "Meta de margem EBITDA", format: "percent" },
  { id: "caixa", words: ["caixa", "saldo de caixa", "saldo em caixa"], widgetId: "bp_disponibilidades", label: "Meta de caixa", format: "money" },
];

// Glossário pras anotações do apresentador (tom didático, ou sempre que o
// termo aparece num slide).
export const GLOSSARY = {
  ebitda: "EBITDA: o que a operação gera antes de juros, impostos sobre o lucro, depreciação e amortização — mostra se o negócio em si se paga.",
  margemBruta: "Margem bruta: quanto sobra da receita depois dos custos diretos (mercadoria, produção ou serviço), antes das despesas da estrutura.",
  margemLiquida: "Margem líquida: quanto sobra de cada R$ 100 vendidos depois de tudo — custos, despesas, juros e impostos.",
  liquidez: "Liquidez corrente: quanto a empresa tem a receber/em caixa no curto prazo para cada R$ 1 que deve no curto prazo. Acima de 1 é folga; abaixo, aperto.",
  endividamento: "Endividamento: quanto a empresa deve a terceiros para cada R$ 1 de patrimônio dos sócios.",
  capitalGiro: "Capital de giro: o que sobra do ativo de curto prazo depois de pagar o passivo de curto prazo — o 'colchão' para operar.",
  ciclo: "Ciclo financeiro: quantos dias o dinheiro fica preso entre pagar fornecedores e receber dos clientes (prazo de estoque + recebimento − pagamento).",
  equilibrio: "Ponto de equilíbrio: o faturamento mínimo para pagar custos e despesas sem lucro nem prejuízo.",
  dfc: "Fluxo de caixa (DFC): de onde o dinheiro entrou e para onde saiu — operação, investimentos e financiamentos.",
  roe: "ROE: o lucro do período sobre o patrimônio dos sócios — o retorno do capital investido por eles.",
  pl: "Patrimônio líquido: o que sobra para os sócios se a empresa vendesse todos os bens e pagasse todas as dívidas.",
};
