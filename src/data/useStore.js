import { useSyncExternalStore } from "react";
import { state as legacyState, setData as rawSetData } from "./store.js";

let version = 0;
const listeners = new Set();

export const state = legacyState;

export function setData(partial) {
  rawSetData(partial);
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return version;
}

// Components call useAppState() to both subscribe to any setData() call
// anywhere in the app and get the live (mutable) state object back.
// Read state.whatever directly in the render body — it is always current.
export function useAppState() {
  useSyncExternalStore(subscribe, getSnapshot);
  return legacyState;
}
