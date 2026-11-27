import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarRange, Check, ChevronDown, ChevronRight, GitCompareArrows, Landmark } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { setData } from "../data/store.js";
import { groupCompanies } from "../lib/groups.js";
import { CARTAO, MES_LONGO } from "../lib/fmtNotas.js";
import { REGIMES, fetchInternoContabil, fimDoMes } from "../lib/internoContabil.js";
import Dfc from "./Dfc.jsx";

// Interno x Contábil (Ferramentas, só Grupo Concent; pedido do Izaias em 27/11/2026): duas abas.
//  - "Demonstrativo interno": o demonstrativo gerencial do sistema do cliente, na mesma estrutura dele, com quanto de cada grupo foi achado na contabilidade e
//    para qual conta foi (montado e conferido na Central). No caixa, a prova: resultado líquido do relatório x movimento de caixa e equivalentes na contabilidade.
//  - "DFC": a DFC direta da contabilidade (a mesma do B.I.), pra ver lado a lado com a visão interna.

const num = (v) => (Math.abs(v || 0) < 0.005 ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const sinal = (v) => (v < -0.004 ? "−" : "") + num(Math.abs(v || 0));
const pct = (a, t) => (t ? Math.min(100, Math.max(0, (a / t) * 100)) : 100);
const pctTxt = (a, t) => {
  if (!t) return "—";
  if (Math.abs(t - a) < 0.01) return "100%";
  return `${Math.min(99.9, Math.round((a / t) * 1000) / 10).toLocaleString("pt-BR")}%`;
};
const bateu = (a, t) => Math.abs((t || 0) - (a || 0)) < 0.01;
const mesRotulo = (mes) => {
  const [a, m] = String(mes).split("-");
  return `${MES_LONGO[Number(m) - 1] || m} de ${a}`;
};

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-4 p-4 md:p-6">
      <div className="h-28 rounded-2xl bg-surface-muted" />
      <div className="h-24 rounded-2xl bg-surface-muted" />
      <div className="h-96 rounded-2xl bg-surface-muted" />
    </div>
  );
}

