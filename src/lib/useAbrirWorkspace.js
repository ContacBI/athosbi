import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { state } from "../data/useStore.js";
import { selectCompany } from "./companies.js";
import { selectGroup } from "./groups.js";
import { prewarmDashboardContext } from "./dashboardData.js";

// Abrir uma empresa/grupo esperando o razão chegar ANTES de entrar no painel
// (Empresas.jsx e o Início, Landing.jsx). A espera acontece aqui: uma tela de
// carregamento (WorkspaceLoading, renderizada por quem chama com `pending`)
// mostra "Carregando os lançamentos — X%" enquanto baixa e "Calculando os
// relatórios…" enquanto o painel é montado (prewarmDashboardContext — num
// grupo grande são alguns segundos de navegador ocupado, que dentro do
// painel apareciam como tela em branco). Só navega com tudo pronto.
// selectCompany/selectGroup já marcam o ativo de forma síncrona, então a
// checagem do id ativo garante que nunca abre a empresa/grupo ANTERIOR; e
// clicar em outro card no meio do caminho troca o alvo (o anterior desiste
// de navegar ao terminar).
export function useAbrirWorkspace() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null); // { id, name, isGroup, phase: "loading" | "calculating" }
  const pendingRef = useRef(null);

  async function handleOpen(id, select, isActive, label, destino = "/empresa", antesDeNavegar) {
    if (pendingRef.current === id) return;
    pendingRef.current = id;
    setPending({ id, ...label, phase: "loading" });
    const stillWanted = () => pendingRef.current === id && isActive();
    const ir = () => {
      antesDeNavegar?.();
      navigate(destino);
    };
    try {
      await select(id);
      if (!stillWanted()) return;
      if (!state.journalLoadFailed && (state.dashboardTabs || []).length > 0) {
        setPending({ id, ...label, phase: "calculating" });
        // Deixa o navegador pintar o "calculando…" antes do cálculo pesado.
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (!stillWanted()) return;
        prewarmDashboardContext();
      }
      if (stillWanted()) ir();
    } catch (error) {
      console.error("Falha ao abrir:", error);
      // Mesmo com erro no pré-cálculo, abre — o painel calcula sozinho e a
      // barra do topo avisa se o razão não carregou.
      if (stillWanted()) ir();
    } finally {
      if (pendingRef.current === id) {
        pendingRef.current = null;
        setPending(null);
      }
    }
  }

  // `destino`: pra onde ir depois de carregar (padrão: o painel; o Início
  // usa pra abrir direto a última apresentação). `antesDeNavegar`: roda logo
  // antes de entrar (o console usa pra trocar pro modo "ver como cliente" só
  // na hora de sair dele — ver lib/modoEquipe.js).
  function abrirEmpresa(id, destino, { antesDeNavegar } = {}) {
    const company = state.companies.find((item) => item.id === id);
    handleOpen(id, selectCompany, () => state.activeCompanyId === id && !state.activeGroupId, { name: company?.name || "Empresa", isGroup: false }, destino, antesDeNavegar);
  }

  function abrirGrupo(id, destino, { antesDeNavegar } = {}) {
    const group = state.groups.find((item) => item.id === id);
    handleOpen(id, selectGroup, () => state.activeGroupId === id, { name: group?.name || "Grupo", isGroup: true }, destino, antesDeNavegar);
  }

  // "Voltar" no meio do carregamento: desiste de navegar quando terminar (a
  // empresa/grupo continua selecionado e carregando em segundo plano — abrir
  // de novo depois reaproveita o que já chegou).
  function cancelar() {
    pendingRef.current = null;
    setPending(null);
  }

  return { pending, abrirEmpresa, abrirGrupo, cancelar };
}
