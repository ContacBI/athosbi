import { Navigate, Outlet } from "react-router-dom";
import ParametrosSidebar from "./ParametrosSidebar.jsx";
import { useAppState } from "../data/useStore.js";

export default function ParametrosLayout() {
  const state = useAppState();
  // Admin (Total) entra em tudo; colaborador Restrito também entra aqui —
  // enxerga a carteira inteira e a maioria das telas de Parâmetros, só que
  // sem poder editar fora das empresas onde é responsável (RLS decide isso
  // na escrita; cada tela some os botões que ele não teria como usar). As
  // 3 telas admin-only (Sistema, Colaborar, B.I.) se travam sozinhas — ver
  // o mesmo `if (!state.isAdmin)` no topo delas.
  if (!state.isAdmin && !state.isColaborador) return <Navigate to="/empresas" replace />;
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
