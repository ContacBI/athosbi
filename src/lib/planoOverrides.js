import { state } from "../data/useStore.js";
import { savePlanoSnapshot, fetchBasePlano } from "./planoStore.js";

// The tree-UI ("+" under a line in Parâmetros → Sistema → Plano gerencial)
// path for adding one account at a time — safe by construction, since a
// new code is generated from wherever the user clicked and can't collide
// with or overwrite anything that already exists. Bulk editing the whole
// plano (including existing lines) happens through the Excel round-trip
// instead — see lib/planoExcel.js.

export function isCustomPlanoCode(code) {
  const row = state.plano.find((item) => item.codigo_gerencial === code);
  return Boolean(row?.custom);
}

function directChildCodes(parentCode) {
  const prefix = `${parentCode}.`;
  return state.plano
    .map((row) => row.codigo_gerencial)
    .filter((code) => code.startsWith(prefix) && !code.slice(prefix.length).includes("."));
}

// Next sibling code under a parent — looks at the highest existing direct
// child's numeric suffix (matching its own digit width, so "01" siblings
// stay "01".."09".."10" instead of jumping to "1") and adds one; starts at
// "01" when the parent has no children yet.
function nextChildCode(parentCode) {
  const children = directChildCodes(parentCode);
  if (!children.length) return `${parentCode}.01`;
  let maxNumber = 0;
  let width = 2;
  children.forEach((code) => {
    const last = code.split(".").pop();
    const number = Number(last);
    if (Number.isFinite(number)) {
      width = last.length;
      if (number > maxNumber) maxNumber = number;
    }
  });
  return `${parentCode}.${String(maxNumber + 1).padStart(width, "0")}`;
}

export function previewNewAccount(parentCode, natureza) {
  const parent = state.plano.find((row) => row.codigo_gerencial === parentCode);
  if (!parent) return null;
  return {
    codigo_gerencial: nextChildCode(parentCode),
    demonstrativo: parent.demonstrativo,
    grupo_macro: parent.grupo_macro,
    nivel: String(Number(parent.nivel || 1) + 1),
    natureza,
    aceita_depara: natureza === "Analitica" ? "sim" : "nao",
  };
}

// `nome` and `natureza` ("Sintetica" | "Analitica") come from the form;
// everything else — code, nível, demonstrativo, grupo_macro, aceita_depara
// — is derived from wherever the user chose to nest it, so there's no way
// to type a malformed or colliding code by hand.
export function addPlanoAccount({ parentCode, nome, natureza }) {
  const trimmedName = String(nome || "").trim();
  if (!trimmedName) return null;
  const preview = previewNewAccount(parentCode, natureza);
  if (!preview) return null;
  const row = {
    ...preview,
    nome: trimmedName,
    sinal_padrao: "Neutro",
    observacao: "",
    dfc_numero: "",
    dfc_codigo: "",
    dfc_descricao: "",
    custom: true,
    createdAt: new Date().toISOString(),
  };
  savePlanoSnapshot([...state.plano, row]);
  return row;
}

// Only ever called with a code that isCustomPlanoCode() already confirmed —
// removing one of the standard rows isn't offered anywhere in the UI.
export function removePlanoAccount(code) {
  savePlanoSnapshot(state.plano.filter((row) => row.codigo_gerencial !== code));
}

export function hasChildren(code) {
  return directChildCodes(code).length > 0;
}

// Re-exported so callers that already import from here (the Plano
// Gerencial page) don't need a second import line for the Excel path.
export { fetchBasePlano };
