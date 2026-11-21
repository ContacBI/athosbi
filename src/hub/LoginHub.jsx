import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react";
import { useLogin } from "../pages/Login.jsx";
import { pedirLinkDeSenha } from "../lib/recuperarSenha.js";
import { mensagemDoErroDeSenha } from "../lib/senha.js";
import TelaDeAcesso, { Campo, classeDoInput } from "./TelaDeAcesso.jsx";

const ESPERA_PARA_REENVIAR = 60; // o Supabase só manda outro e-mail pro mesmo endereço depois de 1 minuto

// "Esqueci minha senha" no próprio cartão: pede o e-mail (já vem o que
// estava digitado no login), manda o link e mostra o que fazer depois —
// com "Reenviar" liberado depois de 1 minuto.
function Recuperar({ emailInicial, onVoltar }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviadoPara, setEnviadoPara] = useState("");
  const [espera, setEspera] = useState(0);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const relogio = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(relogio);
  }, [espera]);

  async function enviar(event) {
    event?.preventDefault();
    const limpo = email.trim();
    if (!limpo) {
      setErro("Digite o e-mail do seu acesso.");
      return;
    }
    setErro("");
    setEnviando(true);
    const { error } = await pedirLinkDeSenha(limpo);
    setEnviando(false);
    if (error) {
      setErro(mensagemDoErroDeSenha(error));
      if (error.status === 429) setEspera(ESPERA_PARA_REENVIAR);
      return;
    }
    setEnviadoPara(limpo);
    setEspera(ESPERA_PARA_REENVIAR);
  }

  if (enviadoPara) {
    return (
      <div className="hub-surgir">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
          <MailCheck size={26} />
        </span>
        <h2 className="hub-display mt-6 text-[34px] font-bold leading-tight">Confira seu e-mail</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">
          Se houver um acesso com <strong className="text-[var(--hub-texto)]">{enviadoPara}</strong>, o link para criar a nova senha chega em alguns minutos.
        </p>
        <ul className="mt-6 space-y-2.5 rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-cartao)] p-5 text-[13.5px] text-[var(--hub-texto-2)]">
          <li>• Olhe também o <strong className="text-[var(--hub-texto)]">spam</strong> e a aba de promoções.</li>
          <li>• O link vale por <strong className="text-[var(--hub-texto)]">1 hora</strong> e funciona uma vez só.</li>
          <li>• Pediu mais de uma vez? Use o e-mail mais recente.</li>
        </ul>
        {erro && <p className="mt-5 rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{erro}</p>}
        <button type="button" onClick={enviar} disabled={espera > 0 || enviando} className="hub-botao hub-botao-fantasma mt-6 h-[50px] w-full text-[14.5px] disabled:cursor-not-allowed disabled:opacity-60">
          {enviando ? "Enviando…" : espera > 0 ? `Reenviar em ${espera}s` : "Reenviar o link"}
        </button>
        <button type="button" onClick={onVoltar} className="mt-4 flex w-full items-center justify-center gap-2 text-[13.5px] font-semibold text-[var(--hub-texto-3)] hover:text-[var(--hub-acento)]">
          <ArrowLeft size={15} /> Voltar para o login
        </button>
      </div>
    );
  }

  return (
    <div className="hub-surgir">
      <p className="hub-rotulo">Recuperar acesso</p>
      <h2 className="hub-display mt-3 text-[38px] font-bold leading-tight">Esqueceu a senha?</h2>
      <p className="mt-2 text-[15px] text-[var(--hub-texto-3)]">Digite o e-mail do seu acesso. Enviamos um link para você criar uma senha nova.</p>
      <form onSubmit={enviar} className="mt-9 space-y-5">
        <Campo icone={Mail} rotulo="E-mail">
          <input type="email" required autoFocus autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com.br" className={classeDoInput} />
        </Campo>
        {erro && <p className="rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{erro}</p>}
        <button type="submit" disabled={enviando || espera > 0} className="hub-botao hub-botao-primario h-[54px] w-full text-[15.5px] disabled:cursor-wait disabled:opacity-70">
          {enviando ? "Enviando…" : espera > 0 ? `Aguarde ${espera}s` : "Enviar link"} {!enviando && espera <= 0 && <ArrowRight size={18} />}
        </button>
      </form>
      <button type="button" onClick={onVoltar} className="mt-6 flex w-full items-center justify-center gap-2 text-[13.5px] font-semibold text-[var(--hub-texto-3)] hover:text-[var(--hub-acento)]">
        <ArrowLeft size={15} /> Voltar para o login
      </button>
    </div>
  );
}

export default function LoginHub() {
  const { email, setEmail, password, setPassword, error, loading, handleSubmit } = useLogin();
  const [verSenha, setVerSenha] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  return (
    <TelaDeAcesso>
      {recuperando ? (
        <Recuperar emailInicial={email} onVoltar={() => setRecuperando(false)} />
      ) : (
        <div className="hub-surgir">
          <p className="hub-rotulo">Acesso do cliente</p>
          <h2 className="hub-display mt-3 text-[38px] font-bold leading-tight">Bem-vindo de volta</h2>
          <p className="mt-2 text-[15px] text-[var(--hub-texto-3)]">Entre com o e-mail e a senha do seu acesso.</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <Campo icone={Mail} rotulo="E-mail">
              <input type="email" required autoFocus autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com.br" className={classeDoInput} />
            </Campo>
            <Campo icone={Lock} rotulo="Senha">
              <input type={verSenha ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className={classeDoInput} />
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Esconder a senha" : "Mostrar a senha"} className="text-[var(--hub-texto-3)] hover:text-[var(--hub-texto)]">
                {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </Campo>
            <div className="flex justify-end">
              <button type="button" onClick={() => setRecuperando(true)} className="text-[13px] font-semibold text-[var(--hub-texto-3)] hover:text-[var(--hub-acento)]">
                Esqueci minha senha
              </button>
            </div>

            {error && <p className="rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{error}</p>}

            <button type="submit" disabled={loading} className="hub-botao hub-botao-primario h-[54px] w-full text-[15.5px] disabled:cursor-wait disabled:opacity-70">
              {loading ? "Entrando…" : "Entrar"} {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] leading-relaxed text-[var(--hub-texto-3)]">O acesso é criado pelo escritório. Se ainda não tem o seu, fale com a sua equipe na Athos.</p>
        </div>
      )}
    </TelaDeAcesso>
  );
}
