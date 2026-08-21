import { Navigate, Outlet } from "react-router-dom";
import CompanyTopBar from "./CompanyTopBar.jsx";
import { useAppState } from "../data/useStore.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";
import { densityColumnGap } from "../lib/density.js";

export default function CompanyLayout() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;

  if (!company && !state.activeGroupId) {
    return <Navigate to="/empresas" replace />;
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
