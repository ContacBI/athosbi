import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, LayoutGrid, Loader2, Lock, Minimize } from "lucide-react";
import { openShared } from "../lib/sharingPublic.js";

// Página pública do link compartilhado (/p/<código>): sem login, só os
// slides (imagens) — setas, teclado, deslizar no celular, tela cheia,
// miniaturas e PDF. Validade, senha e registro de abertura ficam no banco
// (open_shared_presentation).

const MESSAGES = {
  not_found: ["Link não encontrado", "Confira se o endereço está completo. Se o problema continuar, peça um link novo a quem enviou."],
  revoked: ["Este link foi desativado", "Quem compartilhou a apresentação desativou o link. Peça um novo, se precisar."],
  expired: ["Este link venceu", "O prazo de validade do link terminou. Peça um novo a quem enviou."],
  locked: ["Muitas tentativas com senha errada", "Por segurança, o link ficou bloqueado por alguns minutos. Tente de novo mais tarde."],
  error: ["Não consegui abrir agora", "Confira a internet e tente de novo em instantes."],
};

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

function Shell({ children }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-[#081d33] px-6 text-center text-white">{children}</div>;
}

export default function SharedPresentation({ token }) {
  const [result, setResult] = useState(null);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [index, setIndex] = useState(0);
  const [grid, setGrid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const touch = useRef(null);
  const stage = useRef(null);

  useEffect(() => {
    // Link privado: fora dos buscadores.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const load = useCallback(
    async (pass) => {
      setChecking(true);
      try {
        setResult(await openShared(token, pass));
      } catch (error) {
        console.error(error);
        setResult({ status: "error" });
      } finally {
        setChecking(false);
      }
    },
    [token]
  );
  useEffect(() => {
    load(null);
  }, [load]);

  useEffect(() => {
    if (result?.status === "ok") document.title = `${result.title} · AthosBI`;
  }, [result]);

  const slides = result?.status === "ok" ? result.slides || [] : [];
  const go = useCallback((next) => setIndex((current) => Math.max(0, Math.min(slides.length - 1, typeof next === "function" ? next(current) : next))), [slides.length]);

  useEffect(() => {
    if (!slides.length) return undefined;
    function onKey(event) {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go((i) => i + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go((i) => i - 1);
      } else if (event.key === "Home") go(0);
      else if (event.key === "End") go(slides.length - 1);
      else if (event.key === "Escape") setGrid(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, go]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else stage.current?.requestFullscreen?.().catch(() => {});
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540] });
      doc.setProperties({ title: result.title, creator: "AthosBI" });
      slides.forEach((src, i) => {
        if (i > 0) doc.addPage([960, 540], "landscape");
        doc.addImage(src, "JPEG", 0, 0, 960, 540, undefined, "FAST");
      });
      doc.save(`${String(result.title || "apresentacao").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.pdf`);
    } catch (error) {
      console.error(error);
      window.alert("Não consegui gerar o PDF agora.");
    } finally {
      setDownloading(false);
    }
  }

  if (!result) {
    return (
      <Shell>
        <Loader2 size={30} className="animate-spin text-[#e8691f]" />
        <p className="mt-3 text-[14px] text-white/70">Abrindo a apresentação…</p>
      </Shell>
    );
  }

  if (result.status === "password" || result.status === "wrong_password") {
    return (
      <Shell>
        <div className="w-full max-w-sm rounded-3xl bg-white/5 p-7 ring-1 ring-white/10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8691f]/20 text-[#ff9a5c]">
            <Lock size={22} />
          </span>
          <h1 className="mt-4 text-[19px] font-semibold">{result.title}</h1>
          {result.workspace_name && <p className="mt-0.5 text-[13px] text-white/60">{result.workspace_name}</p>}
          <p className="mt-4 text-[13px] text-white/70">Esta apresentação está protegida. Digite a senha que você recebeu.</p>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (password.trim()) load(password.trim());
            }}
          >
            <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" className="shared-senha h-11 rounded-xl bg-white/10 px-4 text-[15px] text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-[#e8691f]" />
            {result.status === "wrong_password" && <p className="text-[12.5px] text-[#ffb3a9]">Senha errada. Confira e tente de novo.</p>}
            <button type="submit" disabled={checking || !password.trim()} className="shared-entrar h-11 rounded-xl bg-[#e8691f] text-[14px] font-semibold text-white disabled:opacity-50">
              {checking ? "Conferindo…" : "Abrir"}
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  if (result.status !== "ok") {
    const [title, text] = MESSAGES[result.status] || MESSAGES.error;
    return (
      <Shell>
        <h1 className="shared-aviso text-[22px] font-semibold">{title}</h1>
        {result.title && <p className="mt-1 text-[14px] text-white/60">“{result.title}”</p>}
        <p className="mt-3 max-w-md text-[14px] text-white/70">{text}</p>
        {result.status === "expired" && result.expires_at && <p className="mt-2 text-[12px] text-white/40">Venceu em {formatDay(result.expires_at)}.</p>}
      </Shell>
    );
  }

  return (
    <div ref={stage} className="shared-apresentacao flex h-[100dvh] flex-col bg-[#05101f] text-white">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{result.title}</p>
          <p className="truncate text-[12px] text-white/50">
            {[result.workspace_name, result.period_label].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={() => setGrid((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 ${grid ? "bg-white/15" : ""}`} title="Ver todos os slides">
          <LayoutGrid size={17} />
        </button>
        <button type="button" onClick={downloadPdf} disabled={downloading} className="shared-pdf hidden h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium hover:bg-white/10 disabled:opacity-50 sm:flex" title="Baixar em PDF">
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
        </button>
        <button type="button" onClick={toggleFullscreen} className="hidden h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 sm:flex" title="Tela cheia">
          {fullscreen ? <Minimize size={17} /> : <Expand size={17} />}
        </button>
      </header>

      {grid ? (
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-4 pb-6 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
          {slides.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                go(i);
                setGrid(false);
              }}
              className={`overflow-hidden rounded-lg ring-2 ${i === index ? "ring-[#e8691f]" : "ring-transparent hover:ring-white/30"}`}
            >
              <img src={src} alt={`Slide ${i + 1}`} className="block aspect-video w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <main
          className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
          onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            if (touch.current == null) return;
            const dx = event.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 40) go((i) => i + (dx < 0 ? 1 : -1));
          }}
        >
          <img src={slides[index]} alt={`Slide ${index + 1} de ${slides.length}`} className="shared-slide max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          <button type="button" onClick={() => go((i) => i - 1)} disabled={index === 0} className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 sm:flex" aria-label="Slide anterior">
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={() => go((i) => i + 1)} disabled={index === slides.length - 1} className="shared-proximo absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 sm:flex" aria-label="Próximo slide">
            <ChevronRight size={22} />
          </button>
        </main>
      )}

      <footer className="flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-white/50 sm:px-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go((i) => i - 1)} disabled={index === 0} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 disabled:opacity-30 sm:hidden" aria-label="Slide anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="shared-contador tabular-nums text-white/80">
            {index + 1} / {slides.length}
          </span>
          <button type="button" onClick={() => go((i) => i + 1)} disabled={index === slides.length - 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 disabled:opacity-30 sm:hidden" aria-label="Próximo slide">
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="truncate text-right">
          {result.expires_at ? `Link válido até ${formatDay(result.expires_at)} · ` : ""}Números de {formatDay(result.updated_at)} · AthosBI
        </span>
      </footer>
    </div>
  );
}
