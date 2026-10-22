import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Gauge,
  Hash,
  Heading,
  ImagePlus,
  Loader2,
  Palette,
  Play,
  Plus,
  Redo2,
  Shapes,
  Smile,
  Table2,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  ChartColumnBig,
  Sheet,
  BookmarkPlus,
  Link2,
  Presentation,
} from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import PeriodPicker from "../PeriodPicker.jsx";
import { SLIDE_H, SLIDE_W, applyBrand, cloneBlock, cloneSlide, compressImage, fontStack, makeBlock, makeSlide, resolveColor, upsertPresentation } from "../../lib/presentations.js";
import { BRANDS, brandLogoFor, loadBrandLogos, saveBrandLogos } from "../../lib/brand.js";
import SlideView from "./SlideView.jsx";
import { SHAPES } from "./SlideView.jsx";
import { BlockInspector, MultiInspector, SlideInspector, ThemeInspector } from "./Inspector.jsx";
import { IconPicker, LayoutPicker, SaveSlideModal, SlideThumb, WidgetPicker } from "./pickers.jsx";
import { deleteLibrarySlide, loadOfficeLibrary, saveSlideToLibrary, suggestSlideName } from "../../lib/officeLibrary.js";

// Área de transferência dos blocos (Ctrl+C / Ctrl+V) — vale entre slides e
// entre apresentações enquanto a aba estiver aberta.
let clipboard = [];

const HANDLES = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};
const HANDLE_CURSOR = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

