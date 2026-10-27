import { useEffect, useMemo, useRef, useState } from "react";
import { setData, useAppState } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";
import { configResumo, paraGravar } from "./resumoCelular.js";

// Lê e grava a configuração da empresa/grupo ativo. Cada mudança aparece na
// hora; a gravação espera a pessoa parar de mexer (o recado é digitado
// letra a letra).
export function useGravarResumo() {
  const appState = useAppState();
  const config = useMemo(() => configResumo(appState.resumoCelular), [appState.resumoCelular]);
  const [salvo, setSalvo] = useState("ok");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function mudar(next) {
    setData({ resumoCelular: paraGravar(next) });
    setSalvo("salvando");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persistActiveCompany().then(
        () => setSalvo("ok"),
        () => setSalvo("erro")
      );
    }, 700);
  }
  return { config, mudar, salvo };
}
