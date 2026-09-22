import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

// Pra onde o e-mail de convite (invite-user) e o de "esqueci minha senha"
// (Login.jsx) passaram a apontar, em vez de irem direto pro link mágico do
// próprio Supabase (`{{ .ConfirmationURL }}`). Esse link direto é consumido
// por um simples GET — e é exatamente isso que scanners de segurança de
// e-mail corporativo (Microsoft Safe Links, e equivalentes do Google
// Workspace) fazem sozinhos, automaticamente, assim que o e-mail chega,
// bem antes da pessoa abrir a caixa de entrada. O token de uso único
// acabava gasto pelo scanner, e quem clicava de verdade caía sem sessão
// nenhuma — parecia simplesmente "ir pro login" sem motivo.
//
// A correção (recomendada pelo próprio Supabase pra esse problema exato):
// o e-mail aponta pra ESTA página, só com token_hash+type na URL — nada é
// consumido só de abrir. A troca de verdade (supabase.auth.verifyOtp) só
// roda dentro do onClick do botão, e scanner nenhum clica em botão.
export default function ConfirmAccess() {
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash") || "";
  const type = params.get("type") || "invite";
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");

  const label = type === "recovery" ? "a recuperação da sua senha" : "seu convite";

  async function handleConfirm() {
    if (!tokenHash) {
      setError("Esse link está incompleto — abra de novo direto do e-mail original, sem copiar só uma parte dele.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (verifyError) {
      setError(
        "Esse link não é mais válido. O mais comum é ele já ter sido aberto automaticamente por um verificador de segurança do seu provedor de e-mail antes de você clicar, ou simplesmente ter expirado. Peça pra reenviarem um novo."
      );
      setStatus("error");
      return;
    }
    window.location.href = "/definir-senha";
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

      <div className="relative flex w-full max-w-[360px] flex-col items-center">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-2xl font-medium shadow-lg shadow-accent-600/30">
          <ShieldCheck size={26} strokeWidth={1.8} />
        </span>
        <h1 className="text-2xl font-medium tracking-tight">Confirmar {label}</h1>
        <p className="mt-2 max-w-xs text-sm text-white/60">
          Por segurança, só continuamos quando você clica aqui — evita que um verificador automático do seu e-mail gaste o link sozinho.
        </p>

        {status === "error" && <p className="mt-4 text-[12.5px] text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={status === "loading"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent-600/20 transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {status === "loading" ? "Confirmando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
