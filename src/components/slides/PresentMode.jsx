import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Loader2, Minimize, NotebookPen, X } from "lucide-react";
import { SLIDE_H, SLIDE_W, deckFontFamilies } from "../../lib/presentations.js";
import { embeddedFontCss } from "../../lib/slideFonts.js";
import { exportSlidePng, exportSlidesPdf } from "../../lib/slidesPdf.js";
import { slug } from "../../lib/demonstrativoExport.js";
import SlideView from "./SlideView.jsx";
import { ExplorerOverlay, LedgerOverlay } from "./PresentOverlays.jsx";

export function visibleSlides(deck) {
  return deck.slides.filter((slide) => !slide.hidden);
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    function onResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

// Tela cheia: setas/espaço/clique avançam, Esc sai, N mostra as anotações,
// B apaga a tela (pausa), F liga/desliga a tela cheia.
export default function PresentMode({ deck, env, startIndex = 0, onClose }) {
  const slides = useMemo(() => visibleSlides(deck), [deck]);
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, slides.length - 1)));
  const [showNotes, setShowNotes] = useState(false);
  const [black, setBlack] = useState(false);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef(null);
  const enteredFullscreen = useRef(false);
  // Janelas por cima do slide (Explorar, razão da conta) — uma pilha: o
  // razão aberto de dentro do Explorar volta pro Explorar ao fechar.
  const [overlays, setOverlays] = useState([]);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const pushOverlay = useCallback((overlay) => setOverlays((list) => [...list, { ...overlay, id: `${Date.now()}-${list.length}` }]), []);
  const popOverlay = useCallback(() => setOverlays((list) => list.slice(0, -1)), []);
  const presentEnv = useMemo(
    () => ({
      ...env,
      mode: "present",
      onOpenLedger: (request) => pushOverlay({ type: "ledger", request }),
      onExplore: (initial) => pushOverlay({ type: "explorer", initial }),
    }),
    [env, pushOverlay]
  );
  const { w, h } = useWindowSize();
  const scale = Math.min(w / SLIDE_W, h / SLIDE_H);

  const next = useCallback(() => setIndex((value) => Math.min(slides.length - 1, value + 1)), [slides.length]);
  const prev = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    function onChange() {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      // Esc em tela cheia sai da tela cheia antes de o app ver a tecla —
      // então sair da tela cheia (depois de ter entrado) encerra a
      // apresentação, que é o que a pessoa quis com o Esc.
      if (active) enteredFullscreen.current = true;
      // Com uma janela aberta, o Esc (que em tela cheia o navegador usa pra
      // sair dela) fecha só a janela — a apresentação continua.
      else if (overlaysRef.current.length) setOverlays((list) => list.slice(0, -1));
      else if (enteredFullscreen.current) onClose();
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);

  useEffect(() => {
    function onKey(event) {
      const key = event.key;
      if (overlaysRef.current.length) {
        if (key === "Escape") popOverlay();
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(key)) {
        event.preventDefault();
        setBlack(false);
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(key)) {
        event.preventDefault();
        setBlack(false);
        prev();
      } else if (key === "Home") setIndex(0);
      else if (key === "End") setIndex(slides.length - 1);
      else if (key === "Escape") onClose();
      else if (key.toLowerCase() === "n") setShowNotes((value) => !value);
      else if (key.toLowerCase() === "b" || key === ".") setBlack((value) => !value);
      else if (key.toLowerCase() === "f") toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, slides.length, onClose, toggleFullscreen, popOverlay]);

  function poke() {
    setControls(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControls(false), 2500);
  }
  useEffect(() => {
    poke();
    return () => clearTimeout(idleTimer.current);
  }, []);

  const slide = slides[index];
  if (!slide) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black text-white">
        <p>Nenhum slide pra apresentar (todos estão marcados pra pular).</p>
        <button type="button" onClick={onClose} className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
          Voltar
        </button>
      </div>
    );
  }
  const transition = slide.transition && slide.transition !== "@deck" ? slide.transition : deck.transition || "fade";
  return (
    <div className="fixed inset-0 z-[80] select-none overflow-hidden bg-black" onPointerMove={poke} style={{ cursor: controls ? "default" : "none" }}>
      <div
        className="absolute"
        style={{ left: (w - SLIDE_W * scale) / 2, top: (h - SLIDE_H * scale) / 2, width: SLIDE_W * scale, height: SLIDE_H * scale }}
        onClick={(event) => {
          if (event.target.closest("button, a, input, .recharts-wrapper, [data-interactive]")) return;
          next();
        }}
      >
        <div key={slide.id} className={transition !== "none" ? `slide-tr-${transition}` : undefined} style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <SlideView slide={slide} deck={deck} env={presentEnv} number={index + 1} total={slides.length} />
        </div>
      </div>
      {overlays.map((overlay, i) =>
        overlay.type === "ledger" ? (
          <LedgerOverlay key={overlay.id} deck={deck} request={overlay.request} z={100 + i} onClose={popOverlay} />
        ) : (
          <ExplorerOverlay key={overlay.id} deck={deck} env={presentEnv} initial={overlay.initial} z={100 + i} onClose={popOverlay} onLedger={(request) => pushOverlay({ type: "ledger", request })} />
        )
      )}
      {black && <div className="absolute inset-0 bg-black" onClick={() => setBlack(false)} />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-accent-500 transition-all duration-300" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      </div>

      {showNotes && (
        <div className="absolute inset-x-0 bottom-1 max-h-[30vh] overflow-y-auto bg-black/85 px-8 py-5 text-[18px] leading-relaxed text-white/90 backdrop-blur">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Anotações · slide {index + 1}</p>
          {slide.notes ? <p className="whitespace-pre-wrap">{slide.notes}</p> : <p className="text-white/40">Sem anotações neste slide.</p>}
        </div>
      )}

      <div className={`absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 px-2 py-1.5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur transition-opacity duration-300 ${controls && !overlays.length ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <PresentButton title="Anterior (←)" onClick={prev} disabled={index === 0}>
          <ChevronLeft size={18} />
        </PresentButton>
        <span className="min-w-16 px-2 text-center text-[13px] tabular-nums text-white/80">
          {index + 1} / {slides.length}
        </span>
        <PresentButton title="Próximo (→ ou espaço)" onClick={next} disabled={index === slides.length - 1}>
          <ChevronRight size={18} />
        </PresentButton>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <PresentButton title="Anotações (N)" onClick={() => setShowNotes((value) => !value)} active={showNotes}>
          <NotebookPen size={16} />
        </PresentButton>
        <PresentButton title="Tela cheia (F)" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
        </PresentButton>
        <PresentButton title="Sair (Esc)" onClick={onClose}>
          <X size={17} />
        </PresentButton>
      </div>
    </div>
  );
}

function PresentButton({ children, title, onClick, disabled, active }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${active ? "bg-accent-500 text-white" : "hover:bg-white/15"}`}
    >
      {children}
    </button>
  );
}

