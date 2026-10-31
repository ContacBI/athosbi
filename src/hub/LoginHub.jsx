import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./hub.css";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { useLogin } from "../pages/Login.jsx";
import { useTheme } from "../lib/theme.js";
import AthosMark from "../components/AthosMark.jsx";
import Mosaico from "./Mosaico.jsx";

const DESTAQUES = ["Números fechados e conferidos pelo escritório", "Carga tributária, faturamento e resultado", "Comparativos e análises para acompanhar o seu negócio"];

function Campo({ icone: Icone, rotulo, children }) {
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

export default function LoginHub() {
  const { email, setEmail, password, setPassword, error, notice, loading, handleSubmit, handleForgotPassword } = useLogin();
  const [verSenha, setVerSenha] = useState(false);
  const [tema, alternarTema] = useTheme();
  const escuro = tema === "dark";

  return (
    <div className="hub relative grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Lado da marca — sempre no azul-noite da Athos */}
      <aside className="relative hidden overflow-hidden bg-[#081d33] px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0" style={{ background: "radial-gradient(700px circle at 100% 110%, rgba(232,105,31,0.42), transparent 60%), radial-gradient(600px circle at -10% -10%, rgba(47,111,237,0.32), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 30% 30%, black, transparent 75%)" }} />
        <div className="relative flex items-center gap-2.5">
          <AthosMark size={32} />
          <span className="hub-display text-[20px] font-bold">
            Athos<span className="ml-1 align-top text-[10px] font-bold uppercase tracking-[0.2em] text-[#f4a96f]">hub</span>
          </span>
        </div>
        <div className="relative my-auto max-w-[540px] py-12">
          <h1 className="hub-display text-[54px] font-extrabold leading-[1.02]">
            Clareza para <span className="hub-italico">decidir</span>
            <span className="hub-pontuacao">.</span>
          </h1>
          <ul className="mt-9 space-y-4">
            {DESTAQUES.map((texto) => (
              <li key={texto} className="flex items-center gap-3.5 text-[16px] text-white/80">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#f28a42]" />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <Mosaico colunas={6} linhas={4} degraus={4} className="pointer-events-auto relative -mb-24 ml-auto w-[78%] opacity-90 [--hub-ladrilho:rgba(255,255,255,0.05)] [--hub-ladrilho-borda:rgba(255,255,255,0.07)] [--hub-ladrilho-aceso:rgba(242,138,66,0.35)]" />
      </aside>

      {/* Formulário */}
      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="hub-fundo-decor pointer-events-none absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <span className="flex items-center gap-2.5 lg:invisible">
            <AthosMark size={28} />
            <span className="hub-display text-[18px] font-bold">Athos</span>
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

        <div className="relative mx-auto my-auto w-full max-w-[420px] py-10">
          <p className="hub-rotulo">Acesso do cliente</p>
          <h2 className="hub-display mt-3 text-[38px] font-bold leading-tight">Bem-vindo de volta</h2>
          <p className="mt-2 text-[15px] text-[var(--hub-texto-3)]">Entre com o e-mail e a senha do seu acesso.</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <Campo icone={Mail} rotulo="E-mail">
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com.br"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]"
              />
            </Campo>
            <Campo icone={Lock} rotulo="Senha">
              <input
                type={verSenha ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]"
              />
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Esconder a senha" : "Mostrar a senha"} className="text-[var(--hub-texto-3)] hover:text-[var(--hub-texto)]">
                {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </Campo>
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} className="text-[13px] font-semibold text-[var(--hub-texto-3)] hover:text-[var(--hub-acento)]">
                Esqueci minha senha
              </button>
            </div>

            {error && <p className="rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{error}</p>}
            {notice && <p className="rounded-xl bg-[var(--hub-acento-suave)] px-4 py-3 text-[13px] font-medium text-[var(--hub-acento)]">{notice}</p>}

            <button type="submit" disabled={loading} className="hub-botao hub-botao-primario h-[54px] w-full text-[15.5px] disabled:cursor-wait disabled:opacity-70">
              {loading ? "Entrando…" : "Entrar"} {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] leading-relaxed text-[var(--hub-texto-3)]">O acesso é criado pelo escritório. Se ainda não tem o seu, fale com a sua equipe na Athos.</p>
        </div>

        <p className="relative text-center text-[12px] text-[var(--hub-texto-3)]">© {new Date().getFullYear()} Athos Consultoria Empresarial</p>
      </main>
    </div>
  );
}
