import { state } from "../data/useStore.js";
import { aplicarContabil, aplicarManual, fetchCargaTributaria, somarCargas, somarPeriodos } from "./cargaTributaria.js";
import { groupCompanies } from "./groups.js";

// Carga tributária pros widgets do B.I. e dos slides: lê a carga (dominio_carga) da empresa aberta — ou, num grupo, de cada empresa membro, com os
// valores informados à mão e a opção do contábil de cada uma — e devolve o resumo dos meses do período do painel (ctx.months, "AAAA-MM").
// Guarda a leitura por 60 s pra vários widgets da mesma tela não lerem o banco um a um.
export const COR_IMPOSTO = {
  iss: "#2563eb", icms: "#7c3aed", ipi: "#0891b2", pis: "#16a34a", cofins: "#84cc16", csll: "#f59e0b", irpj: "#dc2626", simples: "#db2777", cpp: "#be185d", outros: "#64748b",
};

const cache = new Map();

export function carregarCargaDoEscopo() {
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = grupo ? groupCompanies(grupo) : state.companies.filter((company) => company.id === state.activeCompanyId);
  if (!membros.length) return Promise.resolve(null);
  const chave = membros.map((membro) => membro.id).join(",");
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.em < 60_000) return hit.promessa;
  const promessa = Promise.all(membros.map(async (membro) => ({ membro, linhas: await fetchCargaTributaria(membro.id) }))).then((lista) => ({ lista }));
  cache.set(chave, { em: Date.now(), promessa });
  promessa.catch(() => cache.delete(chave));
  return promessa;
}

export function cargaDoPeriodo(carregado, meses) {
  if (!carregado || !meses?.length) return null;
  const anos = [...new Set(meses.map((m) => Number(String(m).slice(0, 4))))];
  const porAno = new Map();
  for (const ano of anos) {
    const dados = somarCargas(
      carregado.lista.map(({ membro, linhas }) => {
        const linha = linhas.find((item) => item.ano === ano);
        if (!linha?.dados) return null;
        const comManual = aplicarManual(linha.dados, (membro.cargaManual || {})[String(ano)]);
        return membro.cargaContabil ? aplicarContabil(comManual) : comManual;
      })
    );
    if (dados) porAno.set(ano, dados);
  }
  const porMes = meses
    .map((m) => {
      const dados = porAno.get(Number(String(m).slice(0, 4)));
      const periodo = dados?.meses?.[Number(String(m).slice(5, 7)) - 1];
      return periodo ? { ...periodo, rotulo: m } : null;
    })
    .filter(Boolean);
  const comMovimento = porMes.filter((p) => p.fat?.total || p.impTotal);
  if (!comMovimento.length) return null;
  const grupos = [];
  const vistos = new Set();
  porAno.forEach((dados) => (dados.grupos || []).forEach((g) => { if (!vistos.has(g.id)) { vistos.add(g.id); grupos.push(g); } }));
  return { periodo: somarPeriodos(comMovimento), meses: porMes, grupos };
}
