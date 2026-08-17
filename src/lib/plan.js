import { parseCsv } from "../importers/csv.js";
import { setData } from "../data/useStore.js";
import { loadPlano } from "./planoStore.js";

async function fetchCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`falha ao carregar ${path}`);
  return parseCsv(await response.text());
}

async function fetchOptionalCsv(paths) {
  for (const path of paths) {
    try {
      const rows = await fetchCsv(path);
      if (rows.length) return rows;
    } catch {
      // try next candidate
    }
  }
  return [];
}

export async function loadPlan() {
  const [, dfcStructure, dfcRules, dfcLinks] = await Promise.all([
    loadPlano(), // the editable plano gerencial — see lib/planoStore.js
    fetchCsv("/data/estrutura_dfc_direta.csv"),
    fetchCsv("/data/regras_dfc_direta.csv"),
    fetchOptionalCsv(["/data/vinculo_gerencial_dfc.csv", "/data/vinculo_dre_dfc.csv"]),
  ]);
  setData({ dfcStructure, dfcRules, dfcLinks });
}