// conta de destino: azul quando é de resultado, cinza quando é patrimonial (baixa de salários/impostos/fornecedores a pagar)
function Chip({ d }) {
  const nome = (d.contas || []).map((c) => `${c.c} ${c.nome}`).join(" + ");
  return (
    <span
      title={(d.via ? `via ${d.via} → ` : "") + nome}
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium ${d.res ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-line bg-surface-muted text-ink-500"}`}
    >
      {d.via && <span className="mr-1 opacity-70">via {d.via} →</span>}
      <span className="truncate">{nome}</span>
    </span>
  );
}

function Achado({ linha, negativo }) {
  const ok = bateu(linha.achado, linha.total);
  return (
    <div className="text-right">
      <span className={`tabular-nums font-semibold ${ok ? "text-emerald-600" : "text-rose-600"}`}>{negativo ? "−" : ""}{num(linha.achado)}</span>
      {linha.nao > 0.004 && <span className="block text-[11px] text-rose-600">falta {num(linha.nao)}</span>}
    </div>
  );
}

const GRADE = "grid grid-cols-[minmax(0,2.6fr)_120px_130px] items-center gap-4 md:grid-cols-[minmax(0,2.4fr)_130px_150px_minmax(0,3fr)]";

function LinhaGrupo({ l }) {
  if (l.partes?.length) {
    return (
      <>
        <div className={`${GRADE} border-t border-line/50 px-5 py-2.5 text-[13px]`}>
          <span className="truncate font-semibold text-ink-900"><span className="mr-2 text-accent-600">=</span>{l.nome}</span>
          <span className="text-right font-semibold tabular-nums text-ink-900">{num(l.total)}</span>
          <Achado linha={l} />
          <span className="hidden text-[11.5px] text-ink-400 md:block">linha líquida: despesa − reembolso</span>
        </div>
        {l.partes.map((p) => (
          <div key={p.codigo} className={`${GRADE} px-5 py-1.5 text-[12.5px]`}>
            <span className="truncate pl-6 text-ink-600"><span className="mr-1.5 inline-block w-3 font-bold text-ink-400">{p.sinal === "-" ? "−" : "+"}</span><span className="mr-1.5 tabular-nums text-ink-400">{p.codigo}</span>{p.nome}</span>
            <span className="text-right tabular-nums text-ink-600">{p.sinal === "-" ? "−" : ""}{num(p.total)}</span>
            <Achado linha={p} negativo={p.sinal === "-"} />
            <span className="hidden min-w-0 flex-wrap gap-1.5 md:flex">{(p.destinos || []).slice(0, 3).map((d, i) => <Chip key={i} d={d} />)}</span>
          </div>
        ))}
      </>
    );
  }
  return (
    <div className={`${GRADE} border-t border-line/50 px-5 py-2.5 text-[13px] hover:bg-accent-500/5`}>
      <span className="truncate text-ink-800"><span className="mr-2 inline-block min-w-[34px] tabular-nums text-ink-400">{l.codigo}</span>{l.nome}</span>
      <span className="text-right font-semibold tabular-nums text-ink-900">{num(l.total)}</span>
      <Achado linha={l} />
      <span className="hidden min-w-0 flex-wrap gap-1.5 md:flex">
        {(l.destinos || []).slice(0, 3).map((d, i) => <Chip key={i} d={d} />)}
        {(l.destinos || []).length > 3 && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-400">+{l.destinos.length - 3}</span>}
      </span>
    </div>
  );
}

function Bloco({ nome, desc, total, achado, linhas, tracejado }) {
  const p = pct(achado, total);
  const ok = bateu(achado, total);
  return (
    <div className={`${tracejado ? "rounded-2xl border border-dashed border-line" : CARTAO} overflow-hidden`}>
      <div className={`${GRADE} border-b border-line/60 bg-surface-muted/50 px-5 py-3`}>
        <span className="flex min-w-0 items-baseline gap-2.5">
          <b className={`whitespace-nowrap text-[12.5px] font-bold uppercase tracking-[.12em] ${tracejado ? "text-ink-500" : "text-accent-600"}`}>{nome}</b>
          {desc && <span className="truncate text-[11.5px] text-ink-400">{desc}</span>}
        </span>
        <span className="text-right text-[15px] font-bold tabular-nums text-ink-900">{num(total)}</span>
        <span>
          {total ? (
            <>
              <span className="block text-right text-[11px] text-ink-400">{pctTxt(achado, total)} achado</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-200/40">
                <span className={`block h-full rounded-full ${ok ? "bg-emerald-500" : p > 80 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${p}%` }} />
              </span>
            </>
          ) : null}
        </span>
        <span className="hidden md:block" />
      </div>
      {linhas.length ? linhas.map((l) => <LinhaGrupo key={l.codigo} l={l} />) : <p className="px-5 py-3 text-[12.5px] text-ink-400">Nada neste mês.</p>}
    </div>
  );
}

function Faixa({ rotulo, sub, valor, final }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-5 ${final ? "border-accent-500/40 bg-gradient-to-r from-accent-500/15 to-accent-500/5 py-4" : "border-accent-500/30 bg-accent-500/5 py-3"}`}>
      <span className={`font-bold text-ink-900 ${final ? "text-[15px]" : "text-[13.5px]"}`}>
        {rotulo}
        {sub && <span className="ml-2 text-[12px] font-medium text-ink-400">{sub}</span>}
      </span>
      <b className={`tabular-nums ${final ? "text-[22px] text-accent-600" : "text-[17px]"} ${valor < 0 && !final ? "text-rose-600" : ""}`}>{sinal(valor)}</b>
    </div>
  );
}

// resumo do resultado: Receitas − Pessoal − Impostos − Gerais = EBIT(DA) + Outras entradas = Resultado − Abaixo = Resultado líquido
function Cascata({ c }) {
  const itens = [
    ["Receitas", c.receita, c.achado?.receita],
    ["−", null],
    ["Pessoal", c.pessoal, c.achado?.pessoal],
    ["−", null],
    ["Impostos", c.impostos, c.achado?.impostos],
    ["−", null],
    ["Despesas gerais", c.gerais, c.achado?.gerais],
    ["=", null],
    ["EBIT(DA)", c.ebit, undefined, "sub"],
    ["+", null],
    ["Outras entradas", c.entradas, c.achado?.entradas],
    ["=", null],
    ["Resultado", c.resultado, undefined, "sub"],
    ["−", null],
    ["Abaixo do resultado", c.abaixo, c.achado?.abaixo],
    ["=", null],
    ["Resultado líquido", c.liquido, undefined, "fim"],
  ];
  return (
    <div className={`${CARTAO} flex overflow-x-auto`}>
      {itens.map(([rot, v, ach, tipo], i) =>
        v === null ? (
          <span key={i} className="relative z-10 -mx-3 flex w-6 shrink-0 items-center justify-center self-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface-card text-[13px] font-bold text-ink-400 shadow-sm">{rot}</span>
          </span>
        ) : (
          <div key={i} className={`flex min-w-[130px] flex-1 flex-col gap-1 border-l border-line/60 px-4 py-4 first:border-l-0 ${tipo === "sub" ? "bg-surface-muted/50" : ""} ${tipo === "fim" ? "bg-gradient-to-br from-accent-500/20 to-accent-500/5" : ""}`}>
            <span className="truncate text-[10.5px] font-semibold uppercase tracking-[.1em] text-ink-400">{rot}</span>
            <b className={`whitespace-nowrap tabular-nums ${tipo === "fim" ? "text-[22px] text-accent-600" : "text-[19px] text-ink-900"}`}>{sinal(v)}</b>
            <span className="truncate text-[11px]">
              {ach === undefined ? " " : <span className={bateu(ach, v) ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>{pctTxt(ach, v)} achado na contabilidade</span>}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function Prova({ p }) {
  const [aberto, setAberto] = useState(false);
  const ok = Math.abs(p.diferenca || 0) < 0.01;
  const Caixa = ({ rot, v, sub, azul }) => (
    <div className={`flex min-w-0 flex-col gap-1 rounded-xl px-4 py-3 ${azul ? "bg-sky-500/10 ring-1 ring-sky-500/30" : "bg-surface-muted/70"}`}>
      <span className="truncate text-[10.5px] font-semibold uppercase tracking-[.1em] text-ink-400">{rot}</span>
      <b className={`whitespace-nowrap text-[20px] tabular-nums ${azul ? (v < 0 ? "text-rose-600" : "text-emerald-600") : "text-ink-900"}`}>{azul && v > 0 ? "+" : ""}{sinal(v)}</b>
      <span className="truncate text-[11px] text-ink-400">{sub}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
      <div className={`${CARTAO} flex flex-col p-4`}>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-400"><Landmark size={13} /> Caixa e equivalentes na contabilidade <span className="normal-case tracking-normal text-ink-300">bancos + aplicações · {p.contas?.length || 0} contas</span></p>
        <div className="grid flex-1 grid-cols-[1fr_18px_1fr_18px_1fr] items-stretch">
          <Caixa rot={`Saldo inicial · ${p.dIni}`} v={p.ini} sub="contabilidade" />
          <ArrowRight size={14} className="self-center justify-self-center text-ink-300" />
          <Caixa rot="Movimento do mês" v={p.mov} sub="contábil" azul />
          <ArrowRight size={14} className="self-center justify-self-center text-ink-300" />
          <Caixa rot={`Saldo final · ${p.dFim}`} v={p.fim} sub="contabilidade" />
        </div>
        {p.contas?.length > 0 && (
          <>
            <button type="button" onClick={() => setAberto((a) => !a)} className="mt-3 flex items-center gap-1 self-start text-[12px] font-semibold text-ink-400 hover:text-ink-700">
              {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} saldo por conta
            </button>
            {aberto && (
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-ink-400">
                    <th className="py-1 text-left font-semibold">Conta</th>
                    <th className="py-1 text-right font-semibold">Saldo {p.dIni}</th>
                    <th className="py-1 text-right font-semibold">Entradas</th>
                    <th className="py-1 text-right font-semibold">Saídas</th>
                    <th className="py-1 text-right font-semibold">Saldo {p.dFim}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.contas.map((x) => (
                    <tr key={x.c} className="border-t border-line/50">
                      <td className="max-w-[260px] truncate py-1.5 text-ink-700">{x.c} {x.nome}</td>
                      <td className="py-1.5 text-right tabular-nums">{num(x.ini)}</td>
                      <td className="py-1.5 text-right tabular-nums">{num(x.ent)}</td>
                      <td className="py-1.5 text-right tabular-nums">{num(x.sai)}</td>
                      <td className="py-1.5 text-right tabular-nums">{num(x.fim)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      <div className={`${CARTAO} flex flex-col p-4`}>
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-400">
          Resultado líquido × movimento contábil
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11.5px] normal-case tracking-normal ${ok ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{ok ? "✓ fecha" : "diferença"}</span>
        </p>
        {[
          ["Resultado do exercício", "relatório interno", p.resultado],
          ["(−) Abaixo do resultado", "empréstimos, previdência, distribuição", p.abaixo],
        ].map(([r, s, v]) => (
          <div key={r} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line/60 py-2 text-[13px]">
            <span className="truncate text-ink-600">{r}<span className="ml-1.5 text-[11.5px] text-ink-400">{s}</span></span>
            <b className="tabular-nums font-semibold">{sinal(v)}</b>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-2 text-[13px] font-bold"><span>= Resultado líquido do relatório</span><b className="tabular-nums">{sinal(p.liquidoRelatorio)}</b></div>
        <div className="flex items-baseline justify-between gap-3 py-2 text-[13px]"><span className="text-ink-600">Movimento contábil de caixa</span><b className="tabular-nums text-sky-600">{sinal(p.mov)}</b></div>
        <div className={`mt-2 flex items-center justify-between rounded-xl px-4 py-2.5 text-[13.5px] font-bold ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
          <span>{ok ? "Relatório = contabilidade" : "Diferença"}</span>
          <b className="text-[17px] tabular-nums">{ok ? "0,00" : sinal(p.diferenca)}</b>
        </div>
        {!ok && p.nota && <p className="mt-2 text-[11.5px] leading-5 text-ink-400">{p.nota}</p>}
      </div>
    </div>
  );
}

