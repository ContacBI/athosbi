import { state, mappingByClassification, planByCode } from "./store.js";

export function filteredJournal() {
  return state.journal.filter((entry) => {
    const date = String(entry.data || "").slice(0, 10);
    if (state.periodStart && date < state.periodStart) return false;
    if (state.periodEnd && date > state.periodEnd) return false;
    return true;
  });
}

export function reportMonths() {
  const periodMonths = monthsFromSelectedPeriod();
  if (periodMonths.length) return periodMonths;
  return Array.from(new Set(filteredJournal()
    .map((entry) => String(entry.data || "").slice(0, 7))
    .filter(Boolean)))
    .sort();
}

export function buildReport(type) {
  return buildReportTree(type).filter((row) => row.kind === "synthetic" && row.hasValue);
}

export function buildDfcDirect() {
  const rows = dfcStructure().map((item) => ({
    kind: "synthetic",
    demonstrativo: "DFC",
    codigo_gerencial: item.code,
    categoria_gerencial: item.name,
    grupo_macro: item.group,
    nivel: item.level,
    natureza: item.nature,
    saldo: 0,
    saldo_inicial: 0,
    saldo_anterior_balancete: 0,
    movimento_periodo: 0,
    saldo_final: 0,
    contas: [],
    qtd_lancamentos: 0,
    monthValues: {},
    hasValue: item.nature !== "heading",
    hasSyntheticChildren: item.nature === "heading",
    isFormula: item.nature !== "analytic",
  }));
  const byCode = new Map(rows.map((row) => [row.codigo_gerencial, row]));
  const entries = filteredJournal();
  const cashEntries = entries.filter(isCashEntry);

  cashEntries.forEach((entry) => {
    if (isOpeningBalanceEntry(entry)) return;
    const counterpart = findCashCounterpart(entry, entries);
    if (counterpart && isCashEntry(counterpart)) return;
    const targetCode = classifyDfcEntry(entry, counterpart);
    addDfcValue(byCode.get(targetCode) || byCode.get("DFC.OP.OUTROS"), entry, counterpart);
  });

  applyDfcSubtotals(byCode);
  applyDfcAvailability(byCode);

  return rows.filter((row) => row.natureza === "heading" || row.hasValue || row.qtd_lancamentos || row.codigo_gerencial.startsWith("DFC.CASH"));
}

// DFC indireta: parte do resultado e reconcilia as variações das principais
// contas operacionais. Investimento, financiamento e disponibilidades usam a
// mesma apuração por movimentos de caixa da DFC direta para manter o caixa
// final conciliado entre as duas apresentações.
export function buildDfcIndirect() {
  const dre = buildReportTree("DRE");
  const bp = buildReportTree("BP");
  const direct = buildDfcDirect();
  const value = (rows, code) => rows.find((row) => row.codigo_gerencial === code)?.saldo || 0;
  const variation = (code) => {
    const row = bp.find((item) => item.codigo_gerencial === code);
    return row ? Number(row.saldo_final || 0) - Number(row.saldo_inicial || 0) : 0;
  };
  const rows = [];
  const add = (code, name, saldo, group, natureza = "analytic") => rows.push({ codigo_gerencial: code, categoria_gerencial: name, saldo, grupo_macro: group, natureza });
  add("DFCI.OP.RESULTADO", "Resultado líquido do período", value(dre, "DRE.17"), "Operacional");
  add("DFCI.OP.DEPRECIACAO", "Depreciações e amortizações", value(dre, "DRE.11"), "Operacional");
  add("DFCI.OP.CLIENTES", "Variação em clientes e outros recebíveis", -variation("01.01.02"), "Operacional");
  add("DFCI.OP.ESTOQUES", "Variação em estoques", -variation("01.01.03"), "Operacional");
  add("DFCI.OP.FORNECEDORES", "Variação em fornecedores", variation("02.01.01"), "Operacional");
  add("DFCI.OP.OBRIGACOES", "Variação em obrigações trabalhistas e tributárias", variation("02.01.03") + variation("02.01.04"), "Operacional");
  const operating = rows.reduce((sum, row) => sum + row.saldo, 0);
  add("DFCI.OP.LIQUIDO", "CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS", operating, "Operacional", "subtotal");
  const directValue = (code) => direct.find((row) => row.codigo_gerencial === code)?.saldo || 0;
  add("DFCI.INV.LIQUIDO", "CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO", directValue("DFC.INV.CAIXA_LIQUIDO"), "Investimento", "subtotal");
  add("DFCI.FIN.LIQUIDO", "CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO", directValue("DFC.FIN.CAIXA_LIQUIDO"), "Financiamento", "subtotal");
  add("DFCI.CASH.VARIACAO", "AUMENTO/(REDUÇÃO) NAS DISPONIBILIDADES", operating + directValue("DFC.INV.CAIXA_LIQUIDO") + directValue("DFC.FIN.CAIXA_LIQUIDO"), "Disponibilidades", "subtotal");
  add("DFCI.CASH.INICIO", "DISPONIBILIDADES NO INÍCIO DO PERÍODO", directValue("DFC.CASH.INICIO"), "Disponibilidades", "subtotal");
  add("DFCI.CASH.FIM", "DISPONIBILIDADES NO FINAL DO PERÍODO", directValue("DFC.CASH.FIM"), "Disponibilidades", "subtotal");
  return rows;
}

