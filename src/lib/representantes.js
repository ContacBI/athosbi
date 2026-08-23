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

// `tipo` distingue sócio de contador — são papéis diferentes (um contador
// não é necessariamente sócio, e vice-versa), mas continuam num cadastro
// só porque a mecânica de "vincular gente a uma empresa" é idêntica pros
// dois. Registro sem `tipo` (todo cadastro anterior a essa distinção) é
// tratado como "socio" — não muda nada pra quem já usava a tela.
export function createRepresentante({ nome, email = "", cpf = "", tipo = "socio" }) {
  const name = String(nome || "").trim();
  if (!name) return null;
  const representante = {
    id: `rep_${Date.now()}`,
    nome: name,
    email,
    cpf,
    tipo,
    createdAt: new Date().toISOString(),
  };
  const representantes = state.representantes.concat(representante);
  persist(representantes);
  setData({ representantes });
  return representante;
}

export function updateRepresentante(id, { nome, email = "", cpf = "", tipo = "socio" }) {
  const name = String(nome || "").trim();
  if (!name) return null;
  const representantes = state.representantes.map((item) =>
    item.id === id ? { ...item, nome: name, email, cpf, tipo } : item
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

// Wholesale replace — used only by the full-backup restore (lib/fullBackup.js).
export function restoreRepresentantes(representantes) {
  const next = Array.isArray(representantes) ? representantes : [];
  persist(next);
  setData({ representantes: next });
}
