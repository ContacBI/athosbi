import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bookmark, Building2, Copy, Download, LayoutTemplate, MoreHorizontal, Pencil, Play, Plus, Presentation, Search, Sparkles, Trash2, X } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { sharedDashboardContext } from "../lib/dashboardData.js";
import { companiesResponsavel, groupsResponsavel, isResponsavelForGroup } from "../lib/colaboradores.js";
import { DECK_TEMPLATES, THEMES, deckCopyForOtherWorkspace, deletePresentation, duplicatePresentation, fontStack, makePresentation, themeById, tokenInfo, upsertPresentation } from "../lib/presentations.js";
import { addPresentationToCompanies } from "../lib/companies.js";
import { addPresentationToGroups } from "../lib/groups.js";
import { loadOfficeLibrary } from "../lib/officeLibrary.js";
import SlideEditor from "../components/slides/SlideEditor.jsx";
import AssistantBuilder from "../components/slides/AssistantBuilder.jsx";
import PresentMode, { SlidesExporter, visibleSlides } from "../components/slides/PresentMode.jsx";
import { Modal, SlideThumb } from "../components/slides/pickers.jsx";
import "../lib/slideFonts.js";
import { BRANDS, brandLogoFor } from "../lib/brand.js";

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function NewDeckModal({ onCreate, onClose, env, initialFavorite = null, autoCreate = false }) {
  const [mode, setMode] = useState("contexto");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("resultados");
  const [themeId, setThemeId] = useState(() => initialFavorite?.themeId || BRANDS.find((item) => item.id === initialFavorite?.brand)?.themeId || "athos-premium");
  const [brand, setBrand] = useState(initialFavorite?.brand || "athos");
  const preview = useMemo(() => makePresentation({ templateId, themeId, brand }), [templateId, themeId, brand]);

  const nameField = (placeholder) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-600">Nome</span>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} className="h-10 rounded-lg border border-line bg-surface-card px-3 text-[14px] outline-none focus:border-accent-400" />
    </label>
  );
  const brandField = (
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
  );
  const themeField = (
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
  );

  const tabs = (
    <div className="flex gap-1 border-b border-line px-6 pt-3">
      {[
        { id: "contexto", label: "Montar pelo contexto", icon: Sparkles },
        { id: "modelos", label: "Modelos prontos", icon: LayoutTemplate },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setMode(tab.id)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold transition-colors ${mode === tab.id ? "border-accent-500 text-accent-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}
        >
          <tab.icon size={15} /> {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      title="Nova apresentação"
      subtitle={mode === "contexto" ? "Escreva (ou fale) o que precisa — o assistente lê os números e monta os slides com a marca e o tema escolhidos." : "Escolha um modelo e um tema — depois dá pra mudar absolutamente tudo."}
      onClose={onClose}
      width={mode === "contexto" ? "max-w-6xl" : "max-w-5xl"}
    >
      {tabs}
      {mode === "contexto" ? (
        <AssistantBuilder
          env={env}
          brand={brand}
          themeId={themeId}
          name={name}
          onBrand={(id) => {
            setBrand(id);
            setThemeId(BRANDS.find((item) => item.id === id)?.themeId || themeId);
          }}
          onTheme={(id) => THEMES.some((theme) => theme.id === id) && setThemeId(id)}
          initialFavorite={initialFavorite}
          autoCreate={autoCreate}
          shared={
            <div className="flex flex-col gap-5 rounded-xl border border-line p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {nameField("O assistente sugere um nome")}
                {brandField}
              </div>
              {themeField}
            </div>
          }
          onCreate={(deck) => onCreate({ ...deck, theme: themeById(themeId) })}
        />
      ) : (
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-5">
            {nameField(DECK_TEMPLATES.find((t) => t.id === templateId)?.label)}
            {brandField}
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
            {themeField}
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
      )}
    </Modal>
  );
}

// "Copiar para outras empresas": a apresentação (slides, tema, marca)
// entra como uma nova em cada empresa/grupo marcado — os números e
// gráficos passam a ser os de lá. Só aparecem as empresas que a pessoa
// pode editar (admin vê a carteira toda).
function CopyDeckModal({ deck, targets, onClose, onDone }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = targets.filter((item) => !term || `${item.name} ${item.cnpj || ""} ${item.codigo || ""}`.toLowerCase().includes(term));
  const sections = [
    { label: "Empresas", items: shown.filter((item) => item.kind === "empresa") },
    { label: "Grupos", items: shown.filter((item) => item.kind === "grupo") },
  ].filter((section) => section.items.length);
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = shown.length > 0 && shown.every((item) => selected.has(item.id));
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      shown.forEach((item) => (allShown ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  }
  function apply() {
    const chosen = targets.filter((item) => selected.has(item.id));
    if (!chosen.length) return;
    const make = () => deckCopyForOtherWorkspace(deck);
    const companies = addPresentationToCompanies(make, chosen.filter((item) => item.kind === "empresa").map((item) => item.id));
    const groups = addPresentationToGroups(make, chosen.filter((item) => item.kind === "grupo").map((item) => item.id));
    onDone(companies + groups);
  }
  return (
    <Modal title="Copiar para outras empresas" subtitle={`“${deck.name}” entra como uma apresentação nova em cada empresa marcada, com os números de lá.`} onClose={onClose} width="max-w-lg">
      <div className="flex max-h-[60vh] flex-col">
        <div className="flex items-center gap-2 border-b border-line px-6 py-3">
          <label className="relative flex flex-1 items-center">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa…" className="h-9 w-full rounded-lg border border-line bg-surface-page pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
          </label>
          <button type="button" onClick={toggleAll} disabled={!shown.length} className="h-9 rounded-lg px-2.5 text-[12px] font-medium text-accent-600 hover:bg-accent-50 disabled:opacity-40">
            {allShown ? "Desmarcar" : "Marcar"} {term ? "os achados" : "todas"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {!targets.length && <p className="text-[13px] text-ink-400">Não há outra empresa que você possa editar.</p>}
          {targets.length > 0 && !shown.length && <p className="text-[13px] text-ink-400">Nenhuma empresa com “{search}”.</p>}
          {sections.map((section) => (
            <div key={section.label} className="mb-3">
              {sections.length > 1 && <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{section.label}</p>}
              {section.items.map((item) => (
                <label key={item.id} className={`copy-deck-alvo flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${selected.has(item.id) ? "bg-accent-50" : "hover:bg-surface-muted"}`}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4" />
                  <span className="truncate text-[13px] text-ink-700">{item.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button type="button" onClick={apply} disabled={!selected.size} className="copy-deck-aplicar h-9 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-40">
            Copiar{selected.size ? ` para ${selected.size}` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeckMenu({ onDuplicate, onDelete, onCopyOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-800" title="Mais">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-56 rounded-lg bg-surface-card p-1 shadow-lg ring-1 ring-line" onClick={() => setOpen(false)}>
            <button type="button" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">
              <Copy size={14} /> Duplicar
            </button>
            {onCopyOut && (
              <button type="button" onClick={onCopyOut} className="deck-copiar-para flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted">
                <Building2 size={14} /> Copiar para outras empresas
              </button>
            )}
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
  // "?apresentar=1" (vindo do resumo no celular): abre direto no modo
  // apresentação; "&voltar=celular" faz o fechar voltar pro resumo.
  const [searchParams] = useSearchParams();
  const autoPresent = searchParams.get("apresentar") === "1";
  const backTo = searchParams.get("voltar") === "celular" ? "/empresa/celular" : null;
  const autoPresented = useRef(false);
  const state = useAppState();
  const [creating, setCreating] = useState(false); // true, ou { favorite, auto } vindo de um pedido salvo
  const [copying, setCopying] = useState(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [flash, setFlash] = useState("");
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
  const favorites = [...(state.assistantFavorites || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  useEffect(() => {
    loadOfficeLibrary();
  }, []);
  // Pra onde dá pra copiar uma apresentação: o que a pessoa edita (admin:
  // a carteira toda), menos a própria empresa/grupo aberto.
  const copyTargets = [
    ...(state.isAdmin ? state.companies : companiesResponsavel(state)).filter((company) => state.activeGroupId || company.id !== state.activeCompanyId).map((company) => ({ ...company, kind: "empresa" })),
    ...(state.isAdmin ? state.groups : groupsResponsavel(state)).filter((group) => group.id !== state.activeGroupId).map((group) => ({ ...group, kind: "grupo" })),
  ].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  const deck = deckId ? decks.find((item) => item.id === deckId) || null : null;

  const ctx = useMemo(() => {
    if (!hasData) return null;
    return sharedDashboardContext();
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

  useEffect(() => {
    if (!autoPresent || !deck || autoPresented.current) return;
    autoPresented.current = true;
    setPresenting({ deck, index: 0 });
  }, [autoPresent, deck]);

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
      {presenting && (
        <PresentMode
          deck={presenting.deck}
          env={env}
          startIndex={presenting.index}
          onClose={() => {
            setPresenting(null);
            if (autoPresent && backTo) navigate(backTo);
          }}
        />
      )}
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
          <div className="flex items-center gap-2">
            {favorites.length > 0 && (
              <div className="relative">
                <button type="button" onClick={() => setFavoritesOpen((value) => !value)} className="pedidos-salvos flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface-card px-3.5 text-[13px] font-medium text-ink-700 hover:border-accent-300">
                  <Bookmark size={15} className="text-accent-500" /> Pedidos salvos
                </button>
                {favoritesOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setFavoritesOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-80 rounded-xl bg-surface-card p-1.5 shadow-lg ring-1 ring-line">
                      <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] text-ink-400">Gera a apresentação desta empresa com um clique.</p>
                      {favorites.map((favorite) => (
                        <button
                          key={favorite.id}
                          type="button"
                          onClick={() => {
                            setFavoritesOpen(false);
                            setCreating({ favorite, auto: true });
                          }}
                          className="pedido-salvo-gerar flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted"
                          title={favorite.text}
                        >
                          <Play size={13} className="shrink-0 text-accent-500" fill="currentColor" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-ink-800">{favorite.name}</span>
                            <span className="block truncate text-[11px] text-ink-400">{favorite.text}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-600">
              <Plus size={16} /> Nova apresentação
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-[13px] text-warning-700">{error}</p>}
      {flash && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-success-50 px-4 py-2.5 text-[13px] text-success-600">
          {flash}
          <button type="button" onClick={() => setFlash("")} aria-label="Fechar">
            <X size={14} />
          </button>
        </p>
      )}

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
                        onCopyOut={() => setCopying(item)}
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

      {creating && <NewDeckModal env={env} onCreate={create} onClose={() => setCreating(false)} initialFavorite={creating.favorite || null} autoCreate={Boolean(creating.auto)} />}
      {copying && (
        <CopyDeckModal
          deck={copying}
          targets={copyTargets}
          onClose={() => setCopying(null)}
          onDone={(count) => {
            setCopying(null);
            setFlash(`“${copying.name}” copiada para ${count} ${count === 1 ? "empresa" : "empresas"}. Ela aparece em Apresentações de cada uma, com os números de lá.`);
          }}
        />
      )}
      {overlays}
    </div>
  );
}
