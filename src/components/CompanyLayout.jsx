import { Navigate, Outlet } from "react-router-dom";
import CompanyTopBar from "./CompanyTopBar.jsx";
import { useAppState } from "../data/useStore.js";
import { PageActionsProvider } from "../lib/pageActions.jsx";

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
        <main className="w-full px-6 py-5">
          <Outlet />
        </main>
      </div>
    </PageActionsProvider>
  );
}
