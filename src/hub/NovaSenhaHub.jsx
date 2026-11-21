import { useState } from "react";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, Lock, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { pedirLinkDeSenha } from "../lib/recuperarSenha.js";
import { forcaDaSenha, mensagemDoErroDeSenha, regrasDaSenha, senhaPronta } from "../lib/senha.js";
import TelaDeAcesso, { Campo, classeDoInput } from "./TelaDeAcesso.jsx";

// A senha nova no visual do hub — pro link de "esqueci minha senha" e pro
// de convite (só no teste; no oficial continuam ConfirmAccess +
// SetPassword). Uma tela só, em vez de duas: o link do e-mail traz o
// token_hash e a página já abre no formulário. O token só é usado no
// "Salvar" (supabase.auth.verifyOtp) — um verificador de e-mail
// corporativo que abre o link sozinho não gasta nada, porque não envia
// formulário. Com `jaConectado` (o modelo antigo do e-mail, que entra
// direto em /definir-senha com a sessão), pula a verificação.

const COR_DA_FORCA = ["var(--hub-borda)", "#d8493a", "#d99a2b", "#1d9e75"];

function Medidor({ senha }) {
  const { nivel, rotulo } = forcaDaSenha(senha);
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3].map((barra) => (
          <span key={barra} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: nivel >= barra ? COR_DA_FORCA[nivel] : "var(--hub-borda)" }} />
        ))}
      </div>
      <span className="w-12 text-right text-[12px] font-semibold" style={{ color: COR_DA_FORCA[nivel] }}>
        {rotulo}
      </span>
    </div>
  );
}

function LinkVencido({ motivo }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await pedirLinkDeSenha(email);
    setEnviando(false);
    if (error) setErro(mensagemDoErroDeSenha(error));
    else setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="hub-surgir">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
          <MailCheck size={26} />
        </span>
        <h2 className="hub-display mt-6 text-[34px] font-bold leading-tight">Link novo a caminho</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">
          Se houver um acesso com <strong className="text-[var(--hub-texto)]">{email.trim()}</strong>, o e-mail chega em alguns minutos. Olhe também o spam.
        </p>
        <a href="/" className="hub-botao hub-botao-fantasma mt-8 h-[50px] w-full text-[14.5px]">
          Voltar para o login
        </a>
      </div>
    );
  }

  return (
    <div className="hub-surgir">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(216,73,58,0.1)] text-[#d8493a]">
        <CircleAlert size={26} />
      </span>
      <h2 className="hub-display mt-6 text-[34px] font-bold leading-tight">Esse link não vale mais</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">{motivo}</p>
      <form onSubmit={enviar} className="mt-8 space-y-5">
        <Campo icone={Mail} rotulo="Peça um link novo">
          <input type="email" required autoFocus autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com.br" className={classeDoInput} />
        </Campo>
        {erro && <p className="rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{erro}</p>}
        <button type="submit" disabled={enviando} className="hub-botao hub-botao-primario h-[54px] w-full text-[15.5px] disabled:cursor-wait disabled:opacity-70">
          {enviando ? "Enviando…" : "Enviar um link novo"} {!enviando && <ArrowRight size={18} />}
        </button>
      </form>
      <a href="/" className="mt-6 block text-center text-[13.5px] font-semibold text-[var(--hub-texto-3)] hover:text-[var(--hub-acento)]">
        Voltar para o login
      </a>
    </div>
  );
}

function Pronto({ convite }) {
  return (
    <div className="hub-surgir text-center">
      <span className="senha-pronta mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1d9e75] to-[#34c08f] text-white shadow-[0_18px_40px_-14px_rgba(29,158,117,0.8)]">
        <Check size={38} strokeWidth={2.6} />
      </span>
      <h2 className="hub-display mt-7 text-[34px] font-bold leading-tight">{convite ? "Senha criada!" : "Senha alterada!"}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">Você já está conectado. Da próxima vez, é só entrar com o seu e-mail e a senha nova.</p>
      {/* Recarrega de verdade: o portal sobe já com a sessão nova. */}
      <a href="/" className="hub-botao hub-botao-primario mt-8 h-[54px] w-full text-[15.5px]">
        Entrar no Hub <ArrowRight size={18} />
      </a>
    </div>
  );
}

