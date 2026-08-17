import { Navigate, useNavigate } from "react-router-dom";
import { LayoutGrid, Sparkles } from "lucide-react";
import { useAppState } from "../data/useStore.js";

// The company's front door. Nothing is pre-built: if the user already has a
// tab, jump straight to the first one. Otherwise show a blank slate — the
// "Personalizar" button (always in the top bar) is the only way in, and
// from there the user decides everything, including whether Demonstrativos
// completo shows up anywhere at all.
export default function CompanyHome() {
  const state = useAppState();
  const navigate = useNavigate();
  const tabs = state.dashboardTabs || [];
  const isGroup = Boolean(state.activeGroupId);

  if (tabs.length > 0) return <Navigate to={`/empresa/painel/${tabs[0].id}`} replace />;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
        <Sparkles size={26} strokeWidth={1.6} />
      </span>
      <p className="text-[15px] font-medium text-ink-900">
        {isGroup ? "Esse grupo ainda está em branco" : "Essa empresa ainda está em branco"}
      </p>
      <p className="text-[13px] text-ink-400">
        {isGroup
          ? "Nada vem pronto. Use o \"Personalizar\" no topo pra montar o consolidado, somando os dados das empresas do grupo."
          : "Nada vem pronto. Use o \"Personalizar\" no topo pra criar as abas que fizerem sentido pra ela."}
      </p>
      <button
        type="button"
        onClick={() => navigate("/empresa/personalizar")}
        className="mt-1 flex items-center gap-1.5 rounded-full bg-accent-500 px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
      >
        <LayoutGrid size={14} strokeWidth={1.8} />
        Personalizar
      </button>
    </div>
  );
}
