import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Lock, RefreshCw, ShieldOff } from "lucide-react";
import { state } from "../../data/useStore.js";
import { SLIDE_H, SLIDE_W, deckFontFamilies, friendlyPeriod } from "../../lib/presentations.js";
import { contextForPeriod } from "../../lib/assistant/context.js";
import { embeddedFontCss } from "../../lib/slideFonts.js";
import { createShare, expiryFromChoice, listShares, refreshShare, revokeShare, setShareExpiry, setSharePassword, shareStatus, shareUrl } from "../../lib/sharing.js";
import { visibleSlides } from "./PresentMode.jsx";
import SlideView from "./SlideView.jsx";
import { Modal } from "./pickers.jsx";
import Carregando from "../Carregando.jsx";

// "Compartilhar por link": cria (ou atualiza) uma foto dos slides em
// imagens e um link que abre sem login, com validade e senha opcional.
// Lista os links desta apresentação com quantas vezes cada um foi aberto.

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "never", label: "Sem prazo" },
  { value: "custom", label: "Até uma data" },
];

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

// Desenha os slides fora da tela (como o PDF) e devolve cada um em JPEG.
function SlidesCapture({ deck, env, onDone, onError, onProgress }) {
  const slides = useMemo(() => visibleSlides(deck), [deck]);
  const refs = useRef([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { captureSlide } = await import("../../lib/slidesPdf.js");
        const fontCss = await embeddedFontCss(deckFontFamilies(deck));
        await new Promise((resolve) => setTimeout(resolve, 500));
        const images = [];
        for (let i = 0; i < slides.length; i += 1) {
          if (!alive) return;
          onProgress?.(i + 1, slides.length);
          const canvas = await captureSlide(refs.current[i], 1.25, fontCss);
          images.push(canvas.toDataURL("image/jpeg", 0.82));
        }
        if (alive) onDone(images);
      } catch (error) {
        console.error("Falha ao preparar os slides do link:", error);
        if (alive) onError(error);
      }
    })();
    return () => {
      alive = false;
    };
    // Roda uma vez por captura (o componente é montado pra isso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return slides.map((slide, i) => (
    <div key={slide.id} style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
      <div ref={(node) => (refs.current[i] = node)} style={{ width: SLIDE_W, height: SLIDE_H }}>
        <SlideView slide={slide} deck={deck} env={{ ...env, mode: "export" }} number={i + 1} total={slides.length} />
      </div>
    </div>
  ));
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copie o link:", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button type="button" onClick={copy} className="share-copiar flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-[12px] font-semibold text-white hover:bg-navy-700">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}