// Monta os slides fora da tela (cada um no seu invólucro fixo 0×0 em 0,0 —
// ver slidesPdf.js) e tira o print de um por um. `only` = índice de um
// slide só (PNG); sem ele, PDF com todos os visíveis — ou PowerPoint
// (format "pptx", ver slidesPptx.js).
export function SlidesExporter({ deck, env, only = null, format = "pdf", onDone }) {
  const slides = useMemo(() => (only != null ? [deck.slides[only]].filter(Boolean) : visibleSlides(deck)), [deck, only]);
  const refs = useRef([]);
  const [progress, setProgress] = useState({ done: 0, total: slides.length });
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        const nodes = refs.current.slice(0, slides.length).filter(Boolean);
        const fileLabel = slug(`${deck.name}_${env.info.empresa}`) || "apresentacao";
        const fontCss = await embeddedFontCss(deckFontFamilies(deck));
        if (only != null) await exportSlidePng({ node: nodes[0], fileLabel: `${fileLabel}_slide_${only + 1}`, fontCss });
        else if (format === "pptx") {
          const { exportSlidesPptx } = await import("../../lib/slidesPptx.js");
          await exportSlidesPptx({ nodes, slides, deck, info: env.info, fileLabel, fontCss, onProgress: (done, total) => alive && setProgress({ done, total }) });
        } else await exportSlidesPdf({ nodes, fileLabel, title: deck.name, fontCss, onProgress: (done, total) => alive && setProgress({ done, total }) });
        if (alive) onDone();
      } catch (err) {
        console.error("Falha ao gerar o arquivo da apresentação:", err);
        if (alive) setError("Não consegui gerar o arquivo. Tente de novo — se continuar, recarregue a página.");
      }
    }
    run();
    return () => {
      alive = false;
    };
    // Roda uma vez por exportação (o componente é montado pra isso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {slides.map((slide, i) => (
        <div key={slide.id} style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
          <div ref={(node) => (refs.current[i] = node)} style={{ width: SLIDE_W, height: SLIDE_H }}>
            <SlideView slide={slide} deck={deck} env={{ ...env, mode: "export" }} number={only != null ? visibleSlides(deck).indexOf(slide) + 1 || null : i + 1} total={visibleSlides(deck).length} />
          </div>
        </div>
      ))}
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/40 backdrop-blur-sm">
        <div className="flex w-80 flex-col items-center gap-3 rounded-2xl bg-surface-card p-6 text-center shadow-2xl">
          {error ? (
            <>
              <p className="text-[14px] text-danger-600">{error}</p>
              <button type="button" onClick={onDone} className="rounded-md bg-surface-muted px-4 py-2 text-[13px] text-ink-700 hover:bg-line">
                Fechar
              </button>
            </>
          ) : (
            <>
              <Loader2 size={28} className="animate-spin text-accent-500" />
              <p className="text-[14px] font-medium text-ink-900">{only != null ? "Gerando a imagem…" : format === "pptx" ? "Gerando o PowerPoint…" : "Gerando o PDF…"}</p>
              {only == null && (
                <>
                  <p className="text-[12.5px] tabular-nums text-ink-500">
                    Slide {Math.max(1, progress.done)} de {progress.total}
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
