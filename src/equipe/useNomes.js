import { useEffect, useState } from "react";
import { listAdmins, listColaboradores } from "../lib/colaboradores.js";

// E-mail → nome de quem é da equipe (Parâmetros › Colaborar), pra mostrar
// os responsáveis pelo nome. Busca uma vez por sessão.
let nomes = null;

export function useNomesDaEquipe() {
  const [mapa, setMapa] = useState(nomes || {});
  useEffect(() => {
    if (nomes) return undefined;
    let vivo = true;
    Promise.all([listAdmins().catch(() => []), listColaboradores().catch(() => [])]).then(([admins, colaboradores]) => {
      nomes = Object.fromEntries([...admins, ...colaboradores].filter((pessoa) => pessoa.email).map((pessoa) => [pessoa.email, pessoa.nome || ""]));
      if (vivo) setMapa(nomes);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return mapa;
}

export function nomeDaPessoa(email, mapa) {
  return mapa[email] || String(email || "").split("@")[0];
}
