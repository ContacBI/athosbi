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
