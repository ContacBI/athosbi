import { state, setData } from "../data/useStore.js";
import { REPRESENTANTES_KEY, readStoredArray, writePersistent } from "./persistence.js";
import { unlinkRepresentanteFromCompanies } from "./companies.js";

function persist(representantes) {
  return writePersistent(REPRESENTANTES_KEY, representantes);
}

export async function loadRepresentantes() {
  const representantes = await readStoredArray(REPRESENTANTES_KEY);
  setData({ representantes });
}

export function createRepresentante({ nome, email = "", cpf = "" }) {
  const name = String(nome || "").trim();
  if (!name) return null;
  const representante = {
    id: `rep_${Date.now()}`,
    nome: name,
    email,
    cpf,
    createdAt: new Date().toISOString(),
  };
  const representantes = state.representantes.concat(representante);
  persist(representantes);
  setData({ representantes });
  return representante;
}

export function updateRepresentante(id, { nome, email = "", cpf = "" }) {
  const name = String(nome || "").trim();
  if (!name) return null;
  const representantes = state.representantes.map((item) =>
    item.id === id ? { ...item, nome: name, email, cpf } : item
  );
  persist(representantes);
  setData({ representantes });
  return representantes.find((item) => item.id === id) || null;
}

export function deleteRepresentante(id) {
  const representantes = state.representantes.filter((item) => item.id !== id);
  persist(representantes);
  setData({ representantes });
  unlinkRepresentanteFromCompanies(id);
}

export function companiesForRepresentante(id) {
  return state.companies.filter((company) => (company.representanteIds || []).includes(id));
}
