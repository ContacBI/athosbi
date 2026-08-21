// Espaçamento HORIZONTAL entre colunas dos demonstrativos (DRE/Balanço/DFC)
// — a distância entre a coluna de um mês e a do mês seguinte. Ajuste
// PESSOAL deste computador/navegador, não da empresa: o problema que
// motivou isso foi a mesma tela abrindo com colunas confortáveis numa
// máquina e quase grudadas/invadindo uma a outra em outra (fonte, DPI e
// zoom do sistema variam de computador pra computador). Por isso fica só
// no localStorage deste navegador, nunca sincronizado via Supabase — cada
// pessoa ajusta a própria tela, sem afetar quem mais usa a mesma empresa.
const STORAGE_KEY = "portalGerencial.reportDensity";

export const DENSITY_OPTIONS = [
  { id: "compact", label: "Compacta", columnGap: "0.5rem" },
  { id: "normal", label: "Normal", columnGap: "1rem" },
  { id: "comfortable", label: "Confortável", columnGap: "1.75rem" },
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

export function densityColumnGap(id) {
  return DENSITY_OPTIONS.find((option) => option.id === id)?.columnGap || DENSITY_OPTIONS[1].columnGap;
}
