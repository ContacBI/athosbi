import { Navigate, Outlet, useLocation } from "react-router-dom";
import CompanyTopBar from "./CompanyTopBar.jsx";
import { useAppState } from "../data/useStore.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";
import { densityColumnGap } from "../lib/density.js";

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
const EDIT_ONLY_PREFIXES = ["/empresa/relatorios", "/empresa/de-para", "/empresa/vinculo-dfc"];

export default function CompanyLayout() {
  const state = useAppState();
  const location = useLocation();
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;

  if (!company && !state.activeGroupId) {
    return <Navigate to="/empresas" replace />;
  }

  const canEditHere =
    state.isAdmin ||
    (company && (company.responsaveis || []).includes(state.userEmail)) ||
    (state.activeGroupId && isResponsavelForGroup(state, state.activeGroupId));
  if (!canEditHere && EDIT_ONLY_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
    return <Navigate to="/empresa" replace />;
  }

  return (
    <PageActionsProvider>
      <div className="min-h-screen bg-surface-page">
        <CompanyTopBar company={company} />
        {/* --col-gap cascata pra qualquer grid de demonstrativo (DRE/BP/DFC)
            que use gap-x-[var(--col-gap,...)] — distância entre as colunas
            de mês, ajustável em ReportSettingsMenu (ver lib/density.js). */}
        <main className="w-full px-6 py-5" style={{ "--col-gap": densityColumnGap(state.reportDensity) }}>
          <Outlet />
        </main>
      </div>
    </PageActionsProvider>
  );
}
