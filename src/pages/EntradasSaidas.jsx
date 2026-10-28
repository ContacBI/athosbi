import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Lightbulb, Minus, Percent, Receipt, Scale, SlidersHorizontal, Ticket, Wallet } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { saveNotasConfig } from "../lib/companies.js";
import { groupCompanies, saveNotasMedidaGrupo } from "../lib/groups.js";
import { oculto } from "../lib/visibilidade.js";
import EntradasSaidasDetalhe from "../components/EntradasSaidasDetalhe.jsx";
import { CARTAO, MES_CURTO, MES_LONGO, NAVY, ROSA, VERDE, brlCompacto, dec, eixo, inteiro, moneyFull, pct } from "../lib/fmtNotas.js";
import { CONFIG_PADRAO, TIPOS, considerado, fetchNotas, montarEntradasSaidas, sugerirConsiderar } from "../lib/notasFiscais.js";

function Variacao({ atual, anterior, bomSobe = true, rotulo }) {
  if (!anterior || !Number.isFinite(atual)) return null;
  const v = (atual - anterior) / Math.abs(anterior);
  const subiu = v >= 0;
  const bom = bomSobe ? subiu : !subiu;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${bom ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`} title={rotulo}>
      {subiu ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {dec(Math.abs(v) * 100)}%
    </span>
  );
}

function Kpi({ id, rotulo, valor, exato, dica, delta, icone: Icone, destaque, onAbrir, spark, cor = VERDE }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(id)}
      title="Clique para ver as comparações e análises"
      className={`${CARTAO} group relative flex min-w-0 flex-col justify-between overflow-hidden p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-[0_18px_40px_-16px_rgba(16,24,40,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${destaque ? "col-span-2" : ""}`}
    >
      <span className="absolute inset-y-0 left-0 w-1 opacity-90" style={{ background: cor }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
        <span className="flex items-center gap-1.5">
          <ChevronRight size={14} className="-translate-x-1 text-accent-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          {Icone && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600"><Icone size={14} /></span>}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate font-bold tabular-nums tracking-tight text-ink-900 ${destaque ? "text-[30px] leading-9" : "text-[22px] leading-7"}`} title={exato}>{valor}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {delta}
            {dica && <span className="truncate text-[11.5px] text-ink-400">{dica}</span>}
          </div>
        </div>
        {spark && spark.length > 1 && (
          <div className={`h-11 shrink-0 ${destaque ? "w-36" : "w-20"}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`eeSpark-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cor} stopOpacity={0.35} /><stop offset="100%" stopColor={cor} stopOpacity={0} /></linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={2} fill={`url(#eeSpark-${id})`} connectNulls isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </button>
  );
}

function Seletor({ rotulo, valor, opcoes, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{rotulo}</span>
      <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
        {opcoes.map(([id, nome]) => (
          <button key={id} type="button" onClick={() => onChange(id)} className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${valor === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{nome}</button>
        ))}
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-5 p-4 md:p-6">
      <div className="h-24 rounded-2xl bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="col-span-2 h-28 rounded-2xl bg-surface-muted" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-muted" />)}
      </div>
      <div className="h-72 rounded-2xl bg-surface-muted" />
    </div>
  );
}

export default function EntradasSaidas() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [brutos, setBrutos] = useState(null); // { [companyId]: linhas do dominio_notas }
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ano, setAno] = useState(null);
  const [mesDe, setMesDe] = useState(1);
  const [mesAte, setMesAte] = useState(12);
  const [aba, setAba] = useState("S");
  const [foco, setFoco] = useState("todas"); // grupo: "todas" (consolidado) ou o id de uma empresa
  const [verAcumuladores, setVerAcumuladores] = useState(false);
  const [medirAberto, setMedirAberto] = useState(false);
  // Lâmpada: liga/desliga as frases de leitura rápida (lembra a escolha neste navegador; começa ligada)
  const [verInsights, setVerInsights] = useState(() => {
    try { return localStorage.getItem("athosbi.es.insights") !== "0"; } catch { return true; }
  });
  const alternarInsights = () => setVerInsights((atual) => {
    try { localStorage.setItem("athosbi.es.insights", atual ? "0" : "1"); } catch { /* sem armazenamento: só não lembra */ }
    return !atual;
  });
  const [detalhe, setDetalhe] = useState(null); // cartão aberto no painel de comparações ("fat" | "ent" | "saldo" | "ticket" | "ratio")
  const equipe = Boolean(state.isAdmin || state.isColaborador); // cliente só vê as informações; os acumuladores (configuração) são da equipe
  const membrosUso = useMemo(() => (grupo && foco !== "todas" ? membros.filter((m) => m.id === foco) : membros), [membros, grupo, foco]);
  const ehConsolidado = Boolean(grupo) && foco === "todas";
  const config = (!grupo && company?.notasConfig) || (grupo && foco !== "todas" && membrosUso[0]?.notasConfig) || CONFIG_PADRAO;
  // grupo: a medida é do grupo (vale pra todas as empresas); empresa: a medida é dela
  const base = (grupo ? grupo.notasMedida?.base : config.base) || "nota";
  const valor = (grupo ? grupo.notasMedida?.valor : config.valor) || "nota";
  const podeEditar = Boolean(!grupo && company && (state.isAdmin || (company.responsaveis || []).includes(state.userEmail)));

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setBrutos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchNotas(m.id).then((linhas) => [m.id, linhas])))
      .then((pares) => ativo && setBrutos(Object.fromEntries(pares)))
      .catch((err) => {
        console.error("Falha ao ler as notas fiscais:", err);
        if (ativo) setErro("Não consegui carregar as notas fiscais agora. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMembros]);

  const anos = useMemo(() => [...new Set(Object.values(brutos || {}).flatMap((linhas) => linhas.map((item) => item.ano)))].sort((a, b) => b - a), [brutos]);
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[0]);
  }, [anos, ano]);
  const sincronizado = useMemo(() => Object.values(brutos || {}).flatMap((linhas) => linhas.filter((i) => i.ano === ano).map((i) => i.synced_at)).sort().pop(), [brutos, ano]);

  const r = useMemo(() => (brutos && ano ? montarEntradasSaidas({ membros: membrosUso, brutos, ano, mesDe, mesAte, base, valor, ehGrupo: ehConsolidado }) : null), [membrosUso, brutos, ano, mesDe, mesAte, base, valor, ehConsolidado]);
  // Período ANTERIOR de mesmo tamanho, colado no escolhido (1 mês -> o mês anterior; 6 meses -> os 6 meses anteriores; pode cruzar o ano), pras variações dos cartões.
  // Só vale quando TODOS os meses desse período têm nota nos dados; com meio período, a comparação enganaria e o selo some.
  const anterior = useMemo(() => {
    if (!brutos || !ano) return null;
    const n = mesAte - mesDe + 1;
    const ini = ano * 12 + (mesDe - 1) - n;
    const segmentos = new Map(); // ano -> [primeiro mês, último mês] (1..12)
    for (let k = 0; k < n; k += 1) {
      const t = ini + k;
      const a = Math.floor(t / 12);
      const m = (t % 12) + 1;
      const seg = segmentos.get(a) || [m, m];
      seg[0] = Math.min(seg[0], m);
      seg[1] = Math.max(seg[1], m);
      segmentos.set(a, seg);
    }
    const temDados = (a, m) => membrosUso.some((mb) => (brutos[mb.id] || []).find((x) => x.ano === a)?.dados?.linhas?.some((l) => Number(String(l.m).slice(5, 7)) === m));
    let fat = 0, vendas = 0, entradas = 0, entradasC = 0;
    for (const [a, [m1, m2]] of segmentos) {
      for (let m = m1; m <= m2; m += 1) if (!temDados(a, m)) return null;
      const rr = montarEntradasSaidas({ membros: membrosUso, brutos, ano: a, mesDe: m1, mesAte: m2, base, valor, ehGrupo: ehConsolidado });
      fat += rr.faturamento;
      vendas += rr.vendas;
      entradas += rr.totais.E.v;
      entradasC += rr.totais.E.c;
    }
    const mIni = ini % 12, aIni = Math.floor(ini / 12), mFim = (ini + n - 1) % 12, aFim = Math.floor((ini + n - 1) / 12);
    const rotulo = n === 1 ? `${MES_CURTO[mIni]}/${aIni}` : `${MES_CURTO[mIni]}/${aIni} a ${MES_CURTO[mFim]}/${aFim}`;
    return { faturamento: fat, vendas, ticket: vendas ? fat / vendas : null, totais: { E: { v: entradas, c: entradasC } }, saldo: fat - entradas, rotulo };
  }, [membrosUso, brutos, ano, mesDe, mesAte, base, valor, ehConsolidado]);
  // Série dos 12 meses que terminam no mês final escolhido (pode cruzar o ano): alimenta os minigráficos dos cartões e o painel de análises.
  const serie12 = useMemo(() => {
    if (!brutos || !ano) return [];
    const cache = new Map();
    const doAno = (a) => {
      if (!cache.has(a)) cache.set(a, anos.includes(a) ? montarEntradasSaidas({ membros: membrosUso, brutos, ano: a, mesDe: 1, mesAte: 12, base, valor, ehGrupo: ehConsolidado }) : null);
      return cache.get(a);
    };
    const fim = ano * 12 + (mesAte - 1);
    const iniPeriodo = ano * 12 + (mesDe - 1);
    const out = [];
    for (let t = fim - 11; t <= fim; t += 1) {
      const a = Math.floor(t / 12);
      const m = t % 12;
      const mm = doAno(a)?.meses[m];
      const rotulo = `${MES_CURTO[m]}/${String(a).slice(2)}`;
      const base0 = { rotulo, t, a, m: m + 1, noPeriodo: t >= iniPeriodo };
      const fat = mm ? mm.S.v + mm.V.v : 0;
      const ent = mm ? mm.E.v : 0;
      const cont = mm ? mm.S.c + mm.V.c : 0;
      if (!mm || (!fat && !ent)) { out.push({ ...base0, fat: null, ent: null, saldo: null, ticket: null, ratio: null }); continue; }
      out.push({ ...base0, fat, ent, saldo: fat - ent, ticket: cont ? fat / cont : null, ratio: fat ? ent / fat : null });
    }
    return out;
  }, [membrosUso, brutos, ano, anos, mesDe, mesAte, base, valor, ehConsolidado]);
  // grupo: uma linha por empresa pra comparar (cada uma com a própria escolha de acumuladores e a mesma base/valor)
  const comparativo = useMemo(() => (grupo && brutos && ano ? membros.map((m) => ({ membro: m, r: montarEntradasSaidas({ membros: [m], brutos, ano, mesDe, mesAte, base, valor }) })) : []), [grupo, membros, brutos, ano, mesDe, mesAte, base, valor]);

  async function gravar(proxima) {
    setAviso("");
    try {
      await saveNotasConfig(proxima);
    } catch (err) {
      console.error("Falha ao salvar a escolha dos acumuladores:", err);
      setAviso("Não consegui salvar a escolha agora. Tente de novo.");
    }
  }
  const alternar = (tipo, linha) => {
    const atual = considerado(config, tipo, linha.codigo, linha.nome);
    gravar({ ...CONFIG_PADRAO, ...config, flags: { ...(config.flags || {}), [tipo]: { ...(config.flags?.[tipo] || {}), [String(linha.codigo)]: !atual } } });
  };
  const emMassa = (tipo, modo) => {
    const lista = r?.linhas[tipo] || [];
    const novo = {};
    if (modo !== "sugestao") lista.forEach((linha) => { novo[String(linha.codigo)] = modo === "todos"; });
    gravar({ ...CONFIG_PADRAO, ...config, flags: { ...(config.flags || {}), [tipo]: novo } });
  };
  const mudarMedida = (campo, id) => {
    if (grupo) {
      if (!equipe) { setAviso("Só a equipe muda essa opção."); return; }
      saveNotasMedidaGrupo(grupo.id, { base, valor, [campo]: id });
      return;
    }
    if (!podeEditar) { setAviso("Só quem edita a empresa muda essa opção."); return; }
    gravar({ ...CONFIG_PADRAO, ...config, [campo]: id });
  };

  if (!membros.length) return <p className="p-6 text-[13px] text-ink-400">Abra uma empresa ou um grupo para ver as notas fiscais.</p>;
  if (erro) return <p className="p-6 text-[13px] text-danger-600">{erro}</p>;
  if (!brutos) return <Esqueleto />;
  if (!anos.length) {
    return (
      <div className="w-full p-4 md:p-6">
        <div className={`${CARTAO} p-6`}>
          <h1 className="text-[20px] font-semibold text-ink-900">Entradas x Saídas</h1>
          <p className="mt-2 text-[13px] text-ink-500">Ainda não chegaram notas fiscais da Domínio para {grupo ? "este grupo" : "esta empresa"}. A Central envia uma vez por dia; assim que chegarem, elas aparecem aqui.</p>
        </div>
      </div>
    );
  }
  if (!r) return <Esqueleto />; // o ano é escolhido no efeito logo depois da primeira leitura

  const unidade = base === "item" ? "peças" : "notas";
  const ativos = r.meses.map((m, i) => ({ ...m, i })).filter((m) => m.i + 1 >= mesDe && m.i + 1 <= mesAte);
  const dadosGrafico = ativos.map((m) => ({ mes: MES_CURTO[m.i], saidas: m.S.v + m.V.v, entradas: m.E.v, ticket: m.S.c + m.V.c ? (m.S.v + m.V.v) / (m.S.c + m.V.c) : null }));
  const picoIdx = dadosGrafico.reduce((best, d, i) => (d.saidas > (dadosGrafico[best]?.saidas ?? -1) ? i : best), 0);
  const dadosComPico = dadosGrafico.map((d, i) => ({ ...d, rotuloPico: i === picoIdx && d.saidas ? d.saidas : null }));
  const tendencia = dadosGrafico.map((d) => ({ mes: d.mes, v: d.saidas }));
  const periodoRotulo = mesDe === mesAte ? `${MES_LONGO[mesDe - 1]} de ${ano}` : `${MES_LONGO[mesDe - 1]} a ${MES_LONGO[mesAte - 1]} de ${ano}`;

  // frases de leitura rápida
  const insights = [];
  if (r.faturamento) insights.push(`As entradas consideradas equivalem a ${pct(r.totais.E.v, r.faturamento)} do faturamento em ${periodoRotulo}.`);
  if (dadosGrafico[picoIdx]?.saidas) insights.push(`O maior mês de faturamento foi ${MES_LONGO[ativos[picoIdx].i]}, com ${brlCompacto(dadosGrafico[picoIdx].saidas)}.`);
  const comTicket = dadosGrafico.filter((d) => d.ticket != null);
  if (comTicket.length > 1) {
    const ini = comTicket[0];
    const fim = comTicket[comTicket.length - 1];
    const v = (fim.ticket - ini.ticket) / ini.ticket;
    insights.push(`O ticket médio ${v >= 0 ? "subiu" : "caiu"} ${dec(Math.abs(v) * 100)}% entre ${ini.mes.toLowerCase()} e ${fim.mes.toLowerCase()} (${moneyFull(ini.ticket)} → ${moneyFull(fim.ticket)}).`);
  }
  if (ehConsolidado && comparativo.length > 1) {
    const lider = [...comparativo].sort((a, b) => b.r.faturamento - a.r.faturamento)[0];
    if (lider?.r.faturamento) insights.push(`${lider.membro.name} responde por ${pct(lider.r.faturamento, comparativo.reduce((s, c) => s + c.r.faturamento, 0))} do faturamento do grupo.`);
  }
  const maxFat = Math.max(...comparativo.map((c) => c.r.faturamento), 1);
  const totalGrupo = comparativo.reduce((s, c) => s + c.r.faturamento, 0);

  const totalLinhas = (tipo) => (r.linhas[tipo] || []).reduce((s, l) => ({ notas: s.notas + l.notas, itens: s.itens + l.itens, vcon: s.vcon + l.vcon, vprod: s.vprod + l.vprod }), { notas: 0, itens: 0, vcon: 0, vprod: 0 });
  const tot = totalLinhas(aba);
  const totBase = valor === "itens" ? tot.vprod : tot.vcon;
  const rotuloAnt = anterior ? `vs. ${anterior.rotulo}` : "";
  const select = "rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-accent-500";

  return (
    <div key={`${ano}-${foco}`} className="ee-entra flex w-full flex-col gap-5 p-4 md:p-6">
      <style>{`@keyframes eeEntra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } .ee-entra { animation: eeEntra .28s ease-out both; } @media (prefers-reduced-motion: reduce) { .ee-entra { animation: none; } }`}</style>

      {/* Cabeçalho */}
      <div className={`${CARTAO} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">Notas fiscais</span>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-ink-900"><ArrowLeftRight size={20} className="text-accent-600" /> Entradas x Saídas</h1>
            <p className="mt-1 text-[12.5px] text-ink-400" title="Da escrituração fiscal da Domínio, por acumulador. Só entra na conta o que está marcado.">
              {periodoRotulo}{sincronizado ? ` · atualizado em ${new Date(sincronizado).toLocaleDateString("pt-BR")}` : ""}
            </p>
            {anterior && <p className="mt-0.5 text-[11.5px] text-ink-400">Variações comparadas com o período anterior ({anterior.rotulo}).</p>}
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <select value={ano || ""} onChange={(e) => setAno(Number(e.target.value))} className={select} aria-label="Ano">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-1.5">
              <select value={mesDe} onChange={(e) => { const v = Number(e.target.value); setMesDe(v); if (v > mesAte) setMesAte(v); }} className="bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none" aria-label="Mês inicial">
                {MES_CURTO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <span className="text-ink-300">→</span>
              <select value={mesAte} onChange={(e) => { const v = Number(e.target.value); setMesAte(v); if (v < mesDe) setMesDe(v); }} className="bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none" aria-label="Mês final">
                {MES_CURTO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setMedirAberto((v) => !v)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${medirAberto ? "border-accent-500 bg-accent-500/10 text-accent-700" : "border-line text-ink-600 hover:bg-surface-muted"}`}>
              <SlidersHorizontal size={13} /> Medir por
            </button>
            {!oculto("es:insights") && (
              <button type="button" onClick={alternarInsights} aria-pressed={verInsights} title={verInsights ? "Ocultar a leitura rápida" : "Mostrar a leitura rápida"} className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg border transition-colors ${verInsights ? "border-accent-500 bg-accent-500 text-white shadow-sm" : "border-line text-ink-500 hover:bg-surface-muted"}`}>
                <Lightbulb size={15} />
              </button>
            )}
            {medirAberto && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMedirAberto(false)} />
                <div className={`${CARTAO} absolute right-0 top-full z-40 mt-2 flex w-[300px] flex-col gap-4 p-4`}>
                  <Seletor rotulo="Ticket médio por" valor={base} opcoes={[["nota", "Nota"], ["item", "Item (peças)"]]} onChange={(id) => mudarMedida("base", id)} />
                  <Seletor rotulo="Valor" valor={valor} opcoes={[["nota", "Total da nota"], ["itens", "Só os itens"]]} onChange={(id) => mudarMedida("valor", id)} />
                  <p className="text-[11.5px] leading-4 text-ink-400">{grupo ? "No grupo, esta medida vale para todas as empresas. Os acumuladores seguem a escolha de cada empresa (para mudar, abra a empresa)." : "A escolha fica salva na empresa."}</p>
                </div>
              </>
            )}
          </div>
        </div>
        {grupo && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[["todas", "Consolidado"], ...membros.map((m) => [m.id, m.name])].map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setFoco(id)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${foco === id ? "border-accent-500 bg-accent-500 text-white shadow-sm" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{String(nome).replace(/\s+(LTDA|S\/A|EPP|ME)\b.*$/i, "")}</button>
            ))}
          </div>
        )}
        {aviso && <p className="text-[12px] text-warning-700">{aviso}</p>}
      </div>

      {/* Cartões (clicar abre as comparações e análises) */}
      {!oculto("es:kpis") && (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Kpi id="fat" destaque cor={VERDE} onAbrir={setDetalhe} spark={serie12.map((p) => ({ v: p.fat }))} rotulo="Faturamento (saídas + serviços)" valor={brlCompacto(r.faturamento)} exato={moneyFull(r.faturamento)} icone={Wallet}
          delta={<Variacao atual={r.faturamento} anterior={anterior?.faturamento} rotulo={rotuloAnt} />} dica={`${inteiro(r.vendas)} ${unidade}`} />
        <Kpi id="ent" cor={ROSA} onAbrir={setDetalhe} spark={serie12.map((p) => ({ v: p.ent }))} rotulo="Entradas" valor={brlCompacto(r.totais.E.v)} exato={moneyFull(r.totais.E.v)} icone={Receipt}
          delta={<Variacao atual={r.totais.E.v} anterior={anterior?.totais.E.v} bomSobe={false} rotulo={rotuloAnt} />} dica={`${inteiro(r.totais.E.c)} ${unidade}`} />
        <Kpi id="saldo" cor={NAVY} onAbrir={setDetalhe} spark={serie12.map((p) => ({ v: p.saldo }))} rotulo="Fat. − entradas" valor={brlCompacto(r.saldo)} exato={moneyFull(r.saldo)} icone={Scale}
          delta={<Variacao atual={r.saldo} anterior={anterior?.saldo} rotulo={rotuloAnt} />} dica="sai menos entra" />
        <Kpi id="ticket" cor={NAVY} onAbrir={setDetalhe} spark={serie12.map((p) => ({ v: p.ticket }))} rotulo={`Ticket médio por ${base === "item" ? "peça" : "nota"}`} valor={r.ticket == null ? "—" : moneyFull(r.ticket)} exato={r.ticket == null ? "" : moneyFull(r.ticket)} icone={Ticket}
          delta={<Variacao atual={r.ticket} anterior={anterior?.ticket} rotulo={rotuloAnt} />} dica="faturamento ÷ vendas" />
        <Kpi id="ratio" cor={ROSA} onAbrir={setDetalhe} spark={serie12.map((p) => ({ v: p.ratio }))} rotulo="Entradas ÷ faturamento" valor={pct(r.totais.E.v, r.faturamento)} icone={Percent}
          delta={<Variacao atual={r.faturamento ? r.totais.E.v / r.faturamento : NaN} anterior={anterior?.faturamento ? anterior.totais.E.v / anterior.faturamento : 0} bomSobe={false} rotulo={rotuloAnt} />} dica="quanto vira entrada" />
      </div>
      )}

      {/* Leitura rápida */}
      {insights.length > 0 && verInsights && !oculto("es:insights") && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.slice(0, 4).map((frase) => (
            <div key={frase} className="flex items-start gap-2.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] px-3.5 py-3">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent-600" />
              <p className="text-[12.5px] leading-[18px] text-ink-700">{frase}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ranking entre as empresas do grupo */}
      {ehConsolidado && comparativo.length > 1 && !oculto("es:comparativo") && (
        <div className={`${CARTAO} p-5`}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-ink-900">Comparativo entre as empresas</h2>
            <span className="text-[11.5px] text-ink-400">clique numa empresa para ver só ela</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="w-[34%] py-2 pr-3">Faturamento</th>
                  <th className="py-2 pr-3 text-right">% do grupo</th>
                  <th className="py-2 pr-3 text-right">Entradas</th>
                  <th className="py-2 pr-3 text-right">Fat. − entradas</th>
                  <th className="py-2 pr-3 text-right">Ticket</th>
                  <th className="py-2 text-right">Entradas ÷ fat.</th>
                </tr>
              </thead>
              <tbody>
                {[...comparativo].sort((a, b) => b.r.faturamento - a.r.faturamento).map(({ membro, r: re }, idx) => (
                  <tr key={membro.id} onClick={() => setFoco(membro.id)} className="group cursor-pointer border-b border-line/70 last:border-0 hover:bg-surface-muted/60" title="Ver só esta empresa">
                    <td className="py-2.5 pr-3 font-medium text-ink-900"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent-500/10 text-[11px] font-semibold text-accent-700">{idx + 1}</span>{membro.name}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (re.faturamento / maxFat) * 100)}%`, background: `linear-gradient(90deg, ${VERDE}, #34d399)` }} /></div>
                        <span className="w-[104px] text-right tabular-nums text-ink-900" title={moneyFull(re.faturamento)}>{brlCompacto(re.faturamento)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700">{pct(re.faturamento, totalGrupo)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums" title={moneyFull(re.totais.E.v)}>{brlCompacto(re.totais.E.v)}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${re.saldo < 0 ? "text-rose-600" : ""}`} title={moneyFull(re.saldo)}>{brlCompacto(re.saldo)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{re.ticket == null ? "—" : moneyFull(re.ticket)}</td>
                    <td className="py-2.5 text-right tabular-nums">{pct(re.totais.E.v, re.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mês a mês */}
      {!oculto("es:grafico") && (
      <div className={`${CARTAO} p-5`}>
        <h2 className="mb-4 text-[14px] font-semibold text-ink-900">Mês a mês: o que sai × o que entra</h2>
        <div className="h-[300px] text-ink-400">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosComPico} margin={{ top: 22, right: 12, left: 4, bottom: 0 }} barGap={4}>
              <defs>
                <linearGradient id="eeVerde" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor={VERDE} /></linearGradient>
                <linearGradient id="eeRosa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor={ROSA} /></linearGradient>
              </defs>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "currentColor" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="v" tickFormatter={eixo} tick={{ fontSize: 11, fill: "currentColor" }} width={52} axisLine={false} tickLine={false} />
              <YAxis yAxisId="t" orientation="right" tickFormatter={eixo} tick={{ fontSize: 11, fill: "currentColor" }} width={44} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(128,128,128,0.2)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} formatter={(v, nome) => [moneyFull(v), nome]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar yAxisId="v" dataKey="saidas" name="Saídas + serviços" fill="url(#eeVerde)" radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="rotuloPico" position="top" formatter={(v) => (v ? brlCompacto(v) : "")} style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }} />
              </Bar>
              <Bar yAxisId="v" dataKey="entradas" name="Entradas" fill="url(#eeRosa)" radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false} />
              <Line yAxisId="t" dataKey="ticket" name="Ticket médio" stroke={NAVY} strokeWidth={2} dot={{ r: 3, fill: NAVY, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {detalhe && (
        <EntradasSaidasDetalhe kpi={detalhe} onClose={() => setDetalhe(null)} r={r} anterior={anterior} rotuloAnterior={anterior?.rotulo} serie={serie12} comparativo={comparativo}
          ehConsolidado={ehConsolidado} equipe={equipe} valor={valor} unidade={unidade} periodoRotulo={periodoRotulo} />
      )}

      {/* Acumuladores: só a equipe, recolhido */}
      {equipe && (
        <div className={`${CARTAO} p-5`}>
          <button type="button" onClick={() => setVerAcumuladores((v) => !v)} className="flex w-full items-center gap-2 text-left text-[14px] font-semibold text-ink-900">
            {verAcumuladores ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Acumuladores: escolher o que entra na conta
            <span className="ml-1 text-[11.5px] font-normal text-ink-400">(só a equipe vê esta parte)</span>
          </button>
          {verAcumuladores && (
            <>
              <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
                  {TIPOS.map((t) => (
                    <button key={t.id} type="button" onClick={() => setAba(t.id)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${aba === t.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{t.nome}</button>
                  ))}
                </div>
                {podeEditar && (
                  <div className="flex flex-wrap gap-2 text-[12px]">
                    <button type="button" onClick={() => emMassa(aba, "sugestao")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Usar sugestão</button>
                    <button type="button" onClick={() => emMassa(aba, "todos")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Marcar todos</button>
                    <button type="button" onClick={() => emMassa(aba, "nenhum")} className="rounded-lg border border-line px-2.5 py-1 text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-ink-400">
                      <th className="w-10 py-2 pr-2">Conta</th>
                      <th className="py-2 pr-3">Acumulador</th>
                      <th className="py-2 pr-3 text-right">Notas</th>
                      <th className="py-2 pr-3 text-right">Itens</th>
                      <th className="py-2 pr-3 text-right">Total da nota</th>
                      <th className="py-2 pr-3 text-right">Só os itens</th>
                      <th className="py-2 text-right">% do tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(r.linhas[aba] || []).map((linha) => {
                      const valorLinha = valor === "itens" ? linha.vprod : linha.vcon;
                      const marcado = linha.conta === "sim";
                      return (
                        <tr key={linha.chave} className={`border-b border-line/70 last:border-0 ${linha.conta === "nao" ? "text-ink-400" : ""}`}>
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              disabled={!podeEditar}
                              onClick={() => alternar(aba, linha)}
                              title={podeEditar ? (marcado ? "Tirar da conta" : "Considerar na conta") : linha.conta === "parcial" ? "Considerado só em parte das empresas" : "Escolha dentro de cada empresa"}
                              className={`flex h-6 w-6 items-center justify-center rounded-md border ${marcado ? "border-accent-500 bg-accent-500 text-white" : linha.conta === "parcial" ? "border-accent-500 text-accent-600" : "border-line-strong text-transparent"} ${podeEditar ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                            >
                              {linha.conta === "parcial" ? <Minus size={13} /> : <Check size={13} />}
                            </button>
                          </td>
                          <td className="py-2 pr-3"><span className="mr-2 text-[11.5px] tabular-nums text-ink-400">{linha.codigo}</span>{linha.nome}{!podeEditar ? "" : sugerirConsiderar(aba, linha.nome) === marcado ? "" : <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10.5px] text-ink-500">escolha sua</span>}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{inteiro(linha.notas)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{inteiro(linha.itens)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(linha.vcon)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(linha.vprod)}</td>
                          <td className="py-2 text-right tabular-nums">{pct(valorLinha, totBase)}</td>
                        </tr>
                      );
                    })}
                    {!(r.linhas[aba] || []).length && <tr><td colSpan={7} className="py-6 text-center text-ink-400">Nenhuma nota deste tipo no período.</td></tr>}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line-strong font-semibold text-ink-900">
                      <td />
                      <td className="py-2 pr-3">Total do tipo (todos os acumuladores)</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{inteiro(tot.notas)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{inteiro(tot.itens)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(tot.vcon)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{moneyFull(tot.vprod)}</td>
                      <td />
                    </tr>
                    <tr className="text-accent-700">
                      <td />
                      <td className="py-1 pr-3">Considerado na conta</td>
                      <td colSpan={5} className="py-1 text-right tabular-nums">{moneyFull(r.totais[aba].v)} · {inteiro(r.totais[aba].c)} {unidade}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-3 text-[11.5px] text-ink-400">Acumuladores de venda e de compra de mercadoria vêm marcados por sugestão; devolução, remessa, bonificação e demonstração vêm desmarcados. Ajuste ao seu critério: a escolha fica salva na empresa.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