export function buildReportTree(type) {
  const mapping = mappingByClassification();
  const plan = planByCode();
  const entries = filteredJournal();
  const entryCountByPlan = new Map();
  const monthByPlan = new Map();
  const periodMovementByAccount = movementByAccount(entries, type);
  const previousMovementByAccount = type === "DRE" ? movementByAccount(entriesBeforePeriodStart(), type) : new Map();
  const rows = new Map();

  state.plano
    .filter((row) => row.demonstrativo === type)
    .forEach((row) => {
      rows.set(row.codigo_gerencial, {
        kind: "synthetic",
        demonstrativo: row.demonstrativo,
        codigo_gerencial: row.codigo_gerencial,
        categoria_gerencial: row.nome,
        grupo_macro: row.grupo_macro,
        nivel: Number(row.nivel || levelFromCode(row.codigo_gerencial)),
        aceita_depara: row.aceita_depara,
        saldo: 0,
        debito: 0,
        credito: 0,
        saldo_inicial: 0,
        saldo_anterior_balancete: 0,
        movimento_periodo: 0,
        saldo_final: 0,
        contas: [],
        qtd_lancamentos: 0,
        monthValues: {},
        hasValue: false,
        hasSyntheticChildren: false,
      });
    });

  if (type === "BP") {
    // Numeric BP already contains circulante/nao circulante groups in the plan.
  }

  rows.forEach((row) => {
    const parent = parentCode(row.codigo_gerencial);
    if (parent && rows.has(parent)) rows.get(parent).hasSyntheticChildren = true;
  });

  // Period-scoped gross debit/credit per managerial code — kept separate from
  // row.debito/row.credito (which mirror the whole imported trial balance,
  // not the selected period) so a compact "Entradas/Saidas" view can be
  // period-aware without disturbing the non-operating exclusion snapshot
  // logic that already depends on the trial-balance totals.
  const periodDebitByPlan = new Map();
  const periodCreditByPlan = new Map();

  entries.forEach((entry) => {
    const mapped = mapping.get(entry.classificacao) || {};
    const codigoGerencial = entry.codigo_gerencial || mapped.codigo_gerencial || "";
    if (!codigoGerencial) return;
    const planRow = plan.get(codigoGerencial);
    if (planRow && planRow.demonstrativo !== type) return;
    const month = String(entry.data || "").slice(0, 7);
    const value = reportEntryValue(type, entry, planRow);
    ancestors(codigoGerencial).forEach((code) => {
      entryCountByPlan.set(code, (entryCountByPlan.get(code) || 0) + 1);
      const months = monthByPlan.get(code) || {};
      months[month] = (months[month] || 0) + value;
      monthByPlan.set(code, months);
      periodDebitByPlan.set(code, (periodDebitByPlan.get(code) || 0) + Number(entry.debito || 0));
      periodCreditByPlan.set(code, (periodCreditByPlan.get(code) || 0) + Number(entry.credito || 0));
    });
  });

  state.accounts
    .filter((account) => account.tipo_sintetica === "nao")
    .forEach((account) => {
      const map = mapping.get(account.classificacao);
      if (!map || map.demonstrativo !== type) return;
      const accountValue = reportAccountValue(type, account, periodMovementByAccount, previousMovementByAccount);
      ancestors(map.codigo_gerencial).forEach((code) => {
        const row = rows.get(code);
        if (!row) return;
        row.saldo += accountValue.final;
        row.debito += account.debito;
        row.credito += account.credito;
        row.saldo_inicial += accountValue.initial;
        row.saldo_anterior_balancete += accountValue.previous;
        row.movimento_periodo += accountValue.movement;
        row.saldo_final += accountValue.final;
        row.contas.push(account);
        row.hasValue = true;
      });
    });

  rows.forEach((row, code) => {
    row.qtd_lancamentos = entryCountByPlan.get(code) || 0;
    row.monthValues = monthByPlan.get(code) || {};
    row.periodDebito = periodDebitByPlan.get(code) || 0;
    row.periodCredito = periodCreditByPlan.get(code) || 0;
  });

  if (type === "DRE") {
    applyNonOperatingExclusions(rows);
    applyDreFormulas(rows);
  }
  if (type === "BP") applyBpPeriodResult(rows);

  return Array.from(rows.values())
    .filter((row) => row.hasValue || row.qtd_lancamentos || row.nivel <= 2)
    .sort((a, b) => a.codigo_gerencial.localeCompare(b.codigo_gerencial, "pt-BR", { numeric: true }));
}

function applyBpPeriodResult(rows) {
  const targetCode = "03.02.01.05";
  const dreRows = buildReportTree("DRE");
  const resultRow = dreRows.find((row) => row.codigo_gerencial === "DRE.17")
    || dreRows.find((row) => row.codigo_gerencial === "DRE.12");
  if (!resultRow) return;

  const monthValues = resultRow.monthValues || {};
  const periodResult = Object.keys(resultRow.monthValues || {}).length
    ? sumObjectValues(resultRow.monthValues)
    : Number(resultRow.saldo || 0);
  const bpValue = Number(periodResult || 0);
  const previousValue = dreResultBeforePeriodStart();
  const totalValue = previousValue + bpValue;
  const target = ensureSyntheticRow(rows, targetCode, {
    demonstrativo: "BP",
    categoria_gerencial: "Resultado do exercicio",
    grupo_macro: "Patrimonio Liquido",
    nivel: 5,
  });

  target.categoria_gerencial = "Resultado do exercicio";
  target.saldo = totalValue;
  target.saldo_final = totalValue;
  target.movimento_periodo = bpValue;
  target.saldo_inicial = previousValue;
  target.saldo_anterior_balancete = previousValue;
  target.monthValues = monthValues;
  target.hasValue = true;
  target.isFormula = true;
  target.contas = [];
  target.qtd_lancamentos = Number(resultRow.qtd_lancamentos || 0);

  ancestors(targetCode).filter((code) => code !== targetCode).forEach((code) => {
    const row = rows.get(code);
    if (!row) return;
    row.saldo += totalValue;
    row.saldo_final += totalValue;
    row.saldo_inicial += previousValue;
    row.saldo_anterior_balancete += previousValue;
    row.movimento_periodo += bpValue;
    row.monthValues = sumMonthObjects(row.monthValues || {}, monthValues);
    row.hasValue = true;
    row.isFormula = row.codigo_gerencial === "03" ? true : row.isFormula;
    row.qtd_lancamentos += Number(resultRow.qtd_lancamentos || 0);
  });
}

function dreResultBeforePeriodStart() {
  const entries = entriesBeforePeriodStart();
  if (!entries.length) return 0;
  const mapping = mappingByClassification();
  const plan = planByCode();
  const values = new Map();

  entries.forEach((entry) => {
    const codigoGerencial = entry.codigo_gerencial || mapping.get(entry.classificacao)?.codigo_gerencial || "";
    if (!codigoGerencial) return;
    const planRow = plan.get(codigoGerencial);
    if (planRow && planRow.demonstrativo !== "DRE") return;
    const value = reportEntryValue("DRE", entry, planRow);
    ancestors(codigoGerencial).forEach((code) => {
      values.set(code, (values.get(code) || 0) + value);
    });
  });

  applyDreFormulaValues(values);
  return values.get("DRE.17") || values.get("DRE.12") || 0;
}

function applyDreFormulaValues(values) {
  [
    ["DRE.03", ["DRE.01", "DRE.02"]],
    ["DRE.05", ["DRE.03", "DRE.04"]],
    ["DRE.10", ["DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.09"]],
    ["DRE.12", ["DRE.10", "DRE.11"]],
    ["DRE.15", ["DRE.12", "DRE.13", "DRE.14"]],
    ["DRE.17", ["DRE.15", "DRE.16"]],
  ].forEach(([target, sources]) => {
    values.set(target, sources.reduce((sum, code) => sum + Number(values.get(code) || 0), 0));
  });
}

