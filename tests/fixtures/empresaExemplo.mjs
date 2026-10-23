// Empresa fictícia para os testes automáticos (nenhum dado de cliente):
// balancete de jan–mar/2026 no formato da Domínio, De/Para para o plano
// gerencial padrão (public/data/plano_gerencial_padrao.csv) e o razão com
// as operações do trimestre. Os números esperados são calculados aqui
// mesmo, à mão, a partir das operações — os testes comparam com o app.

export const COMPANY_ID = "cmp_exemplo_teste";
export const PERIOD = { start: "2026-01-01", end: "2026-03-31" };

// classificação da Domínio → conta gerencial
const CONTAS = [
  ["1.1.1.01", "CAIXA GERAL", "01.01.01.01.01", 5000],
  ["1.1.1.02", "BANCO EXEMPLO S/A", "01.01.01.02.01", 120000],
  ["1.1.2.01", "CLIENTES", "01.01.02.01.02", 80000],
  ["1.1.3.01", "MERCADORIAS PARA REVENDA", "01.01.03.01.01", 60000],
  ["1.2.3.01", "MAQUINAS E EQUIPAMENTOS", "01.02.03.01.01", 150000],
  ["2.1.1.01", "FORNECEDORES DIVERSOS", "02.01.01.01.01", -50000],
  ["2.1.2.01", "EMPRESTIMO BANCO EXEMPLO", "02.01.02.01.03", -100000],
  ["2.1.3.01", "PIS A RECOLHER", "02.01.03.01.01", 0],
  ["2.1.4.01", "SALARIOS A PAGAR", "02.01.04.01.01", 0],
  ["2.3.1.01", "CAPITAL SOCIAL", "03.01.01", -200000],
  ["2.3.2.01", "LUCROS ACUMULADOS", "03.02.01.01", -65000],
  ["9.1.1.01", "VENDAS DE MERCADORIAS A PRAZO", "DRE.01.01.01.02", 0],
  ["9.1.2.01", "PIS SOBRE VENDAS", "DRE.02.01.01.01", 0],
  ["9.2.1.01", "CUSTO DAS MERCADORIAS VENDIDAS", "DRE.04.01.02.01", 0],
  ["9.3.1.01", "SALARIOS ADMINISTRATIVOS", "DRE.07.01.01.01", 0],
  ["9.3.2.01", "ALUGUEL", "DRE.07.02.01.01", 0],
  ["9.3.3.01", "DEPRECIACAO", "DRE.07.07.03.01", 0],
  ["9.4.1.01", "DESPESAS BANCARIAS", "DRE.14.02.01.01", 0],
  ["9.4.2.01", "RENDIMENTOS DE APLICACOES", "DRE.14.01.01.01", 0],
];

const round = (n) => Math.round(n * 100) / 100;

function operacoes() {
  const ops = [];
  const add = (data, historico, debito, credito, valor) => ops.push({ data, historico, debito, credito, valor: round(valor) });
  const fator = { 1: 1, 2: 1.1, 3: 0.9 };
  let pisAnterior = 0;
  for (const mes of [1, 2, 3]) {
    const m = String(mes).padStart(2, "0");
    const f = fator[mes];
    const venda = 100000 * f;
    const pis = venda * 0.0165;
    add(`2026-${m}-05`, `VENDA NF ${mes}01`, "1.1.2.01", "9.1.1.01", venda);
    add(`2026-${m}-05`, `PIS S/ VENDA NF ${mes}01`, "9.1.2.01", "2.1.3.01", pis);
    add(`2026-${m}-05`, `BAIXA DO ESTOQUE NF ${mes}01`, "9.2.1.01", "1.1.3.01", venda * 0.45);
    add(`2026-${m}-08`, `COMPRA DE MERCADORIAS NF ${mes}55`, "1.1.3.01", "2.1.1.01", 50000 * f);
    add(`2026-${m}-12`, "RECEBIMENTO DE CLIENTES", "1.1.1.02", "1.1.2.01", 90000 * f);
    add(`2026-${m}-15`, "PAGAMENTO A FORNECEDORES", "2.1.1.01", "1.1.1.02", 48000 * f);
    add(`2026-${m}-25`, "FOLHA DE PAGAMENTO", "9.3.1.01", "2.1.4.01", 20000);
    add(`2026-${m}-28`, "PAGAMENTO DA FOLHA", "2.1.4.01", "1.1.1.02", 20000);
    add(`2026-${m}-10`, "ALUGUEL DO MES", "9.3.2.01", "1.1.1.02", 8000);
    add(`2026-${m}-28`, "DEPRECIACAO DO MES", "9.3.3.01", "1.2.3.01", 1250);
    add(`2026-${m}-28`, "TARIFAS BANCARIAS", "9.4.1.01", "1.1.1.02", 300);
    add(`2026-${m}-28`, "RENDIMENTO DE APLICACAO", "1.1.1.02", "9.4.2.01", 500);
    add(`2026-${m}-20`, "AMORTIZACAO DE EMPRESTIMO", "2.1.2.01", "1.1.1.02", 5000);
    if (pisAnterior) add(`2026-${m}-25`, "PAGAMENTO DO PIS", "2.1.3.01", "1.1.1.02", pisAnterior);
    if (mes === 1) add("2026-01-03", "SUPRIMENTO DE CAIXA", "1.1.1.01", "1.1.1.02", 1000);
    pisAnterior = round(pis);
  }
  return ops;
}

