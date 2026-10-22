import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, CheckCircle2, ChevronDown, Info, Lightbulb, Mic, Play, Plus, Sparkles, Square, Star, TriangleAlert, Wand2, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { parseRequest } from "../../lib/assistant/parse.js";
import { analyze } from "../../lib/assistant/analysis.js";
import { resolvePlan, buildDeck } from "../../lib/assistant/plan.js";
import { buildCatalog, comparisonPeriod, contextForPeriod, shortPeriod } from "../../lib/assistant/context.js";
import { AUDIENCES, OCCASIONS, TONES, TOPICS, TOPIC_BY_ID } from "../../lib/assistant/vocab.js";
import { friendlyPeriod, tokenInfo } from "../../lib/presentations.js";
import { deleteFavorite, saveFavorite } from "../../lib/officeLibrary.js";
import { detectAnomalies } from "../../lib/anomalias.js";
import { useNavigate } from "react-router-dom";
import { SlideThumb } from "./pickers.jsx";

const EXAMPLES = [
  "Resultado do trimestre para os sócios, destacando caixa e endividamento, uns 10 slides",
  "Apresentação para o banco com foco em endividamento e capacidade de pagamento, últimos 12 meses",
  "Reunião mensal com a diretoria: mês passado, maiores despesas e plano de ação",
  "Fechamento do ano bem completo, comparar com o ano anterior, didático para quem não entende de contabilidade",
  "Diagnóstico financeiro com prazos médios, ciclo financeiro e capital de giro",
  "Meta de faturamento de 2 milhões; receita e margens mês a mês, curta e visual",
];

const HINTS = [
  ["Período", "“abril e maio”, “1º trimestre”, “últimos 3 meses”, “mês passado”, “de jan a jun/26”, “acumulado do ano”, “ano de 2025”."],
  ["Para quem", "sócios, diretoria, conselho, banco, investidores, equipe, contador, assembleia, cliente."],
  ["Ocasião", "reunião mensal, fechamento do trimestre/ano, pedido de crédito, planejamento, diagnóstico, reestruturação, prestação de contas."],
  ["Jeito", "formal, didático (“para quem não entende de contabilidade”), técnico, visual (“mais gráficos”), direto."],
  ["Tamanho", "“8 slides”, “dez slides”, “curta”, “bem completa”."],
  ["Destaques", "“foco em caixa”, “principalmente margens” — ganham mais espaço. “Sem DFC” tira o assunto."],
  ["Linhas e contas", "cite pelo nome para abrir no demonstrativo: “evidenciar caixa e equivalentes”, “o banco Itaú”, “despesas com pessoal”."],
  ["Comparação e metas", "“comparar com o ano anterior”, “versus o período anterior”, “meta de faturamento de 1,5 milhão”, “meta de margem de 15%”."],
  ["Título", "“título: Raio-X da empresa”."],
];

const NOTICE_STYLE = {
  aviso: "bg-warning-50 text-warning-700",
  info: "bg-accent-50 text-accent-700",
  dica: "bg-surface-muted text-ink-600",
};

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const VOICE_ERRORS = {
  "not-allowed": "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.",
  "service-not-allowed": "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.",
  "no-speech": "Não ouvi nada — fale mais perto do microfone e tente de novo.",
  "audio-capture": "Não encontrei um microfone neste computador.",
  network: "O ditado precisa de internet (o navegador usa o serviço de voz dele).",
};

// Ditado por voz do próprio navegador (Chrome/Edge): grátis, em português,
// o texto vai aparecendo enquanto a pessoa fala e entra no campo do pedido.
function useDictation(onFinal) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recognition = useRef(null);
  const handler = useRef(onFinal);
  handler.current = onFinal;

  useEffect(() => {
    if (!listening) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [listening]);

  useEffect(() => () => recognition.current?.abort?.(), []);

  function start() {
    if (!Recognition) return;
    setError("");
    setSeconds(0);
    const rec = new Recognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finalText = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else partial += result[0].transcript;
      }
      if (finalText.trim()) handler.current(finalText.trim());
      setInterim(partial);
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted") setError(VOICE_ERRORS[event.error] || "Não consegui ouvir agora. Tente de novo.");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Não consegui ligar o microfone. Tente de novo.");
    }
  }

  function stop() {
    recognition.current?.stop();
  }

  return { supported: Boolean(Recognition), listening, interim, error, seconds, start, stop };
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function monthOptions(months) {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return months.map((key) => {
    const [year, month] = key.split("-");
    return { key, label: `${names[Number(month) - 1]}/${year.slice(2)}` };
  });
}

