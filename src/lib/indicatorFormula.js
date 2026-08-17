import { state } from "../data/useStore.js";
import { EXECUTIVE_DRE_MAP } from "./executiveDre.js";
import { directChildren } from "./reportTree.js";

function pct(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}

function ratioText(value) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(2).replace(".", ",");
}

function formatIndicatorValue(value, format) {
  if (format === "percent") return pct(value);
  if (format === "ratio") return ratioText(value);
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Every indicator formula references a "linha" by its codigo_gerencial —
// the same three trees every other report already builds: the plain DRE
// and BP managerial trees (state.plano), or the fixed DEX.* EBITDA-executive
// rollup (a derived, always-the-same-17-rows tree, not something that lives
// in state.plano at all).
export function treeFor(ctx, code) {
  if (String(code || "").startsWith("DEX")) return ctx.executive;
  if (String(code || "").startsWith("DRE")) return ctx.dre;
  return ctx.bp;
}

export function lineValue(ctx, code) {
  const tree = treeFor(ctx, code);
  const row = (tree || []).find((item) => item.codigo_gerencial === code);
  return Number(row?.saldo || 0);
}

// Label lookup works even without a live ctx (e.g. while editing a formula
// with no company data loaded yet) since it reads the static plano/DEX
// definitions rather than a computed tree.
export function lineLabel(code) {
  if (String(code || "").startsWith("DEX")) {
    return EXECUTIVE_DRE_MAP.find((item) => item.code === code)?.name || code;
  }
  return state.plano.find((item) => item.codigo_gerencial === code)?.nome || code;
}

function sumTerms(ctx, terms) {
  return (terms || []).reduce((sum, term) => sum + lineValue(ctx, term.code) * (term.sign < 0 ? -1 : 1), 0);
}

// The one formula shape every indicator (built-in or custom) is expressed
// in: either a plain sum of signed lines ("kind: sum" — e.g. EBITDA, Capital
// de giro), or a ratio between two such sums ("kind: ratio" — every margin/
// liquidez/ROE-style indicator), optionally ×100 for a percentage.
export function evaluateIndicatorFormula(formula, ctx) {
  if (!formula || !ctx) return { value: 0, format: formula?.format || "money" };
  if (formula.kind === "ratio") {
    const numerator = sumTerms(ctx, formula.numerator);
    const denominator = sumTerms(ctx, formula.denominator);
    const raw = denominator ? numerator / denominator : 0;
    return { value: formula.format === "percent" ? raw * 100 : raw, format: formula.format };
  }
  return { value: sumTerms(ctx, formula.numerator), format: formula.format };
}

function termsLabel(terms) {
  return (terms || [])
    .map((term, index) => {
      const sign = term.sign < 0 ? "−" : index === 0 ? "" : "+";
      return `${sign} ${lineLabel(term.code)}`.trim();
    })
    .filter(Boolean)
    .join(" ");
}

export function describeIndicatorFormula(formula) {
  if (!formula) return "";
  if (formula.kind === "ratio") {
    const suffix = formula.format === "percent" ? " × 100" : "";
    return `${termsLabel(formula.numerator)} ÷ ${termsLabel(formula.denominator)}${suffix}`;
  }
  return termsLabel(formula.numerator);
}

// The row-by-row breakdown shown in the on-screen "como chegamos a esse
// valor" detail — one row per term (numerator, then denominator for a
// ratio), plus a bold result row at the end.
export function indicatorDetailRows(formula, ctx) {
  if (!formula) return [];
  const rows = [];
  const pushTerms = (terms) => {
    (terms || []).forEach((term) => {
      const raw = lineValue(ctx, term.code);
      const signed = term.sign < 0 ? -raw : raw;
      rows.push({ label: `${term.sign < 0 ? "(-) " : ""}${lineLabel(term.code)}`, value: signed });
    });
  };
  pushTerms(formula.numerator);
  if (formula.kind === "ratio") pushTerms(formula.denominator);
  const { value, format } = evaluateIndicatorFormula(formula, ctx);
  rows.push({ label: "Resultado", display: formatIndicatorValue(value, format), bold: true });
  return rows;
}

// A single, unsigned, positive-sign term — i.e. a formula nobody's edited
// away from a plain "show this one line" reference. Used to decide whether
// a card's detail view can use the richer children/ledger breakdown below
// instead of the flatter generic term list.
export function isSingleLineFormula(formula) {
  return formula?.kind === "sum" && formula.numerator?.length === 1 && formula.numerator[0]?.sign !== -1;
}

// A single unedited line reference (DRE.05, "01.01" etc.) shows its real
// composition — direct children in the tree if it's a subtotal, or its top
// underlying ledger accounts if it's a leaf — instead of the flatter
// generic term breakdown. This is what a DRE/Balanço card showed before it
// became formula-editable, and is worth keeping for the common case where
// nobody's actually touched the formula.
export function richLineDetail(code, ctx) {
  const tree = treeFor(ctx, code) || [];
  const row = tree.find((item) => item.codigo_gerencial === code);
  const children = directChildren(tree, code).filter((child) => Math.abs(Number(child.saldo || 0)) > 0.005);
  if (children.length) {
    return {
      formula: "Composição pelos subgrupos diretos desta linha",
      rows: children.map((child) => ({ label: child.categoria_gerencial, value: child.saldo })),
    };
  }
  const accounts = (row?.contas || [])
    .slice()
    .sort((a, b) => Math.abs(Number(b.saldo_atual || 0)) - Math.abs(Number(a.saldo_atual || 0)))
    .slice(0, 8);
  return {
    formula: accounts.length ? "Principais contas contábeis que alimentam esta linha" : "Sem lançamentos no período selecionado",
    rows: accounts.map((account) => ({ label: account.nome_conta || account.descricao || account.classificacao, value: account.saldo_atual })),
  };
}

// Every codigo_gerencial a formula could reference — DRE + BP lines from
// the managerial plan, plus the fixed DEX.* EBITDA-executive rows — grouped
// for a line-picker UI. Deduplicated since a company's plano rows should
// already be one row per code, but a defensive Map costs nothing.
export function availableFormulaLines() {
  const byCode = new Map();
  state.plano.forEach((row) => {
    if (!row.codigo_gerencial || byCode.has(row.codigo_gerencial)) return;
    byCode.set(row.codigo_gerencial, { code: row.codigo_gerencial, label: row.nome, group: row.demonstrativo === "BP" ? "Balanço" : "DRE" });
  });
  EXECUTIVE_DRE_MAP.forEach((item) => {
    if (byCode.has(item.code)) return;
    byCode.set(item.code, { code: item.code, label: item.name, group: "EBITDA Executivo" });
  });
  return [...byCode.values()];
}
