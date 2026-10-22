import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, Download, MoreHorizontal, Pencil, Play, Plus, Presentation, Trash2 } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { buildDashboardContext } from "../lib/dashboardData.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { DECK_TEMPLATES, THEMES, deletePresentation, duplicatePresentation, fontStack, makePresentation, themeById, tokenInfo, upsertPresentation } from "../lib/presentations.js";
import SlideEditor from "../components/slides/SlideEditor.jsx";
import PresentMode, { SlidesExporter, visibleSlides } from "../components/slides/PresentMode.jsx";
import { Modal, SlideThumb } from "../components/slides/pickers.jsx";
import "../lib/slideFonts.js";
import { BRANDS, brandLogoFor } from "../lib/brand.js";

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function NewDeckModal({ onCreate, onClose, env }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("resultados");
  const [themeId, setThemeId] = useState("athos-premium");
  const [brand, setBrand] = useState("athos");
  const preview = useMemo(() => makePresentation({ templateId, themeId, brand }), [templateId, themeId, brand]);
  return (
    <Modal title="Nova apresentação" subtitle="Escolha um modelo e um tema — depois dá pra mudar absolutamente tudo." onClose={onClose} width="max-w-5xl">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-600">Nome</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={DECK_TEMPLATES.find((t) => t.id === templateId)?.label} className="h-10 rounded-lg border border-line bg-surface-card px-3 text-[14px] outline-none focus:border-accent-400" />
          </label>
          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-600">Marca</p>
            <div className="grid grid-cols-2 gap-2">
              {BRANDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setBrand(item.id);
                    setThemeId(item.themeId);
                  }}
                  className={`flex h-16 items-center justify-center rounded-xl border bg-white px-4 transition-colors ${brand === item.id ? "border-accent-500 ring-1 ring-accent-500" : "border-line hover:border-accent-300"}`}
                  title={`Logo e assinatura da ${item.name} nos slides`}
                >
                  <img src={brandLogoFor(item.id, false).src} alt={item.name} className="h-8" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-600">Modelo</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {DECK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${templateId === template.id ? "border-accent-500 bg-accent-50" : "border-line hover:border-accent-300"}`}
                >
                  <span className="block text-[13px] font-semibold text-ink-900">{template.label}</span>
                  <span className="mt-1 block text-[11.5px] leading-snug text-ink-500">{template.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-600">Tema</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {THEMES.map((theme) => (
                <button key={theme.id} type="button" onClick={() => setThemeId(theme.id)} className={`overflow-hidden rounded-lg text-left ring-1 transition-all ${themeId === theme.id ? "ring-2 ring-accent-500" : "ring-line hover:ring-accent-300"}`}>
                  <span className="relative block h-12" style={{ background: theme.colors.bg }}>
                    <span className="absolute left-2 top-1.5 text-[13px] font-bold" style={{ color: theme.colors.text, fontFamily: fontStack(theme.headingFont, theme) }}>
                      Aa
                    </span>
                    <span className="absolute bottom-1.5 left-2 flex gap-1">
                      {["accent", "accent2", "accent3"].map((key) => (
                        <span key={key} className="h-2.5 w-2.5 rounded-full" style={{ background: theme.colors[key] }} />
                      ))}
                    </span>
                  </span>
                  <span className="block px-2 py-1 text-[11px] font-medium text-ink-700">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-medium text-ink-600">Prévia ({preview.slides.length} slides)</p>
          <div className="grid grid-cols-2 gap-2">
            {preview.slides.slice(0, 6).map((slide, i) => (
              <span key={slide.id} className="overflow-hidden rounded-md ring-1 ring-line">
                <SlideThumb slide={slide} deck={preview} env={env} width={184} number={i + 1} total={preview.slides.length} />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onCreate({ ...preview, name: name.trim() || preview.name, theme: themeById(themeId) })}
            className="mt-auto flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-500 text-[14px] font-semibold text-white hover:bg-accent-600"
          >
            <Plus size={16} /> Criar e editar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeckMenu({ onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-800" title="Mais">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-44 rounded-lg bg-surface-card p-1 shadow-lg ring-1 ring-line" onClick={() => setOpen(false)}>
            <button type="button" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">
              <Copy size={14} /> Duplicar
            </button>
            <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-danger-600 hover:bg-danger-50">
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Apresentacoes() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const [creating, setCreating] = useState(false);
  const [presenting, setPresenting] = useState(null); // { deck, index }
  const [exporting, setExporting] = useState(null); // { deck, only }
  const [error, setError] = useState("");
  const periodApplied = useRef(null);

  const hasData = state.accounts.length > 0 || state.journal.length > 0;
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;
  const canEdit = Boolean(
    state.isAdmin || (company && (company.responsaveis || []).includes(state.userEmail)) || (state.activeGroupId && isResponsavelForGroup(state, state.activeGroupId))
  );
  const decks = state.presentations || [];
  const deck = deckId ? decks.find((item) => item.id === deckId) || null : null;

  const ctx = useMemo(() => {
    if (!hasData) return null;
    return buildDashboardContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, state.mappings, state.accounts, state.journal, state.periodStart, state.periodEnd, state.indicatorOverrides]);
  const info = tokenInfo();
  const infoKey = `${info.empresa}|${info.cnpj}|${info.start}|${info.end}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableInfo = useMemo(() => info, [infoKey]);
  const env = useMemo(() => ({ ctx, info: stableInfo, mode: "edit" }), [ctx, stableInfo]);

  // A apresentação lembra o período dos dados dela: ao abrir, o app passa
  // pra esse período (uma vez por abertura).
  useEffect(() => {
    if (!deck?.period || periodApplied.current === deck.id) return;
    periodApplied.current = deck.id;
    const { start, end } = deck.period;
    if (start && end && (start !== state.periodStart || end !== state.periodEnd)) setData({ periodStart: start, periodEnd: end });
  }, [deck, state.periodStart, state.periodEnd]);

  const onPeriodChange = useCallback((start, end, saveIntoDeck) => {
    setData({ periodStart: start, periodEnd: end });
    saveIntoDeck?.({ start, end });
  }, []);

  async function create(newDeck) {
    setCreating(false);
    try {
      await upsertPresentation(newDeck);
    } catch (err) {
      console.error(err);
      setError("A apresentação foi criada, mas não consegui salvar agora. Ela fica aberta — confira a conexão.");
    }
    navigate(`/empresa/apresentacoes/${newDeck.id}`);
  }

  const overlays = (
    <>
      {presenting && <PresentMode deck={presenting.deck} env={env} startIndex={presenting.index} onClose={() => setPresenting(null)} />}
      {exporting && <SlidesExporter deck={exporting.deck} env={env} only={exporting.only} onDone={() => setExporting(null)} />}
    </>
  );

  if (deckId) {
    if (!deck) {
      return (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-[14px] text-ink-600">Essa apresentação não existe mais (ou é de outra empresa).</p>
          <button type="button" onClick={() => navigate("/empresa/apresentacoes")} className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            Ver apresentações
          </button>
        </div>
      );
    }
    return (
      <>
        <SlideEditor
          key={deck.id}
          initial={deck}
          ctx={ctx}
          info={stableInfo}
          readOnly={!canEdit}
          onExit={() => navigate("/empresa/apresentacoes")}
          onPresent={(current, index) => setPresenting({ deck: current, index })}
          onExport={(current, only) => setExporting({ deck: current, only })}
          onPeriodChange={onPeriodChange}
        />
        {overlays}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold text-ink-900">
            <Presentation size={22} className="text-accent-500" /> Apresentações
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">Slides com os números {state.activeGroupId ? "do grupo" : "da empresa"} — monte do seu jeito, apresente em tela cheia e baixe em PDF.</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-600">
            <Plus size={16} /> Nova apresentação
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-[13px] text-warning-700">{error}</p>}

      {decks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
            <Presentation size={30} strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-ink-900">Nenhuma apresentação ainda</p>
            <p className="mt-1 max-w-md text-[13px] text-ink-500">
              Comece por um modelo pronto (reunião de resultados, resumo executivo) com a logo e as cores da Athos ou da Contac, e personalize cada detalhe.
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600">
              <Plus size={16} /> Criar a primeira
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[...decks]
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
            .map((item) => {
              const shown = visibleSlides(item);
              return (
                <div key={item.id} className="group flex flex-col overflow-hidden rounded-2xl bg-surface-card shadow-sm ring-1 ring-line transition-shadow hover:shadow-md">
                  <button type="button" onClick={() => navigate(`/empresa/apresentacoes/${item.id}`)} className="relative block overflow-hidden bg-surface-muted">
                    <span className="block transition-transform duration-300 group-hover:scale-[1.02]">
                      <SlideThumb slide={item.slides[0]} deck={item} env={env} width={440} number={1} total={shown.length} />
                    </span>
                  </button>
                  <div className="flex items-start justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink-900">{item.name}</p>
                      <p className="text-[11.5px] text-ink-400">
                        {item.slides.length} slide{item.slides.length === 1 ? "" : "s"} · atualizada em {formatWhen(item.updatedAt)}
                      </p>
                    </div>
                    {canEdit && (
                      <DeckMenu
                        onDuplicate={() => duplicatePresentation(item.id)?.id && setError("")}
                        onDelete={() => {
                          if (window.confirm(`Excluir a apresentação "${item.name}"? Não dá pra desfazer.`)) deletePresentation(item.id).catch((err) => setError(err.message));
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-auto grid grid-cols-3 gap-1 border-t border-line p-2">
                    <button type="button" onClick={() => navigate(`/empresa/apresentacoes/${item.id}`)} className="flex h-9 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted">
                      <Pencil size={14} /> {canEdit ? "Editar" : "Abrir"}
                    </button>
                    <button type="button" onClick={() => setPresenting({ deck: item, index: 0 })} className="flex h-9 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium text-accent-600 hover:bg-accent-50">
                      <Play size={14} /> Apresentar
                    </button>
                    <button type="button" onClick={() => setExporting({ deck: item, only: null })} className="flex h-9 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted">
                      <Download size={14} /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {creating && <NewDeckModal env={env} onCreate={create} onClose={() => setCreating(false)} />}
      {overlays}
    </div>
  );
}
