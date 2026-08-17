// Which of the four balance/result "naturezas" a ledger account or a
// managerial plano line belongs to — Ativo / Passivo / PL / Resultado.
// Used to keep De/Para honest: an Ativo ledger account should only ever be
// linkable to an Ativo managerial line, never to a Passivo or DRE one.
export const NATURE_LABELS = {
  ativo: "Ativo",
  passivo: "Passivo",
  pl: "Patrimônio líquido",
  resultado: "Resultado (DRE)",
};

export const NATURE_ORDER = ["ativo", "passivo", "pl", "resultado"];

// A sensible default for the common Brazilian chart-of-accounts convention
// (1.x = Ativo, 2.1.x/2.2.x = Passivo circulante/não circulante, 2.3.x =
// PL, 9.x = contas de resultado). Every company starts with this, but it's
// just a starting point — a company whose accounting software numbers
// things differently can override it at cadastro time (see CompanyModal).
export const DEFAULT_NATURE_RULES = {
  ativo: ["1"],
  passivo: ["2.1", "2.2"],
  pl: ["2.3"],
  resultado: ["9"],
};

// "1, 2.1 , 2.2" -> ["1", "2.1", "2.2"]
export function parsePrefixList(text) {
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatPrefixList(prefixes) {
  return (prefixes || []).join(", ");
}

// The company's own ledger account, classified by its raw classificacao
// against that company's configured prefix rules. Returns null when it
// doesn't match any configured prefix — callers should treat that as "not
// enough information to restrict", not as an error.
export function accountNature(classificacao, rules) {
  const code = String(classificacao || "");
  const effective = rules || DEFAULT_NATURE_RULES;
  for (const nature of NATURE_ORDER) {
    const prefixes = effective[nature] || [];
    if (prefixes.some((prefix) => prefix && code.startsWith(prefix))) return nature;
  }
  return null;
}

// The shared managerial plano's own structure is fixed across every
// company (it's the one standard chart everyone maps into), so this side
// never needs a per-company override — 01.x is always Ativo, 02.x always
// Passivo, 03.x always PL, and every DRE.x line is Resultado.
export function planoNature(row) {
  if (row?.demonstrativo === "DRE") return "resultado";
  const code = String(row?.codigo_gerencial || "");
  if (code.startsWith("03")) return "pl";
  if (code.startsWith("02")) return "passivo";
  if (code.startsWith("01")) return "ativo";
  return null;
}