function isTyping(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

function boundsOf(blocks) {
  const x = Math.min(...blocks.map((b) => b.x));
  const y = Math.min(...blocks.map((b) => b.y));
  const r = Math.max(...blocks.map((b) => b.x + b.w));
  const bt = Math.max(...blocks.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

// Redimensionar mantendo fixo o canto/lado oposto — inclusive com o bloco
// girado (a conta é feita no "eixo" do próprio bloco).
function resizeGeometry(b, handle, p, start, keepRatio) {
  const [hx, hy] = HANDLES[handle];
  const th = ((b.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const dx = p.x - start.x;
  const dy = p.y - start.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  let w = b.w + hx * lx;
  let h = b.h + hy * ly;
  if (keepRatio && hx && hy) {
    const ratio = b.w / b.h;
    if (Math.abs(w / b.w) > Math.abs(h / b.h)) h = w / ratio;
    else w = h * ratio;
  }
  w = Math.max(8, w);
  h = Math.max(8, h);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const ax = (-hx * b.w) / 2;
  const ay = (-hy * b.h) / 2;
  const anchorX = cx + ax * cos - ay * sin;
  const anchorY = cy + ax * sin + ay * cos;
  const nax = (-hx * w) / 2;
  const nay = (-hy * h) / 2;
  const ncx = anchorX - (nax * cos - nay * sin);
  const ncy = anchorY - (nax * sin + nay * cos);
  return { x: ncx - w / 2, y: ncy - h / 2, w, h };
}

function capturePointer(node, pointerId) {
  try {
    node?.setPointerCapture(pointerId);
  } catch {
    /* ponteiro já solto */
  }
}

function snapTargets(blocks, excludeIds) {
  const xs = [0, SLIDE_W / 2, SLIDE_W, 80, SLIDE_W - 80];
  const ys = [0, SLIDE_H / 2, SLIDE_H, 52, SLIDE_H - 60];
  blocks.forEach((b) => {
    if (excludeIds.includes(b.id) || b.hidden || b.rotation) return;
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  });
  return { xs, ys };
}

function nearest(candidates, targets, threshold) {
  let best = null;
  candidates.forEach((value) => {
    targets.forEach((target) => {
      const diff = target - value;
      if (Math.abs(diff) <= threshold && (!best || Math.abs(diff) < Math.abs(best.diff))) best = { diff, target };
    });
  });
  return best;
}

// O palco: o slide em 1280×720 encolhido pra caber, mais a camada de
// seleção (alças, guias de alinhamento, retângulo de seleção) por cima.
function Canvas({ slide, deck, env, selected, onSelect, onGeometry, editingId, onStartEdit, onStopEdit, onTextChange, onDoubleClickBlock, onDropFiles, readOnly, number, total }) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [box, setBox] = useState({ w: 900, h: 500 });
  const [transient, setTransient] = useState(null);
  const transientRef = useRef(null);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const drag = useRef(null);
  const lastDownId = useRef(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(0.1, Math.min((box.w - 48) / SLIDE_W, (box.h - 48) / SLIDE_H));
  const live = (block) => (transient?.[block.id] ? { ...block, ...transient[block.id] } : block);

  function setLive(value) {
    transientRef.current = value;
    setTransient(value);
  }

  function toLogical(event) {
    const rect = stageRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  function onPointerDown(event) {
    if (readOnly || event.button !== 0) return;
    if (event.target.closest("[data-editing]")) return;
    if (editingId) onStopEdit();
    const p = toLogical(event);
    const handle = event.target.closest("[data-handle]");
    if (handle) {
      const block = slide.blocks.find((item) => item.id === handle.dataset.blockid);
      if (!block) return;
      drag.current = { type: handle.dataset.handle === "rot" ? "rotate" : "resize", handle: handle.dataset.handle, start: p, block: { ...block } };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const el = event.target.closest("[data-block-id]");
    lastDownId.current = el ? el.dataset.blockId : null;
    if (el) {
      const id = el.dataset.blockId;
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        onSelect(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
        return;
      }
      const nextSel = selected.includes(id) ? selected : [id];
      if (nextSel !== selected) onSelect(nextSel);
      const moving = slide.blocks.filter((item) => nextSel.includes(item.id) && !item.locked);
      if (!moving.length) return;
      drag.current = { type: "move", start: p, blocks: moving.map((item) => ({ ...item })), moved: false, pointerId: event.pointerId };
    } else {
      if (!event.shiftKey) onSelect([]);
      drag.current = { type: "marquee", start: p, base: event.shiftKey ? selected : [], pointerId: event.pointerId };
    }
  }

  function onPointerMove(event) {
    const d = drag.current;
    if (!d) {
      if (!readOnly) {
        const el = event.target.closest("[data-block-id]");
        const id = el ? el.dataset.blockId : null;
        if (id !== hoverId) setHoverId(id);
      }
      return;
    }
    const p = toLogical(event);
    const threshold = 6 / scale;
    if (d.type === "move") {
      let dx = p.x - d.start.x;
      let dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * scale < 3) return;
      if (!d.moved) capturePointer(stageRef.current, d.pointerId);
      d.moved = true;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const lines = [];
      if (!event.altKey) {
        const b = boundsOf(d.blocks);
        const { xs, ys } = snapTargets(slide.blocks, d.blocks.map((item) => item.id));
        const sx = nearest([b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], xs, threshold);
        const sy = nearest([b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], ys, threshold);
        if (sx) {
          dx += sx.diff;
          lines.push({ axis: "x", pos: sx.target });
        }
        if (sy) {
          dy += sy.diff;
          lines.push({ axis: "y", pos: sy.target });
        }
      }
      setGuides(lines);
      setLive(Object.fromEntries(d.blocks.map((item) => [item.id, { x: Math.round(item.x + dx), y: Math.round(item.y + dy) }])));
    } else if (d.type === "resize") {
      const keep = (d.block.kind === "image" || d.block.kind === "icon") !== event.shiftKey;
      const g = resizeGeometry(d.block, d.handle, p, d.start, keep);
      const lines = [];
      if (!d.block.rotation && !event.altKey) {
        const [hx, hy] = HANDLES[d.handle];
        const { xs, ys } = snapTargets(slide.blocks, [d.block.id]);
        if (hx === 1) {
          const s = nearest([g.x + g.w], xs, threshold);
          if (s) {
            g.w += s.diff;
            lines.push({ axis: "x", pos: s.target });
          }
        } else if (hx === -1) {
          const s = nearest([g.x], xs, threshold);
          if (s) {
            g.x += s.diff;
            g.w -= s.diff;
            lines.push({ axis: "x", pos: s.target });
          }
        }
        if (hy === 1) {
          const s = nearest([g.y + g.h], ys, threshold);
          if (s) {
            g.h += s.diff;
            lines.push({ axis: "y", pos: s.target });
          }
        } else if (hy === -1) {
          const s = nearest([g.y], ys, threshold);
          if (s) {
            g.y += s.diff;
            g.h -= s.diff;
            lines.push({ axis: "y", pos: s.target });
          }
        }
      }
      setGuides(lines);
      setLive({ [d.block.id]: { x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.w), h: Math.round(g.h) } });
    } else if (d.type === "rotate") {
      const b = d.block;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      let angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (angle > 180) angle -= 360;
      if (event.shiftKey) angle = Math.round(angle / 15) * 15;
      else {
        const snapped = Math.round(angle / 90) * 90;
        if (Math.abs(angle - snapped) < 4) angle = snapped;
      }
      setLive({ [b.id]: { rotation: Math.round(angle) === -180 ? 180 : Math.round(angle) } });
    } else if (d.type === "marquee") {
      if (!d.captured) {
        capturePointer(stageRef.current, d.pointerId);
        d.captured = true;
      }
      setMarquee({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) });
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.type === "marquee") {
      const m = marquee;
      setMarquee(null);
      if (m && m.w > 3 && m.h > 3) {
        const hits = slide.blocks.filter((b) => !b.locked && b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y).map((b) => b.id);
        onSelect([...new Set([...d.base, ...hits])]);
      }
      return;
    }
    const changes = transientRef.current;
    setGuides([]);
    if (changes && Object.keys(changes).length) onGeometry(changes);
    setLive(null);
  }

  function onDoubleClick(event) {
    if (readOnly) return;
    const id = event.target.closest("[data-block-id]")?.dataset.blockId || lastDownId.current;
    if (!id) return;
    const block = slide.blocks.find((item) => item.id === id);
    if (!block || block.locked) return;
    if (block.kind === "text") onStartEdit(block.id);
    else onDoubleClickBlock(block);
  }

  const selectedBlocks = slide.blocks.filter((b) => selected.includes(b.id)).map(live);
  const single = selectedBlocks.length === 1 ? selectedBlocks[0] : null;
  const editing = editingId ? slide.blocks.find((b) => b.id === editingId) : null;
  const hover = hoverId && !selected.includes(hoverId) ? slide.blocks.find((b) => b.id === hoverId) : null;
  const px = (value) => value / scale;

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      onPointerDown={(event) => {
        // Clique fora do slide (na área pontilhada) tira a seleção.
        if (readOnly || stageRef.current?.contains(event.target)) return;
        if (editingId) onStopEdit();
        onSelect([]);
      }}
      onDragOver={(event) => {
        if (!readOnly && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (readOnly) return;
        event.preventDefault();
        const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
        if (files.length && stageRef.current) onDropFiles(files, toLogical(event));
      }}
    >
      <div style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, position: "relative" }} className="shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <div
          ref={stageRef}
          data-slide-stage
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHoverId(null)}
          onDoubleClick={onDoubleClick}
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0, touchAction: "none", userSelect: "none" }}
        >
          <SlideView slide={slide} deck={deck} env={env} number={number} total={total} editingId={editingId} transient={transient} />

          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {hover && !transient && (
              <div style={{ position: "absolute", left: hover.x, top: hover.y, width: hover.w, height: hover.h, transform: hover.rotation ? `rotate(${hover.rotation}deg)` : undefined, outline: `${px(1)}px solid rgba(232,105,31,0.55)` }} />
            )}
            {selectedBlocks.map((b) => (
              <div
                key={b.id}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y,
                  width: b.w,
                  height: b.h,
                  transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                  outline: `${px(1.5)}px solid #e8691f`,
                  outlineOffset: px(1),
                }}
              >
                {single && !b.locked && !readOnly && editingId !== b.id && (
                  <>
                    {Object.keys(HANDLES).map((name) => {
                      const [hx, hy] = HANDLES[name];
                      const size = px(10);
                      return (
                        <span
                          key={name}
                          data-handle={name}
                          data-blockid={b.id}
                          style={{
                            position: "absolute",
                            left: `calc(${(hx + 1) * 50}% - ${size / 2}px)`,
                            top: `calc(${(hy + 1) * 50}% - ${size / 2}px)`,
                            width: size,
                            height: size,
                            background: "#ffffff",
                            border: `${px(1.5)}px solid #e8691f`,
                            borderRadius: px(2),
                            cursor: HANDLE_CURSOR[name],
                            pointerEvents: "auto",
                          }}
                        />
                      );
                    })}
                    <span style={{ position: "absolute", left: "50%", top: -px(28), width: px(1.5), height: px(22), background: "#e8691f", transform: "translateX(-50%)" }} />
                    <span
                      data-handle="rot"
                      data-blockid={b.id}
                      title="Girar (Shift = de 15 em 15°)"
                      style={{ position: "absolute", left: `calc(50% - ${px(7)}px)`, top: -px(36), width: px(14), height: px(14), borderRadius: "50%", background: "#e8691f", border: `${px(2)}px solid #ffffff`, cursor: "grab", pointerEvents: "auto" }}
                    />
                  </>
                )}
                {b.locked && <span style={{ position: "absolute", right: px(4), top: px(4), fontSize: px(11), background: "#e8691f", color: "#fff", padding: `${px(1)}px ${px(5)}px`, borderRadius: px(4) }}>travado</span>}
              </div>
            ))}
            {guides.map((line, i) =>
              line.axis === "x" ? (
                <div key={i} style={{ position: "absolute", left: line.pos, top: 0, width: px(1), height: SLIDE_H, background: "#ec4899" }} />
              ) : (
                <div key={i} style={{ position: "absolute", top: line.pos, left: 0, height: px(1), width: SLIDE_W, background: "#ec4899" }} />
              )
            )}
            {marquee && <div style={{ position: "absolute", left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: `${px(1)}px dashed #e8691f`, background: "rgba(232,105,31,0.08)" }} />}
            {transient && single && (
              <div style={{ position: "absolute", left: single.x, top: single.y + single.h + px(8), fontSize: px(11), background: "#081d33", color: "#fff", padding: `${px(2)}px ${px(6)}px`, borderRadius: px(4), whiteSpace: "nowrap" }}>
                {single.rotation && transient[single.id]?.rotation != null ? `${single.rotation}°` : `${Math.round(single.x)}, ${Math.round(single.y)} · ${Math.round(single.w)}×${Math.round(single.h)}`}
              </div>
            )}
          </div>

          {editing && <TextEditor block={editing} deck={deck} onChange={(value) => onTextChange(editing.id, value)} onDone={onStopEdit} />}
        </div>
      </div>
    </div>
  );
}