export default function ShareDeckModal({ deck, env, onClose }) {
  const [shares, setShares] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [customDate, setCustomDate] = useState("");
  const [password, setPassword] = useState("");
  const [capture, setCapture] = useState(null); // { mode: "create" } | { mode: "refresh", id }
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  // Os slides do link mostram o período salvo na apresentação (o mesmo que
  // ela abre no editor); sem período salvo, o da tela.
  const period = deck.period?.start && deck.period?.end ? deck.period : { start: state.periodStart, end: state.periodEnd };
  const periodLabel = friendlyPeriod(period.start, period.end);
  const captureEnv = useMemo(() => {
    if (!capture) return null;
    const samePeriod = period.start === state.periodStart && period.end === state.periodEnd;
    const ctx = samePeriod ? env.ctx : contextForPeriod(period.start, period.end);
    return { ...env, ctx, info: { ...env.info, start: period.start, end: period.end } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);

  async function reload() {
    try {
      setShares(await listShares(deck.id));
      setLoadError("");
    } catch (error) {
      console.error(error);
      setLoadError("Não consegui carregar os links desta apresentação. Confira a conexão.");
      setShares([]);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);

  async function handleCaptured(images) {
    const job = capture;
    setCapture(null);
    setProgress(null);
    try {
      if (job.mode === "create") {
        const created = await createShare({ deck, title: deck.name, periodLabel, slides: images, expiresAt: expiryFromChoice(expiry, customDate), password: password.trim() });
        setPassword("");
        setMessage(`Link criado${created.has_password ? " com senha" : ""}. Copie e envie para quem vai ver.`);
      } else {
        await refreshShare(job.id, { slides: images, periodLabel, title: deck.name });
        setMessage("Números atualizados: quem abrir o mesmo link já vê a versão nova.");
      }
      await reload();
    } catch (error) {
      console.error(error);
      setMessage("Não consegui salvar o link agora. Confira a conexão e tente de novo.");
    }
  }

  async function act(id, fn, done) {
    setBusyId(id);
    try {
      await fn();
      if (done) setMessage(done);
      await reload();
    } catch (error) {
      console.error(error);
      setMessage("Não consegui fazer isso agora. Confira a conexão e tente de novo.");
    } finally {
      setBusyId("");
    }
  }

  const canCreate = !capture && (expiry !== "custom" || customDate);
  const active = (shares || []).filter((share) => shareStatus(share) === "ativo");
  const inactive = (shares || []).filter((share) => shareStatus(share) !== "ativo");

  return (
    <Modal title="Compartilhar por link" subtitle="Quem recebe o link vê os slides sem precisar de login — só os slides, nada além disso." onClose={onClose} width="max-w-3xl">
      <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto p-6">
        <section className="rounded-xl border border-line p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
            <Link2 size={15} className="text-accent-500" /> Novo link
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-600">Vale por</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPIRY_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setExpiry(option.value)} className={`share-validade h-8 rounded-full px-3 text-[12px] font-medium ${expiry === option.value ? "bg-navy-900 text-white" : "bg-surface-muted text-ink-600 hover:text-ink-900"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              {expiry === "custom" && <input type="date" value={customDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setCustomDate(event.target.value)} className="mt-2 h-9 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400" />}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-ink-600">Senha (opcional)</span>
              <input type="text" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sem senha" autoComplete="off" className="share-senha h-9 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400" />
              <span className="text-[11px] text-ink-400">Se preencher, envie a senha por outro caminho (WhatsApp, ligação).</span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px] leading-snug text-ink-400">
              Os slides vão como estão agora ({periodLabel}). Os slides marcados para pular não entram. Depois dá para “Atualizar os números” no mesmo link.
            </p>
            <button type="button" disabled={!canCreate} onClick={() => setCapture({ mode: "create" })} className="share-criar flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50">
              <Link2 size={15} /> Criar link
            </button>
          </div>
        </section>

        {(capture || progress) && (
          <p className="flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-[12.5px] font-medium text-accent-700">
            <Loader2 size={14} className="animate-spin" /> Preparando os slides{progress ? ` — ${progress.done} de ${progress.total}` : "…"}
          </p>
        )}
        {message && <p className="share-mensagem rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] text-ink-700">{message}</p>}
        {loadError && <p className="rounded-lg bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">{loadError}</p>}

        <section>
          <p className="mb-2 text-[13px] font-semibold text-ink-900">Links desta apresentação</p>
          {shares === null ? (
            <Carregando compacto />
          ) : !shares.length ? (
            <p className="text-[12.5px] text-ink-400">Nenhum link criado ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...active, ...inactive].map((share) => {
                const status = shareStatus(share);
                const url = shareUrl(share.token);
                return (
                  <div key={share.id} className={`share-link rounded-xl border p-3 ${status === "ativo" ? "border-line" : "border-line bg-surface-muted/60 opacity-75"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${status === "ativo" ? "bg-success-50 text-success-600" : "bg-surface-muted text-ink-500"}`}>{status}</span>
                      {share.has_password && (
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-500">
                          <Lock size={12} /> com senha
                        </span>
                      )}
                      <span className="text-[11.5px] text-ink-500">{share.expires_at ? `${status === "expirado" ? "venceu em" : "vale até"} ${formatDay(share.expires_at)}` : "sem prazo"}</span>
                      <span className="text-[11.5px] text-ink-400">· {share.slide_count} slides · {share.period_label}</span>
                    </div>
                    {status === "ativo" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input readOnly value={url} onFocus={(event) => event.target.select()} className="share-url h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-page px-2.5 text-[12px] text-ink-700" />
                        <CopyButton text={url} />
                        <a href={url} target="_blank" rel="noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-surface-muted" title="Abrir como o cliente vê">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}
                    <p className="share-aberturas mt-2 text-[11.5px] text-ink-500">
                      {share.openCount ? `Aberto ${share.openCount} ${share.openCount === 1 ? "vez" : "vezes"} · última em ${formatWhen(share.lastOpen)}${share.views[0]?.device ? ` (${share.views[0].device})` : ""}` : "Ainda não foi aberto"}
                      {share.wrongPasswords ? ` · ${share.wrongPasswords} tentativa${share.wrongPasswords === 1 ? "" : "s"} com senha errada` : ""}
                      {` · criado em ${formatWhen(share.created_at)}${share.updated_at && share.updated_at !== share.created_at ? `, atualizado em ${formatWhen(share.updated_at)}` : ""}`}
                    </p>
                    {status !== "revogado" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {status === "ativo" && (
                          <button type="button" disabled={Boolean(capture) || busyId === share.id} onClick={() => setCapture({ mode: "refresh", id: share.id })} className="share-atualizar flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-accent-700 hover:bg-accent-50 disabled:opacity-50">
                            <RefreshCw size={12} /> Atualizar os números
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === share.id}
                          onClick={() => {
                            const days = window.prompt("Vale por mais quantos dias a partir de hoje? (0 = sem prazo)", "30");
                            if (days == null) return;
                            const n = Number(days);
                            if (!Number.isFinite(n) || n < 0) return;
                            act(share.id, () => setShareExpiry(share.id, n === 0 ? null : expiryFromChoice(String(n))), n === 0 ? "Link sem prazo de validade." : `Link vale por mais ${n} dias.`);
                          }}
                          className="h-7 rounded-lg px-2 text-[11.5px] font-medium text-ink-600 hover:bg-surface-muted disabled:opacity-50"
                        >
                          {status === "expirado" ? "Reativar" : "Mudar validade"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === share.id}
                          onClick={() => {
                            const next = window.prompt(share.has_password ? "Nova senha (deixe vazio para tirar a senha):" : "Senha para este link:", "");
                            if (next == null) return;
                            act(share.id, () => setSharePassword(share.id, next.trim()), next.trim() ? "Senha do link trocada." : "O link ficou sem senha.");
                          }}
                          className="h-7 rounded-lg px-2 text-[11.5px] font-medium text-ink-600 hover:bg-surface-muted disabled:opacity-50"
                        >
                          {share.has_password ? "Trocar senha" : "Pôr senha"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === share.id}
                          onClick={() => window.confirm("Revogar este link? Quem tentar abrir vai ver que ele foi desativado. Não dá para desfazer.") && act(share.id, () => revokeShare(share.id), "Link revogado.")}
                          className="share-revogar flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                        >
                          <ShieldOff size={12} /> Revogar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {capture && captureEnv && (
        <SlidesCapture
          deck={deck}
          env={captureEnv}
          onProgress={(done, total) => setProgress({ done, total })}
          onDone={handleCaptured}
          onError={() => {
            setCapture(null);
            setProgress(null);
            setMessage("Não consegui preparar os slides. Tente de novo — se continuar, recarregue a página.");
          }}
        />
      )}
    </Modal>
  );
}