function lastDayOf(key) {
  const [year, month] = key.split("-").map(Number);
  return `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-3 py-2">
      <span className="pt-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options, className = "" }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 appearance-none rounded-lg border border-line bg-surface-card pl-2.5 pr-7 text-[12.5px] text-ink-800 outline-none focus:border-accent-400">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" />
    </span>
  );
}

// Nome sugerido ao salvar um pedido: o título que a pessoa deu, senão a
// ocasião + o público ("Reunião mensal · Sócios"), senão o começo do texto.
function suggestFavoriteName(request, text) {
  if (request.title) return request.title;
  const parts = [request.occasion?.label, request.audience?.label].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

export default function AssistantBuilder({ env, brand, themeId, name, shared, onBrand, onTheme, onCreate, initialFavorite = null, autoCreate = false }) {
  const appState = useAppState();
  const [text, setText] = useState(initialFavorite?.text || "");
  const [overrides, setOverrides] = useState(() => (initialFavorite?.overrides ? structuredClone(initialFavorite.overrides) : {}));
  // "Gerar" num pedido salvo: carrega o pedido e cria a apresentação assim
  // que o roteiro estiver pronto, sem mais nenhum clique.
  const [pendingAuto, setPendingAuto] = useState(Boolean(initialFavorite && autoCreate));
  const [saving, setSaving] = useState(null); // { name } enquanto o campo de nome está aberto
  const [savedFlash, setSavedFlash] = useState("");
  const favorites = [...(appState.assistantFavorites || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  const [showHints, setShowHints] = useState(false);
  const textRef = useRef(null);
  const dictation = useDictation((spoken) => {
    setText((current) => {
      const base = current.trimEnd();
      const piece = spoken.charAt(0).toLowerCase() + spoken.slice(1);
      return base ? `${base}${/[.,;:!?]$/.test(base) ? " " : ", "}${piece}` : spoken.charAt(0).toUpperCase() + spoken.slice(1);
    });
  });
  const debouncedText = useDebounced(text, 350);

  const catalog = useMemo(() => buildCatalog(env.ctx), [env.ctx]);
  const request = useMemo(() => parseRequest(debouncedText, catalog), [debouncedText, catalog]);
  const months = catalog.months;

  // Período: o que a pessoa ajustou > o que entendi do texto > o da tela.
  const fallbackPeriod = appState.periodStart && appState.periodEnd ? { start: appState.periodStart, end: appState.periodEnd } : months.length ? { start: `${months[Math.max(0, months.length - 12)]}-01`, end: lastDayOf(months[months.length - 1]) } : null;
  const period = overrides.period || request.period || fallbackPeriod;
  const compareMode = overrides.compare !== undefined ? overrides.compare : request.compare;
  const cmpPeriod = period && compareMode ? comparisonPeriod(period, compareMode) : null;
  const tones = overrides.tones || request.tones;
  const linesKey = JSON.stringify(request.lines);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!period || !env.ctx) return undefined;
    setBusy(true);
    // Fora do clique/tecla: o cálculo do período leva um instante num
    // grupo grande e não pode travar a digitação.
    const handle = setTimeout(() => {
      try {
        const ctx = contextForPeriod(period.start, period.end);
        const prevCtx = cmpPeriod ? contextForPeriod(cmpPeriod.start, cmpPeriod.end) : null;
        const analysis = analyze(ctx, {
          period,
          label: shortPeriod(period.start, period.end),
          prevCtx,
          prevPeriod: cmpPeriod || {},
          prevLabel: cmpPeriod?.label || "",
          tones,
          lines: request.lines,
        });
        setResult({ key: `${period.start}|${period.end}|${cmpPeriod?.start || ""}`, ctx, analysis });
      } catch (error) {
        console.error("assistente: falha ao analisar", error);
        setResult(null);
      } finally {
        setBusy(false);
      }
    }, 40);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.start, period?.end, cmpPeriod?.start, cmpPeriod?.end, tones.join(","), linesKey, env.ctx]);

  const merged = useMemo(() => ({ ...request, tones }), [request, tones]);
  const plan = useMemo(() => (result ? resolvePlan(merged, result.analysis, { ...overrides, tones, compareLabel: cmpPeriod?.label }) : null), [result, merged, overrides, tones, cmpPeriod?.label]);
  const deck = useMemo(() => {
    if (!plan || !result) return null;
    return buildDeck(plan, result.analysis, { request: merged, brand, themeId, name: name.trim(), period, empresa: tokenInfo().empresa });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, result, merged, brand, themeId, name]);

  const info = tokenInfo();
  const previewEnv = useMemo(() => (result ? { ...env, ctx: result.ctx, info: { ...info, start: period?.start || "", end: period?.end || "" } } : env), [result, env, info.empresa, period?.start, period?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cria sozinho só quando o roteiro já é do pedido carregado: o texto já
  // passou pela leitura (debounce) e a análise é do período certo.
  const resultKey = period ? `${period.start}|${period.end}|${cmpPeriod?.start || ""}` : "";
  useEffect(() => {
    if (!pendingAuto || busy || !deck || debouncedText !== text || result?.key !== resultKey) return;
    setPendingAuto(false);
    onCreate(deck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAuto, busy, deck, debouncedText, text, result, resultKey]);

  function loadFavorite(favorite, create = false) {
    setText(favorite.text || "");
    setOverrides(favorite.overrides ? structuredClone(favorite.overrides) : {});
    if (favorite.brand && favorite.brand !== brand) onBrand?.(favorite.brand);
    if (favorite.themeId) onTheme?.(favorite.themeId);
    setPendingAuto(create);
  }

  async function confirmSave() {
    const clean = String(saving?.name || "").trim();
    if (!clean) return;
    try {
      await saveFavorite({ name: clean, text, overrides, brand, themeId });
      setSaving(null);
      setSavedFlash(`“${clean}” salvo — aparece em “Pedidos salvos” para todo o escritório.`);
      setTimeout(() => setSavedFlash(""), 5000);
    } catch (error) {
      console.error(error);
      setSavedFlash("Não consegui salvar o pedido agora — confira a conexão e tente de novo.");
    }
  }

  async function removeFavorite(favorite) {
    if (!window.confirm(`Apagar o pedido salvo “${favorite.name}”? Ele some para todo o escritório.`)) return;
    try {
      await deleteFavorite(favorite.id);
    } catch (error) {
      console.error(error);
      window.alert("Não consegui apagar agora — confira a conexão.");
    }
  }

  const set = (patch) => setOverrides((current) => ({ ...current, ...patch }));
  const toggleTone = (id) => set({ tones: tones.includes(id) ? tones.filter((item) => item !== id) : [...tones, id] });
  const removeTopic = (id) =>
    setOverrides((current) => ({ ...current, removeTopics: [...new Set([...(current.removeTopics || []), id])], addTopics: (current.addTopics || []).filter((item) => item !== id), emphasis: (current.emphasis || []).filter((item) => item !== id) }));
  const addTopic = (id) => setOverrides((current) => ({ ...current, addTopics: [...new Set([...(current.addTopics || []), id])], removeTopics: (current.removeTopics || []).filter((item) => item !== id) }));
  const toggleEmphasis = (id) => setOverrides((current) => ({ ...current, emphasis: (current.emphasis || []).includes(id) ? current.emphasis.filter((item) => item !== id) : [...(current.emphasis || []), id] }));

  const options = monthOptions(months);
  const topicIds = new Set((plan?.topics || []).map((topic) => topic.id));
  const addable = TOPICS.filter((topic) => !topicIds.has(topic.id));
  const hasText = debouncedText.trim().length > 0;
  const periodLabel = period ? friendlyPeriod(period.start, period.end) : "—";
  // Conferência antes de apresentar (ver pages/Conferencia.jsx): lançamentos
  // de prioridade alta ainda abertos no período e contas sem De/Para — só
  // para quem edita a empresa.
  const navigate = useNavigate();
  const editCompany = appState.activeGroupId ? null : appState.companies.find((item) => item.id === appState.activeCompanyId);
  const canConfer = Boolean(editCompany) && (appState.isAdmin || (editCompany.responsaveis || []).includes(appState.userEmail));
  const conferencia = useMemo(() => {
    if (!canConfer || !period || !appState.journal.length) return null;
    const found = detectAnomalies(appState.journal, { start: period.start, end: period.end, natureRules: appState.natureRules, dismissed: editCompany.anomaliasOk || [] });
    return { alta: found.alta, open: found.open, missing: result?.analysis?.facts?.missing || 0 };
  }, [canConfer, period?.start, period?.end, appState.journal, appState.natureRules, editCompany, result]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col gap-5">
        {favorites.length > 0 && (
          <div className="assistant-favoritos rounded-xl bg-surface-muted p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
              <Bookmark size={13} className="text-accent-500" /> Pedidos salvos do escritório
              <span className="font-normal text-ink-400">— “Gerar” monta a apresentação desta empresa na hora</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((favorite) => (
                <span key={favorite.id} className="assistant-favorito group inline-flex h-8 items-center rounded-full border border-line bg-surface-card pl-3 pr-1 text-[12.5px] text-ink-700" title={favorite.text}>
                  <button type="button" onClick={() => loadFavorite(favorite)} className="max-w-[220px] truncate hover:text-accent-700" title="Carregar o pedido para ajustar antes de criar">
                    {favorite.name}
                  </button>
                  <button type="button" onClick={() => loadFavorite(favorite, true)} className="assistant-gerar ml-1.5 flex h-6 items-center gap-1 rounded-full bg-accent-500 px-2 text-[11px] font-semibold text-white hover:bg-accent-600" title="Montar e criar a apresentação com este pedido">
                    <Play size={10} fill="currentColor" /> Gerar
                  </button>
                  <button type="button" onClick={() => removeFavorite(favorite)} className="ml-0.5 hidden h-6 w-6 items-center justify-center rounded-full text-ink-300 hover:bg-danger-50 hover:text-danger-600 group-hover:flex" title="Apagar este pedido salvo">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {pendingAuto && <p className="mt-2 text-[12px] font-medium text-accent-700">Montando a apresentação com o pedido salvo…</p>}
          </div>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
              <Sparkles size={14} className="text-accent-500" /> Conte o que você precisa
            </p>
            <button type="button" onClick={() => setShowHints((value) => !value)} className="flex items-center gap-1 text-[11.5px] font-medium text-accent-600 hover:underline">
              <Info size={13} /> O que eu entendo
            </button>
          </div>
          <div className={`relative rounded-xl border bg-surface-card transition-colors ${dictation.listening ? "border-danger-500 ring-2 ring-danger-200" : "border-line focus-within:border-accent-400"}`}>
            <textarea
              ref={textRef}
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ex.: resultado de abril e maio para os sócios, destacando caixa e endividamento, uns 8 slides, didático"
              rows={4}
              className="block w-full resize-y rounded-xl bg-transparent px-3.5 pb-12 pt-3 text-[14px] leading-relaxed text-ink-900 outline-none"
            />
            {dictation.listening && dictation.interim && <p className="pointer-events-none absolute bottom-12 left-3.5 right-16 truncate text-[13px] italic text-ink-400">{dictation.interim}…</p>}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
              <span className="pl-1.5 text-[11.5px] text-ink-400">
                {dictation.listening ? (
                  <span className="flex items-center gap-1.5 font-medium text-danger-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-danger-500" /> Ouvindo… {String(Math.floor(dictation.seconds / 60)).padStart(2, "0")}:{String(dictation.seconds % 60).padStart(2, "0")} — fale o pedido
                  </span>
                ) : busy ? (
                  "Lendo os números…"
                ) : hasText ? (
                  "Entendi — veja ao lado o roteiro e a prévia"
                ) : (
                  "Escreva ou fale o pedido"
                )}
              </span>
              <div className="flex items-center gap-1">
                {text && !dictation.listening && (
                  <button type="button" onClick={() => setText("")} className="flex h-9 items-center rounded-lg px-2 text-[12px] text-ink-500 hover:bg-surface-muted" title="Limpar">
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (dictation.listening ? dictation.stop() : dictation.supported ? dictation.start() : null)}
                  disabled={!dictation.supported}
                  title={dictation.supported ? (dictation.listening ? "Parar de gravar" : "Gravar o pedido falando") : "Seu navegador não tem ditado por voz — use o Chrome ou o Edge"}
                  className={`assistant-mic flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${dictation.listening ? "bg-danger-500 text-white hover:bg-danger-600" : dictation.supported ? "bg-accent-500 text-white hover:bg-accent-600" : "cursor-not-allowed bg-surface-muted text-ink-400"}`}
                >
                  {dictation.listening ? <Square size={14} fill="currentColor" /> : <Mic size={15} />}
                  {dictation.listening ? "Parar" : "Falar"}
                </button>
              </div>
            </div>
          </div>
          {dictation.error && <p className="mt-1.5 text-[12px] text-danger-600">{dictation.error}</p>}
          {!dictation.supported && <p className="mt-1.5 text-[11.5px] text-ink-400">Para falar o pedido, abra o app no Chrome ou no Edge (ou use o microfone do teclado do celular).</p>}
          {showHints && (
            <div className="mt-3 grid gap-1.5 rounded-xl bg-surface-muted p-3.5 text-[12px] leading-snug text-ink-600">
              {HINTS.map(([title, body]) => (
                <p key={title}>
                  <span className="font-semibold text-ink-800">{title}:</span> {body}
                </p>
              ))}
              <p className="text-ink-500">Pode escrever do seu jeito, com erro de digitação — eu corrijo e mostro abaixo o que entendi.</p>
            </div>
          )}
          {!hasText && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setText(example)} className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-left text-[12px] text-ink-600 hover:border-accent-300 hover:text-ink-900">
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
              <Wand2 size={14} className="text-accent-500" /> O que entendi
            </p>
            {Object.keys(overrides).length > 0 && (
              <button type="button" onClick={() => setOverrides({})} className="text-[11.5px] font-medium text-accent-600 hover:underline">
                Desfazer meus ajustes
              </button>
            )}
          </div>
          <div className="divide-y divide-line px-4">
            <Row label="Período">
              <span className="text-[13px] font-medium text-ink-900">{periodLabel}</span>
              {options.length > 0 && period && (
                <span className="flex items-center gap-1 text-[12px] text-ink-500">
                  <Select value={period.start.slice(0, 7)} onChange={(key) => set({ period: { start: `${key}-01`, end: key > period.end.slice(0, 7) ? lastDayOf(key) : period.end } })} options={options.map((o) => ({ value: o.key, label: o.label }))} />
                  até
                  <Select value={period.end.slice(0, 7)} onChange={(key) => set({ period: { start: key < period.start.slice(0, 7) ? `${key}-01` : period.start, end: lastDayOf(key) } })} options={options.map((o) => ({ value: o.key, label: o.label }))} />
                </span>
              )}
              {!overrides.period && request.period?.note && <span className="w-full text-[11.5px] text-ink-400">{request.period.note}</span>}
              {!overrides.period && !request.period && hasText && <span className="w-full text-[11.5px] text-ink-400">Não vi período no pedido — usei o da tela.</span>}
              {conferencia && (conferencia.alta > 0 || conferencia.missing > 0) && (
                <span className="assistant-conferencia flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-warning-50 px-2.5 py-1.5 text-[12px] text-warning-700">
                  <TriangleAlert size={13} className="shrink-0" />
                  <span>
                    Antes de apresentar:{" "}
                    {[conferencia.alta > 0 && `${conferencia.alta} ${conferencia.alta === 1 ? "lançamento" : "lançamentos"} de prioridade alta para conferir`, conferencia.missing > 0 && `${conferencia.missing} ${conferencia.missing === 1 ? "conta" : "contas"} sem De/Para`].filter(Boolean).join(" e ")}{" "}
                    neste período.
                  </span>
                  {conferencia.alta > 0 && (
                    <button type="button" onClick={() => navigate("/empresa/conferencia", { state: { periodo: { start: period.start, end: period.end } } })} className="assistant-conferir font-semibold underline">
                      Conferir agora
                    </button>
                  )}
                </span>
              )}
            </Row>
            <Row label="Para quem">
              <Select value={overrides.audience ?? request.audience?.id ?? ""} onChange={(value) => set({ audience: value })} options={[{ value: "", label: "Geral" }, ...AUDIENCES.map((a) => ({ value: a.id, label: a.label }))]} />
              <Select value={overrides.occasion ?? request.occasion?.id ?? ""} onChange={(value) => set({ occasion: value })} options={[{ value: "", label: "Sem ocasião" }, ...OCCASIONS.map((o) => ({ value: o.id, label: o.label }))]} />
            </Row>
            <Row label="Jeito">
              {TONES.map((tone) => (
                <button key={tone.id} type="button" onClick={() => toggleTone(tone.id)} className={`h-7 rounded-full border px-2.5 text-[12px] font-medium transition-colors ${tones.includes(tone.id) ? "border-accent-500 bg-accent-50 text-accent-700" : "border-line text-ink-500 hover:border-accent-300"}`}>
                  {tone.label}
                </button>
              ))}
            </Row>
            <Row label="Tamanho">
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={overrides.size ?? plan?.target ?? ""}
                  onChange={(event) => set({ size: event.target.value ? Math.max(4, Math.min(30, Number(event.target.value))) : undefined })}
                  className="h-8 w-16 rounded-lg border border-line bg-surface-card px-2 text-[13px] outline-none focus:border-accent-400"
                />
                slides {deck && <span className="text-ink-400">· saiu com {deck.slides.length}</span>}
              </span>
              <Select
                value={compareMode || ""}
                onChange={(value) => set({ compare: value || null })}
                options={[
                  { value: "", label: "Sem comparação" },
                  { value: "yoy", label: "Comparar com o ano anterior" },
                  { value: "anterior", label: "Comparar com o período anterior" },
                ]}
              />
              {cmpPeriod && <span className="text-[11.5px] text-ink-400">({cmpPeriod.label})</span>}
            </Row>
            <Row label="Assuntos">
              {(plan?.topics || []).map((topic) => (
                <span key={topic.id} className={`group inline-flex h-7 items-center gap-1 rounded-full border pl-2.5 pr-1 text-[12px] font-medium ${topic.emphasis ? "border-accent-500 bg-accent-50 text-accent-800" : "border-line bg-surface-card text-ink-700"}`} title={`Por quê: ${topic.sourceLabel}`}>
                  <button type="button" onClick={() => toggleEmphasis(topic.id)} title={topic.emphasis ? "Tirar o destaque" : "Destacar (ganha mais espaço)"} className={topic.emphasis ? "text-accent-500" : "text-ink-300 hover:text-accent-500"}>
                    <Star size={12} fill={topic.emphasis ? "currentColor" : "none"} />
                  </button>
                  {topic.label}
                  {topic.source === "dados" && <TriangleAlert size={11} className="text-warning-600" />}
                  <button type="button" onClick={() => removeTopic(topic.id)} className="flex h-5 w-5 items-center justify-center rounded-full text-ink-400 hover:bg-surface-muted hover:text-danger-600" title="Tirar">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {addable.length > 0 && (
                <span className="relative inline-flex">
                  <select value="" onChange={(event) => event.target.value && addTopic(event.target.value)} className="h-7 appearance-none rounded-full border border-dashed border-line-strong bg-transparent pl-6 pr-2.5 text-[12px] text-ink-500 outline-none hover:border-accent-300">
                    <option value="">Assunto</option>
                    {addable.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                  <Plus size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
                </span>
              )}
            </Row>
            {(request.lines.length > 0 || request.goals.length > 0) && (
              <Row label="Em destaque">
                {request.lines.map((line) => (
                  <span key={`${line.kind}:${line.code}:${line.classificacao || ""}`} className="inline-flex h-7 items-center rounded-full bg-surface-muted px-2.5 text-[12px] text-ink-700" title={line.kind === "account" ? `Conta ${line.classificacao}` : `Linha ${line.code}`}>
                    {line.kind === "account" ? "Conta: " : ""}
                    {line.name}
                  </span>
                ))}
                {request.goals.map((goal) => (
                  <span key={goal.metricId} className="inline-flex h-7 items-center rounded-full bg-surface-muted px-2.5 text-[12px] text-ink-700">
                    {goal.label}: {goal.format === "percent" ? `${goal.target.toLocaleString("pt-BR")}%` : goal.target.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                ))}
              </Row>
            )}
            {(request.corrections.length > 0 || request.title || request.excluded.length > 0) && (
              <Row label="Também">
                {request.title && <span className="text-[12px] text-ink-600">Título: “{request.title}”</span>}
                {request.excluded.length > 0 && <span className="text-[12px] text-ink-600">Sem: {request.excluded.map((id) => TOPIC_BY_ID[id]?.label).join(", ")}</span>}
                {request.corrections.map((item) => (
                  <span key={item.typed} className="text-[12px] text-ink-500">
                    “{item.typed}” → <span className="font-medium text-ink-700">{item.understood}</span>
                  </span>
                ))}
              </Row>
            )}
          </div>
          {request.brand && request.brand !== brand && onBrand && (
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12px] text-ink-600">
              <span>Você citou a {request.brand === "contac" ? "Contac" : "Athos"} no pedido, mas a marca escolhida é outra.</span>
              <button type="button" onClick={() => onBrand(request.brand)} className="shrink-0 rounded-lg bg-accent-50 px-2.5 py-1 font-semibold text-accent-700 hover:bg-accent-100">
                Usar a {request.brand === "contac" ? "Contac" : "Athos"}
              </button>
            </div>
          )}
          {[...request.warnings.map((text) => ({ kind: "aviso", text })), ...(plan?.notices || [])].length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
              {[...request.warnings.map((text) => ({ kind: "aviso", text })), ...(plan?.notices || [])].map((notice) => (
                <p key={notice.text} className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${NOTICE_STYLE[notice.kind] || NOTICE_STYLE.dica}`}>
                  {notice.kind === "aviso" ? <TriangleAlert size={13} className="mt-px shrink-0" /> : notice.kind === "info" ? <Lightbulb size={13} className="mt-px shrink-0" /> : <Info size={13} className="mt-px shrink-0" />}
                  {notice.text}
                </p>
              ))}
            </div>
          )}
        </div>

        {shared}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-ink-600">Roteiro {deck ? `(${deck.slides.length} slides)` : ""}</p>
          {result && (
            <span className="flex items-center gap-1 text-[11.5px] text-ink-400">
              <CheckCircle2 size={12} className="text-success-500" /> {result.analysis.alerts.length} alerta{result.analysis.alerts.length === 1 ? "" : "s"} · {result.analysis.positives.length} ponto{result.analysis.positives.length === 1 ? "" : "s"} positivo{result.analysis.positives.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ol className="assistant-outline flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-xl bg-surface-muted p-2 text-[12.5px]">
          {(plan?.outline || []).map((item, index) => (
            <li key={item.key + index} className="flex items-center gap-2 rounded-md px-2 py-1 text-ink-700">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] text-ink-400">{index + 1}</span>
              <span className="truncate">{item.label}</span>
              {item.emphasis && <Star size={11} className="shrink-0 text-accent-500" fill="currentColor" />}
            </li>
          ))}
          {!plan && <li className="px-2 py-1 text-ink-400">{busy ? "Montando…" : "Escreva o pedido para ver o roteiro."}</li>}
        </ol>
        <p className="text-[12px] font-medium text-ink-600">Prévia</p>
        <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
          {deck?.slides.map((slide, i) => (
            <span key={slide.id} className="overflow-hidden rounded-md ring-1 ring-line">
              <SlideThumb slide={slide} deck={deck} env={previewEnv} width={186} number={i + 1} total={deck.slides.length} />
            </span>
          ))}
        </div>
        <button
          type="button"
          disabled={!deck || busy}
          onClick={() => deck && onCreate(deck)}
          className="mt-auto flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-500 text-[14px] font-semibold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={16} /> Criar e editar
        </button>
        {saving ? (
          <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-ink-600">Nome do pedido salvo</span>
              <input
                autoFocus
                value={saving.name}
                onChange={(event) => setSaving({ name: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && confirmSave()}
                className="assistant-nome-favorito h-9 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400"
              />
            </label>
            <p className="text-[11px] leading-snug text-ink-400">Guarda o texto e os seus ajustes (público, jeito, assuntos, tamanho, comparação), a marca e o tema. O período não vai junto: em cada empresa vale o que o texto disser (“mês passado”) ou o da tela.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSaving(null)} className="h-8 rounded-lg px-3 text-[12.5px] text-ink-500 hover:bg-surface-muted">
                Cancelar
              </button>
              <button type="button" onClick={confirmSave} disabled={!saving.name.trim()} className="assistant-confirmar-favorito h-8 rounded-lg bg-navy-900 px-3 text-[12.5px] font-semibold text-white disabled:opacity-40">
                Salvar pedido
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => setSaving({ name: suggestFavoriteName(request, text) })}
            className="assistant-salvar-favorito flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line text-[12.5px] font-medium text-ink-600 hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            title="Guardar este pedido para gerar a mesma apresentação de outros clientes com um clique"
          >
            <BookmarkPlus size={14} /> Salvar este pedido
          </button>
        )}
        {savedFlash && <p className="text-center text-[11.5px] font-medium text-success-600">{savedFlash}</p>}
        <p className="text-center text-[11px] leading-snug text-ink-400">Gráficos e números se atualizam sozinhos; os textos são uma sugestão — tudo continua editável.</p>
      </div>
    </div>
  );
}
