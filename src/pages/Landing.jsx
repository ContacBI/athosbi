import { useNavigate } from "react-router-dom";
import { ArrowRight, Settings, LayoutDashboard, FileText, BarChart3, LogOut, Scale } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAppState } from "../data/useStore.js";
import { temBi as temModuloBi, temReforma as temModuloReforma } from "../lib/modulos.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const FEATURES = [
  { icon: LayoutDashboard, label: "Dashboards por empresa" },
  { icon: FileText, label: "BP, DRE e DFC prontos" },
  { icon: BarChart3, label: "Indicadores gerenciais" },
];

export default function Landing() {
  const navigate = useNavigate();
  const state = useAppState();
  // Um botão por módulo liberado (ver lib/modulos.js) — cliente só da
  // Reforma Tributária nem vê o B.I.
  const temBi = temModuloBi(state);
  const temReforma = temModuloReforma(state);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy-950 px-6 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(560px circle at 50% 38%, rgba(47,111,237,0.28), transparent 60%), radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.25) 100%, transparent), radial-gradient(1px 1px at 80% 65%, rgba(255,255,255,.2) 100%, transparent), radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,.15) 100%, transparent)",
        }}
      />

      <div className="absolute right-6 top-6 flex items-center gap-1">
        <ThemeToggle />
        {(state.isAdmin || state.isColaborador) && (
          <button
            type="button"
            onClick={() => navigate("/parametros")}
            aria-label="Configurações"
            title="Configurações"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Settings size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          aria-label="Sair"
          title="Sair"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="relative flex flex-col items-center">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-medium shadow-lg shadow-accent-600/30">
          BI
        </span>
        <h1 className="text-5xl font-medium tracking-tight sm:text-6xl">AthosBI</h1>
        <p className="mt-3 max-w-md text-sm text-white/60">
          {temBi
            ? "Relatórios gerenciais, indicadores e demonstrações financeiras da sua carteira de empresas."
            : "Simule o impacto da Reforma Tributária na sua empresa, produto a produto."}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {temBi && (
            <button
              type="button"
              onClick={() => navigate("/empresas")}
              className="flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent-600/20 transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-xl"
            >
              Acessar empresas
              <ArrowRight size={16} />
            </button>
          )}
          {temReforma && (
            <button
              type="button"
              onClick={() => navigate("/reforma")}
              className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 ${
                temBi
                  ? "border border-white/25 text-white hover:border-white/50 hover:bg-white/10"
                  : "bg-accent-500 text-white shadow-lg shadow-accent-600/20 hover:bg-accent-600 hover:shadow-xl"
              }`}
            >
              <Scale size={16} />
              Reforma Tributária
            </button>
          )}
          {!temBi && !temReforma && <p className="text-[13px] text-white/60">Nenhum acesso liberado ainda — fale com o escritório.</p>}
        </div>

        {temBi && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-[12px] text-white/40">
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
