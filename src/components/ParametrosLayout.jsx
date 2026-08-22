import { Navigate, Outlet } from "react-router-dom";
import ParametrosSidebar from "./ParametrosSidebar.jsx";
import { useAppState } from "../data/useStore.js";

export default function ParametrosLayout() {
  const state = useAppState();
  // Toda a tela de Parâmetros é cadastro/edição — quem não é admin nunca
  // deveria nem tentar entrar aqui (a RLS do banco já bloquearia qualquer
  // escrita, mas é melhor nem mostrar telas que só vão dar erro). Ver
  // lib/access.js isPortalAdmin, calculado uma vez no boot em App.jsx.
  if (!state.isAdmin) return <Navigate to="/empresas" replace />;
  return (
    <div className="flex min-h-screen bg-surface-page">
      <div className="sticky top-0 h-screen shrink-0">
        <ParametrosSidebar />
      </div>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
