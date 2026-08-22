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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
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
        <p className="mt-2 max-w-xs text-sm text-white/60">Entre com o acesso da sua equipe pra ver a carteira de empresas.</p>

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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-accent-400"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-[12.5px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent-600/20 transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <LogIn size={16} />
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