function dfcStructure() {
  const custom = state.dfcStructure.map(normalizeDfcStructureRow).filter((row) => row.code && row.name);
  return custom.length ? custom : defaultDfcStructure();
}

function normalizeDfcStructureRow(row) {
  return {
    number: String(row.number || row.numero || row.id || "").trim(),
    code: row.code || row.codigo || row.codigo_gerencial || "",
    name: row.name || row.descricao || row.nome || row.categoria_gerencial || "",
    group: row.group || row.grupo || row.grupo_macro || "",
    level: Number(row.level || row.nivel || 1),
    nature: row.nature || row.natureza || "analytic",
  };
}

function defaultDfcStructure() {
  return [
    { code: "DFC.OP", name: "ATIVIDADES OPERACIONAIS", group: "Operacional", level: 1, nature: "heading" },
    { code: "DFC.OP.CLIENTES", name: "Valores recebidos de clientes", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.FORNECEDORES", name: "Valores pagos a fornecedores", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.EMPREGADOS", name: "Valores pagos a empregados", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.CAIXA_OPERACOES", name: "CAIXA GERADO PELAS OPERACOES", group: "Operacional", level: 2, nature: "subtotal" },
    { code: "DFC.OP.REC_FIN", name: "Receitas financeiras", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.DESP_FIN", name: "Despesas financeiras", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.TRIBUTOS", name: "Tributos pagos", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.CAIXA_ANTES_EXTRA", name: "FLUXO DE CAIXA ANTES DE ITENS EXTRAORDINARIOS", group: "Operacional", level: 2, nature: "subtotal" },
    { code: "DFC.OP.SEGUROS", name: "Recebimento por indenizacao de seguros", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.LUCROS_DIV_RECEBIDOS", name: "Recebimentos de lucros e dividendos", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.OUTROS", name: "Outros recebimentos/(pagamento) liquidos", group: "Operacional", level: 2, nature: "analytic" },
    { code: "DFC.OP.CAIXA_LIQUIDO", name: "CAIXA LIQUIDO PROVENIENTE DAS ATIVIDADES OPERACIONAIS", group: "Operacional", level: 2, nature: "subtotal" },
    { code: "DFC.INV", name: "ATIVIDADES DE INVESTIMENTO", group: "Investimento", level: 1, nature: "heading" },
    { code: "DFC.INV.IMOBILIZADO", name: "Compras de imobilizado", group: "Investimento", level: 2, nature: "analytic" },
    { code: "DFC.INV.ACOES_COTAS", name: "Aquisicao de acoes/cotas", group: "Investimento", level: 2, nature: "analytic" },
    { code: "DFC.INV.VENDA_ATIVOS", name: "Recebimentos por vendas de ativos permanentes", group: "Investimento", level: 2, nature: "analytic" },
    { code: "DFC.INV.JUROS_EMPRESTIMOS", name: "Juros recebidos de emprestimos", group: "Investimento", level: 2, nature: "analytic" },
    { code: "DFC.INV.CAIXA_LIQUIDO", name: "CAIXA LIQUIDO USADO NAS ATIVIDADES DE INVESTIMENTOS", group: "Investimento", level: 2, nature: "subtotal" },
    { code: "DFC.FIN", name: "ATIVIDADES DE FINANCIAMENTO", group: "Financiamento", level: 1, nature: "heading" },
    { code: "DFC.FIN.CAPITAL", name: "Integralizacao de capital", group: "Financiamento", level: 2, nature: "analytic" },
    { code: "DFC.FIN.LUCROS_DIV_PAGOS", name: "Pagamentos de lucros e dividendos", group: "Financiamento", level: 2, nature: "analytic" },
    { code: "DFC.FIN.EMPRESTIMOS_TOMADOS", name: "Emprestimos tomados", group: "Financiamento", level: 2, nature: "analytic" },
    { code: "DFC.FIN.EMPRESTIMOS_PAGOS", name: "Pagamentos de emprestimos/Debentures", group: "Financiamento", level: 2, nature: "analytic" },
    { code: "DFC.FIN.CAIXA_LIQUIDO", name: "CAIXA LIQUIDO GERADO PELAS ATIVIDADES DE FINANCIAMENTOS", group: "Financiamento", level: 2, nature: "subtotal" },
    { code: "DFC.CASH.VARIACAO", name: "AUMENTO/REDUCAO NAS DISPONIBILIDADES", group: "Disponibilidades", level: 1, nature: "subtotal" },
    { code: "DFC.CASH.INICIO", name: "DISPONIBILIDADES - NO INICIO DO PERIODO", group: "Disponibilidades", level: 1, nature: "subtotal" },
    { code: "DFC.CASH.FIM", name: "DISPONIBILIDADES - NO FINAL DO PERIODO", group: "Disponibilidades", level: 1, nature: "subtotal" },
  ];
}
function isCashEntry(entry) {
  const code = gerencialCodeForEntry(entry);
  return code === "01.01.01" || code.startsWith("01.01.01.");
}

function isOpeningBalanceEntry(entry) {
  return normalize(entry.historico).includes("saldo anterior");
}

function findCashCounterpart(cashEntry, entries) {
  const value = Number(cashEntry.debito || 0) - Number(cashEntry.credito || 0);
  const candidates = entries
    .filter((entry) => entry !== cashEntry)
    .filter((entry) => entry.data === cashEntry.data)
    .filter((entry) => normalize(entry.historico) === normalize(cashEntry.historico))
    .filter((entry) => Math.abs((Number(entry.debito || 0) - Number(entry.credito || 0)) + value) < 0.005);
  return candidates.find((entry) => !isCashEntry(entry)) || candidates[0] || null;
}

function classifyDfcEntry(cashEntry, counterpart) {
  const cashValue = Number(cashEntry.debito || 0) - Number(cashEntry.credito || 0);
  const code = gerencialCodeForEntry(counterpart);
  const text = normalize(`${counterpart?.descricao_conta || ""} ${counterpart?.categoria_gerencial || ""} ${counterpart?.grupo_macro || ""} ${counterpart?.historico || cashEntry.historico || ""}`);
  const linkTarget = dfcLinkTarget(code, cashValue);
  if (linkTarget) return linkTarget;
  const manualTarget = dfcRuleTarget(cashEntry, counterpart, code, text);
  if (manualTarget) {
    return directionalDfcTarget(manualTarget, cashValue);
  }

  if (text.includes("sinistro") || text.includes("indenizacao") || text.includes("indenizacao")) return "DFC.OP.SEGUROS";
  if (text.includes("dividendo") || text.includes("lucro recebido")) return cashValue >= 0 ? "DFC.OP.LUCROS_DIV_RECEBIDOS" : "DFC.FIN.LUCROS_DIV_PAGOS";
  if (code.startsWith("03.01")) return "DFC.FIN.CAPITAL";
  if (code.startsWith("02.01.02") || code.startsWith("02.02.01")) return cashValue >= 0 ? "DFC.FIN.EMPRESTIMOS_TOMADOS" : "DFC.FIN.EMPRESTIMOS_PAGOS";
  if (code.startsWith("02.01.07") || code.startsWith("03.02.01.04") || code.startsWith("DRE.09.02.05")) return "DFC.FIN.LUCROS_DIV_PAGOS";
  if (code.startsWith("01.02.03") || code.startsWith("01.02.04")) return cashValue >= 0 ? "DFC.INV.VENDA_ATIVOS" : "DFC.INV.IMOBILIZADO";
  if (code.startsWith("01.02.02")) return cashValue >= 0 ? "DFC.INV.VENDA_ATIVOS" : "DFC.INV.ACOES_COTAS";
  if (code.startsWith("DRE.13.01")) return text.includes("emprest") ? "DFC.INV.JUROS_EMPRESTIMOS" : "DFC.OP.REC_FIN";
  if (code.startsWith("DRE.13.02")) return "DFC.OP.DESP_FIN";
  if (code.startsWith("DRE.02") || code.startsWith("DRE.08") || code.startsWith("DRE.16") || code.startsWith("02.01.03")) return "DFC.OP.TRIBUTOS";
  if (code.startsWith("02.01.04") || code.startsWith("DRE.04.03.07") || code.startsWith("DRE.07.01") || text.includes("salario") || text.includes("folha") || text.includes("fgts") || text.includes("inss")) return "DFC.OP.EMPREGADOS";
  if (code.startsWith("DRE.01") || code.startsWith("01.01.02.01")) return "DFC.OP.CLIENTES";
  if (code.startsWith("02.01.01") || code.startsWith("DRE.04") || code.startsWith("DRE.06") || code.startsWith("DRE.07")) return "DFC.OP.FORNECEDORES";
  return "DFC.OP.OUTROS";
}

function dfcLinkTarget(code, cashValue) {
  const structureByNumber = new Map(dfcStructure()
    .filter((item) => item.number && item.code)
    .map((item) => [String(item.number), item.code]));
  const links = state.dfcLinks
    .map((row) => normalizeDfcLink(row, structureByNumber))
    .filter((link) => link.codigo && link.destino);
  const match = links
    .filter((link) => code === link.codigo || code.startsWith(`${link.codigo}.`))
    .sort((a, b) => b.codigo.length - a.codigo.length)[0];
  return directionalDfcTarget(match?.destino || "", cashValue);
}

function normalizeDfcLink(row, structureByNumber = new Map()) {
  const number = String(row.dfc_numero || row.numero_dfc || row.numero || "").trim();
  return {
    codigo: String(row.codigo_gerencial || row.codigo || "").trim(),
    destino: String(row.destino_dfc || row.destino || row.codigo_dfc || structureByNumber.get(number) || "").trim(),
  };
}

function directionalDfcTarget(target, cashValue) {
  if (target === "DFC.FIN.EMPRESTIMOS_TOMADOS" && cashValue < 0) return "DFC.FIN.EMPRESTIMOS_PAGOS";
  if (target === "DFC.INV.IMOBILIZADO" && cashValue >= 0) return "DFC.INV.VENDA_ATIVOS";
  if (target === "DFC.INV.ACOES_COTAS" && cashValue >= 0) return "DFC.INV.VENDA_ATIVOS";
  return target;
}

function dfcRuleTarget(cashEntry, counterpart, code, text) {
  const classification = String(counterpart?.classificacao || "");
  const cashClassification = String(cashEntry?.classificacao || "");
  const accountName = normalize(counterpart?.descricao_conta || counterpart?.nome_conta || "");
  const cashText = normalize(`${cashEntry?.descricao_conta || ""} ${cashEntry?.historico || ""}`);
  const rules = state.dfcRules
    .map(normalizeDfcRule)
    .filter((rule) => rule.tipo && rule.valor && rule.destino);
  const rule = rules.find((item) => {
    if (item.tipo === "codigo_gerencial" || item.tipo === "codigo") return code === item.valor || code.startsWith(`${item.valor}.`);
    if (item.tipo === "classificacao") return classification === item.valor || classification.startsWith(`${item.valor}.`);
    if (item.tipo === "classificacao_caixa") return cashClassification === item.valor || cashClassification.startsWith(`${item.valor}.`);
    if (item.tipo === "nome_conta") return accountName.includes(normalize(item.valor));
    if (item.tipo === "texto") return text.includes(normalize(item.valor)) || cashText.includes(normalize(item.valor));
    return false;
  });
  return rule?.destino || "";
}

function normalizeDfcRule(row) {
  return {
    tipo: normalize(row.tipo || row.tipo_regra || "codigo_gerencial"),
    valor: String(row.valor || row.origem || row.classificacao || row.codigo_gerencial || row.codigo || "").trim(),
    destino: String(row.destino || row.codigo_dfc || row.dfc || "").trim(),
  };
}

function addDfcValue(row, cashEntry, counterpart) {
  if (!row) return;
  const value = Number(cashEntry.debito || 0) - Number(cashEntry.credito || 0);
  const month = String(cashEntry.data || "").slice(0, 7);
  row.saldo += value;
  row.movimento_periodo += value;
  row.saldo_final += value;
  row.monthValues[month] = (row.monthValues[month] || 0) + value;
  row.qtd_lancamentos += 1;
  row.hasValue = true;
  addDfcAnalytic(row, cashEntry, counterpart, value, month);
}

function addDfcAnalytic(row, cashEntry, counterpart, value, month) {
  const key = counterpart?.classificacao || counterpart?.codigo_gerencial || "sem-contrapartida";
  let analytic = row.contas.find((item) => item.classificacao === key);
  if (!analytic) {
    analytic = {
      kind: "analytic",
      demonstrativo: "DFC",
      classificacao: key,
      codigo: counterpart?.codigo_gerencial || "",
      codigo_gerencial: row.codigo_gerencial,
      nome_conta: counterpart?.descricao_conta || counterpart?.categoria_gerencial || "Sem contrapartida identificada",
      categoria_gerencial: counterpart?.categoria_gerencial || "",
      grupo_macro: row.grupo_macro,
      nivel: Number(row.nivel || 1) + 1,
      qtd_lancamentos: 0,
      monthValues: {},
      valor_gerencial: 0,
      saldo: 0,
      saldo_final: 0,
      movimento_periodo: 0,
      saldo_anterior_balancete: 0,
      dfcEntries: [],
    };
    row.contas.push(analytic);
  }
  analytic.valor_gerencial += value;
  analytic.saldo += value;
  analytic.saldo_final += value;
  analytic.movimento_periodo += value;
  analytic.monthValues[month] = (analytic.monthValues[month] || 0) + value;
  analytic.qtd_lancamentos += 1;
  analytic.dfcEntries.push(...[cashEntry, counterpart].filter(Boolean));
}

function applyDfcSubtotals(byCode) {
  sumDfcRows(byCode, "DFC.OP.CAIXA_OPERACOES", ["DFC.OP.CLIENTES", "DFC.OP.FORNECEDORES", "DFC.OP.EMPREGADOS"]);
  sumDfcRows(byCode, "DFC.OP.CAIXA_ANTES_EXTRA", ["DFC.OP.CAIXA_OPERACOES", "DFC.OP.REC_FIN", "DFC.OP.DESP_FIN", "DFC.OP.TRIBUTOS"]);
  sumDfcRows(byCode, "DFC.OP.CAIXA_LIQUIDO", ["DFC.OP.CAIXA_ANTES_EXTRA", "DFC.OP.SEGUROS", "DFC.OP.LUCROS_DIV_RECEBIDOS", "DFC.OP.OUTROS"]);
  sumDfcRows(byCode, "DFC.INV.CAIXA_LIQUIDO", ["DFC.INV.IMOBILIZADO", "DFC.INV.ACOES_COTAS", "DFC.INV.VENDA_ATIVOS", "DFC.INV.JUROS_EMPRESTIMOS"]);
  sumDfcRows(byCode, "DFC.FIN.CAIXA_LIQUIDO", ["DFC.FIN.CAPITAL", "DFC.FIN.LUCROS_DIV_PAGOS", "DFC.FIN.EMPRESTIMOS_TOMADOS", "DFC.FIN.EMPRESTIMOS_PAGOS"]);
  sumDfcRows(byCode, "DFC.CASH.VARIACAO", ["DFC.OP.CAIXA_LIQUIDO", "DFC.INV.CAIXA_LIQUIDO", "DFC.FIN.CAIXA_LIQUIDO"]);
}

function sumDfcRows(byCode, targetCode, sourceCodes) {
  const target = byCode.get(targetCode);
  if (!target) return;
  sourceCodes.map((code) => byCode.get(code)).filter(Boolean).forEach((source) => {
    target.saldo += source.saldo;
    target.movimento_periodo += source.movimento_periodo;
    target.saldo_final += source.saldo_final;
    target.qtd_lancamentos += source.qtd_lancamentos;
    target.monthValues = sumMonthObjects(target.monthValues || {}, source.monthValues || {});
    if (source.hasValue) target.hasValue = true;
  });
}

function applyDfcAvailability(byCode) {
  const initial = cashBalanceAtStart();
  const variationRow = byCode.get("DFC.CASH.VARIACAO");
  const ending = cashBalanceAtEnd();
  const variation = ending - initial;
  if (variationRow) {
    variationRow.saldo = variation;
    variationRow.movimento_periodo = variation;
    variationRow.saldo_final = variation;
  }
  const months = reportMonths();
  const startMonthValues = {};
  const endMonthValues = {};
  let running = initial;
  months.forEach((month) => {
    startMonthValues[month] = running;
    running += Number(variationRow?.monthValues?.[month] || 0);
    endMonthValues[month] = running;
  });
  setDfcFixedValue(byCode.get("DFC.CASH.INICIO"), initial, startMonthValues, cashEquivalentAnalyticRows("saldo_anterior", "DFC.CASH.INICIO"));
  setDfcFixedValue(byCode.get("DFC.CASH.FIM"), ending, endMonthValues, cashEquivalentAnalyticRows("saldo_atual", "DFC.CASH.FIM"));
}

function setDfcFixedValue(row, value, monthValues = {}, contas = []) {
  if (!row) return;
  row.saldo = value;
  row.movimento_periodo = value;
  row.saldo_final = value;
  row.monthValues = monthValues;
  row.contas = contas;
  row.qtd_lancamentos = contas.length;
  row.hasValue = true;
}

function cashBalanceAtStart() {
  return cashEquivalentAccounts().reduce((sum, account) => sum + Number(account.saldo_anterior || 0), 0);
}

function cashBalanceAtEnd() {
  return cashEquivalentAccounts().reduce((sum, account) => sum + Number(account.saldo_atual || 0), 0);
}

function cashEquivalentAccounts() {
  return state.accounts
    .filter((account) => account.tipo_sintetica === "nao")
    .filter((account) => isCashEntry({ ...account, descricao_conta: account.nome_conta, historico: "" }));
}

function cashEquivalentAnalyticRows(balanceField, parentCode) {
  return cashEquivalentAccounts().map((account) => {
    const value = Number(account[balanceField] || 0);
    return {
      kind: "analytic",
      demonstrativo: "DFC",
      classificacao: account.classificacao,
      codigo: account.codigo || "",
      codigo_gerencial: parentCode,
      nome_conta: account.nome_conta || account.descricao_conta || account.classificacao,
      categoria_gerencial: "Caixa e equivalentes",
      grupo_macro: "Disponibilidades",
      nivel: 2,
      qtd_lancamentos: 0,
      monthValues: {},
      valor_gerencial: value,
      saldo: value,
      saldo_final: value,
      movimento_periodo: value,
      saldo_anterior_balancete: balanceField === "saldo_anterior" ? value : 0,
      dfcEntries: [],
    };
  });
}

function gerencialCodeForEntry(entry) {
  const ownCode = String(entry?.codigo_gerencial || "");
  if (ownCode) return ownCode;
  const map = mappingByClassification().get(entry?.classificacao);
  return String(map?.codigo_gerencial || "");
}

function ensureSyntheticRow(rows, code, values) {
  if (rows.has(code)) return rows.get(code);
  const row = {
    kind: "synthetic",
    demonstrativo: values.demonstrativo,
    codigo_gerencial: code,
    categoria_gerencial: values.categoria_gerencial,
    grupo_macro: values.grupo_macro,
    nivel: Number(values.nivel || levelFromCode(code)),
    aceita_depara: "nao",
    saldo: 0,
    debito: 0,
    credito: 0,
    saldo_inicial: 0,
    saldo_anterior_balancete: 0,
    movimento_periodo: 0,
    saldo_final: 0,
    contas: [],
    qtd_lancamentos: 0,
    monthValues: {},
    hasValue: false,
    hasSyntheticChildren: false,
  };
  rows.set(code, row);
  const parent = rows.get(parentCode(code));
  if (parent) parent.hasSyntheticChildren = true;
  return row;
}

function ensureBalanceGroups(rows) {
  [
    ["01.01", "Ativo Circulante", "Ativo Circulante"],
    ["01.02", "Ativo Nao Circulante", "Ativo Nao Circulante"],
    ["02.01", "Passivo Circulante", "Passivo Circulante"],
    ["02.02", "Passivo Nao Circulante", "Passivo Nao Circulante"],
  ].forEach(([code, name, group]) => {
    ensureSyntheticRow(rows, code, {
      demonstrativo: "BP",
      categoria_gerencial: name,
      grupo_macro: group,
      nivel: 3,
    });
  });
}

function adjustBalanceGroupLevels(rows) {
  rows.forEach((row) => {
    if (balanceGroupCode(row.codigo_gerencial)) row.nivel = Number(row.nivel || 1) + 1;
  });
}

function applyDreFormulas(rows) {
  const formulas = [
    ["DRE.03", ["DRE.01", "DRE.02"]],
    ["DRE.05", ["DRE.03", "DRE.04"]],
    ["DRE.10", ["DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.09"]],
    ["DRE.12", ["DRE.10", "DRE.11"]],
    ["DRE.15", ["DRE.12", "DRE.13", "DRE.14"]],
    ["DRE.17", ["DRE.15", "DRE.16"]],
  ];

  formulas.forEach(([targetCode, sourceCodes]) => {
    const target = rows.get(targetCode);
    if (!target) return;
    const sources = sourceCodes.map((code) => rows.get(code)).filter(Boolean);
    target.saldo = sumValues(sources, "saldo");
    target.debito = sumValues(sources, "debito");
    target.credito = sumValues(sources, "credito");
    target.saldo_inicial = sumValues(sources, "saldo_inicial");
    target.saldo_anterior_balancete = sumValues(sources, "saldo_anterior_balancete");
    target.movimento_periodo = sumValues(sources, "movimento_periodo");
    target.saldo_final = sumValues(sources, "saldo_final");
    target.qtd_lancamentos = sumValues(sources, "qtd_lancamentos");
    target.monthValues = sumMonthValues(sources);
    target.periodDebito = sumValues(sources, "periodDebito");
    target.periodCredito = sumValues(sources, "periodCredito");
    target.hasValue = true;
    target.isFormula = true;
  });
}

function applyNonOperatingExclusions(rows) {
  if (!state.hideNonOperatingResults || !Array.isArray(state.excludedNonOperatingCodes) || !state.excludedNonOperatingCodes.length) return;
  const excluded = topLevelExcludedNonOperatingCodes();
  excluded.forEach((code) => {
    const source = rows.get(code);
    if (!source) return;
    const snapshot = rowMetricSnapshot(source);
    ancestors(code).filter((ancestor) => ancestor !== code).forEach((ancestorCode) => {
      const row = rows.get(ancestorCode);
      if (!row) return;
      subtractRowSnapshot(row, snapshot);
    });
    rows.forEach((row) => {
      if (row.codigo_gerencial === code || isDescendantCode(row.codigo_gerencial, code)) {
        zeroExcludedRow(row);
      }
    });
  });
}

function topLevelExcludedNonOperatingCodes() {
  const codes = [...new Set((state.excludedNonOperatingCodes || [])
    .map((code) => String(code || "").trim())
    .filter((code) => code.startsWith("DRE.14")))]
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  return codes.filter((code) => !codes.some((candidate) => candidate !== code && isDescendantCode(code, candidate)));
}

function rowMetricSnapshot(row) {
  return {
    saldo: Number(row.saldo || 0),
    debito: Number(row.debito || 0),
    credito: Number(row.credito || 0),
    saldo_inicial: Number(row.saldo_inicial || 0),
    saldo_anterior_balancete: Number(row.saldo_anterior_balancete || 0),
    movimento_periodo: Number(row.movimento_periodo || 0),
    saldo_final: Number(row.saldo_final || 0),
    qtd_lancamentos: Number(row.qtd_lancamentos || 0),
    monthValues: { ...(row.monthValues || {}) },
  };
}

function subtractRowSnapshot(row, snapshot) {
  row.saldo -= snapshot.saldo;
  row.debito -= snapshot.debito;
  row.credito -= snapshot.credito;
  row.saldo_inicial -= snapshot.saldo_inicial;
  row.saldo_anterior_balancete -= snapshot.saldo_anterior_balancete;
  row.movimento_periodo -= snapshot.movimento_periodo;
  row.saldo_final -= snapshot.saldo_final;
  row.qtd_lancamentos = Math.max(0, Number(row.qtd_lancamentos || 0) - snapshot.qtd_lancamentos);
  Object.entries(snapshot.monthValues).forEach(([month, value]) => {
    row.monthValues[month] = Number(row.monthValues?.[month] || 0) - Number(value || 0);
  });
}

function zeroExcludedRow(row) {
  row.saldo = 0;
  row.debito = 0;
  row.credito = 0;
  row.saldo_inicial = 0;
  row.saldo_anterior_balancete = 0;
  row.movimento_periodo = 0;
  row.saldo_final = 0;
  row.qtd_lancamentos = 0;
  row.monthValues = {};
  row.contas = [];
  row.hasValue = false;
  row.isExcludedNonOperating = true;
}

function sumValues(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function sumMonthValues(rows) {
  const result = {};
  rows.forEach((row) => {
    Object.entries(row.monthValues || {}).forEach(([month, value]) => {
      result[month] = (result[month] || 0) + Number(value || 0);
    });
  });
  return result;
}

function sumMonthObjects(left, right) {
  const result = { ...left };
  Object.entries(right).forEach(([month, value]) => {
    result[month] = (result[month] || 0) + Number(value || 0);
  });
  return result;
}

function sumObjectValues(values) {
  return Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
}

function reportAccountValue(type, account, periodMovementByAccount, previousMovementByAccount = new Map()) {
  if (type === "DRE") {
    const previous = previousMovementByAccount.get(account.classificacao) || 0;
    const movement = periodMovementByAccount.get(account.classificacao) || 0;
    return {
      initial: previous,
      previous,
      movement,
      final: previous + movement,
    };
  }
  if (type !== "BP") {
    return {
      initial: 0,
      previous: Number(account.saldo_anterior || 0),
      movement: 0,
      final: reportValue(type, account.saldo_atual),
    };
  }
  const planRow = accountPlanRow(account);
  const initial = openingBalance(account, planRow);
  const movement = periodMovementByAccount.get(account.classificacao) || 0;
  // The trial balance is the authoritative source for a balance-sheet closing
  // balance. Rebuilding it from journals can double count opening movements or
  // diverge when the journal extract is not a complete roll-forward.
  const final = bpBalanceValue(account.saldo_atual, planRow);
  return { initial, previous: initial, movement, final };
}

function openingBalance(account, planRow = accountPlanRow(account)) {
  // saldo_anterior already comes from the imported trial balance and must not
  // receive the journal again, especially when classifications are reused.
  return bpBalanceValue(account.saldo_anterior, planRow);
}

function accountPlanRow(account) {
  const mapping = mappingByClassification();
  const plan = planByCode();
  return plan.get(mapping.get(account.classificacao)?.codigo_gerencial || "") || null;
}

function bpBalanceValue(value, planRow) {
  const numeric = Number(value || 0);
  return isPassiveOrEquityPlan(planRow) ? -numeric : numeric;
}

function movementByAccount(entries, type) {
  const mapping = mappingByClassification();
  const plan = planByCode();
  const result = new Map();
  entries.forEach((entry) => {
    const codigoGerencial = entry.codigo_gerencial || mapping.get(entry.classificacao)?.codigo_gerencial || "";
    const planRow = plan.get(codigoGerencial);
    if (planRow && planRow.demonstrativo !== type) return;
    const value = reportEntryValue(type, entry, planRow);
    result.set(entry.classificacao, (result.get(entry.classificacao) || 0) + value);
  });
  return result;
}

export function visibleReportRows(type) {
  const tree = buildReportTree(type);
  const byParent = new Map();
  tree.forEach((row) => {
    const parent = parentCode(row.codigo_gerencial) || "";
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(row);
  });

  const output = [];
  const roots = byParent.get("") || [];
  roots.forEach((row) => appendVisibleRow(row, byParent, output));
  return applySearch(removeDuplicateDreSubtotal(applyNonOperatingVisibility(dedupeRows(output), type), type), state.search);
}

function entriesBeforePeriodStart() {
  if (!state.periodStart) return [];
  const year = String(state.periodStart || "").slice(0, 4);
  return state.journal.filter((entry) => {
    const date = String(entry.data || "").slice(0, 10);
    if (!date || date >= state.periodStart) return false;
    return !year || date.startsWith(year);
  });
}

function applyNonOperatingVisibility(rows, type) {
  if (type !== "DRE" || !state.hideNonOperatingResults) return rows;
  return rows.filter((row) => !row.isExcludedNonOperating);
}

function removeDuplicateDreSubtotal(rows, type) {
  if (type !== "DRE") return rows;
  const beforeTax = rows.find((row) => row.codigo_gerencial === "DRE.15");
  const net = rows.find((row) => row.codigo_gerencial === "DRE.17");
  if (!beforeTax || !net) return rows;
  const sameTotal = nearZero(Number(beforeTax.saldo || 0) - Number(net.saldo || 0));
  const sameMonths = sameMonthValues(beforeTax.monthValues || {}, net.monthValues || {});
  return sameTotal && sameMonths ? rows.filter((row) => row.codigo_gerencial !== "DRE.15") : rows;
}

function sameMonthValues(left, right) {
  const months = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...months].every((month) => nearZero(Number(left[month] || 0) - Number(right[month] || 0)));
}

function isDescendantCode(code, parent) {
  return String(code || "").startsWith(`${parent}.`);
}

function nearZero(value) {
  return Math.abs(Number(value || 0)) < 0.005;
}

function appendVisibleRow(row, byParent, output) {
  output.push(row);
  const autoOpen = Number(row.nivel || 0) < 2;
  if (!autoOpen && !state.expandedLines.has(row.codigo_gerencial)) return;

  const children = byParent.get(row.codigo_gerencial) || [];
  if (children.length) {
    children.forEach((child) => {
      output.push(child);
      if (state.expandedLines.has(child.codigo_gerencial)) appendVisibleChildren(child, byParent, output);
    });
    return;
  }

  output.push(...analyticRowsForLine(row));
}

function appendVisibleChildren(row, byParent, output) {
  const children = byParent.get(row.codigo_gerencial) || [];
  if (children.length) {
    children.forEach((child) => {
      output.push(child);
      if (state.expandedLines.has(child.codigo_gerencial)) appendVisibleChildren(child, byParent, output);
    });
    return;
  }

  output.push(...analyticRowsForLine(row));
}

export function analyticRowsForLine(line) {
  if (!line) return [];
  const mapping = mappingByClassification();
  const entries = filteredJournal();
  const type = line.demonstrativo;
  const periodMovementByAccount = movementByAccount(entries, type);
  const previousMovementByAccount = type === "DRE" ? movementByAccount(entriesBeforePeriodStart(), type) : new Map();
  const analyticAccounts = state.accounts.filter((account) => account.tipo_sintetica === "nao");
  const classFrequency = analyticAccounts.reduce((counts, account) => {
    const key = String(account.classificacao || "");
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  return analyticAccounts
    .filter((account) => mapping.get(account.classificacao)?.codigo_gerencial === line.codigo_gerencial)
    .map((account) => {
      const sameClassEntries = entries.filter((entry) => entry.classificacao === account.classificacao);
      const accountEntries = (classFrequency.get(String(account.classificacao || "")) || 0) > 1
        ? sameClassEntries.filter((entry) => journalEntryMatchesAccount(entry, account))
        : sameClassEntries;
      const accountValue = reportAccountValue(type, account, periodMovementByAccount, previousMovementByAccount);
      const monthValues = {};
      let analyticMovement = 0;
      let periodDebito = 0;
      let periodCredito = 0;
      accountEntries.forEach((entry) => {
        const month = String(entry.data || "").slice(0, 7);
        const planRow = mapping.get(entry.classificacao) ? planByCode().get(mapping.get(entry.classificacao).codigo_gerencial) : null;
        const entryValue = reportEntryValue(type, entry, planRow);
        monthValues[month] = (monthValues[month] || 0) + entryValue;
        analyticMovement += entryValue;
        periodDebito += Number(entry.debito || 0);
        periodCredito += Number(entry.credito || 0);
      });
      return {
        ...account,
        kind: "analytic",
        nivel: line.nivel + 1,
        qtd_lancamentos: accountEntries.length,
        monthValues,
        saldo_inicial: accountValue.initial,
        saldo_anterior_balancete: accountValue.previous,
        movimento_periodo: analyticMovement,
        saldo_final: accountValue.final,
        valor_gerencial: accountValue.final,
        periodDebito,
        periodCredito,
      };
    })
    .sort((a, b) => {
      if (type === "BP") {
        const byName = analyticAlphabeticalKey(a).localeCompare(analyticAlphabeticalKey(b), "pt-BR", { sensitivity: "base", numeric: true });
        if (byName) return byName;
      }
      return String(a.classificacao || "").localeCompare(String(b.classificacao || ""), "pt-BR", { numeric: true });
    });
}

function journalEntryMatchesAccount(entry, account) {
  const entryName = comparableAccountName(entry.descricao_conta || entry.nome_conta || "");
  const accountName = comparableAccountName(account.nome_conta || account.descricao || "");
  if (!entryName || !accountName) return false;
  return entryName === accountName
    || (entryName.length >= 8 && accountName.includes(entryName))
    || (accountName.length >= 8 && entryName.includes(accountName));
}

function comparableAccountName(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function analyticAlphabeticalKey(account) {
  return String(account.nome_conta || account.descricao || "")
    .trim()
    .replace(/^(?:\d[\d.\-/]*\s+)+/, "")
    .trim();
}

export function kpis() {
  const dre = buildReport("DRE");
  const bp = buildReportTree("BP");
  const rowValue = (rows, code) => rows.find((row) => row.codigo_gerencial === code)?.saldo || 0;
  const rowPeriodValue = (rows, code) => {
    const row = rows.find((item) => item.codigo_gerencial === code);
    if (!row) return 0;
    return Object.keys(row.monthValues || {}).length ? sumObjectValues(row.monthValues) : Number(row.saldo || 0);
  };
  const receita = rowPeriodValue(dre, "DRE.03");
  const resultado = rowPeriodValue(dre, "DRE.17") || rowPeriodValue(dre, "DRE.12");
  const analyticAccounts = state.accounts.filter((account) => account.tipo_sintetica === "nao");
  const totalAtivoBalancete = analyticAccounts
    .filter((account) => String(account.classificacao || "").startsWith("1"))
    .reduce((sum, account) => sum + Number(account.saldo_atual || 0), 0);
  const totalPassivoPlBalancete = analyticAccounts
    .filter((account) => String(account.classificacao || "").startsWith("2"))
    .reduce((sum, account) => sum + Number(account.saldo_atual || 0), 0);
  const totalAtivo = rowValue(bp, "01") || totalAtivoBalancete;
  const totalPassivoPl = (rowValue(bp, "02") + rowValue(bp, "03")) || totalPassivoPlBalancete;
  const diferencaBalanco = Math.sign(totalAtivo) === Math.sign(totalPassivoPl)
    ? totalAtivo - totalPassivoPl
    : totalAtivo + totalPassivoPl;
  return {
    receita,
    resultado,
    totalAtivo,
    totalPassivoPl,
    diferencaBalanco,
    entries: filteredJournal().length,
    mapped: state.mappings.length,
  };
}

export function entriesForAccount(classificacao) {
  return filteredJournal().filter((entry) => entry.classificacao === classificacao);
}

export function entriesForDfcAnalytic(parentCode, classificacao) {
  const parent = buildDfcDirect().find((row) => row.codigo_gerencial === parentCode);
  const analytic = parent?.contas?.find((row) => row.classificacao === classificacao);
  return analytic?.dfcEntries || [];
}

export function missingMappingAccounts() {
  const mapping = mappingByClassification();
  return state.accounts
    .filter((account) => account.tipo_sintetica === "nao")
    .filter((account) => !mapping.has(account.classificacao));
}

export function applySearch(rows, query) {
  const normalized = normalize(query);
  if (!normalized) return rows;
  return rows.filter((row) => normalize(`${row.codigo_gerencial} ${row.categoria_gerencial} ${row.grupo_macro} ${row.nome_conta || ""}`).includes(normalized));
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.kind === "analytic"
      ? `analytic:${row.classificacao || ""}:${row.codigo || ""}:${normalize(row.nome_conta || row.descricao || "")}`
      : `${row.kind}:${row.codigo_gerencial || row.classificacao}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ancestors(code) {
  const balanceGroup = balanceGroupCode(code);
  const parts = String(code || "").split(".");
  const result = parts.map((_, index) => parts.slice(0, index + 1).join("."));
  const rootAlias = balanceRootAlias(parts[0]);
  const withRoot = rootAlias ? [rootAlias, ...result.filter((item) => item !== parts[0])] : result;
  if (!balanceGroup) return withRoot;
  const sideCode = parts.slice(0, 2).join(".");
  return withRoot.flatMap((item) => item === sideCode ? [item, balanceGroup] : [item]);
}

function parentCode(code) {
  const balanceGroup = balanceGroupCode(code);
  if (balanceGroup) {
    const parts = String(code || "").split(".");
    if (parts.length === 3) return balanceGroup;
  }
  const parts = String(code || "").split(".");
  if (parts.length <= 1) return "";
  if (parts.length === 2) return balanceRootAlias(parts[0]) || parts[0];
  return parts.slice(0, -1).join(".");
}

function balanceRootAlias(firstPart) {
  // The current BP plan already uses 01, 02 and 03 as its root codes.
  // Converting them to the legacy 1, 2 and 3 codes detaches the whole tree.
  return "";
}

function balanceGroupCode(code) {
  const normalized = String(code || "");
  const match = normalized.match(/^$/);
  if (!match) return "";
  const side = match[1];
  const groupNumber = Number(match[2]);
  if (side === "A") return groupNumber <= 6 ? "01.01" : "01.02";
  if (side === "P") return groupNumber <= 6 ? "02.01" : "02.02";
  return "";
}

function levelFromCode(code) {
  return String(code || "").split(".").length;
}

function monthsFromSelectedPeriod() {
  if (!state.periodStart || !state.periodEnd) return [];
  const start = monthStart(state.periodStart);
  const end = monthStart(state.periodEnd);
  if (!start || !end || start > end) return [];
  const months = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function monthStart(value) {
  const [year, month] = String(value || "").slice(0, 7).split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function reportValue(type, value) {
  if (type === "DRE") return -value;
  return value;
}

function reportEntryValue(type, entry, planRow = null) {
  const raw = Number(entry.debito || 0) - Number(entry.credito || 0);
  if (type === "BP" && isPassiveOrEquityPlan(planRow)) return -raw;
  return reportValue(type, raw);
}

function isPassiveOrEquityPlan(planRow) {
  const code = String(planRow?.codigo_gerencial || "");
  return code === "02" || code.startsWith("02.") || code === "03" || code.startsWith("03.");
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}