export function buildEmpresaExemplo(plano) {
  const planoByCode = new Map(plano.map((row) => [row.codigo_gerencial, row]));
  const conta = new Map(CONTAS.map(([classificacao, nome, codigo, saldo]) => [classificacao, { classificacao, nome, codigo, saldo }]));
  const mappings = CONTAS.map(([classificacao, nome, codigo]) => {
    const row = planoByCode.get(codigo);
    if (!row) throw new Error(`conta gerencial ${codigo} não existe no plano`);
    return { classificacao, nome_conta: nome, codigo_conta: classificacao.replace(/\./g, ""), codigo_gerencial: codigo, categoria_gerencial: row.nome, demonstrativo: row.demonstrativo, grupo_macro: row.grupo_macro, tipo_conta: "", observacao: "" };
  });
  const mapByClass = new Map(mappings.map((row) => [row.classificacao, row]));
  const journal = [];
  operacoes().forEach((op, index) => {
    const linha = String(1000 + index);
    for (const [classificacao, debito, credito] of [
      [op.debito, op.valor, 0],
      [op.credito, 0, op.valor],
    ]) {
      const map = mapByClass.get(classificacao);
      journal.push({
        data: op.data,
        debito,
        credito,
        historico: op.historico,
        linha_origem: linha,
        classificacao,
        descricao_conta: conta.get(classificacao).nome,
        codigo_gerencial: map.codigo_gerencial,
        categoria_gerencial: map.categoria_gerencial,
        demonstrativo: map.demonstrativo,
        grupo_macro: map.grupo_macro,
      });
    }
  });
  // Balancete do trimestre: saldo anterior (31/12/2025) + débitos − créditos.
  const accounts = CONTAS.map(([classificacao, nome, , saldo], index) => {
    const lines = journal.filter((entry) => entry.classificacao === classificacao);
    const debito = round(lines.reduce((sum, entry) => sum + entry.debito, 0));
    const credito = round(lines.reduce((sum, entry) => sum + entry.credito, 0));
    return { grau: "5", codigo: String(100 + index), nome_conta: nome, classificacao, tipo_sintetica: "nao", saldo_anterior: saldo, debito, credito, saldo_atual: round(saldo + debito - credito) };
  });
  const company = {
    id: COMPANY_ID,
    name: "EMPRESA EXEMPLO LTDA",
    cnpj: "00.000.000/0001-00",
    codigo: "999",
    accounts,
    mappings,
    journalCount: journal.length,
    periodStart: PERIOD.start,
    periodEnd: PERIOD.end,
    lastBalanceteMeta: { inicio: PERIOD.start, fim: PERIOD.end, origem: "dominio", name: "Domínio · teste" },
    responsaveis: ["teste@exemplo.com"],
    presentations: [],
    orcamentos: [],
    dashboardTabs: [],
  };
  return { company, journal, expected: esperado(accounts) };
}

// Valores esperados, direto das operações.
function esperado(accounts) {
  const saldo = (classificacao) => accounts.find((item) => item.classificacao === classificacao).saldo_atual;
  const movimento = (classificacao) => {
    const item = accounts.find((row) => row.classificacao === classificacao);
    return round(item.credito - item.debito);
  };
  const vendas = movimento("9.1.1.01");
  const pis = movimento("9.1.2.01");
  const receitaLiquida = round(vendas + pis);
  const custo = movimento("9.2.1.01");
  const despesasAdm = round(movimento("9.3.1.01") + movimento("9.3.2.01") + movimento("9.3.3.01"));
  const financeiro = round(movimento("9.4.1.01") + movimento("9.4.2.01"));
  const lucro = round(receitaLiquida + custo + despesasAdm + financeiro);
  const caixa = round(saldo("1.1.1.01") + saldo("1.1.1.02"));
  const caixaInicio = 125000;
  const ativo = round(["1.1.1.01", "1.1.1.02", "1.1.2.01", "1.1.3.01", "1.2.3.01"].reduce((sum, code) => sum + saldo(code), 0));
  return { vendas, pis, receitaLiquida, custo, lucroBruto: round(receitaLiquida + custo), despesasAdm, financeiro, lucro, caixa, caixaInicio, variacaoCaixa: round(caixa - caixaInicio), ativo, depreciacao: 3750 };
}
