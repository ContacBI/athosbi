import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronDown, ChevronRight, Percent, Scale, Search, TrendingUp, Wallet, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { groupCompanies } from "../lib/groups.js";
import { CARTAO, MES_CURTO, MES_LONGO, NAVY, ROSA, VERDE, brlCompacto, dec, eixo, moneyFull } from "../lib/fmtNotas.js";
import { comparativoReceita, fetchGestaoClickDre, lancamentosDe, montarDre } from "../lib/gestaoClickDre.js";

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-5 p-4 md:p-6">
      <div className="h-24 rounded-2xl bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-muted" />)}</div>
      <div className="h-72 rounded-2xl bg-surface-muted" />
    </div>
  );
}

// Selo de variação (A.H.%) contra o mesmo período do ano anterior
function Variacao({ ah, titulo }) {
  if (ah == null || !Number.isFinite(ah)) return null;
  const subiu = ah >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${subiu ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`} title={titulo}>
      {subiu ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {dec(Math.abs(ah))}%
    </span>
  );
}

function Cartao({ rotulo, valor, sub, cor = VERDE, icone: Icone, negativo, delta }) {
  return (
    <div className={`${CARTAO} relative flex min-w-0 flex-col justify-between overflow-hidden p-4`}>
      <span className="absolute inset-y-0 left-0 w-1 opacity-90" style={{ background: cor }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
        {Icone && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600"><Icone size={14} /></span>}
      </div>
      <p className={`mt-2 truncate text-[22px] font-bold leading-7 tabular-nums tracking-tight ${negativo ? "text-rose-600" : "text-ink-900"}`} title={moneyFull(valor)}>{brlCompacto(valor)}</p>
      {(delta || sub) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {delta}
          {sub && <span className="truncate text-[11.5px] text-ink-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}

// Nome curto da loja pra coluna do painel (os cadastros do portal têm razão social comprida; "ANJOS VITORIA" é a loja de Maringá)
const lojaCurta = (nome) => {
  const n = String(nome || "").toUpperCase();
  if (n.includes("CAMBE")) return "Cambé";
  if (n.includes("ROLANDIA")) return "Rolândia";
  if (n.includes("VITORIA") || n.includes("MARINGA")) return "Maringá";
  if (n.includes("CATUAI")) return "Catuaí";
  if (n.includes("JK")) return "JK";
  return nome;
};
const num = (v) => (Math.abs(v) < 0.005 ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));


// Painel lateral: os lançamentos por trás de um valor da DRE (clique no valor). Mesma lista que o Gestão Click mostra, já filtrada pela linha e pelo mês.
function PainelLancamentos({ painel, dados, ehConsolidado, onClose }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("data"); // "data" | "valor"
  useEffect(() => {
    const fecha = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fecha);
    return () => window.removeEventListener("keydown", fecha);
  }, [onClose]);
  const { linhas, semDetalhe } = useMemo(() => lancamentosDe({ ...dados, mes: painel.mes, alvo: painel.alvo }), [dados, painel]);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = linhas.filter((x) => !q || `${x.descricao} ${x.plano} ${x.loja}`.toLowerCase().includes(q));
    return l.sort((a, b) => (ordem === "valor" ? Math.abs(b.valor) - Math.abs(a.valor) : a.mes - b.mes || a.dia.localeCompare(b.dia)));
  }, [linhas, busca, ordem]);
  const total = filtradas.reduce((s, x) => s + x.valor, 0);
  const mostraPlano = painel.alvo.tipo === "pag" && (painel.alvo.nomes || []).length > 1;
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400";
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[860px] flex-col bg-surface-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">Lançamentos</p>
            <h2 className="truncate text-[17px] font-semibold text-ink-900">{painel.titulo}</h2>
            <p className="text-[12px] text-ink-400">{painel.mes ? `${MES_LONGO[painel.mes - 1]} de ${dados.ano}` : `${MES_LONGO[dados.mesDe - 1]} a ${MES_LONGO[dados.mesAte - 1]} de ${dados.ano}`}{ehConsolidado ? " · todas as lojas" : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-900" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface-card px-2.5">
            <Search size={14} className="text-ink-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição" className="w-full bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none" />
          </div>
          <p className="text-[12.5px] text-ink-500">{filtradas.length} lançamento(s) · <b className={`tabular-nums ${total < 0 ? "text-rose-600" : "text-ink-900"}`}>{moneyFull(total)}</b></p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {semDetalhe && !linhas.length ? (
            <p className="p-6 text-[13px] text-ink-500">Este mês ainda não tem o detalhe dos lançamentos. Ele chega no próximo envio da Central.</p>
          ) : !linhas.length ? (
            <p className="p-6 text-[13px] text-ink-500">Nenhum lançamento neste recorte.</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 bg-surface-card">
                <tr>
                  {ehConsolidado && <th className={th}>Loja</th>}
                  <th className={th}>Data</th>
                  <th className={th}>Descrição</th>
                  {mostraPlano && <th className={th}>Plano de contas</th>}
                  <th className={th}>Situação</th>
                  <th className={`${th} cursor-pointer text-right`} onClick={() => setOrdem((o) => (o === "valor" ? "data" : "valor"))} title="Clique para ordenar por valor / data">Valor {ordem === "valor" ? "↓" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((x, i) => (
                  <tr key={i} className="border-t border-line/60">
                    {ehConsolidado && <td className="px-3 py-1.5 text-ink-600">{lojaCurta(x.loja)}</td>}
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-ink-600">{x.dia}</td>
                    <td className="px-3 py-1.5 text-ink-800">{x.descricao}</td>
                    {mostraPlano && <td className="px-3 py-1.5 text-ink-600">{x.plano}</td>}
                    <td className="whitespace-nowrap px-3 py-1.5 text-ink-500">{x.situacao}</td>
                    <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${x.valor < 0 ? "text-rose-600" : "text-ink-900"}`}>{num(x.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function DreGerencial() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [brutos, setBrutos] = useState(null);
  const [erro, setErro] = useState("");
  const [ano, setAno] = useState(null);
  const [mesDe, setMesDe] = useState(1);
  const [mesAte, setMesAte] = useState(12);
  const [foco, setFoco] = useState("todas");
  const [abertos, setAbertos] = useState({});
  const [painel, setPainel] = useState(null); // { alvo, titulo, mes } — lançamentos abertos ao clicar num valor

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setBrutos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchGestaoClickDre(m.id).then((linhas) => [m.id, linhas])))
      .then((pares) => ativo && setBrutos(Object.fromEntries(pares)))
      .catch((err) => {
        console.error("Falha ao ler a DRE gerencial:", err);
        if (ativo) setErro("Não consegui carregar a DRE gerencial agora. Tente de novo.");
      });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMembros]);

  const anos = useMemo(() => [...new Set(Object.values(brutos || {}).flatMap((linhas) => linhas.map((item) => item.ano)))].sort((a, b) => b - a), [brutos]);
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[0]);
  }, [anos, ano]);
  const sincronizado = useMemo(() => Object.values(brutos || {}).flatMap((linhas) => linhas.filter((i) => i.ano === ano).map((i) => i.synced_at)).sort().pop(), [brutos, ano]);
  const membrosUso = useMemo(() => (grupo && foco !== "todas" ? membros.filter((m) => m.id === foco) : membros), [membros, grupo, foco]);
  const ehConsolidado = Boolean(grupo) && foco === "todas";

  // meses que têm dado: o período padrão vai até o último mês com dado
  const ultimoMes = useMemo(() => {
    let u = 1;
    for (const linhas of Object.values(brutos || {})) for (const item of linhas) if (item.ano === ano) for (const k of Object.keys(item.dados?.meses || {})) u = Math.max(u, Number(k));
    return u;
  }, [brutos, ano]);
  useEffect(() => { setMesAte(ultimoMes); setMesDe(1); }, [ano, ultimoMes]);

  const r = useMemo(() => (brutos && ano ? montarDre({ membros: membrosUso, brutos, ano, mesDe, mesAte }) : null), [membrosUso, brutos, ano, mesDe, mesAte]);
  // comparativo de receita com o ano anterior (só receita: é o que foi validado contra a planilha de 2025)
  const comp = useMemo(() => (brutos && ano ? comparativoReceita({ membros: membrosUso, brutos, ano, mesDe, mesAte }) : null), [membrosUso, brutos, ano, mesDe, mesAte]);
  // por loja (grupo): DRE de cada uma pros alertas
  const lojas = useMemo(() => (brutos && ano && grupo ? membros.map((m) => ({ membro: m, r: montarDre({ membros: [m], brutos, ano, mesDe, mesAte }) })) : []), [membros, brutos, ano, mesDe, mesAte, grupo]);

  if (erro) return <div className="p-6 text-[13px] text-rose-600">{erro}</div>;
  if (!brutos || !r) return <Esqueleto />;
  if (!anos.length || !r.temDados) {
    return (
      <div className="p-4 md:p-6">
        <div className={`${CARTAO} p-6 text-[13px] text-ink-500`}>
          <h1 className="flex items-center gap-2 text-[18px] font-semibold text-ink-900"><BarChart3 size={18} className="text-accent-600" /> DRE Gerencial</h1>
          <p className="mt-2">Ainda não chegaram dados do Gestão Click para {grupo ? "este grupo" : "esta empresa"}. Eles vêm da Central, depois de validados lá.</p>
        </div>
      </div>
    );
  }

  const meses = Array.from({ length: mesAte - mesDe + 1 }, (_, k) => mesDe + k);
  const parciais = meses.filter((m) => r.meses[m - 1]?.parcial);
  const select = "rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-accent-500";
  const periodoRotulo = mesDe === mesAte ? `${MES_LONGO[mesDe - 1]} de ${ano}` : `${MES_LONGO[mesDe - 1]} a ${MES_LONGO[mesAte - 1]} de ${ano}`;
  const margemPct = r.receita.t ? (r.margem.t / r.receita.t) * 100 : null;
  const resPct = r.receita.t ? (r.resultado.t / r.receita.t) * 100 : null;
  const grafico = meses.map((m) => ({ mes: MES_CURTO[m - 1], receita: r.receita.v[m - 1], resultado: r.resultado.v[m - 1], parcial: r.meses[m - 1]?.parcial }));

  const abre = (alvo, titulo, mes) => (e) => { e.stopPropagation(); setPainel({ alvo, titulo, mes }); };
  const Linha = ({ nome, v, t, nivel = 0, destaque, negrito, aberto, onClick, cor, alvo }) => (
    <tr className={`${destaque ? "bg-surface-muted/70" : ""} ${onClick ? "cursor-pointer hover:bg-surface-muted/50" : ""}`} onClick={onClick}>
      <td className={`sticky left-0 z-10 whitespace-nowrap border-b border-line/60 px-3 py-1.5 ${destaque ? "bg-surface-muted" : "bg-surface-card"} ${negrito ? "font-semibold text-ink-900" : "text-ink-700"}`} style={{ paddingLeft: 12 + nivel * 18 }}>
        <span className="inline-flex items-center gap-1.5">
          {onClick && (aberto ? <ChevronDown size={13} className="text-ink-400" /> : <ChevronRight size={13} className="text-ink-400" />)}
          {nome}
        </span>
      </td>
      {meses.map((m) => {
        const clica = alvo && Math.abs(v[m - 1]) >= 0.005;
        return (
          <td key={m} onClick={clica ? abre(alvo, nome, m) : undefined} title={clica ? "Ver os lançamentos" : undefined} className={`border-b border-line/60 px-3 py-1.5 text-right tabular-nums ${negrito ? "font-semibold" : ""} ${v[m - 1] < 0 ? "text-rose-600" : cor || "text-ink-800"} ${clica ? "cursor-pointer hover:bg-accent-500/10 hover:underline" : ""}`}>{num(v[m - 1])}</td>
        );
      })}
      <td onClick={alvo && Math.abs(t) >= 0.005 ? abre(alvo, nome, null) : undefined} title={alvo && Math.abs(t) >= 0.005 ? "Ver os lançamentos do período" : undefined} className={`border-b border-line/60 px-3 py-1.5 text-right font-semibold tabular-nums ${t < 0 ? "text-rose-600" : cor || "text-ink-900"} ${alvo && Math.abs(t) >= 0.005 ? "cursor-pointer hover:bg-accent-500/10 hover:underline" : ""}`}>{num(t)}</td>
    </tr>
  );
  const Bloco = ({ g }) => {
    const aberto = abertos[g.id];
    return (
      <>
        <Linha nome={g.nome} v={g.v} t={g.t} negrito aberto={aberto} alvo={{ tipo: "pag", nomes: g.linhas.map((l) => l.nome) }} onClick={g.linhas.length ? () => setAbertos((a) => ({ ...a, [g.id]: !a[g.id] })) : undefined} />
        {aberto && g.linhas.map((l) => <Linha key={l.nome} nome={l.nome} v={l.v} t={l.t} nivel={1} alvo={{ tipo: "pag", nomes: [l.nome] }} />)}
      </>
    );
  };
  const Fora = ({ id, titulo, itens }) => {
    if (!itens.length) return null;
    const aberto = abertos[id];
    const v = Array(12).fill(0);
    for (const l of itens) l.v.forEach((x, i) => { v[i] += x; });
    return (
      <>
        <Linha nome={titulo} v={v} t={itens.reduce((s, l) => s + l.t, 0)} negrito aberto={aberto} alvo={{ tipo: "pag", nomes: itens.map((l) => l.nome) }} onClick={() => setAbertos((a) => ({ ...a, [id]: !a[id] }))} />
        {aberto && itens.map((l) => <Linha key={l.nome} nome={l.nome} v={l.v} t={l.t} nivel={1} alvo={{ tipo: "pag", nomes: [l.nome] }} />)}
      </>
    );
  };

  return (
    <div key={`${ano}-${foco}`} className="flex w-full flex-col gap-5 p-4 md:p-6">
      <div className={`${CARTAO} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">Gestão Click</span>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-ink-900"><BarChart3 size={20} className="text-accent-600" /> DRE Gerencial</h1>
            <p className="mt-1 text-[12.5px] text-ink-400" title="Vendas concretizadas e pagamentos do fluxo de caixa do Gestão Click, por plano de contas. Só o que foi validado na Central.">
              {periodoRotulo}{sincronizado ? ` · atualizado em ${new Date(sincronizado).toLocaleDateString("pt-BR")}` : ""} · dados validados na Central
            </p>
            {parciais.length > 0 && <p className="mt-0.5 text-[11.5px] text-amber-600">{parciais.map((m) => MES_LONGO[m - 1]).join(", ")}: mês em andamento (ainda muda).</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
        {grupo && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[["todas", "Consolidado"], ...membros.map((m) => [m.id, m.name])].map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setFoco(id)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${foco === id ? "border-accent-500 bg-accent-500 text-white shadow-sm" : "border-line bg-surface-card text-ink-600 hover:border-accent-500/40"}`}>{nome}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Cartao rotulo="Receita bruta" valor={r.receita.t} sub={comp?.temAnterior ? `${ano - 1}: ${brlCompacto(comp.totais.ant)}` : "vendas concretizadas"} delta={comp?.temAnterior ? <Variacao ah={comp.totais.ah} titulo={`vs. ${ano - 1} nos meses fechados dos dois anos`} /> : null} icone={Wallet} cor={NAVY} />
        <Cartao rotulo="Margem de contribuição" valor={r.margem.t} sub={margemPct == null ? "" : `${dec(margemPct)}% da receita`} icone={Percent} cor={VERDE} negativo={r.margem.t < 0} />
        <Cartao rotulo="Resultado operacional" valor={r.operacional.t} sub={r.receita.t ? `${dec((r.operacional.t / r.receita.t) * 100)}% da receita` : ""} icone={Scale} cor={VERDE} negativo={r.operacional.t < 0} />
        <Cartao rotulo="Resultado" valor={r.resultado.t} sub={resPct == null ? "" : `${dec(resPct)}% da receita`} icone={TrendingUp} cor={r.resultado.t < 0 ? ROSA : VERDE} negativo={r.resultado.t < 0} />
      </div>

      {comp?.temAnterior && (() => {
        const nomeLoja = (m) => lojaCurta(m.name);
        const grafico2 = comp.porMes.map((x) => ({ mes: MES_CURTO[x.mes - 1] + (x.parcial ? "*" : ""), [ano]: x.atual, [ano - 1]: x.temAnt ? x.ant : null }));
        const linhasLoja = [...comp.porLoja].sort((a, b) => b.atual - a.atual);
        const comAh = comp.porLoja.filter((l) => l.ah != null);
        const melhor = comAh.length > 1 ? comAh.reduce((a, b) => (b.ah > a.ah ? b : a)) : null;
        const pior = comAh.length > 1 ? comAh.reduce((a, b) => (b.ah < a.ah ? b : a)) : null;
        const alertas = [];
        const lojasAlerta = ehConsolidado ? lojas : membrosUso.map((m) => ({ membro: m, r }));
        const margemGrupo = r.receita.t ? (r.margem.t / r.receita.t) * 100 : null;
        for (const l of lojasAlerta) {
          const c = comp.porLoja.find((x) => x.membro.id === l.membro.id);
          if (c && c.ah != null && c.ah < 0) alertas.push({ sev: "crit", loja: nomeLoja(l.membro), txt: `Queda de receita frente a ${ano - 1}`, val: `${dec(c.ah)}%` });
          if (l.r.operacional.t < 0) alertas.push({ sev: "crit", loja: nomeLoja(l.membro), txt: `Resultado operacional negativo em ${ano}`, val: moneyFull(l.r.operacional.t) });
          const mp = l.r.receita.t ? (l.r.margem.t / l.r.receita.t) * 100 : null;
          if (ehConsolidado && mp != null && margemGrupo != null && margemGrupo - mp >= 5) alertas.push({ sev: "warn", loja: nomeLoja(l.membro), txt: `Margem de contribuição ${dec(margemGrupo - mp)} p.p. abaixo da média do grupo (${dec(margemGrupo)}%)`, val: `${dec(mp)}%` });
        }
        alertas.sort((a, b) => (a.sev === b.sev ? a.loja.localeCompare(b.loja) : a.sev === "crit" ? -1 : 1));
        const rotuloMeses = comp.mesesComparados.length === 1 ? MES_LONGO[comp.mesesComparados[0] - 1] : `${MES_CURTO[comp.mesesComparados[0] - 1]} a ${MES_CURTO[comp.mesesComparados[comp.mesesComparados.length - 1] - 1]}`;
        return (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <div className={`${CARTAO} p-4 xl:col-span-3`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Receita bruta {ano} x {ano - 1}, mês a mês</p>
                <div className="mt-2 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={grafico2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,150,.18)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={eixo} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip formatter={(v) => (v == null ? "—" : moneyFull(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey={ano - 1} name={String(ano - 1)} fill="#9db4d3" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey={ano} name={String(ano)} fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-400">Variação calculada só nos meses fechados dos dois anos ({rotuloMeses}){comp.mesesFora.length ? `; ${comp.mesesFora.map((m) => MES_LONGO[m - 1]).join(", ")} fica de fora (mês em andamento ou sem dado em ${ano - 1})` : ""}. Só a receita foi validada contra a planilha de {ano - 1}; as despesas de {ano - 1} ainda não.</p>
              </div>
              <div className={`${CARTAO} flex flex-col gap-3 p-4 xl:col-span-2`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{ehConsolidado ? "Receita por loja" : "Receita"} · {rotuloMeses}</p>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead><tr className="text-[11px] uppercase tracking-wider text-ink-400"><th className="py-1 text-left font-semibold">{ehConsolidado ? "Loja" : ""}</th><th className="py-1 text-right font-semibold">{ano - 1}</th><th className="py-1 text-right font-semibold">{ano}</th><th className="py-1 text-right font-semibold">A.H.</th></tr></thead>
                  <tbody>
                    {ehConsolidado && linhasLoja.map((l) => (
                      <tr key={l.membro.id} className="border-t border-line/60"><td className="py-1.5 text-ink-800">{nomeLoja(l.membro)}</td><td className="py-1.5 text-right tabular-nums text-ink-500">{num(l.ant)}</td><td className="py-1.5 text-right tabular-nums text-ink-900">{num(l.atual)}</td><td className="py-1.5 text-right"><Variacao ah={l.ah} /></td></tr>
                    ))}
                    <tr className="border-t-2 border-line font-semibold"><td className="py-1.5 text-ink-900">{ehConsolidado ? "Total" : nomeLoja(membrosUso[0])}</td><td className="py-1.5 text-right tabular-nums text-ink-600">{num(comp.totais.ant)}</td><td className="py-1.5 text-right tabular-nums text-ink-900">{num(comp.totais.atual)}</td><td className="py-1.5 text-right"><Variacao ah={comp.totais.ah} /></td></tr>
                  </tbody>
                </table>
                {melhor && pior && ehConsolidado && (
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-emerald-500/10 p-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Maior crescimento</p><p className="text-[13px] font-semibold text-ink-900">{nomeLoja(melhor.membro)} <span className="text-emerald-600">{melhor.ah >= 0 ? "+" : ""}{dec(melhor.ah)}%</span></p></div>
                    <div className="rounded-xl bg-rose-500/10 p-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Menor crescimento</p><p className="text-[13px] font-semibold text-ink-900">{nomeLoja(pior.membro)} <span className="text-rose-600">{pior.ah >= 0 ? "+" : ""}{dec(pior.ah)}%</span></p></div>
                  </div>
                )}
              </div>
            </div>
            <div className={`${CARTAO} p-4`}>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"><AlertTriangle size={13} /> Alertas do período</p>
              <p className="mt-0.5 text-[11.5px] text-ink-400">Queda de receita frente a {ano - 1}, resultado operacional negativo{ehConsolidado ? " ou margem abaixo da média do grupo" : ""}.</p>
              {alertas.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-emerald-600">Nenhum alerta neste período.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line/60">
                  {alertas.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-3 py-1.5 text-[12.5px]">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${a.sev === "crit" ? "bg-rose-500/15 text-rose-600" : "bg-amber-500/15 text-amber-600"}`}>{a.sev === "crit" ? "!" : "⚠"}</span>
                      <span className="w-24 shrink-0 font-medium text-ink-900">{a.loja}</span>
                      <span className="min-w-0 flex-1 text-ink-600">{a.txt}</span>
                      <span className={`tabular-nums font-semibold ${a.sev === "crit" ? "text-rose-600" : "text-amber-600"}`}>{a.val}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        );
      })()}

      <div className={`${CARTAO} p-4`}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Receita bruta x resultado, mês a mês</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,150,.18)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={eixo} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v) => moneyFull(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita bruta" fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke={VERDE} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${CARTAO} overflow-x-auto`}>
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-400">
              <th className="sticky left-0 z-10 bg-surface-card px-3 py-2.5 text-left font-semibold">{ehConsolidado ? "DRE consolidada" : "DRE"}</th>
              {meses.map((m) => <th key={m} className="px-3 py-2.5 text-right font-semibold">{MES_CURTO[m - 1]}{r.meses[m - 1]?.parcial ? "*" : ""}</th>)}
              <th className="px-3 py-2.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <Linha nome="Receita bruta" v={r.receita.v} t={r.receita.t} negrito destaque alvo={{ tipo: "receita" }} />
            <Bloco g={r.variaveis} />
            <Linha nome="Margem de contribuição" v={r.margem.v} t={r.margem.t} negrito destaque />
            <Bloco g={r.fixas} />
            <Linha nome="Resultado operacional" v={r.operacional.v} t={r.operacional.t} negrito destaque />
            <Linha nome="Investimento (rendimento de aplicações)" v={r.investimento.v} t={r.investimento.t} alvo={{ tipo: "invest" }} />
            <Bloco g={r.financiamento} />
            <Bloco g={r.outras} />
            <Linha nome="Resultado" v={r.resultado.v} t={r.resultado.t} negrito destaque />
            {(r.fora.internas.length > 0 || r.fora.naoClass.length > 0 || r.fora.naoMapeados.length > 0) && (
              <>
                <tr><td colSpan={meses.length + 2} className="sticky left-0 bg-surface-card px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Fora da DRE</td></tr>
                <Fora id="naoclass" titulo="Despesas não classificadas (sem linha na DRE)" itens={r.fora.naoClass} />
                {r.fora.naoClass.length > 0 && <Linha nome="Resultado após despesas não classificadas" v={r.resultadoAposNaoClass.v} t={r.resultadoAposNaoClass.t} negrito destaque />}
                <Fora id="naomap" titulo="Planos novos ainda sem linha (revisar)" itens={r.fora.naoMapeados} />
                <Fora id="internas" titulo="Movimentações internas (não entram no resultado)" itens={r.fora.internas} />
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] leading-5 text-ink-400">
        Receita bruta = vendas concretizadas (canceladas e em aberto ficam de fora). Despesas = pagamentos do fluxo de caixa agrupados pelo plano de contas, em negativo. Este módulo mostra só dados validados na Central;
        {parciais.length > 0 ? " * mês em andamento." : ""} Clique nas linhas com seta para abrir o detalhe por plano de contas e <b>em qualquer valor</b> para ver os lançamentos.
      </p>
      {painel && <PainelLancamentos painel={painel} dados={{ membros: membrosUso, brutos, ano, mesDe, mesAte }} ehConsolidado={ehConsolidado} onClose={() => setPainel(null)} />}
    </div>
  );
}
