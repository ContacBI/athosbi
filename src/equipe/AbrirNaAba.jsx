import { useEffect, useMemo, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAppState } from "../data/useStore.js";
import { lerAbertura } from "../lib/abrirEmOutraAba.js";
import { hubLigado, preferirPortalAtual } from "../lib/hub.js";
import { entrarNoModo, realStaff } from "../lib/modoEquipe.js";
import { lembrarGrupoContexto } from "../lib/unidades.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import WorkspaceLoading from "../components/WorkspaceLoading.jsx";

// /abrir — a aba nova que o console abre (lib/abrirEmOutraAba.js): carrega o
// grupo/empresa com a tela de "Abrindo…" e entra no B.I. no modo pedido. Como
// no console, carrega editando e só troca pra "ver como o cliente" na hora
// de entrar.
export default function AbrirNaAba() {
  const state = useAppState();
  const { pending, abrirEmpresa, abrirGrupo } = useAbrirWorkspace();
  const pedido = useMemo(() => lerAbertura(window.location.search), []);
  const pode = hubLigado(state) && realStaff(state);
  const registro = pedido ? (pedido.tipo === "grupo" ? state.groups : state.companies).find((item) => item.id === pedido.id) : null;
  const comecou = useRef(false);

  useEffect(() => {
    if (!pode || !registro || comecou.current) return;
    comecou.current = true;
    preferirPortalAtual(false);
    entrarNoModo("console");
    const opcoes = { substituir: true, antesDeNavegar: pedido.modo === "portal" ? () => entrarNoModo("portal", { pessoa: pedido.pessoa }) : undefined };
    if (pedido.tipo === "grupo") {
      lembrarGrupoContexto(pedido.id);
      abrirGrupo(pedido.id, pedido.destino, opcoes);
    } else abrirEmpresa(pedido.id, pedido.destino, opcoes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pode, registro]);

  if (!pode) return <Navigate to="/" replace />;
  if (!registro) return <Navigate to="/equipe" replace />;

  // A aba foi aberta pelo console: "fechar" volta pra ele. Se o navegador não
  // deixar fechar, vai pro console aqui mesmo.
  const fechar = () => {
    window.close();
    setTimeout(() => window.location.assign("/equipe"), 150);
  };

  return <WorkspaceLoading name={registro.name} isGroup={pedido.tipo === "grupo"} phase={pending?.phase || "loading"} progress={state.journalLoadProgress} onCancel={fechar} cancelLabel="Fechar esta aba" />;
}