// Escrever direto no slide: uma caixa de texto com a mesma letra, tamanho e
// cor do bloco, por cima dele.
function TextEditor({ block, deck, onChange, onDone }) {
  const ref = useRef(null);
  const theme = deck.theme;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);
  return (
    <textarea
      ref={ref}
      data-editing
      value={block.text}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDone();
        }
        event.stopPropagation();
      }}
      onBlur={onDone}
      spellCheck
      style={{
        position: "absolute",
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
        padding: block.style?.padding || 0,
        fontFamily: fontStack(block.font, theme),
        fontSize: block.size,
        fontWeight: block.weight,
        fontStyle: block.italic ? "italic" : "normal",
        textTransform: block.uppercase ? "uppercase" : "none",
        textAlign: block.align,
        lineHeight: block.lineHeight,
        letterSpacing: block.letterSpacing ? `${block.letterSpacing}px` : undefined,
        color: resolveColor(block.color, theme) || theme.colors.text,
        background: "rgba(232,105,31,0.06)",
        border: "none",
        outline: "2px dashed #e8691f",
        resize: "none",
        overflow: "hidden",
        caretColor: "#e8691f",
      }}
    />
  );
}

function ToolButton({ icon: Icon, label, onClick, disabled, title, accent = false, light = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        accent ? "bg-accent-500 text-white hover:bg-accent-600" : light ? "text-[12.5px] text-ink-700 hover:bg-surface-muted hover:text-ink-900" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {Icon && <Icon size={15} strokeWidth={1.9} />}
      {label && <span className={light || accent ? "" : "hidden xl:inline"}>{label}</span>}
      {children}
    </button>
  );
}

