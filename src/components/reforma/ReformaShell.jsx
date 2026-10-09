import { useNavigate } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import ThemeToggle from "../ThemeToggle.jsx";

// Moldura das telas da Reforma Tributária: faixa azul de identidade (igual
// à da carteira em Empresas.jsx), voltar, título e ações à direita.
export default function ReformaShell({ titulo, subtitulo, voltarPara = "/", voltarRotulo = "Início", acoes, extra, children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className="relative overflow-hidden bg-navy-950 px-6 pb-5 pt-5 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(560px circle at 12% 0%, rgba(232,105,31,0.22), transparent 62%)" }} />
        <div className="relative mx-auto flex max-w-[1200px] flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => navigate(voltarPara)} className="flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white">
              <ArrowLeft size={15} />
              {voltarRotulo}
            </button>
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-accent-400">
                <Scale size={13} />
                Reforma Tributária
              </span>
              <h1 className="mt-1 truncate text-[24px] font-medium leading-tight">{titulo}</h1>
              {subtitulo && <p className="mt-1 text-[13px] text-white/60">{subtitulo}</p>}
            </div>
            {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
          </div>
          {extra}
        </div>
      </div>
      <main className="mx-auto mt-5 flex max-w-[1200px] flex-col gap-4 px-4 sm:px-6">{children}</main>
    </div>
  );
}
