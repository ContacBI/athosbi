import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

// Pra onde o link de convite (lib/access.js inviteUser) e o de "esqueci
// minha senha" (Login.jsx) mandam a pessoa — os dois casos chegam aqui já
// logados (é assim que o link mágico do Supabase funciona: abrir o link já
// cria a sessão), só falta escolher a senha de verdade pra usar dali em
// diante. supabase.auth.updateUser roda em cima dessa sessão temporária.
export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate("/", { replace: true });
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
          <KeyRound size={26} strokeWidth={1.8} />
        </span>
        <h1 className="text-3xl font-medium tracking-tight">Defina sua senha</h1>
        <p className="mt-2 max-w-xs text-sm text-white/60">É só essa vez — da próxima vez você já entra direto com e-mail e senha.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-3 text-left">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-white/60">Nova senha</span>
            <input
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-accent-400"
              placeholder="••••••••"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-white/60">Confirmar senha</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
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
            {loading ? "Salvando…" : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
