import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Building2, Network, Repeat, Users, SlidersHorizontal, ChevronLeft, BarChart3, LogOut, ShieldCheck, Layers, UserCog } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAppState } from "../data/useStore.js";
import ThemeToggle from "./ThemeToggle.jsx";

const ITEMS = [
  { to: "/parametros/empresas", label: "Empresas", icon: Building2 },
  { to: "/parametros/grupo", label: "Grupo", icon: Network },
  { to: "/parametros/de-para", label: "De/Para", icon: Repeat },
  { to: "/parametros/planos-padrao", label: "Planos padrão", icon: Layers },
  { to: "/parametros/representantes", label: "Representantes", icon: Users },
  { to: "/parametros/acessos", label: "Acessos", icon: ShieldCheck },
];

// Só Total (admin) enxerga essas 3 — Restrito nunca, mesmo entrando no
// resto de Parâmetros (ver ParametrosLayout.jsx).
const ADMIN_ONLY_ITEMS = [
  { to: "/parametros/bi", label: "B.I.", icon: BarChart3 },
  { to: "/parametros/colaborar", label: "Colaborar", icon: UserCog },
  { to: "/parametros/sistema", label: "Sistema", icon: SlidersHorizontal },
];

// Telas como Planos padrão e De/Para guardam "estou vendo o quê" (qual
// plano aberto, qual empresa escolhida) num useState local, não na URL —
// clicar de novo no mesmo item da barra lateral não muda de rota, então o
// React Router nem re-renderiza a página. Pra voltar pra lista sem precisar
// do botão "< Voltar" de dentro da tela, a barra dispara este evento global
// quando o clique é no item já ativo; cada página que tem essa navegação
// interna escuta e zera o próprio estado (ver PlanoPadraoAdmin.jsx e
// DeParaAdmin.jsx).
export const RESET_SECTION_EVENT = "parametros:reset-secao";

export default function ParametrosSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useAppState();
  const items = state.isAdmin ? [...ITEMS, ...ADMIN_ONLY_ITEMS] : ITEMS;

  function handleNavClick(to) {
    if (location.pathname === to) {
      window.dispatchEvent(new CustomEvent(RESET_SECTION_EVENT, { detail: { path: to } }));
    }
  }

  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col bg-navy-950 text-white">
      <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5 px-5 py-5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-sm font-medium">
          A
        </span>
        <span className="text-[15px] font-medium leading-tight">AthosBI</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft size={14} />
        Início
      </button>

      <nav className="mt-1 flex flex-1 flex-col gap-0.5 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => handleNavClick(to)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                isActive ? "bg-accent-500 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={15} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}
