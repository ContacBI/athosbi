import { Navigate, Outlet, useLocation } from "react-router-dom";
import CompanyTopBar from "./CompanyTopBar.jsx";
import { useAppState } from "../data/useStore.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";
import { densityColumnGap } from "../lib/density.js";

// Rotas de gestão/edição dentro do workspace da empresa — quem só tem
// acesso de leitura (não-admin, ver lib/access.js) nunca deveria nem abrir
// essas telas: o banco já recusa qualquer escrita vinda daqui (RLS em
// app_storage), mas sem essa trava a pessoa veria um erro cru do Supabase
// em vez de simplesmente não ter o caminho pra chegar lá.
const ADMIN_ONLY_PREFIXES = ["/empresa/relatorios", "/empresa/de-para", "/empresa/vinculo-dfc", "/empresa/personalizar"];

export default function CompanyLayout() {
  const state = useAppState();
  const location = useLocation();
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;

  if (!company && !state.activeGroupId) {
    return <Navigate to="/empresas" replace />;
  }

  if (!state.isAdmin && ADMIN_ONLY_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
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