function Demonstrativo({ dados }) {
  const d = dados || {};
  const blocos = d.blocos || [];
  const ordem = ["receita", "pessoal", "impostos", "gerais"];
  const antes = ordem.map((id) => blocos.find((b) => b.id === id)).filter(Boolean);
  const depois = blocos.filter((b) => !ordem.includes(b.id));
  return (
    <div className="flex flex-col gap-4">
      {d.cascata && <Cascata c={d.cascata} />}
      {d.prova && <Prova p={d.prova} />}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-[11.5px] text-ink-400">
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10.5px] text-sky-700 dark:text-sky-300">conta</span> chega numa conta de resultado (receita/despesa)</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[10.5px] text-ink-500">conta</span> baixa de conta patrimonial (salários, impostos ou fornecedores a pagar)</span>
        <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-emerald-600">verde</span>/<span className="font-semibold text-rose-600">vermelho</span> = achado inteiro / falta na contabilidade</span>
      </div>
      <div className={`${GRADE} px-5 text-[10.5px] font-semibold uppercase tracking-[.12em] text-ink-400`}>
        <span>Grupo do relatório interno</span>
        <span className="text-right">No relatório</span>
        <span className="text-right">Achado na contabilidade</span>
        <span className="hidden md:block">Vai para</span>
      </div>
      {antes.map((b) => <Bloco key={b.id} nome={b.nome} desc={`${b.linhas.length} linha(s)`} total={b.total} achado={b.achado} linhas={b.linhas} />)}
      <Faixa rotulo="= Resultado operacional · EBIT(DA)" sub="receitas − pessoal − impostos − despesas gerais" valor={d.resultadoOperacional} />
      {depois.map((b) => <Bloco key={b.id} nome={b.nome} desc={`${b.linhas.length} linha(s)`} total={b.total} achado={b.achado} linhas={b.linhas} />)}
      <Faixa rotulo="= Resultado do exercício" sub="EBIT(DA) + outras entradas − outras saídas" valor={d.resultado} />
      {d.abaixo?.linhas?.length > 0 && <Bloco nome="Abaixo do resultado" desc="empréstimos, previdência e distribuição de lucros" total={d.abaixo.total} achado={d.abaixo.achado} linhas={d.abaixo.linhas} tracejado />}
      <Faixa rotulo="= Resultado líquido" sub="resultado do exercício − empréstimos − previdência − distribuição" valor={d.liquido} final />
    </div>
  );
}

