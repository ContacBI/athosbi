// Espaçamento das linhas dos demonstrativos (DRE/Balanço/DFC) — um ajuste
// PESSOAL deste computador/navegador, não da empresa: o problema que
// motivou isso foi a mesma conta abrindo compacta numa máquina e
// espremida/quase se sobrepondo em outra (fonte, DPI e zoom do sistema
// variam de computador pra computador). Por isso fica só no localStorage
// deste navegador, nunca sincronizado via Supabase — cada pessoa ajusta a
// própria tela, sem afetar quem mais usa a mesma empresa.
const STORAGE_KEY = "portalGerencial.reportDensity";

export const DENSITY_OPTIONS = [
  { id: "compact", label: "Compacta", rowPadding: "0.25rem" },
  { id: "normal", label: "Normal", rowPadding: "0.5rem" },
  { id: "comfortable", label: "Confortável", rowPadding: "0.9rem" },
];

const VALID_IDS = new Set(DENSITY_OPTIONS.map((option) => option.id));

export function readStoredDensity() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_IDS.has(stored) ? stored : "normal";
  } catch {
    return "normal";
  }
}

export function writeStoredDensity(id) {
  try {
    localStorage.setItem(STORAGE_KEY, VALID_IDS.has(id) ? id : "normal");
  } catch {
    // Sem localStorage disponível (modo privado etc.) — ajuste só não sobrevive a um F5.
  }
}

export function densityRowPadding(id) {
  return DENSITY_OPTIONS.find((option) => option.id === id)?.rowPadding || DENSITY_OPTIONS[1].rowPadding;
}