function Dropdown({ button, children, align = "left" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      {button(() => setOpen((value) => !value), open)}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute top-[calc(100%+6px)] z-50 min-w-56 rounded-xl bg-surface-card p-1.5 text-ink-800 shadow-xl ring-1 ring-line ${align === "right" ? "right-0" : "left-0"}`} onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, hint, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted">
      {Icon && <Icon size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-500" />}
      <span>
        <span className="block text-[13px] text-ink-800">{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
      </span>
    </button>
  );
}

export default function SlideEditor({ initial, ctx, info, readOnly, onExit, onPresent, onExport, onPeriodChange, onShare }) {
  const appState = useAppState();
  const deckRef = useRef(initial);
  const [deck, setDeckState] = useState(initial);
  const history = useRef({ past: [], future: [], key: null });
  const [, forceHistory] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [picker, setPicker] = useState(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [tab, setTab] = useState("slide");
  const [saveState, setSaveState] = useState("saved");
  const [brandLogos, setBrandLogos] = useState([]);
  const [dragSlide, setDragSlide] = useState(null);
  const [savingSlide, setSavingSlide] = useState(null); // slide sendo guardado na biblioteca
  const [libraryFlash, setLibraryFlash] = useState("");
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);

  const env = useMemo(() => ({ ctx, info, mode: "edit" }), [ctx, info]);
  const index = Math.min(slideIndex, deck.slides.length - 1);
  const slide = deck.slides[index];
  const visible = deck.slides.filter((item) => !item.hidden);
  const number = slide && !slide.hidden ? visible.indexOf(slide) + 1 : null;

  useEffect(() => {
    loadBrandLogos().then(setBrandLogos);
    loadOfficeLibrary();
  }, []);

  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!pendingSave.current) return;
    pendingSave.current = false;
    setSaveState("saving");
    try {
      await upsertPresentation(deckRef.current);
      setSaveState(pendingSave.current ? "pending" : "saved");
    } catch (error) {
      console.error("Falha ao salvar a apresentação:", error);
      setSaveState("error");
    }
  }, []);

  useEffect(() => () => flushSave(), [flushSave]);

  const scheduleSave = useCallback(() => {
    pendingSave.current = true;
    setSaveState("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 1000);
  }, [flushSave]);

  // Toda alteração passa por aqui: vira um passo de desfazer (alterações
  // seguidas no mesmo campo — arrastar um controle deslizante, digitar —
  // contam como um passo só) e agenda a gravação.
  const apply = useCallback(
    (next, key) => {
      if (readOnly) return;
      const prev = deckRef.current;
      if (next === prev) return;
      const h = history.current;
      if (!key || key !== h.key) {
        h.past.push(prev);
        if (h.past.length > 120) h.past.shift();
      }
      h.key = key || null;
      h.future = [];
      deckRef.current = next;
      setDeckState(next);
      forceHistory((value) => value + 1);
      scheduleSave();
    },
    [readOnly, scheduleSave]
  );

  const update = useCallback((fn, key) => apply(fn(deckRef.current), key), [apply]);

  function undo() {
    const h = history.current;
    if (!h.past.length) return;
    h.future.push(deckRef.current);
    const prev = h.past.pop();
    h.key = null;
    deckRef.current = prev;
    setDeckState(prev);
    forceHistory((value) => value + 1);
    setEditingId(null);
    scheduleSave();
  }

  function redo() {
    const h = history.current;
    if (!h.future.length) return;
    h.past.push(deckRef.current);
    const next = h.future.pop();
    h.key = null;
    deckRef.current = next;
    setDeckState(next);
    forceHistory((value) => value + 1);
    scheduleSave();
  }

  const updateSlide = useCallback(
    (fn, key) => {
      const current = deckRef.current;
      const i = Math.min(slideIndex, current.slides.length - 1);
      update((d) => ({ ...d, slides: d.slides.map((item, n) => (n === i ? fn(item) : item)) }), key);
    },
    [slideIndex, update]
  );

  const patchBlocks = useCallback((ids, fn, key) => updateSlide((s) => ({ ...s, blocks: s.blocks.map((b) => (ids.includes(b.id) ? fn(b) : b)) }), key), [updateSlide]);

  function addBlocks(blocks) {
    updateSlide((s) => ({ ...s, blocks: [...s.blocks, ...blocks] }));
    setSelected(blocks.map((b) => b.id));
    setTab("slide");
  }

  function centered(kind, props = {}) {
    const block = makeBlock(kind, props);
    const offset = (slide.blocks.length % 6) * 16;
    if (props.x == null) block.x = Math.round((SLIDE_W - block.w) / 2 + offset);
    if (props.y == null) block.y = Math.round((SLIDE_H - block.h) / 2 + offset);
    return block;
  }

  function insert(kind, props) {
    if (readOnly) return;
    addBlocks([centered(kind, props)]);
  }

  function removeSelected() {
    if (!selected.length) return;
    updateSlide((s) => ({ ...s, blocks: s.blocks.filter((b) => !selected.includes(b.id)) }));
    setSelected([]);
  }

  function duplicateSelected() {
    const copies = slide.blocks.filter((b) => selected.includes(b.id)).map((b) => cloneBlock(b));
    if (copies.length) addBlocks(copies);
  }

  function reorder(mode) {
    updateSlide((s) => {
      const blocks = [...s.blocks];
      const chosen = blocks.filter((b) => selected.includes(b.id));
      const rest = blocks.filter((b) => !selected.includes(b.id));
      if (mode === "front") return { ...s, blocks: [...rest, ...chosen] };
      if (mode === "back") return { ...s, blocks: [...chosen, ...rest] };
      const out = [...blocks];
      const ids = mode === "forward" ? [...selected].reverse() : selected;
      ids.forEach((id) => {
        const i = out.findIndex((b) => b.id === id);
        const j = mode === "forward" ? i + 1 : i - 1;
        if (i < 0 || j < 0 || j >= out.length) return;
        [out[i], out[j]] = [out[j], out[i]];
      });
      return { ...s, blocks: out };
    });
  }

  function alignToSlide(dir) {
    patchBlocks(selected, (b) => {
      if (dir === "left") return { ...b, x: 0 };
      if (dir === "hcenter") return { ...b, x: Math.round((SLIDE_W - b.w) / 2) };
      if (dir === "right") return { ...b, x: SLIDE_W - b.w };
      if (dir === "top") return { ...b, y: 0 };
      if (dir === "vcenter") return { ...b, y: Math.round((SLIDE_H - b.h) / 2) };
      return { ...b, y: SLIDE_H - b.h };
    });
  }

  function alignSelection(dir) {
    const chosen = slide.blocks.filter((b) => selected.includes(b.id));
    if (chosen.length < 2) return;
    const box = boundsOf(chosen);
    patchBlocks(selected, (b) => {
      if (dir === "left") return { ...b, x: box.x };
      if (dir === "hcenter") return { ...b, x: Math.round(box.x + (box.w - b.w) / 2) };
      if (dir === "right") return { ...b, x: box.x + box.w - b.w };
      if (dir === "top") return { ...b, y: box.y };
      if (dir === "vcenter") return { ...b, y: Math.round(box.y + (box.h - b.h) / 2) };
      return { ...b, y: box.y + box.h - b.h };
    });
  }

  function distribute(axis) {
    const chosen = slide.blocks.filter((b) => selected.includes(b.id));
    if (chosen.length < 3) return;
    const pos = axis === "x" ? "x" : "y";
    const size = axis === "x" ? "w" : "h";
    const sorted = [...chosen].sort((a, b) => a[pos] - b[pos]);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSize = sorted.reduce((sum, b) => sum + b[size], 0);
    const gap = (last[pos] + last[size] - first[pos] - totalSize) / (sorted.length - 1);
    const places = {};
    let cursor = first[pos];
    sorted.forEach((b) => {
      places[b.id] = Math.round(cursor);
      cursor += b[size] + gap;
    });
    patchBlocks(selected, (b) => ({ ...b, [pos]: places[b.id] }));
  }

  function matchSize(dim) {
    const first = slide.blocks.find((b) => b.id === selected[0]);
    if (!first) return;
    patchBlocks(selected, (b) => ({ ...b, [dim]: first[dim] }));
  }

  async function imageBlockFromFile(file, at) {
    try {
      const image = await compressImage(file);
      const w = Math.min(560, image.width);
      const h = Math.round((w * image.height) / image.width);
      const block = makeBlock("image", { src: image.src, w, h, x: Math.round((at?.x ?? SLIDE_W / 2) - w / 2), y: Math.round((at?.y ?? SLIDE_H / 2) - h / 2), style: { radius: 12 } });
      addBlocks([block]);
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function uploadIntoBlock(block, file) {
    if (!file) return;
    try {
      const image = await compressImage(file);
      // Bloco vazio (o quadro "escolha uma imagem"): assume a proporção da
      // foto, pra ela não sair cortada.
      const wasEmpty = !block.src && !block.brand;
      patchBlocks([block.id], (b) => ({ ...b, src: image.src, brand: "", ...(wasEmpty && b.fit === "cover" ? { h: Math.round((b.w * image.height) / image.width) } : {}) }));
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function uploadBackground(file) {
    if (!file) return;
    try {
      const image = await compressImage(file, 1920);
      updateSlide((s) => ({ ...s, bg: { ...(s.bg || {}), type: "image", image: image.src, overlay: s.bg?.overlay ?? 35, overlayColor: s.bg?.overlayColor || "#000000" } }));
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function saveLogo(src) {
    const name = window.prompt("Nome desta logo (ex.: Logo Athos oficial):", "Logo do escritório");
    if (!name) return;
    try {
      const next = await saveBrandLogos([...brandLogos, { id: `logo_${Date.now().toString(36)}`, name, src }]);
      setBrandLogos([...next]);
    } catch (error) {
      console.error(error);
      window.alert("Não consegui guardar a logo (só o admin pode).");
    }
  }

  // Slides
  function addSlide(layoutId) {
    const [created] = applyBrand([makeSlide(layoutId)], deckRef.current.brand || "athos");
    update((d) => {
      const slides = [...d.slides];
      slides.splice(index + 1, 0, created);
      return { ...d, slides };
    });
    setSlideIndex(index + 1);
    setSelected([]);
    setLayoutOpen(false);
  }

  // Slide da biblioteca do escritório: entra com ids novos e a logo/
  // assinatura da marca desta apresentação.
  function addLibrarySlide(entry) {
    const [created] = applyBrand([cloneSlide(entry.slide)], deckRef.current.brand || "athos");
    update((d) => {
      const slides = [...d.slides];
      slides.splice(index + 1, 0, created);
      return { ...d, slides };
    });
    setSlideIndex(index + 1);
    setSelected([]);
    setLayoutOpen(false);
  }

  async function removeLibrarySlide(entry) {
    if (!window.confirm(`Tirar “${entry.name}” da biblioteca do escritório? Os slides que já foram usados em apresentações continuam lá.`)) return;
    try {
      await deleteLibrarySlide(entry.id);
    } catch (error) {
      console.error(error);
      window.alert("Não consegui tirar agora — confira a conexão.");
    }
  }

  function duplicateSlide(i) {
    update((d) => {
      const slides = [...d.slides];
      slides.splice(i + 1, 0, cloneSlide(d.slides[i]));
      return { ...d, slides };
    });
    setSlideIndex(i + 1);
  }

  function deleteSlide(i) {
    if (deck.slides.length <= 1) return;
    update((d) => ({ ...d, slides: d.slides.filter((_, n) => n !== i) }));
    setSlideIndex(Math.max(0, Math.min(i, deck.slides.length - 2)));
    setSelected([]);
  }

  function moveSlide(from, to) {
    if (from === to || to < 0 || to >= deck.slides.length) return;
    update((d) => {
      const slides = [...d.slides];
      const [item] = slides.splice(from, 1);
      slides.splice(to, 0, item);
      return { ...d, slides };
    });
    setSlideIndex(to);
  }

  function goToSlide(i) {
    setSlideIndex(i);
    setSelected([]);
    setEditingId(null);
  }

  // Teclado
  useEffect(() => {
    function onKey(event) {
      if (picker || layoutOpen) return;
      if (isTyping(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (readOnly) {
        if (key === "arrowdown" || key === "pagedown") goToSlide(Math.min(deck.slides.length - 1, index + 1));
        if (key === "arrowup" || key === "pageup") goToSlide(Math.max(0, index - 1));
      } else if (mod && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (mod && key === "a") {
        event.preventDefault();
        setSelected(slide.blocks.filter((b) => !b.locked).map((b) => b.id));
      } else if (mod && (key === "c" || key === "x")) {
        const chosen = slide.blocks.filter((b) => selected.includes(b.id));
        if (!chosen.length) return;
        clipboard = chosen.map((b) => structuredClone(b));
        if (key === "x") removeSelected();
      } else if ((key === "delete" || key === "backspace") && selected.length) {
        event.preventDefault();
        removeSelected();
      } else if (key === "escape") {
        setSelected([]);
      } else if (key.startsWith("arrow") && selected.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        patchBlocks(selected, (b) => (b.locked ? b : { ...b, x: b.x + dx, y: b.y + dy }), "nudge");
      } else if (!selected.length && (key === "pagedown" || key === "arrowdown")) {
        goToSlide(Math.min(deck.slides.length - 1, index + 1));
      } else if (!selected.length && (key === "pageup" || key === "arrowup")) {
        goToSlide(Math.max(0, index - 1));
      }
    }
    function onPaste(event) {
      if (readOnly || picker || layoutOpen || isTyping(event.target)) return;
      const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (files.length) {
        event.preventDefault();
        files.forEach((file) => imageBlockFromFile(file));
        return;
      }
      if (clipboard.length) {
        event.preventDefault();
        addBlocks(clipboard.map((b) => cloneBlock(b, 20)));
        clipboard = clipboard.map((b) => ({ ...b, x: b.x + 20, y: b.y + 20 }));
        return;
      }
      const text = event.clipboardData?.getData("text/plain");
      if (text) {
        event.preventDefault();
        insert("text", { text: text.slice(0, 2000), w: 640, h: 160 });
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  });

  function handlePick(id) {
    const p = picker;
    setPicker(null);
    if (!p) return;
    if (p.mode === "insert") {
      if (p.type === "kpi") insert("kpi", { widgetId: id });
      else if (p.type === "widget") insert("widget", { widgetId: id });
      else if (p.type === "icon") insert("icon", { icon: id });
      return;
    }
    if (p.type === "icon") patchBlocks([p.blockId], (b) => ({ ...b, icon: id }));
    else patchBlocks([p.blockId], (b) => ({ ...b, widgetId: id }));
  }

  if (!slide) return null;
  const selectedBlocks = slide.blocks.filter((b) => selected.includes(b.id));
  const single = selectedBlocks.length === 1 ? selectedBlocks[0] : null;

  const blockActions = {
    duplicate: duplicateSelected,
    remove: removeSelected,
    front: () => reorder("front"),
    back: () => reorder("back"),
    forward: () => reorder("forward"),
    backward: () => reorder("backward"),
    alignToSlide,
    align: alignSelection,
    distribute,
    matchSize,
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface-page">
      {/* Barra de cima */}
      <div className="flex h-14 shrink-0 items-center gap-2 bg-navy-950 px-3 text-white">
        <button type="button" onClick={async () => { await flushSave(); onExit(); }} title="Voltar às apresentações" className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="flex min-w-0 flex-col">
          <input
            value={deck.name}
            disabled={readOnly}
            onChange={(event) => update((d) => ({ ...d, name: event.target.value }), "name")}
            className="w-56 rounded bg-transparent px-1 text-[14px] font-semibold text-white outline-none hover:bg-white/5 focus:bg-white/10"
          />
          <span className="flex items-center gap-1 px-1 text-[10.5px] text-white/45">
            {readOnly ? (
              "Só visualização"
            ) : saveState === "saving" || saveState === "pending" ? (
              <>
                <Loader2 size={10} className="animate-spin" /> Salvando…
              </>
            ) : saveState === "error" ? (
              <span className="flex items-center gap-1 text-warning-500">
                <TriangleAlert size={10} /> Não salvou — <button type="button" className="underline" onClick={() => { pendingSave.current = true; flushSave(); }}>tentar de novo</button>
              </span>
            ) : (
              <>
                <Check size={10} /> Salvo
              </>
            )}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-1">
          {!readOnly && (
            <>
              <ToolButton icon={Undo2} title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!history.current.past.length} />
              <ToolButton icon={Redo2} title="Refazer (Ctrl+Y)" onClick={redo} disabled={!history.current.future.length} />
            </>
          )}
          <div className="mx-1 hidden lg:block">
            <PeriodPicker label="Dados de" start={appState.periodStart} end={appState.periodEnd} onChange={(start, end) => onPeriodChange(start, end, readOnly ? null : (period) => update((d) => ({ ...d, period })))} />
          </div>
          <Dropdown
            align="right"
            button={(toggle) => (
              <ToolButton icon={Download} label="Baixar" onClick={toggle}>
                <ChevronDown size={12} className="text-white/50" />
              </ToolButton>
            )}
          >
            <MenuItem icon={FileText} label="PDF da apresentação" hint="Todos os slides (menos os marcados pra pular)" onClick={async () => { await flushSave(); onExport(deckRef.current, null); }} />
            <MenuItem icon={Presentation} label="PowerPoint (.pptx)" hint="Textos editáveis; gráficos e quadros como imagem" onClick={async () => { await flushSave(); onExport(deckRef.current, null, "pptx"); }} />
            <MenuItem icon={FileImage} label="Imagem deste slide (PNG)" hint="Pra mandar no WhatsApp ou e-mail" onClick={() => onExport(deckRef.current, index)} />
          </Dropdown>
          {onShare && !readOnly && <ToolButton icon={Link2} label="Compartilhar" title="Enviar por link (sem login, com validade e senha opcional)" onClick={async () => { await flushSave(); onShare(deckRef.current); }} />}
          <ToolButton icon={Play} label="Apresentar" accent onClick={async () => { await flushSave(); onPresent(deckRef.current, Math.max(0, number ? number - 1 : 0)); }} />
        </div>
      </div>

      {!readOnly && (
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-surface-card px-3 py-1.5">
          <span className="mr-2 shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Inserir</span>
          <ToolButton light icon={Heading} label="Título" onClick={() => insert("text", { text: "Título", font: "@heading", size: 44, weight: 700, w: 720, h: 70 })} />
          <ToolButton light icon={Type} label="Texto" onClick={() => insert("text", { text: "Escreva aqui", w: 520, h: 110 })} />
          <ToolButton light icon={Hash} label="Número" title="Número do B.I. (receita, lucro, margem…)" onClick={() => setPicker({ type: "kpi", mode: "insert" })} />
          <ToolButton light icon={BarChart3} label="Gráfico B.I." title="Gráfico ou tabela do B.I. (DRE, balanço, DFC…)" onClick={() => setPicker({ type: "widget", mode: "insert" })} />
          <ToolButton light icon={Sheet} label="Demonstrativo" title="DRE, Balanço ou DFC sob medida: escolha o que cada linha mostra" onClick={() => insert("demo", { x: 64, y: 120 })} />
          <ToolButton light icon={ChartColumnBig} label="Gráfico próprio" title="Gráfico com dados que você digita ou cola do Excel" onClick={() => insert("chart")} />
          <ToolButton light icon={Table2} label="Tabela" onClick={() => insert("table")} />
          <ToolButton light icon={Gauge} label="Meta" onClick={() => insert("meta")} />
          <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted hover:text-ink-900" title="Imagem do computador">
            <ImagePlus size={15} strokeWidth={1.9} />
            <span>Imagem</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) imageBlockFromFile(file);
              }}
            />
          </label>
          <Dropdown
            button={(toggle) => (
              <ToolButton light icon={Shapes} label="Forma" onClick={toggle}>
                <ChevronDown size={12} className="text-ink-400" />
              </ToolButton>
            )}
          >
            <div className="grid grid-cols-5 gap-1 p-1">
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  title={shape.label}
                  onClick={() => insert("shape", shape.id === "line" ? { shape: "line", w: 400, h: 20, style: { fill: "@accent", borderWidth: 4 } } : { shape: shape.id })}
                  className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-muted"
                >
                  {shape.points ? (
                    <svg viewBox="0 0 100 100" className="h-6 w-6">
                      <polygon points={shape.points} className="fill-accent-500" />
                    </svg>
                  ) : (
                    <span className={`bg-accent-500 ${shape.id === "ellipse" ? "h-6 w-6 rounded-full" : shape.id === "line" ? "h-1 w-7 rounded" : "h-5 w-7 rounded-sm"}`} />
                  )}
                </button>
              ))}
            </div>
          </Dropdown>
          <ToolButton light icon={Smile} label="Ícone" onClick={() => setPicker({ type: "icon", mode: "insert" })} />
          <Dropdown
            button={(toggle) => (
              <ToolButton light icon={CircleDot} label="Logo" title="Logo da Athos ou da Contac (muda sozinha entre clara e escura)" onClick={toggle}>
                <ChevronDown size={12} className="text-ink-400" />
              </ToolButton>
            )}
          >
            {BRANDS.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => insert("image", { brand: brand.id, w: Math.round(50 * brand.ratio), h: 50, x: 64, y: 40, fit: "contain", style: { radius: 0 } })}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted"
              >
                <span className="flex h-9 w-36 items-center justify-center rounded-md bg-white ring-1 ring-line">
                  <img src={brandLogoFor(brand.id, false).src} alt="" className="h-6" />
                </span>
                <span className="text-[13px] text-ink-800">{brand.name}</span>
              </button>
            ))}
          </Dropdown>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Slides */}
        <aside className="flex w-[218px] shrink-0 select-none flex-col border-r border-line bg-surface-card">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {deck.slides.map((item, i) => {
              const n = item.hidden ? null : visible.indexOf(item) + 1;
              return (
                <div
                  key={item.id}
                  draggable={!readOnly}
                  onDragStart={() => setDragSlide(i)}
                  onDragOver={(event) => {
                    if (dragSlide != null) event.preventDefault();
                  }}
                  onDrop={() => {
                    if (dragSlide != null) moveSlide(dragSlide, i);
                    setDragSlide(null);
                  }}
                  onDragEnd={() => setDragSlide(null)}
                  className={`group relative mb-3 flex gap-2 ${dragSlide === i ? "opacity-40" : ""}`}
                >
                  <span className="w-4 shrink-0 pt-1 text-right text-[11px] tabular-nums text-ink-400">{i + 1}</span>
                  <button type="button" onClick={() => goToSlide(i)} className={`relative overflow-hidden rounded-md transition-all ${i === index ? "ring-2 ring-accent-500 ring-offset-2" : "ring-1 ring-line hover:ring-accent-300"} ${item.hidden ? "opacity-45" : ""}`}>
                    <SlideThumb slide={item} deck={deck} env={env} width={168} number={n} total={visible.length} />
                    {item.hidden && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white"><EyeOff size={18} /></span>}
                  </button>
                  {!readOnly && (
                    <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                      <SlideAction title="Duplicar" onClick={() => duplicateSlide(i)} icon={Copy} />
                      <SlideAction title="Guardar na biblioteca do escritório" onClick={() => setSavingSlide(item)} icon={BookmarkPlus} />
                      <SlideAction title={item.hidden ? "Mostrar" : "Pular na apresentação"} onClick={() => update((d) => ({ ...d, slides: d.slides.map((s, n2) => (n2 === i ? { ...s, hidden: !s.hidden } : s)) }))} icon={item.hidden ? Eye : EyeOff} />
                      {deck.slides.length > 1 && <SlideAction title="Apagar slide" onClick={() => deleteSlide(i)} icon={Trash2} danger />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!readOnly && (
            <div className="border-t border-line p-3">
              <button type="button" onClick={() => setLayoutOpen(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent-500 text-[13px] font-medium text-white hover:bg-accent-600">
                <Plus size={16} /> Novo slide
              </button>
            </div>
          )}
        </aside>

        {/* Palco */}
        <main className="relative min-w-0 flex-1 bg-[radial-gradient(circle,rgba(100,116,139,0.18)_1px,transparent_1px)] bg-[length:18px_18px]">
          <Canvas
            slide={slide}
            deck={deck}
            env={env}
            selected={selected}
            onSelect={(ids) => {
              setSelected(ids);
              if (ids.length) setTab("slide");
            }}
            onGeometry={(changes) => patchBlocks(Object.keys(changes), (b) => ({ ...b, ...changes[b.id] }))}
            editingId={editingId}
            onStartEdit={(id) => {
              setSelected([id]);
              setEditingId(id);
            }}
            onStopEdit={() => setEditingId(null)}
            onTextChange={(id, text) => patchBlocks([id], (b) => ({ ...b, text }), `text:${id}`)}
            onDoubleClickBlock={(block) => {
              if (block.kind === "kpi") setPicker({ type: "kpi", mode: "replace", blockId: block.id });
              else if (block.kind === "widget") setPicker({ type: "widget", mode: "replace", blockId: block.id });
              else if (block.kind === "icon") setPicker({ type: "icon", mode: "replace", blockId: block.id });
            }}
            onDropFiles={(files, at) => files.forEach((file) => imageBlockFromFile(file, at))}
            readOnly={readOnly}
            number={number}
            total={visible.length}
          />
          {!readOnly && (
            <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-ink-400">
              Arraste pra mover · alças pra redimensionar · bolinha de cima pra girar · duplo clique pra editar · Shift seleciona vários · Alt solta do alinhamento
            </p>
          )}
        </main>

        {/* Propriedades */}
        {!readOnly && (
          <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-surface-card">
            {!selectedBlocks.length && (
              <div className="flex shrink-0 border-b border-line p-1.5">
                {[
                  { id: "slide", label: "Slide", icon: FileText },
                  { id: "tema", label: "Tema e rodapé", icon: Palette },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium ${tab === item.id ? "bg-accent-50 text-accent-700" : "text-ink-500 hover:text-ink-800"}`}>
                    <item.icon size={13} /> {item.label}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {single ? (
                <BlockInspector
                  key={single.id}
                  block={single}
                  deck={deck}
                  ctx={ctx}
                  set={(patch, key) => patchBlocks([single.id], (b) => ({ ...b, ...patch }), key ? `${single.id}:${key}` : null)}
                  setStyle={(patch, key) => patchBlocks([single.id], (b) => ({ ...b, style: { ...b.style, ...patch } }), key ? `${single.id}:style:${key}` : null)}
                  actions={blockActions}
                  openPicker={(type) => setPicker({ type: type === "meta" ? "kpi" : type, mode: "replace", blockId: single.id })}
                  onUploadImage={(file) => uploadIntoBlock(single, file)}
                  brandLogos={brandLogos}
                  canSaveLogo={appState.isAdmin}
                  onSaveLogo={() => saveLogo(single.src)}
                />
              ) : selectedBlocks.length > 1 ? (
                <MultiInspector count={selectedBlocks.length} actions={blockActions} />
              ) : tab === "tema" ? (
                <ThemeInspector deck={deck} setDeck={(patch, key) => update((d) => ({ ...d, ...patch }), key ? `deck:${key}` : null)} brandLogos={brandLogos} />
              ) : (
                <SlideInspector
                  slide={slide}
                  deck={deck}
                  setSlide={(patch, key) => updateSlide((s) => ({ ...s, ...patch }), key ? `${slide.id}:${key}` : null)}
                  onUploadBg={uploadBackground}
                  onApplyBgAll={() => update((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, bg: structuredClone(slide.bg || { type: "theme" }) })) }))}
                  onSelectBlock={(id) => setSelected([id])}
                  onToggleBlock={(id, field) => patchBlocks([id], (b) => ({ ...b, [field]: !b[field] }))}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {picker && picker.type === "icon" && <IconPicker value={single?.icon} onPick={handlePick} onClose={() => setPicker(null)} />}
      {picker && picker.type !== "icon" && <WidgetPicker kind={picker.type} ctx={ctx} onPick={handlePick} onClose={() => setPicker(null)} />}
      {layoutOpen && (
        <LayoutPicker
          deck={deck}
          env={env}
          onPick={addSlide}
          onClose={() => setLayoutOpen(false)}
          library={appState.slideLibrary || []}
          onPickLibrary={addLibrarySlide}
          onDeleteLibrary={removeLibrarySlide}
        />
      )}
      {savingSlide && (
        <SaveSlideModal
          slide={savingSlide}
          deck={deck}
          env={env}
          defaultName={suggestSlideName(savingSlide)}
          onClose={() => setSavingSlide(null)}
          onSave={async ({ name, brand }) => {
            await saveSlideToLibrary({ name, brand, slide: savingSlide, theme: deck.theme });
            setSavingSlide(null);
            setLibraryFlash(`“${name}” guardado na biblioteca do escritório.`);
            setTimeout(() => setLibraryFlash(""), 4000);
          }}
        />
      )}
      {libraryFlash && <div className="biblioteca-flash fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-navy-900 px-4 py-2 text-[13px] font-medium text-white shadow-lg">{libraryFlash}</div>}
    </div>
  );
}

function SlideAction({ icon: Icon, title, onClick, danger }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`flex h-6 w-6 items-center justify-center rounded bg-surface-card/95 shadow ring-1 ring-line ${danger ? "text-danger-600" : "text-ink-600 hover:text-accent-600"}`}>
      <Icon size={12} />
    </button>
  );
}
