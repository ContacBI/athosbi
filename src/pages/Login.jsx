import { useState } from "react";
import { LogIn } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

// Same visual language as Landing.jsx (navy background, accent badge) — this
// is the very first thing anyone sees now that the portal is online with
// real data behind it, so it needed to look like part of the same product,
// not a bolted-on auth screen.
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  // false = entrar numa conta que já existe; true = criar conta nova. Criar
  // conta não dá acesso a nada sozinho — a pessoa só enxerga alguma empresa
  // depois que o dono liberar o e-mail dela em Parâmetros > Acessos (ver
  // supabase/schema.sql e lib/access.js). Até lá, ela loga e a tela de
  // empresas aparece vazia.
  const [mode, setMode] = useState("entrar");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    if (mode === "criar") {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message === "User already registered" ? "Já existe conta com esse e-mail — entre normalmente." : signUpError.message);
        return;
      }
      if (!data.session) {
        setNotice("Conta criada. Confira seu e-mail pra confirmar antes de entrar.");
      }
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) setError("E-mail ou senha incorretos.");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy-950 px-6 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(560px circle at 50% 38%, rgba(47,111,237,0.28), transparent 60%), radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.25) 100%, transparent), radial-gradient(1px 1px at 80% 65%, rgba(255,255,255,.2) 100%, transparent), radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,.15) 100%, transparent)",
        }}
      />

      <div className="relative flex w-full max-w-[340px] flex-col items-center">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-medium shadow-lg shadow-accent-600/30">
          BI
        </span>
        <h1 className="text-3xl font-medium tracking-tight">AthosBI</h1>
        <p className="mt-2 max-w-xs text-sm text-white/60">
          {mode === "entrar" ? "Entre com o acesso da sua equipe pra ver a carteira de empresas." : "Crie sua conta — você só enxerga as empresas que forem liberadas pra você."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-3 text-left">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-white/60">E-mail</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-accent-400"
              placeholder="voce@escritorio.com.br"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-white/60">Senha</span>
            <input
              type="password"
              required
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-accent-400"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-[12.5px] text-red-400">{error}</p>}
          {notice && <p className="text-[12.5px] text-accent-300">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent-600/20 transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <LogIn size={16} />
            {loading ? "Um momento…" : mode === "entrar" ? "Entrar" : "Criar conta"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "entrar" ? "criar" : "entrar");
              setError("");
              setNotice("");
            }}
            className="mt-1 text-center text-[12.5px] text-white/50 hover:text-white/80"
          >
            {mode === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
