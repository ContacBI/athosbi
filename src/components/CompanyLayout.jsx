import { Navigate, Outlet } from "react-router-dom";
import CompanyTopBar from "./CompanyTopBar.jsx";
import { useAppState } from "../data/useStore.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";
import { densityRowPadding } from "../lib/density.js";

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
        {/* --row-py cascata pra qualquer linha de demonstrativo (DRE/BP/DFC)
            que use py-[var(--row-py,...)] — ajustável em ReportSettingsMenu,
            ver lib/density.js. */}
        <main className="w-full px-6 py-5" style={{ "--row-py": densityRowPadding(state.reportDensity) }}>
          <Outlet />
        </main>
      </div>
    </PageActionsProvider>
  );
}
