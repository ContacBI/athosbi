import { useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient.js";

// Interno x Contábil (Grupo Concent): o demonstrativo gerencial interno do cliente (o "DRF" do sistema deles), conferido na Central contra a contabilidade
// (Domínio). A Central monta o demonstrativo e manda pela função interno-contabil; fica em public.interno_contabil, uma linha por empresa, mês (AAAA-MM) e
// regime (caixa | competencia). Aqui é só leitura.
//
// dados = {
//   versao, mes, regime, arquivo, geradoEm,
//   cascata: { receita, pessoal, impostos, gerais, ebit, entradas, resultado, abaixo, liquido, achado: { receita, pessoal, impostos, gerais, entradas, abaixo } },
//   blocos: [{ id, nome, total, achado, linhas: [Linha] }],          // receita, pessoal, impostos, gerais, entradas, saidas
//   abaixo: { total, achado, linhas: [Linha] },                        // empréstimos, previdência, distribuição (abaixo do resultado do exercício)
//   resultadoOperacional, resultado, liquido,
//   prova: { dIni, dFim, ini, fim, mov, contas: [{ c, nome, ini, ent, sai, fim }], resultado, abaixo, liquidoRelatorio, diferenca } | null   (só no caixa)
// }
// Linha = { codigo, nome, total, achado, nao, destinos: [{ contas: [{ c, nome }], v, res, via }], partes?: [{ sinal: "+"|"-", ...Linha }] }   (partes = linha líquida)
export async function fetchInternoContabil(companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase.from("interno_contabil").select("mes, regime, dados, synced_at").eq("company_id", companyId).order("mes", { ascending: false });
  if (error) throw error;
  return data || [];
}

export const REGIMES = [
  { id: "caixa", nome: "Caixa" },
  { id: "competencia", nome: "Competência" },
];

// último dia do mês "AAAA-MM" → "AAAA-MM-DD"
export function fimDoMes(mes) {
  const [a, m] = String(mes).split("-").map(Number);
  const d = new Date(a, m, 0).getDate();
  return `${mes}-${String(d).padStart(2, "0")}`;
}

// Período do módulo (o mês do relatório interno), compartilhado entre a tela e o seletor do topo (CompanyTopBar): só os meses que a Central mandou.
let periodo = { meses: [], mes: null };
const ouvintes = new Set();
export const periodoInterno = {
  get: () => periodo,
  set(parcial) {
    periodo = { ...periodo, ...parcial };
    ouvintes.forEach((f) => f());
  },
  sub(f) {
    ouvintes.add(f);
    return () => ouvintes.delete(f);
  },
};
export const usePeriodoInterno = () => useSyncExternalStore(periodoInterno.sub, periodoInterno.get);
