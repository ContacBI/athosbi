import { setData, state } from "../data/useStore.js";
import { ASSISTANT_FAVORITES_KEY, SLIDE_LIBRARY_KEY, readStoredArray, writePersistent } from "./persistence.js";
import { cloneSlide, newId } from "./presentations.js";

// Biblioteca do escritório: pedidos do assistente salvos como modelo
// ("reunião mensal dos sócios") e slides prontos pra reaproveitar. Ficam
// fora do registro das empresas — o mesmo pedido gera a apresentação de
// qualquer cliente. Cada gravação relê a lista antes (outra pessoa pode ter
// salvo algo nesse meio tempo) e só então acrescenta/tira o item.

let loading = null;

export function loadOfficeLibrary({ force = false } = {}) {
  if (loading && !force) return loading;
  loading = Promise.all([readStoredArray(ASSISTANT_FAVORITES_KEY), readStoredArray(SLIDE_LIBRARY_KEY)])
    .then(([assistantFavorites, slideLibrary]) => {
      setData({ assistantFavorites, slideLibrary });
      return { assistantFavorites, slideLibrary };
    })
    .catch((error) => {
      console.error("Não consegui ler a biblioteca do escritório:", error);
      loading = null;
      return { assistantFavorites: state.assistantFavorites || [], slideLibrary: state.slideLibrary || [] };
    });
  return loading;
}

async function mutate(key, stateKey, fn) {
  const latest = await readStoredArray(key);
  const next = fn(latest);
  setData({ [stateKey]: next });
  await writePersistent(key, next);
  return next;
}

// O período não entra no pedido salvo: "reunião mensal" de outro cliente
// é o último mês DELE. O resto do que a pessoa ajustou (público, jeito,
// assuntos, destaques, tamanho, comparação) vai junto.
export function favoriteOverrides(overrides = {}) {
  const { period: _period, ...rest } = overrides || {};
  return JSON.parse(JSON.stringify(rest));
}

export function saveFavorite({ name, text, overrides, brand, themeId }) {
  const favorite = {
    id: newId("fav"),
    name: String(name || "").trim() || "Pedido salvo",
    text: String(text || "").trim(),
    overrides: favoriteOverrides(overrides),
    brand: brand || "athos",
    themeId: themeId || "",
    createdBy: state.userEmail || "",
    createdAt: new Date().toISOString(),
  };
  return mutate(ASSISTANT_FAVORITES_KEY, "assistantFavorites", (list) => [...list.filter((item) => item.id !== favorite.id), favorite]).then(() => favorite);
}

export function deleteFavorite(id) {
  return mutate(ASSISTANT_FAVORITES_KEY, "assistantFavorites", (list) => list.filter((item) => item.id !== id));
}

export function renameFavorite(id, name) {
  const clean = String(name || "").trim();
  if (!clean) return Promise.resolve(state.assistantFavorites || []);
  return mutate(ASSISTANT_FAVORITES_KEY, "assistantFavorites", (list) => list.map((item) => (item.id === id ? { ...item, name: clean } : item)));
}

// Nome sugerido pra um slide: o primeiro texto dele (o título, quase
// sempre), sem as quebras de linha.
export function suggestSlideName(slide) {
  const text = (slide?.blocks || []).filter((block) => block.kind === "text" && String(block.text || "").trim()).sort((a, b) => (Number(b.size || b.fontSize || 0) - Number(a.size || a.fontSize || 0)))[0]?.text;
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 60) : "Slide";
}

export function saveSlideToLibrary({ name, brand, slide, theme }) {
  const entry = {
    id: newId("lib"),
    name: String(name || "").trim() || suggestSlideName(slide),
    brand: brand || "todas",
    slide: cloneSlide({ ...slide, hidden: false }),
    theme: theme ? JSON.parse(JSON.stringify(theme)) : null,
    createdBy: state.userEmail || "",
    createdAt: new Date().toISOString(),
  };
  return mutate(SLIDE_LIBRARY_KEY, "slideLibrary", (list) => [...list, entry]).then(() => entry);
}

export function deleteLibrarySlide(id) {
  return mutate(SLIDE_LIBRARY_KEY, "slideLibrary", (list) => list.filter((item) => item.id !== id));
}

// Slides da biblioteca que servem pra uma marca: os dela e os "de todas".
export function librarySlidesFor(brand, list = state.slideLibrary || []) {
  return list.filter((item) => !brand || item.brand === "todas" || item.brand === brand);
}
