import { state } from "../data/useStore.js";

// Como os nomes das linhas do plano aparecem (relatórios, De/Para, tela do
// plano padrão, exportações, slides): só a primeira letra maiúscula (o
// padrão) ou TUDO MAIÚSCULO — o botão "M" de cada plano padrão (ver
// nomesMaiusculos em lib/planosPadrao.js). Só a exibição muda: o nome
// guardado no plano continua do jeito que foi digitado.

// Siglas ficam maiúsculas mesmo no modo "só a primeira" — "Irpj e csll"
// ficaria errado.
const SIGLAS = new Set([
  "IRPJ", "CSLL", "PIS", "COFINS", "ICMS", "ISS", "ISSQN", "IPI", "INSS", "FGTS", "IRRF", "CSRF", "IOF", "IPTU", "IPVA", "ITBI", "ITR", "IR", "CS",
  "CPRB", "DIFAL", "ST", "DAS", "DARF", "GPS", "GNRE", "PLR", "PAT", "RAT", "FAP", "SAT", "JCP", "FUNRURAL", "INCRA", "REINTEGRA",
  "SESI", "SENAI", "SESC", "SENAC", "SEBRAE", "CMV", "CPV", "CSP", "EBITDA", "EBIT", "DRE", "DFC", "DMPL", "PL", "LTDA", "EPP", "MEI",
  "CNPJ", "CPF", "PJ", "PF", "CLT", "RH", "TI", "PDD", "NCG", "ROE", "ROA", "CDB", "CDI", "LCI", "LCA", "BNDES", "FINAME", "SELIC",
  "IPCA", "IGPM", "USD", "EUA", "NF", "NFE", "NFSE", "CTE", "SPED", "ECF", "ECD", "EFD", "FIDC", "CCB", "CRI", "CRA", "PGBL", "VGBL",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII",
]);

const WORD = /[A-Za-zÀ-ÖØ-öø-ÿ]+/g;

export function sentenceCase(text) {
  let first = true;
  return String(text ?? "")
    .replace(WORD, (word) => {
      const upper = word.toLocaleUpperCase("pt-BR");
      if (SIGLAS.has(upper)) {
        first = false;
        return upper;
      }
      const lower = word.toLocaleLowerCase("pt-BR");
      if (!first) return lower;
      first = false;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .replace(/\bs\/a\b/gi, "S/A");
}

export function planNameCase(text, upper = Boolean(state.planoMaiusculo)) {
  if (text == null) return text;
  return upper ? String(text).toLocaleUpperCase("pt-BR") : sentenceCase(text);
}

// As linhas do plano com o nome já no formato escolhido.
export function withPlanCase(rows, upper) {
  return rows.map((row) => (row.nome ? { ...row, nome: planNameCase(row.nome, upper) } : row));
}
