// Empresas/grupos abertos por último NESTE navegador (do mais recente) —
// a lista "Abertas por último" do Início (Landing.jsx). Sem dependências de
// propósito: selectCompany/selectGroup chamam isto.

const RECENTES_KEY = "athosbi.recentes.v1";
const MAX_RECENTES = 8;

export function lembrarRecente({ tipo, id }) {
  if (!id) return;
  try {
    const lista = recentes().filter((item) => !(item.tipo === tipo && item.id === id));
    lista.unshift({ tipo, id, at: new Date().toISOString() });
    localStorage.setItem(RECENTES_KEY, JSON.stringify(lista.slice(0, MAX_RECENTES)));
  } catch {
    // localStorage cheio/bloqueado: só não lembra.
  }
}

export function recentes() {
  try {
    const lista = JSON.parse(localStorage.getItem(RECENTES_KEY) || "[]");
    return Array.isArray(lista) ? lista.filter((item) => item && item.id && (item.tipo === "empresa" || item.tipo === "grupo")) : [];
  } catch {
    return [];
  }
}
