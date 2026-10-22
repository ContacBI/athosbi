import { register } from "node:module";

register("./node-hooks.mjs", import.meta.url);

// O app guarda preferências no localStorage do navegador; no Node, um de mentira.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

// Nenhum teste fala com o banco de verdade: chamadas ao Supabase de
// mentira (http://supabase.test) respondem vazio/OK na hora.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (url.includes("supabase.test")) {
    const method = (init.method || "GET").toUpperCase();
    return new Response(method === "GET" ? "[]" : "", { status: method === "GET" ? 200 : 201, headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
};
