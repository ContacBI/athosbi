import { supabase } from "./supabaseClient.js";

// Carga tributária (impostos próprios apurados no fiscal da Domínio ÷ faturamento) por empresa e ano. A Central calcula (só leitura na Domínio) e
// manda pela função dominio-carga; fica em public.dominio_carga (leitura: admin, colaborador e quem tem acesso à empresa).
// Cada linha: { ano, dados: { grupos: [{ id, nome }], meses: [12], trimestres: [4], ano_total }, synced_at }.
// Período (meses, trimestres e ano) = { fat: { servicos, vendas, total, notasServicos, notasVendas, outrasSaidas }, imp: { <grupo>: valor },
// impTotal, carga (fração ou null), reforma: { ibs, cbs }, naoClassificados: { "<código nome>": valor } }.
export async function fetchCargaTributaria(companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase.from("dominio_carga").select("ano, dados, synced_at").eq("company_id", companyId).order("ano", { ascending: false });
  if (error) throw error;
  return data || [];
}

export const pctCarga = (value) => (value == null ? "—" : `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

// Valores informados à mão num mês sem fiscal: faturamento e impostos entram no lugar. O valor informado de um imposto substitui o que o contábil tiver pra ele
// naquele mês (não soma duas vezes). Mês, trimestre e ano são refeitos a partir disso. `manualAno` = { "<mes 0..11>": { fat, imp: { grupo: valor } } }.
export function aplicarManual(central, manualAno) {
  if (!central || !manualAno || !Object.keys(manualAno).length) return central;
  const meses = central.meses.map((m) => ({ ...m, fat: { ...m.fat }, imp: { ...m.imp }, contabil: { ...(m.contabil || {}) } }));
  const tri = central.trimestres.map((t) => ({ ...t, fat: { ...t.fat }, imp: { ...t.imp }, contabil: { ...(t.contabil || {}) } }));
  const tot = { ...central.ano_total, fat: { ...central.ano_total.fat }, imp: { ...central.ano_total.imp }, contabil: { ...(central.ano_total.contabil || {}) } };
  const aplicar = (p, m, cont) => {
    p.fat.total = (p.fat.total || 0) + (m.fat || 0);
    p.fat.servicos = (p.fat.servicos || 0) + (m.fat || 0);
    for (const [id, v] of Object.entries(m.imp || {})) {
      p.imp[id] = (p.imp[id] || 0) + v;
      p.impTotal = (p.impTotal || 0) + v;
      p.contabil[id] = Math.max((p.contabil[id] || 0) - cont[id], 0);
      p.contabilTotal = Math.max((p.contabilTotal || 0) - cont[id], 0);
    }
    p.carga = p.fat.total ? p.impTotal / p.fat.total : null;
  };
  for (const [mesTxt, m] of Object.entries(manualAno)) {
    const i = Number(mesTxt);
    const base = meses[i];
    if (!base || base.fat.total || base.impTotal) continue; // só vale em mês que o fiscal não tem
    const cont = Object.fromEntries(Object.keys(m.imp || {}).map((id) => [id, Math.min(base.contabil[id] || 0, m.imp[id])]));
    for (const alvo of [base, tri[Math.floor(i / 3)], tot]) aplicar(alvo, m, cont);
    base.manual = true;
  }
  return { ...central, meses, trimestres: tri, ano_total: tot };
}

// Soma os impostos que só existem no contábil (provisão) em imp/impTotal/carga.
export function aplicarContabil(dados) {
  if (!dados) return dados;
  const soma = (p) => {
    if (!p?.contabilTotal) return p;
    const imp = { ...p.imp };
    for (const [id, v] of Object.entries(p.contabil || {})) imp[id] = (imp[id] || 0) + v;
    const impTotal = p.impTotal + p.contabilTotal;
    return { ...p, imp, impTotal, carga: p.fat?.total ? impTotal / p.fat.total : p.carga };
  };
  return { ...dados, meses: dados.meses.map(soma), trimestres: dados.trimestres.map(soma), ano_total: soma(dados.ano_total) };
}

function somarObj(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (k === "carga" || k === "manual") continue;
    if (typeof v === "number") out[k] = (out[k] || 0) + v;
    else if (typeof v === "string") out[k] = out[k] ?? v;
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = somarObj(out[k] && typeof out[k] === "object" ? out[k] : {}, v);
  }
  return out;
}
const fecharPeriodo = (p) => ({ ...p, carga: p.fat?.total ? p.impTotal / p.fat.total : null });

// Soma a carga de várias empresas (grupo): faturamento e impostos mês a mês, trimestre e ano; a carga do grupo é o total de impostos ÷ o total faturado.
// Cada empresa já entra com os seus valores informados à mão e a sua opção do contábil aplicados.
export function somarCargas(lista) {
  const validas = (lista || []).filter(Boolean);
  if (!validas.length) return null;
  const base = validas[0];
  const uniaoPorId = (campo) => {
    const mapa = new Map();
    validas.forEach((d) => (d[campo] || []).forEach((g) => { if (!mapa.has(g.id)) mapa.set(g.id, g); }));
    return [...mapa.values()];
  };
  const somarPosicao = (campo, i) => fecharPeriodo(validas.reduce((acc, d) => somarObj(acc, d[campo]?.[i]), {}));
  return {
    grupos: uniaoPorId("grupos"),
    gruposRet: uniaoPorId("gruposRet"),
    gruposFolha: uniaoPorId("gruposFolha"),
    meses: base.meses.map((_, i) => somarPosicao("meses", i)),
    trimestres: base.trimestres.map((_, i) => somarPosicao("trimestres", i)),
    ano_total: fecharPeriodo(validas.reduce((acc, d) => somarObj(acc, d.ano_total), {})),
  };
}