export default function NovaSenhaHub({ jaConectado = false }) {
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash") || "";
  const convite = params.get("type") === "invite";
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  // O token já trocado pela sessão (num erro da senha, dá pra tentar de novo sem gastar outro link).
  const [verificado, setVerificado] = useState(jaConectado);
  const [etapa, setEtapa] = useState(!jaConectado && !tokenHash ? "vencido" : "formulario");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const regras = regrasDaSenha(senha, confirmacao);

  async function salvar(event) {
    event.preventDefault();
    if (!senhaPronta(senha, confirmacao)) {
      const falta = regras.find((regra) => !regra.ok);
      setErro(`Falta: ${falta.texto.toLowerCase()}.`);
      return;
    }
    setErro("");
    setSalvando(true);
    if (!verificado) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: convite ? "invite" : "recovery" });
      if (error) {
        setSalvando(false);
        setEtapa("vencido");
        return;
      }
      setVerificado(true);
    }
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      // Sem sessão: o link (ou a sessão do modelo antigo) já não vale.
      if (/session/i.test(String(error.message || ""))) setEtapa("vencido");
      else setErro(mensagemDoErroDeSenha(error));
      return;
    }
    setEtapa("pronto");
  }

  const motivo = tokenHash || jaConectado
    ? "O link vale por 1 hora e funciona uma vez só. Ele pode ter vencido, já ter sido usado — ou um verificador de segurança do seu e-mail pode ter aberto antes de você."
    : "O endereço está incompleto. Abra o link direto do e-mail, sem copiar só uma parte dele — ou peça um novo abaixo.";

  return (
    <TelaDeAcesso>
      {etapa === "vencido" && <LinkVencido motivo={motivo} />}
      {etapa === "pronto" && <Pronto convite={convite} />}
      {etapa === "formulario" && (
        <div className="hub-surgir">
          <p className="hub-rotulo">{convite ? "Primeiro acesso" : "Recuperar acesso"}</p>
          <h2 className="hub-display mt-3 text-[38px] font-bold leading-tight">{convite ? "Crie sua senha" : "Crie uma nova senha"}</h2>
          <p className="mt-2 text-[15px] text-[var(--hub-texto-3)]">{convite ? "É só desta vez: depois você entra direto com o seu e-mail e esta senha." : "Escolha uma senha que você não usa em outros sites."}</p>

          <form onSubmit={salvar} className="mt-9 space-y-5">
            <Campo icone={Lock} rotulo="Senha nova">
              <input type={verSenha ? "text" : "password"} required autoFocus autoComplete="new-password" value={senha} onChange={(event) => { setSenha(event.target.value); setErro(""); }} placeholder="••••••••" className={classeDoInput} />
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Esconder a senha" : "Mostrar a senha"} className="text-[var(--hub-texto-3)] hover:text-[var(--hub-texto)]">
                {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </Campo>
            <Medidor senha={senha} />
            <Campo icone={ShieldCheck} rotulo="Repita a senha">
              <input type={verSenha ? "text" : "password"} required autoComplete="new-password" value={confirmacao} onChange={(event) => { setConfirmacao(event.target.value); setErro(""); }} placeholder="••••••••" className={classeDoInput} />
            </Campo>

            <ul className="space-y-1.5">
              {regras.map((regra) => (
                <li key={regra.id} className={`flex items-center gap-2 text-[13px] transition-colors ${regra.ok ? "text-[#1d9e75]" : "text-[var(--hub-texto-3)]"}`}>
                  <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors ${regra.ok ? "border-[#1d9e75] bg-[#1d9e75] text-white" : "border-[var(--hub-borda-forte)]"}`}>{regra.ok && <Check size={11} strokeWidth={3} />}</span>
                  {regra.texto}
                </li>
              ))}
            </ul>

            {erro && <p className="rounded-xl bg-[rgba(216,73,58,0.1)] px-4 py-3 text-[13px] font-medium text-[#d8493a]">{erro}</p>}

            <button type="submit" disabled={salvando} className="hub-botao hub-botao-primario h-[54px] w-full text-[15.5px] disabled:cursor-wait disabled:opacity-70">
              {salvando ? "Salvando…" : convite ? "Criar senha e entrar" : "Salvar a nova senha"} {!salvando && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      )}
    </TelaDeAcesso>
  );
}
