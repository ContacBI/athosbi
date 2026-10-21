import { supabase } from "./supabaseClient.js";

// DFC de empresa "instituto" (company.dfcModelo === "instituto"): a estrutura e
// as contas ligadas a cada grupo vêm da Domínio (CTGRUPOSDFC_DIRETO e
// _CONTAS), mandadas pela Central na função dominio-dfc e guardadas na
// empresa em company.dfcInstituto = { estrutura, contas, assinatura, syncedAt }.
//   estrutura: [{ codigo, ordem, atividade (1 oper., 2 invest., 3 financ.), natureza (V título, S sintética, A analítica), descricao }]
//   contas:    [{ grupo, codigo, classificacao }]  (conta contábil -> grupo da DFC)

const ATIVIDADES = { 1: "Operacional", 2: "Investimento", 3: "Financiamento" };
const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const institutoCode = (codigo) => `DFC.INS.${codigo}`;
// "CAIXA GERADO…", "FLUXO DE CAIXA ANTES…", "CAIXA LÍQUIDO…" acumulam tudo que está acima na mesma atividade.
const isAcumulado = (name) => /^(caixa|fluxo)/.test(norm(name));

// Linhas no mesmo formato de defaultDfcStructure() (calculations.js), na ordem da Domínio, + as 3 linhas de disponibilidades.
export function institutoStructure(model) {
  const sorted = [...(model?.estrutura || [])].sort((a, b) => a.ordem - b.ordem);
  let dentroDeGrupo = false; // dentro de uma sintética "de grupo" (ex.: VALORES RECEBIDOS DE ASSOCIADOS), os itens ficam um nível abaixo
  const rows = sorted.map((item) => {
    if (item.natureza === "V") dentroDeGrupo = false;
    if (item.natureza === "S") dentroDeGrupo = !isAcumulado(item.descricao);
    return {
      number: String(item.codigo),
      code: institutoCode(item.codigo),
      name: item.descricao,
      group: ATIVIDADES[item.atividade] || "Operacional",
      atividade: item.atividade,
      level: item.natureza === "V" ? 1 : item.natureza === "S" ? 2 : dentroDeGrupo ? 3 : 2,
      nature: item.natureza === "V" ? "heading" : item.natureza === "S" ? "subtotal" : "analytic",
    };
  });
  return [
    ...rows,
    { code: "DFC.CASH.VARIACAO", name: "AUMENTO/REDUCAO NAS DISPONIBILIDADES", group: "Disponibilidades", level: 1, nature: "subtotal" },
    { code: "DFC.CASH.INICIO", name: "DISPONIBILIDADES - NO INICIO DO PERIODO", group: "Disponibilidades", level: 1, nature: "subtotal" },
    { code: "DFC.CASH.FIM", name: "DISPONIBILIDADES - NO FINAL DO PERIODO", group: "Disponibilidades", level: 1, nature: "subtotal" },
  ];
}

// Quem soma em cada subtotal. Sintética "de grupo" = soma dos itens que vêm logo abaixo dela; sintética acumulada
// (CAIXA…/FLUXO…) = soma de todos os itens analíticos acima dela na mesma atividade. A variação das disponibilidades
// é a soma do último "CAIXA LÍQUIDO…" de cada atividade.
export function institutoSubtotals(structure) {
  const rows = structure.filter((row) => !row.code.startsWith("DFC.CASH"));
  const subtotals = [];
  rows.forEach((row, index) => {
    if (row.nature !== "subtotal") return;
    let sources;
    if (isAcumulado(row.name)) {
      sources = rows.slice(0, index).filter((other) => other.nature === "analytic" && other.atividade === row.atividade).map((other) => other.code);
    } else {
      sources = [];
      for (let i = index + 1; i < rows.length && rows[i].nature === "analytic"; i += 1) sources.push(rows[i].code);
    }
    subtotals.push({ code: row.code, sources });
  });
  const finais = [1, 2, 3]
    .map((atividade) => {
      const doGrupo = rows.filter((row) => row.nature === "subtotal" && row.atividade === atividade);
      return [...doGrupo].reverse().find((row) => norm(row.name).startsWith("caixa liquido")) || doGrupo[doGrupo.length - 1];
    })
    .filter(Boolean)
    .map((row) => row.code);
  return { subtotals, variacao: finais };
}

// Contrapartida (classificação da conta contábil) -> linha da DFC. Conta sem ligação cai em "Outros recebimentos (pagamentos)".
export function institutoClassifier(model, structure) {
  const byClass = new Map();
  (model?.contas || []).forEach((conta) => byClass.set(conta.classificacao, institutoCode(conta.grupo)));
  const analiticas = structure.filter((row) => row.nature === "analytic");
  const fallback =
    analiticas.find((row) => norm(row.name).includes("outros recebimentos"))?.code ||
    analiticas.find((row) => row.atividade === 1)?.code ||
    analiticas[0]?.code ||
    "";
  return { classify: (classificacao) => byClass.get(String(classificacao || "")) || fallback, fallback };
}

// O que a Central mandou (staging public.dominio_dfc_modelo; só admin e colaboradores leem). null = ainda não chegou.
export async function fetchDfcModelo(codigo, cnpj) {
  const cod = String(codigo || "").trim().replace(/^0+(?=\d)/, "");
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (!cod || !digits) return null;
  const { data, error } = await supabase
    .from("dominio_dfc_modelo")
    .select("estrutura, contas, assinatura, synced_at")
    .eq("company_codigo", cod)
    .eq("cnpj", digits)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { estrutura: data.estrutura, contas: data.contas, assinatura: data.assinatura || "", syncedAt: data.synced_at };
}