export default function InternoContabil() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [brutos, setBrutos] = useState(null);
  const [erro, setErro] = useState("");
  const [foco, setFoco] = useState(null);
  const [mes, setMes] = useState(null);
  const [regime, setRegime] = useState("caixa");
  const [aba, setAba] = useState("interno");

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setBrutos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchInternoContabil(m.id).then((linhas) => [m.id, linhas])))
      .then((pares) => ativo && setBrutos(Object.fromEntries(pares)))
      .catch((err) => {
        console.error("Falha ao ler o Interno x Contábil:", err);
        if (ativo) setErro("Não consegui carregar o Interno x Contábil agora. Tente de novo.");
      });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMembros]);

  // empresa do grupo com dado (o demonstrativo interno é por empresa, não consolida)
  const comDados = useMemo(() => membros.filter((m) => (brutos?.[m.id] || []).length > 0), [membros, brutos]);
  useEffect(() => {
    if (comDados.length && !comDados.some((m) => m.id === foco)) setFoco(comDados[0].id);
  }, [comDados, foco]);
  const linhas = useMemo(() => brutos?.[foco] || [], [brutos, foco]);
  const meses = useMemo(() => [...new Set(linhas.map((l) => l.mes))].sort().reverse(), [linhas]);
  useEffect(() => {
    if (meses.length && !meses.includes(mes)) setMes(meses[0]);
  }, [meses, mes]);
  const regimesDoMes = REGIMES.filter((r) => linhas.some((l) => l.mes === mes && l.regime === r.id));
  useEffect(() => {
    if (regimesDoMes.length && !regimesDoMes.some((r) => r.id === regime)) setRegime(regimesDoMes[0].id);
  }, [regimesDoMes, regime]);
  const atual = linhas.find((l) => l.mes === mes && l.regime === regime);

  if (erro) return <div className="p-6 text-[13px] text-rose-600">{erro}</div>;
  if (!brutos) return <Esqueleto />;

  const select = "rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-accent-500";
  const periodoDoMes = mes ? { start: `${mes}-01`, end: fimDoMes(mes) } : null;
  const dfcNoMes = periodoDoMes && state.periodStart === periodoDoMes.start && state.periodEnd === periodoDoMes.end;

  return (
    <div className="flex w-full flex-col gap-5 p-4 md:p-6">
      <div className={`${CARTAO} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">Relatório interno × contabilidade</span>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-ink-900"><GitCompareArrows size={20} className="text-accent-600" /> Interno x Contábil</h1>
            <p className="mt-1 text-[12.5px] text-ink-400">
              {mes ? mesRotulo(mes) : "sem mês"}
              {atual?.synced_at ? ` · conferido na Central em ${new Date(atual.synced_at).toLocaleDateString("pt-BR")}` : ""}
              {atual?.dados?.arquivo ? ` · ${atual.dados.arquivo}` : ""}
            </p>
          </div>
          {meses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={mes || ""} onChange={(e) => setMes(e.target.value)} className={select} aria-label="Mês">
                {meses.map((m) => <option key={m} value={m}>{mesRotulo(m)}</option>)}
              </select>
              {aba === "interno" && (
                <div className="flex items-center rounded-lg bg-surface-muted p-0.5 text-[12px]" role="group" aria-label="Regime">
                  {REGIMES.map((r) => {
                    const tem = regimesDoMes.some((x) => x.id === r.id);
                    return (
                      <button key={r.id} type="button" disabled={!tem} onClick={() => setRegime(r.id)} title={tem ? "" : "A Central ainda não mandou este regime"} className={`rounded-md px-3 py-1 font-medium transition-colors ${regime === r.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"} ${tem ? "" : "cursor-not-allowed opacity-40"}`}>{r.nome}</button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        {grupo && comDados.length > 1 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {comDados.map((m) => (
              <button key={m.id} type="button" onClick={() => setFoco(m.id)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${foco === m.id ? "border-accent-500 bg-accent-500 text-white shadow-sm" : "border-line bg-surface-card text-ink-600 hover:border-accent-500/40"}`}>{m.name}</button>
            ))}
          </div>
        )}
        <nav className="-mb-1 flex gap-6 border-b border-line/70" aria-label="Abas">
          {[["interno", "Demonstrativo interno"], ["dfc", "DFC"]].map(([id, nome]) => (
            <button key={id} type="button" onClick={() => setAba(id)} className={`-mb-px border-b-2 px-1 pb-2.5 text-[14px] font-semibold transition-colors ${aba === id ? "border-accent-500 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"}`}>{nome}</button>
          ))}
        </nav>
      </div>

      {aba === "interno" &&
        (atual ? (
          <Demonstrativo dados={atual.dados} />
        ) : (
          <div className={`${CARTAO} p-6 text-[13px] text-ink-500`}>
            Ainda não chegou o demonstrativo interno {grupo ? "deste grupo" : "desta empresa"}. Ele vem da Central, depois de conferido lá contra a contabilidade.
          </div>
        ))}

      {aba === "dfc" && (
        <div className="flex flex-col gap-3">
          {periodoDoMes && (
            <div className={`${CARTAO} flex flex-wrap items-center gap-3 px-4 py-3 text-[12.5px] text-ink-500`}>
              <CalendarRange size={15} className="text-accent-600" />
              {dfcNoMes ? (
                <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> DFC de {mesRotulo(mes)}, o mesmo mês do demonstrativo interno.</span>
              ) : (
                <>
                  <span>A DFC segue o período escolhido no topo.</span>
                  <button type="button" onClick={() => setData({ periodStart: periodoDoMes.start, periodEnd: periodoDoMes.end })} className="rounded-full bg-accent-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-600">Ver {mesRotulo(mes)}</button>
                </>
              )}
            </div>
          )}
          <Dfc lockedMode="direct" />
        </div>
      )}
    </div>
  );
}
