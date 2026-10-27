// Cópia local (IndexedDB do navegador) das partes do razão já baixadas.
//
// As partes de um razão grande são endereçadas pelo CONTEÚDO: a chave é
// `${baseKey}.c<sha1 do trecho>` (ou .h, no formato antigo — ver writeCompanyJournalNow em
// persistence.js). Uma parte gravada nunca muda — conteúdo novo vira chave
// nova — então a cópia local nunca fica desatualizada: quem diz quais partes
// valem é o manifesto, que continua vindo SEMPRE do banco. Abrir de novo a
// mesma empresa/grupo baixa só o manifesto e as partes que mudaram, em vez
// do razão inteiro (o grupo CUFF eram ~126MB a cada abertura).
//
// É só um atalho: qualquer falha aqui (navegador sem IndexedDB, aba
// anônima, cota cheia) vira "não tem cópia" e o razão vem do banco como
// sempre. Sai do navegador no logout (ver App.jsx).

const DB_NAME = "athosbi-razao";
const STORE = "partes";
const VERSION = 1;

// Só parte endereçada por conteúdo — as do formato antigo (.partN, .a.partN)
// são regravadas no mesmo lugar e não podem ser guardadas.
const CHAVE_IMUTAVEL = /\.[hc][0-9a-f]{40}$/;
export const parteGuardavel = (chave) => CHAVE_IMUTAVEL.test(String(chave || ""));

let dbPromise = null;
// O banco já aberto — guardarParte grava na hora com ele (ver lá).
let dbAberto = null;

function abrir() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, VERSION);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "chave" });
        store.createIndex("empresa", "empresa");
      };
      request.onsuccess = () => {
        dbAberto = request.result;
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

function terminar(transaction) {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
}

// Map chave → parte como veio do banco (array de lançamentos ou o formato
// compacto — quem lê decodifica), só das que existem na cópia local.
export async function lerPartes(chaves) {
  const encontradas = new Map();
  const guardaveis = (chaves || []).filter(parteGuardavel);
  try {
    const db = await abrir();
    if (!guardaveis.length) return encontradas;
    if (!db) return encontradas;
    const transaction = db.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    guardaveis.forEach((chave) => {
      const request = store.get(chave);
      request.onsuccess = () => {
        if (request.result?.valor !== undefined) encontradas.set(chave, request.result.valor);
      };
    });
    if (!(await terminar(transaction))) return new Map();
  } catch {
    return new Map();
  }
  return encontradas;
}

// Síncrono de propósito: o put copia a parte NA HORA, exatamente como veio
// do banco, antes de qualquer outra parte do app mexer nela. Só grava com o
// banco local já aberto (lerPartes abre antes dos downloads).
export function guardarParte(empresa, chave, valor) {
  if (!dbAberto || !parteGuardavel(chave) || valor === undefined || valor === null) return;
  try {
    const transaction = dbAberto.transaction(STORE, "readwrite");
    transaction.onerror = () => {};
    transaction.objectStore(STORE).put({ chave, empresa, valor });
  } catch {
    /* cota cheia ou navegador sem IndexedDB — fica sem cópia */
  }
}

// Apaga as partes guardadas da empresa que o manifesto atual não usa mais.
export async function podarEmpresa(empresa, chavesEmUso) {
  try {
    const db = await abrir();
    if (!db) return;
    const usadas = new Set(chavesEmUso || []);
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.index("empresa").getAllKeys(empresa);
    request.onsuccess = () => {
      (request.result || []).filter((chave) => !usadas.has(chave)).forEach((chave) => store.delete(chave));
    };
    await terminar(transaction);
  } catch {
    /* só limpeza */
  }
}

// Logout: nada do razão fica no navegador.
export async function limparCopiaLocal() {
  try {
    const db = await abrir();
    if (!db) return;
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    await terminar(transaction);
  } catch {
    /* sem IndexedDB, nada guardado */
  }
}
