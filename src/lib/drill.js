import { state } from "../data/useStore.js";
import { DRE_RESUMIDA_MAP, EXECUTIVE_DRE_MAP } from "./executiveDre.js";
import { FORMULAS } from "./budget.js";
import { demoTree, demoValue } from "./slideDemo.js";
import { describeIndicatorFormula, evaluateIndicatorFormula, lineLabel } from "./indicatorFormula.js";
import { planNameCase } from "./planCase.js";

// "Do número ao lançamento" do B.I.: abre um card (ou uma linha de tabela)
// na composição dele — os termos da fórmula, cada linha gerencial nas
// linhas de baixo, as contas do balancete e, por fim, os lançamentos do
// razão (ledgerData, o mesmo razão do modo apresentação). Os valores vêm
// dos mesmos relatórios (demoTree/analyticRowsForLine), então a soma de
// cada nível bate com o nível de cima.

const DRE_FORMULAS = new Map(FORMULAS);

function sourceOf(code) {
  return String(code || "").startsWith("DRE") ? "DRE" : "BP";
}

// Período todo ("total") ou um mês ("2026-07"): a DRE e as linhas
// EBITDA/resumidas são movimento; o Balanço é o saldo no fim do mês.
function rowValue(source, row, column, months) {
  if (!row) return 0;
  if (source === "DEX") {
    if (column === "total") return Number(row.saldo || 0);
    return Number(row.monthValues?.[column] || 0);
  }
  return demoValue(source, row, column, months);
}

function mapEntry(code) {
  if (String(code).startsWith("DEX")) return EXECUTIVE_DRE_MAP.find((item) => item.code === code);
  if (String(code).startsWith("DRS")) return DRE_RESUMIDA_MAP.find((item) => item.code === code);
  return null;
}

export function createDrill(ctx) {
  const trees = { DRE: demoTree("DRE", ctx), BP: demoTree("BP", ctx) };
  const months = ctx?.months || [];
  const derived = new Map([...(ctx?.executive || []), ...(ctx?.dreResumida || [])].map((row) => [row.codigo_gerencial, row]));

  function accountNode(source, acc, sign, parent) {
    const row = acc.row;
    const codes = Array.isArray(row.classificacao) ? row.classificacao : [row.classificacao];
    return {
      key: `${parent.key}>${acc.key}`,
      kind: "account",
      name: acc.name,
      detail: codes.length > 1 ? `${codes.length} contas somadas` : codes[0],
      source,
      sign,
      value: (column) => sign * rowValue(source, row, column, months),
      children: () => [],
      ledger: { source, row, parentCode: parent.code, name: acc.name },
    };
  }

  function lineNode(source, code, sign, parentKey = "") {
    const node = trees[source].findByCode(code);
    const key = `${parentKey}/${code}`;
    const base = { key, kind: "line", code, source, sign, name: node?.name || planNameCase(lineLabel(code)) };
    if (!node) return { ...base, value: () => 0, children: () => [], empty: true };
    let cache = null;
    const self = {
      ...base,
      value: (column) => sign * rowValue(source, node.row, column, months),
      children: () => {
        if (cache) return cache;
        if (source === "DRE" && DRE_FORMULAS.has(code)) {
          cache = DRE_FORMULAS.get(code).map((child) => lineNode("DRE", child, sign, key)).filter((child) => !child.empty);
        } else {
          cache = trees[source].childrenOf(node).map((child) => (child.kind === "analytic" ? accountNode(source, child, sign, self) : lineNode(source, child.code, sign, key)));
        }
        return cache;
      },
    };
    // Linha final (as filhas são contas): dá pra ver os lançamentos de todas
    // as contas juntas, com filtro por conta.
    self.lineLedger = () => {
      const kids = self.children();
      if (!kids.length || kids.some((child) => child.kind !== "account")) return null;
      const codes = kids.flatMap((child) => (Array.isArray(child.ledger.row.classificacao) ? child.ledger.row.classificacao : [child.ledger.row.classificacao]));
      return { source, row: { ...node.row, classificacao: codes }, parentCode: code, name: self.name, multi: true };
    };
    return self;
  }

  // Um código de fórmula de indicador: DRE/BP direto, ou as linhas
  // EBITDA (DEX.*)/DRE resumida (DRS.*), que são somas de linhas da DRE.
  function termNode(code, sign, parentKey = "") {
    const entry = mapEntry(code);
    if (!entry) return lineNode(sourceOf(code), code, sign, parentKey);
    const key = `${parentKey}/${code}`;
    const row = derived.get(code);
    const name = planNameCase(entry.name);
    let children;
    if (code === "DEX.10") children = [termNode("DEX.08", sign, key), termNode("DEX.09", sign, key)];
    else if (entry.percentage) children = [];
    else {
      const factor = entry.invert ? -sign : sign;
      children = (entry.sources || []).map((source) => lineNode("DRE", source, factor, key)).filter((child) => !child.empty);
    }
    return {
      key,
      kind: "line",
      code,
      source: "DRE",
      sign,
      name,
      value: (column) => sign * rowValue("DEX", row, column, months),
      children: () => children,
      lineLedger: () => null,
    };
  }

  return { termNode, months };
}

// Um card (fórmula de indicador) inteiro: grupos de termos (numerador e,
// numa razão, denominador) e o valor do card por coluna.
export function buildDrill({ label, formula }, ctx) {
  const { termNode, months } = createDrill(ctx);
  const groups = [{ id: "num", title: formula.kind === "ratio" ? "Numerador (parte de cima)" : null, terms: (formula.numerator || []).map((term, index) => termNode(term.code, term.sign < 0 ? -1 : 1, `n${index}`)) }];
  if (formula.kind === "ratio") groups.push({ id: "den", title: "Denominador (parte de baixo)", terms: (formula.denominator || []).map((term, index) => termNode(term.code, term.sign < 0 ? -1 : 1, `d${index}`)) });
  const groupTotal = (group, column) => group.terms.reduce((sum, term) => sum + term.value(column), 0);
  function valueAt(column) {
    if (column === "total") return evaluateIndicatorFormula(formula, ctx).value;
    const num = groupTotal(groups[0], column);
    if (formula.kind !== "ratio") return num;
    const den = groupTotal(groups[1], column);
    const raw = Math.abs(den) > 0.005 ? num / den : 0;
    return formula.format === "percent" ? raw * 100 : raw;
  }
  return {
    label,
    format: formula.format || "money",
    formulaText: describeIndicatorFormula(formula),
    groups,
    months,
    valueAt,
    groupTotal,
    hasJournal: (state.journal || []).length > 0,
  };
}

// Fórmula de uma linha das tabelas do B.I. (DRE resumida, Balanço, EBITDA):
// a margem EBITDA vira EBITDA ÷ receita líquida; o resto é a própria linha.
export function lineFormula(row) {
  if (row.codigo_gerencial === "DEX.11") return { kind: "ratio", format: "percent", numerator: [{ code: "DEX.10", sign: 1 }], denominator: [{ code: "DEX.03", sign: 1 }] };
  return { kind: "sum", format: "money", numerator: [{ code: row.codigo_gerencial, sign: 1 }] };
}
