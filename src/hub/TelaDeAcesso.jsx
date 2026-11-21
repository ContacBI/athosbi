import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./hub.css";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme.js";
import AthosMark from "../components/AthosMark.jsx";
import Mosaico from "./Mosaico.jsx";

// O molde das telas de acesso do hub (login, nova senha): a marca à
// esquerda e o cartão à direita. No celular a lateral some e a marca vai
// pro topo.

export function Campo({ icone: Icone, rotulo, children }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-semibold text-[var(--hub-texto-2)]">{rotulo}</span>
      <span className="mt-2 flex h-[52px] items-center gap-3 rounded-2xl border border-[var(--hub-borda-forte)] bg-[var(--hub-fundo)] px-4 transition-[border-color,box-shadow] focus-within:border-[var(--hub-acento)] focus-within:shadow-[0_0_0_4px_var(--hub-acento-suave)]">
        <Icone size={17} className="shrink-0 text-[var(--hub-texto-3)]" />
        {children}
      </span>
    </label>
  );
}

export const classeDoInput = "h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]";

// Lado da marca — sempre no azul-noite da Athos. Só a marca, grande e no
// centro, montando-se ao abrir (animações em hub.css: .athos-degrau,
// .login-letra, .login-fio, .login-selo).
function PainelDaMarca() {
  return (
    <aside className="relative hidden items-center justify-center overflow-hidden bg-[#081d33] px-10 text-white lg:flex">
      <div className="absolute inset-0" style={{ background: "radial-gradient(700px circle at 100% 110%, rgba(232,105,31,0.42), transparent 60%), radial-gradient(600px circle at -10% -10%, rgba(47,111,237,0.32), transparent 60%)" }} />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 75%)" }} />
      <Mosaico colunas={6} linhas={4} degraus={4} className="pointer-events-none absolute -bottom-20 right-8 w-[48%] opacity-40 [--hub-ladrilho:rgba(255,255,255,0.05)] [--hub-ladrilho-borda:rgba(255,255,255,0.07)] [--hub-ladrilho-aceso:rgba(242,138,66,0.35)]" />
      <div className="relative flex flex-col items-center text-center">
        <span className="relative flex">
          <span className="absolute inset-[-30%] rounded-full bg-[#e8691f]/25 blur-3xl" aria-hidden="true" />
          <AthosMark size={108} className="relative" animado />
        </span>
        <h1 className="hub-display mt-10 font-extrabold leading-none tracking-[-0.02em]" style={{ fontSize: "clamp(42px, 4.6vw, 72px)" }} aria-label="Athos Consultoria">
          {[..."Athos Consultoria"].map((letra, i) => (
            <span key={i} aria-hidden="true" className="login-letra" style={{ animationDelay: `${0.75 + i * 0.035}s` }}>
              {letra === " " ? " " : letra}
            </span>
          ))}
        </h1>
        <div className="mt-8 flex items-center gap-4" aria-label="Hub B.I.">
          <span className="login-fio login-fio-esquerda h-px w-14 bg-gradient-to-r from-transparent to-[#f28a42]" />
          <span className="login-selo relative overflow-hidden rounded-full bg-gradient-to-r from-[#e8691f] to-[#f28a42] px-8 py-3 text-[24px] font-extrabold uppercase leading-none tracking-[0.24em] text-white shadow-[0_18px_44px_-14px_rgba(232,105,31,0.9)]">Hub B.I.</span>
          <span className="login-fio login-fio-direita h-px w-14 bg-gradient-to-l from-transparent to-[#f28a42]" />
        </div>
      </div>
    </aside>
  );
}

export default function TelaDeAcesso({ children }) {
  const [tema, alternarTema] = useTheme();
  const escuro = tema === "dark";
  return (
    <div className="hub relative grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <PainelDaMarca />
      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="hub-fundo-decor pointer-events-none absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <span className="flex items-center gap-2.5 lg:invisible">
            <AthosMark size={28} />
            <span className="hub-display text-[17px] font-bold">Athos Consultoria</span>
            <span className="rounded-full bg-gradient-to-r from-[#e8691f] to-[#f28a42] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-white">Hub B.I.</span>
          </span>
          <button
            type="button"
            onClick={alternarTema}
            aria-label={escuro ? "Usar o tema claro" : "Usar o tema escuro"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"
          >
            {escuro ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        <div className="relative mx-auto my-auto w-full max-w-[420px] py-10">{children}</div>

        <p className="relative text-center text-[12px] text-[var(--hub-texto-3)]">© {new Date().getFullYear()} Athos Consultoria Empresarial</p>
      </main>
    </div>
  );
}
