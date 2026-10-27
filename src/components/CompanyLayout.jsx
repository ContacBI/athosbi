import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Smartphone } from "lucide-react";
import CompanyTopBar from "./CompanyTopBar.jsx";
import ModulesSidebar from "./ModulesSidebar.jsx";
import WorkspaceLoading from "./WorkspaceLoading.jsx";
import { useAppState, setData } from "../data/useStore.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { moduloDaRota, modulosLiberados } from "../lib/modulos.js";
import { limiteDoCliente, limitarPeriodo } from "../lib/fechamento.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";
import { densityColumnGap } from "../lib/density.js";
import { useIsMobile } from "../lib/useIsMobile.js";
import { setPrefersFullPanel } from "../lib/installApp.js";

// Rotas de gestão/edição dentro do workspace da empresa — quem só tem
// acesso de leitura nunca deveria nem abrir essas telas: o banco já recusa
// qualquer escrita vinda daqui (RLS em app_storage), mas sem essa trava a
// pessoa veria um erro cru do Supabase em vez de simplesmente não ter o
// caminho pra chegar lá. Admin (Total) sempre passa; um colaborador
// Restrito só passa se estiver em company.responsaveis DESTA empresa (ou,
// em modo grupo, responsável por ALGUMA empresa-membro — ver
// isResponsavelForGroup).
//
// "/empresa/personalizar" NÃO está aqui — pedido explícito: qualquer
// colaborador pode ENTRAR pra ver o workspace de qualquer empresa/grupo
// (útil pra usar como modelo em "Replicar relatórios"), só não edita nada
// se não for responsável. A trava de edição de verdade fica dentro da
// própria tela (PersonalizarHub.jsx recalcula o mesmo canEdit e esconde
// os controles de edição quando falso).
const EDIT_ONLY_PREFIXES = ["/empresa/relatorios", "/empresa/de-para", "/empresa/vinculo-dfc", "/empresa/conferencia"];

export default function CompanyLayout() {
  const state = useAppState();
  // Menu lateral de módulos (B.I Contábil, Orçamento, Carga tributária): sempre começa fechado; a pessoa abre pelo botão do topo se precisar.
  const [modulosAberto, setModulosAberto] = useState(false);
  const alternarModulos = () => setModulosAberto((atual) => !atual);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;

  // Cliente nunca fica num período depois do mês fechado (ver
  // lib/fechamento.js) — nem o que veio salvo da empresa, nem o de um
  // atalho: o fim volta pro último dia do mês fechado.
  const limite = limiteDoCliente(state);
  useEffect(() => {
    if (!limite) return;
    const cortado = limitarPeriodo({ start: state.periodStart, end: state.periodEnd }, limite);
    if (cortado.start !== state.periodStart || cortado.end !== state.periodEnd) setData({ periodStart: cortado.start, periodEnd: cortado.end });
  }, [limite, state.periodStart, state.periodEnd]);

  if (!company && !state.activeGroupId) {
    return <Navigate to="/empresas" replace />;
  }

  // Razão ainda chegando (F5 dentro de uma empresa/grupo, ou troca pelo
  // seletor do topo): tela de carregamento no lugar do painel, em vez de
  // relatórios zerados seguidos de uma tela em branco enquanto calcula.
  // Vindo da tela de escolher empresa isso nem aparece — ela já espera o
  // carregamento antes de navegar (ver Empresas.jsx).
  if (state.journalLoading && !state.journalLoadFailed) {
    const group = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
    return <WorkspaceLoading name={group?.name || company?.name || ""} isGroup={Boolean(group)} progress={state.journalLoadProgress} />;
  }

  const canEditHere =
    state.isAdmin ||
    (company && (company.responsaveis || []).includes(state.userEmail)) ||
    (state.activeGroupId && isResponsavelForGroup(state, state.activeGroupId));
  if (!canEditHere && EDIT_ONLY_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
    return <Navigate to="/empresa" replace />;
  }

  // Módulos complementares (Orçamento, Carga tributária, Análise de
  // desempenho): o cliente só vê os liberados na ficha dele em Parâmetros ›
  // Acessos. Sem nenhum, o menu lateral nem aparece e o link direto volta
  // pro B.I. Enquanto a ficha ainda não chegou (null), não expulsa ninguém.
  const liberados = modulosLiberados(state);
  const moduloAqui = moduloDaRota(location.pathname);
  const fichaPendente = !state.isAdmin && !state.isColaborador && state.modulosCliente === null;
  if (moduloAqui && !fichaPendente && !liberados.includes(moduloAqui)) {
    return <Navigate to="/empresa" replace />;
  }
  const temMenu = liberados.length > 0;

  // Resumo no celular: tela própria, sem a barra do topo nem margens.
  if (location.pathname === "/empresa/celular") {
    return (
      <PageActionsProvider>
        <Outlet />
      </PageActionsProvider>
    );
  }

  return (
    <PageActionsProvider>
      <div className="min-h-screen bg-surface-page">
        <CompanyTopBar company={company} modulesOpen={modulosAberto && temMenu} onToggleModules={temMenu ? alternarModulos : undefined} />
        {isMobile && (
          <button
            type="button"
            onClick={() => {
              setPrefersFullPanel(false);
              navigate("/empresa/celular");
            }}
            className="celular-atalho flex w-full items-center justify-center gap-2 bg-accent-50 px-4 py-2 text-[13px] font-medium text-accent-700"
          >
            <Smartphone size={15} /> Ver o resumo para celular
          </button>
        )}
        {/* --col-gap cascata pra qualquer grid de demonstrativo (DRE/BP/DFC)
            que use gap-x-[var(--col-gap,...)] — distância entre as colunas
            de mês, ajustável em ReportSettingsMenu (ver lib/density.js). */}
        <div className="flex">
          {modulosAberto && temMenu && (
            <ModulesSidebar
              overlay={isMobile}
              liberados={liberados}
              isGroup={Boolean(state.activeGroupId)}
              hasData={state.accounts.length > 0 || state.journal.length > 0}
              onClose={alternarModulos}
            />
          )}
          <main className="min-w-0 flex-1 px-6 py-5" style={{ "--col-gap": densityColumnGap(state.reportDensity) }}>
            <Outlet />
          </main>
        </div>
      </div>
    </PageActionsProvider>
  );
}
