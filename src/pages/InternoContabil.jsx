import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, CalendarRange, Check, ChevronRight, CircleDollarSign, GitCompareArrows, Landmark, Receipt, Search, TrendingUp, Users, Wallet, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { setData } from "../data/store.js";
import { groupCompanies } from "../lib/groups.js";
import { CARTAO, MES_LONGO, NAVY, ROSA, VERDE, dec, moneyFull } from "../lib/fmtNotas.js";
import { REGIMES, fetchInternoContabil, fimDoMes } from "../lib/internoContabil.js";
import Dfc from "./Dfc.jsx";

// Interno x Contábil (Ferramentas, só Grupo Concent; pedido do Izaias em 27/11/2026): duas abas.
//  - "Demonstrativo interno": o demonstrativo gerencial do sistema do cliente, na mesma estrutura dele, com quanto de cada grupo foi achado na contabilidade e
//    para qual conta foi (montado e conferido na Central). No caixa, a prova: resultado líquido do relatório x movimento de caixa e equivalentes na contabilidade.
//  - "DFC": a DFC direta da contabilidade (a mesma do B.I.), pra ver lado a lado com a visão interna.
// Visual no ritmo do B.I. (27/11, 2ª versão): cartões de indicador como o DRE Gerencial e a tabela no padrão da DFC (faixa de grupo, subtotal em laranja claro).

const AZUL = "#2f6fed";
const LARANJA = "#e8691f";
// centavos: o usuário escolhe no topo (padrão: sem; guardado no navegador). Sem centavos, o que fica abaixo de R$ 1 (ex.: diferença de 0,37 da prova)
// continua com os centavos, senão viraria "R$ 0".
const CHAVE_CENTAVOS = "athosbi.internoContabil.centavos";
let COM_CENTAVOS = (() => { try { return localStorage.getItem(CHAVE_CENTAVOS) === "1"; } catch { return false; } })();
const money = (v) => {
  const x = Number(v || 0);
  if (COM_CENTAVOS || (x !== 0 && Math.abs(x) < 1)) return moneyFull(x);
  return Math.round(x).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const inteiro = (v) => Number(Math.round(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const pctTxt = (a, t) => {
  if (!t) return "—";
  if (Math.abs(t - a) < 0.01) return "100%";
  return `${dec(Math.min(99.9, Math.round((a / t) * 1000) / 10))}%`;
};
const bateu = (a, t) => Math.abs((t || 0) - (a || 0)) < 0.01;
const mesRotulo = (mes) => {
  const [a, m] = String(mes).split("-");
  return `${MES_LONGO[Number(m) - 1] || m} de ${a}`;
};

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-5 p-4 md:p-6">
      <div className="h-32 rounded-2xl bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-muted" />)}</div>
      <div className="h-96 rounded-2xl bg-surface-muted" />
    </div>
  );
}

// cartão de indicador (o mesmo desenho do DRE Gerencial / Entradas x Saídas)
function Cartao({ rotulo, valor, sub, cor = VERDE, icone: Icone, negativo, destaque, selo }) {
  return (
    <div className={`${CARTAO} relative flex min-w-0 flex-col justify-between overflow-hidden p-4 ${destaque ? "bg-gradient-to-br from-accent-500/10 to-transparent" : ""}`}>
      <span className="absolute inset-y-0 left-0 w-1 opacity-90" style={{ background: cor }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
        {Icone && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600"><Icone size={14} /></span>}
      </div>
      {valor !== null && <p className={`mt-2 truncate font-bold tabular-nums tracking-tight ${destaque ? "text-[26px] leading-8" : "text-[22px] leading-7"} ${negativo ? "text-rose-600" : "text-ink-900"}`} title={money(valor)}>{inteiro(valor)}</p>}
      <div className="mt-1 flex min-h-[20px] flex-wrap items-center gap-2">
        {selo}
        {sub && <span className="truncate text-[11.5px] text-ink-400">{sub}</span>}
      </div>
    </div>
  );
}

function SeloAchado({ achado, total }) {
  if (!total) return null;
  const ok = bateu(achado, total);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`} title="Quanto do relatório interno foi achado lançado na contabilidade">
      {ok && <Check size={11} />}
      {pctTxt(achado, total)} achado
    </span>
  );
}

// conta de destino: azul = conta de resultado; cinza = baixa de conta patrimonial (salários, impostos, fornecedores a pagar)
function Chip({ d }) {
  const nome = (d.contas || []).map((c) => `${c.c} ${c.nome}`).join(" + ");
  return (
    <span title={(d.via ? `via ${d.via} → ` : "") + nome} className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${d.res ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-surface-muted text-ink-500"}`}>
      {d.via && <span className="mr-1 opacity-60">via {d.via} ›</span>}
      <span className="truncate">{nome}</span>
    </span>
  );
}

// valor achado: verde quando bate com o relatório, vermelho quando falta
function Achado({ linha, menos }) {
  const ok = bateu(linha.achado, linha.total);
  return (
    <span className={`flex items-center justify-end gap-1 whitespace-nowrap text-[12.5px] tabular-nums ${ok ? "text-emerald-600" : "font-semibold text-rose-600"}`}>
      {ok && <Check size={12} className="shrink-0 opacity-70" />}
      {menos ? "-" : ""}{money(linha.achado)}
    </span>
  );
}

const TEMPLATE = "minmax(300px, 1.25fr) 136px 150px minmax(260px, 1fr) 20px";

function LinhaItem({ l, aberto, onToggle, onAbrir }) {
  const partes = l.partes || [];
  const temPartes = partes.length > 0;
  const abre = !temPartes && l.det;
  const LinhaParte = ({ p }) => (
    <button type="button" onClick={() => p.det && onAbrir(p)} disabled={!p.det} style={{ gridTemplateColumns: TEMPLATE }} className="group grid w-full items-center gap-x-4 border-b border-line/70 bg-surface-page/60 px-4 py-1.5 text-left hover:bg-accent-50 disabled:cursor-default">
      <span className="flex min-w-0 items-center gap-2 pl-8 text-[12px] text-ink-600">
        <span className="w-3 shrink-0 text-center font-bold text-ink-400">{p.sinal === "-" ? "−" : "+"}</span>
        <span className="w-8 shrink-0 tabular-nums text-ink-400">{p.codigo}</span>
        <span className="truncate">{p.nome}</span>
      </span>
      <span className="whitespace-nowrap text-right text-[12px] tabular-nums text-ink-700">{p.sinal === "-" ? "-" : ""}{money(p.total)}</span>
      <Achado linha={p} menos={p.sinal === "-"} />
      <span className="flex min-w-0 flex-wrap gap-1">{(p.destinos || []).slice(0, 2).map((d, i) => <Chip key={i} d={d} />)}</span>
      <ChevronRight size={14} className="text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
  return (
    <>
      <button
        type="button"
        onClick={temPartes ? onToggle : abre ? () => onAbrir(l) : undefined}
        style={{ gridTemplateColumns: TEMPLATE }}
        className="group grid w-full items-center gap-x-4 border-b border-line/70 px-4 py-2 text-left transition-colors hover:bg-accent-50"
        title={abre ? "Ver cada linha do relatório e o lançamento da contabilidade" : undefined}
      >
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-800">
          {temPartes ? <ChevronRight size={14} className={`shrink-0 text-ink-400 transition-transform ${aberto ? "rotate-90" : ""}`} /> : <span className="w-8 shrink-0 text-[11.5px] tabular-nums text-ink-400">{l.codigo}</span>}
          <span className={`truncate ${temPartes ? "font-medium" : ""}`}>{l.nome}</span>
          {temPartes && <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-medium text-accent-700">líquido</span>}
        </span>
        <span className="whitespace-nowrap text-right text-[13px] font-medium tabular-nums text-ink-900">{money(l.total)}</span>
        <Achado linha={l} />
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          {temPartes ? <span className="text-[11.5px] text-ink-400">despesa − reembolso</span> : (l.destinos || []).slice(0, 2).map((d, i) => <Chip key={i} d={d} />)}
          {!temPartes && (l.destinos || []).length > 2 && <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-400">+{l.destinos.length - 2}</span>}
          {!temPartes && l.nao > 0.004 && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">falta {money(l.nao)}</span>}
        </span>
        {abre ? <ChevronRight size={14} className="text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-accent-600" /> : <span />}
      </button>
      {aberto && partes.map((p) => <LinhaParte key={p.codigo} p={p} />)}
    </>
  );
}

// faixa do grupo (como a da DFC), com o total e o % achado na mesma grade
function FaixaGrupo({ nome, total, achado, icone: Icone, qtd }) {
  return (
    <div style={{ gridTemplateColumns: TEMPLATE }} className="grid items-center gap-x-4 border-b border-line bg-surface-muted px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
        {Icone && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-500/10 text-accent-600"><Icone size={13} /></span>}
        <span className="truncate">{nome}</span>
        {qtd != null && <span className="shrink-0 font-normal normal-case tracking-normal text-ink-400">{qtd} {qtd === 1 ? "grupo" : "grupos"}</span>}
      </span>
      <span className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-ink-900">{money(total)}</span>
      <span className="text-right"><SeloAchado achado={achado} total={total} /></span>
      <span />
      <span />
    </div>
  );
}

// subtotal (EBIT, resultado...) em laranja claro, como os subtotais da DFC
function Subtotal({ nome, valor, sub, final }) {
  return (
    <div style={{ gridTemplateColumns: TEMPLATE }} className={`grid items-center gap-x-4 border-b border-line px-4 ${final ? "bg-accent-500/15 py-3.5" : "bg-accent-50 py-2.5"}`}>
      <span className={`truncate font-semibold text-ink-900 ${final ? "text-[14px]" : "text-[13px]"}`}>{nome}{sub && <span className="ml-2 text-[11px] font-normal text-ink-400">{sub}</span>}</span>
      <span className={`whitespace-nowrap text-right font-semibold tabular-nums ${final ? "text-[15px]" : "text-[13px]"} ${valor < 0 ? "text-danger-600" : "text-ink-900"}`}>{money(valor)}</span>
      <span />
      <span />
      <span />
    </div>
  );
}

const ICONE_BLOCO = { receita: CircleDollarSign, pessoal: Users, impostos: Receipt, gerais: Wallet, entradas: TrendingUp, saidas: Wallet };

// ---------------------------------------------------------------- janela do grupo (a mesma do card da Central): caminho na contabilidade e cada linha do relatório
// ao lado do lançamento que a baixou. Dados em linha.det = { caminhos: [{ bancos, meio, fim, res, v, n, obs }], cards: [{ rd: [...], lancs: [...], como, fim, outras } | { nao, rd, conc, ref }] }
const COMO = { documento: "pelo documento", "1:1": "valor e nome", emitente: "pelo emitente", banco: "valor no banco", "valor no banco": "valor no banco" };
const dataBR = (iso) => { const [a, m, d] = String(iso || "").slice(0, 10).split("-"); return a && m && d ? `${d}/${m}/${a}` : ""; };

function Janela({ l, contas, onClose }) {
  const [fil, setFil] = useState(l.nao > 0.004 ? "nao" : "todos");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const fecha = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fecha);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", fecha); document.body.style.overflow = antes; };
  }, [onClose]);
  const nome = (c) => (contas || {})[c] || "";
  const det = l.det || { caminhos: [], cards: [] };
  const cards = det.cards || [];
  const nNao = cards.filter((c) => c.nao).reduce((s, c) => s + c.rd.length, 0);
  const nTodas = cards.reduce((s, c) => s + c.rd.length, 0);
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const b = norm(busca);
  const visiveis = cards.filter((c) => (fil === "nao" ? c.nao : fil === "achado" ? !c.nao : true) && (!b || norm([...c.rd.map((r) => `${r.n} ${r.doc} ${money(r.v)}`), ...(c.lancs || []).map((y) => y.h)].join(" ")).includes(b)));
  const p = l.total ? Math.min(100, Math.max(0, (l.achado / l.total) * 100)) : 100;
  const Conta = ({ c, forte }) => (
    <span className={`flex min-w-0 items-baseline gap-1.5 ${forte ? "text-[13.5px] font-semibold text-ink-900" : "text-[12.5px] text-ink-700"}`}><b className="shrink-0 tabular-nums text-ink-400">{c}</b><span className="truncate">{nome(c)}</span></span>
  );
  const Lanc = ({ y }) => (
    <div className="flex flex-col gap-1 border-t border-dashed border-line py-2 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3"><span className="text-[11.5px] font-semibold tabular-nums text-ink-400">{dataBR(y.d)}</span><span className="text-[14px] font-bold tabular-nums text-ink-900">{money(y.v)}</span></div>
      <p className="text-[12.5px] font-medium leading-snug text-ink-800">{y.h}</p>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface-muted px-2 py-0.5 text-ink-600"><b className="text-ink-400">D</b>{y.deb} {nome(y.deb)}</span>
        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface-muted px-2 py-0.5 text-ink-600"><b className="text-ink-400">C</b>{y.cre} {nome(y.cre)}</span>
        {y.lote ? <span className="rounded-full border border-line px-2 py-0.5 text-ink-400">lote {y.lote}</span> : null}
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-3 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[94vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl">
        <div className="relative border-b border-line px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-semibold text-ink-600">grupo {l.codigo}</span>
            {l.nao > 0.004 ? <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 font-semibold text-rose-600">{nNao} não achada(s)</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600"><Check size={11} /> tudo achado</span>}
          </div>
          <h2 className="mt-2 text-[24px] font-bold tracking-tight text-ink-900">{l.nome}</h2>
          <p className="text-[12.5px] text-ink-400">{nTodas} linha(s) no relatório interno do mês</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-500 hover:bg-surface-muted hover:text-ink-900"><X size={16} /></button>
          <div className="mt-4 grid grid-cols-2 items-center gap-4 md:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
            <div className="relative hidden h-16 w-16 md:block" title={`${pctTxt(l.achado, l.total)} achado`}>
              <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(#10b981 ${p}%, rgba(244,63,94,.55) 0)` }} />
              <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-surface-card"><b className="text-[13px] leading-none text-ink-900">{pctTxt(l.achado, l.total)}</b><span className="text-[9.5px] text-ink-400">achado</span></div>
            </div>
            {[
              ["No relatório", money(l.total), "text-ink-900"],
              ["Achado na contabilidade", money(l.achado), "text-emerald-600"],
              ["Não achado", money(l.nao), l.nao > 0.004 ? "text-rose-600" : "text-ink-900"],
              ["Contas de destino", String((l.destinos || []).length), "text-ink-900"],
            ].map(([r, v, cls]) => (
              <div key={r} className="min-w-0 border-l border-line pl-4 first:border-l-0 md:first:border-l">
                <p className={`truncate text-[19px] font-bold tabular-nums ${cls}`}>{v}</p>
                <p className="text-[11px] text-ink-400">{r}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          <section>
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Caminho na contabilidade <span className="normal-case tracking-normal text-ink-300">· de onde saiu, o que baixou e onde ficou</span></p>
            <div className="flex flex-col gap-2.5">
              {(det.caminhos || []).map((c, i) => (
                <div key={i} className="grid grid-cols-1 items-center gap-4 rounded-xl border border-line bg-surface-page/50 p-3.5 lg:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="flex min-w-0 flex-wrap items-stretch gap-2">
                    {c.bancos?.length > 0 && (
                      <>
                        <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-muted px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Banco</span>{c.bancos.map((x) => <Conta key={x} c={x} />)}</div>
                        <ArrowRight size={14} className="shrink-0 self-center text-ink-300" />
                      </>
                    )}
                    {c.meio?.length > 0 && (
                      <>
                        <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-muted px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Baixa de</span>{c.meio.map((x) => <Conta key={x} c={x} />)}</div>
                        <ArrowRight size={14} className="shrink-0 self-center text-ink-300" />
                      </>
                    )}
                    <div className={`flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2 ring-1 ${c.res ? "bg-sky-500/10 ring-sky-500/30" : "bg-surface-muted ring-line"}`}><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{c.res ? "Fica no resultado" : "Fica em"}</span>{(c.fim || []).map((x) => <Conta key={x} c={x} forte />)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-bold tabular-nums text-ink-900">{money(c.v)}</p>
                    <p className="text-[11px] text-ink-400">{pctTxt(c.v, l.total)} · {c.n} linha(s)</p>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-200/40"><span className="block h-full rounded-full bg-accent-500" style={{ width: `${l.total ? Math.min(100, (c.v / l.total) * 100) : 0}%` }} /></span>
                  </div>
                  {c.obs && <p className="text-[12px] text-ink-500 lg:col-span-2">{c.obs.charAt(0).toUpperCase() + c.obs.slice(1)}.</p>}
                </div>
              ))}
              {l.nao > 0.004 && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5">
                  <span className="text-[13px] font-semibold text-rose-600">Sem lançamento na contabilidade no mês</span>
                  <span className="text-[18px] font-bold tabular-nums text-rose-600">{money(l.nao)}</span>
                </div>
              )}
            </div>
          </section>
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Relatório × contabilidade <span className="normal-case tracking-normal text-ink-300">· cada linha do relatório ao lado do lançamento que a baixou</span></p>
              <div className="ml-auto flex items-center rounded-lg bg-surface-muted p-0.5 text-[12px]">
                {[["todos", `Todas ${nTodas}`], ["nao", `Não achadas ${nNao}`], ["achado", `Achadas ${nTodas - nNao}`]].map(([id, r]) => (
                  <button key={id} type="button" onClick={() => setFil(id)} className={`rounded-md px-3 py-1 font-medium transition-colors ${fil === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}>{r}</button>
                ))}
              </div>
              <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface-card px-2.5 text-[12.5px] focus-within:border-accent-500">
                <Search size={13} className="text-ink-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, documento ou valor" className="w-56 bg-transparent text-ink-800 outline-none placeholder:text-ink-400" />
              </label>
            </div>
            <div className="mb-1.5 hidden grid-cols-[minmax(0,5fr)_120px_minmax(0,6fr)] px-4 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400 md:grid">
              <span>Relatório interno</span><span /><span>Lançamento na contabilidade</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {visiveis.map((cd, i) => {
                const somaRd = cd.rd.reduce((s, r) => s + r.v, 0);
                const somaD = (cd.lancs || []).reduce((s, y) => s + y.v, 0);
                const igual = !cd.nao && Math.abs(somaRd - somaD) < 0.01;
                return (
                  <div key={i} className={`grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-[minmax(0,5fr)_120px_minmax(0,6fr)] ${cd.nao ? "border-rose-500/30 bg-rose-500/5" : "border-line bg-surface-card"}`}>
                    <div className="flex min-w-0 flex-col gap-2 p-3.5">
                      {cd.rd.length > 1 && <span className="self-start rounded-full bg-accent-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent-700">{cd.rd.length} linhas do relatório</span>}
                      {cd.rd.map((r, j) => (
                        <div key={j} className="flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2 first:border-t-0 first:pt-0">
                          <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-ink-900">{r.n || "(sem nome)"}</p><p className="truncate text-[11px] text-ink-400">{[r.doc && `Doc ${r.doc}`, r.parc && `parc. ${r.parc}`, dataBR(r.d), r.port].filter(Boolean).join(" · ")}</p></div>
                          <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink-900">{money(r.v)}</span>
                        </div>
                      ))}
                      {cd.rd.length > 1 && <div className="flex justify-between border-t border-line pt-2 text-[12px] font-semibold"><span className="uppercase tracking-wider text-ink-400">Soma</span><span className="tabular-nums text-accent-700">{money(somaRd)}</span></div>}
                    </div>
                    <div className={`flex items-center justify-center gap-2 border-line px-2 py-2 md:flex-col md:border-x ${cd.nao ? "" : "bg-surface-muted/60"}`}>
                      {cd.nao ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-600"><X size={15} /></span>
                      ) : (
                        <>
                          <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-400">{COMO[cd.como] || cd.como}</span>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${igual ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{igual ? `= ${money(somaD)}` : `parte de ${money(somaD)}`}</span>
                        </>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 p-3.5">
                      {cd.nao ? (
                        <>
                          {cd.ref && (
                            <div className="grid grid-cols-2 gap-2 text-[12px]">
                              <div className="rounded-lg border border-line p-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Na contabilidade</p><p className="text-[15px] font-bold tabular-nums">{money(cd.ref.liq)}</p></div>
                              <div className="rounded-lg border border-line p-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Diferença</p><p className="text-[15px] font-bold tabular-nums text-rose-600">{money(cd.ref.dif)}</p></div>
                            </div>
                          )}
                          <p className={`rounded-lg px-3 py-2 text-[12.5px] ${cd.conc?.t ? "bg-surface-muted text-ink-700" : "text-ink-400"}`}>{cd.conc?.t || "Sem lançamento correspondente na contabilidade no mês."}</p>
                        </>
                      ) : (
                        <>
                          {(cd.lancs || []).map((y, j) => <Lanc key={j} y={y} />)}
                          {cd.outras && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] leading-snug text-amber-700 dark:text-amber-300">Este lançamento também baixa {cd.outras.n} linha(s) de outros grupos ({cd.outras.grupos.join(", ")}) — {money(cd.outras.v)}. Somando tudo, fecha com o lançamento.</p>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {visiveis.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-400">Nada neste filtro.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tabela({ d, regime }) {
  const [abertos, setAbertos] = useState({});
  const [janela, setJanela] = useState(null);
  const blocos = d.blocos || [];
  const ordem = ["receita", "pessoal", "impostos", "gerais"];
  const antes = ordem.map((id) => blocos.find((b) => b.id === id)).filter(Boolean);
  const depois = blocos.filter((b) => !ordem.includes(b.id) && (b.linhas.length || b.total));
  const nLinhas = blocos.reduce((s, b) => s + b.linhas.length, 0) + (d.abaixo?.linhas?.length || 0);
  const temDetalhe = blocos.some((b) => b.linhas.some((l) => l.det || (l.partes || []).some((p) => p.det)));
  const linhasDe = (b) => b.linhas.map((l) => <LinhaItem key={l.codigo} l={l} aberto={!!abertos[l.codigo]} onToggle={() => setAbertos((a) => ({ ...a, [l.codigo]: !a[l.codigo] }))} onAbrir={setJanela} />);
  return (
    <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Demonstrativo interno <span className="font-normal text-ink-400">· {regime === "caixa" ? "caixa" : "competência"}</span></h2>
          <p className="mt-0.5 text-[12px] text-ink-400">Os grupos do relatório gerencial do sistema, na mesma estrutura dele, com o valor achado na contabilidade e a conta para onde foi.{temDetalhe ? " Clique num grupo para ver cada lançamento." : ""}</p>
        </div>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-700">{nLinhas} grupos</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[940px]">
          <div style={{ gridTemplateColumns: TEMPLATE }} className="grid gap-x-4 border-b border-line px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
            <span>Grupo do relatório interno</span>
            <span className="text-right">No relatório</span>
            <span className="text-right">Achado na contabilidade</span>
            <span>Conta na contabilidade</span>
            <span />
          </div>
          {antes.map((b) => (
            <Fragment key={b.id}>
              <FaixaGrupo nome={b.nome} total={b.total} achado={b.achado} icone={ICONE_BLOCO[b.id]} qtd={b.linhas.length} />
              {linhasDe(b)}
            </Fragment>
          ))}
          <Subtotal nome="Resultado operacional · EBIT(DA)" sub="receitas − pessoal − impostos − despesas gerais" valor={d.resultadoOperacional} />
          {depois.map((b) => (
            <Fragment key={b.id}>
              <FaixaGrupo nome={b.nome} total={b.total} achado={b.achado} icone={ICONE_BLOCO[b.id]} qtd={b.linhas.length} />
              {linhasDe(b)}
            </Fragment>
          ))}
          <Subtotal nome="Resultado do exercício" valor={d.resultado} />
          {d.abaixo?.linhas?.length > 0 && (
            <>
              <FaixaGrupo nome="Abaixo do resultado" total={d.abaixo.total} achado={d.abaixo.achado} icone={Landmark} qtd={d.abaixo.linhas.length} />
              {linhasDe(d.abaixo)}
            </>
          )}
          <Subtotal nome="Resultado líquido" valor={d.liquido} final />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-4 py-2.5 text-[11.5px] text-ink-400">
        <span className="inline-flex items-center gap-1.5"><span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-700 dark:text-sky-300">conta</span> chega numa conta de resultado</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-medium text-ink-500">conta</span> baixa de conta patrimonial (salários, impostos ou fornecedores a pagar)</span>
        <span>“via Clientes/Fornecedores”: o banco baixou o cliente ou o fornecedor e a receita/despesa veio da nota</span>
      </div>
      {janela && <Janela l={janela} contas={d.contas} onClose={() => setJanela(null)} />}
    </div>
  );
}

// tipo da conta de caixa e equivalentes pelo nome: aplicação financeira, banco (conta movimento) ou caixa (dinheiro em espécie)
const tipoConta = (nome) => {
  const n = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/APLIC|\bFIC\b|\bCDB\b|INVEST|RENDA FIXA|POUPAN|\bFUNDO|\bLCI\b|\bLCA\b|TESOURO/.test(n)) return "aplicacao";
  if (/^CAIXA\s*$|CAIXA GERAL|CAIXA PEQUENO|FUNDO FIXO/.test(n)) return "caixa";
  return "banco";
};
const TIPOS_CONTA = {
  banco: ["Banco", "bg-sky-500/10 text-sky-700 dark:text-sky-300"],
  aplicacao: ["Aplicação", "bg-violet-500/10 text-violet-700 dark:text-violet-300"],
  caixa: ["Caixa", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
};
function TipoConta({ nome }) {
  const [rot, cls] = TIPOS_CONTA[tipoConta(nome)];
  return <span className={`w-[74px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10.5px] font-semibold ${cls}`}>{rot}</span>;
}

// prova do caixa: saldo inicial → movimento → saldo final (contabilidade) e o resultado líquido do relatório contra o movimento
function Prova({ p }) {
  const [aberto, setAberto] = useState(false);
  const ok = Math.abs(p.diferenca || 0) < 0.01;
  const Passo = ({ rot, v, destaque }) => (
    <div className={`min-w-0 flex-1 rounded-xl px-4 py-3 ${destaque ? "bg-sky-500/10 ring-1 ring-sky-500/25" : "bg-surface-muted/70"}`}>
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">{rot}</p>
      <p className={`mt-1 truncate text-[18px] font-bold tabular-nums tracking-tight ${destaque ? (v < 0 ? "text-rose-600" : "text-emerald-600") : "text-ink-900"}`} title={money(v)}>{money(v)}</p>
    </div>
  );
  return (
    <div className={`${CARTAO} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600"><Landmark size={16} /></span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900">Prova do caixa</h2>
          <p className="text-[12px] text-ink-400">O resultado líquido do relatório interno tem que ser o movimento de caixa e equivalentes (bancos + aplicações) na contabilidade.</p>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
          {ok ? <><BadgeCheck size={14} /> fecha com a contabilidade</> : <>diferença de {money(Math.abs(p.diferenca))}</>}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Na contabilidade · {p.contas?.length || 0} contas</p>
          <div className="flex items-center gap-2">
            <Passo rot={`Saldo em ${p.dIni}`} v={p.ini} />
            <ArrowRight size={14} className="shrink-0 text-ink-300" />
            <Passo rot="Movimento do mês" v={p.mov} destaque />
            <ArrowRight size={14} className="shrink-0 text-ink-300" />
            <Passo rot={`Saldo em ${p.dFim}`} v={p.fim} />
          </div>
          {p.contas?.length > 0 && (
            <button type="button" onClick={() => setAberto((a) => !a)} className="flex items-center gap-1 self-start text-[12px] font-medium text-accent-700 hover:underline">
              <ChevronRight size={13} className={`transition-transform ${aberto ? "rotate-90" : ""}`} /> {aberto ? "esconder" : "ver"} saldo por conta
            </button>
          )}
          {aberto && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="text-[11px] text-ink-400">
                    <th className="py-1.5 text-left font-medium">Conta</th>
                    <th className="py-1.5 text-right font-medium">{p.dIni}</th>
                    <th className="py-1.5 text-right font-medium">Entradas</th>
                    <th className="py-1.5 text-right font-medium">Saídas</th>
                    <th className="py-1.5 text-right font-medium">{p.dFim}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.contas.map((x) => (
                    <tr key={x.c} className="border-t border-line">
                      <td className="max-w-[300px] py-1.5 text-ink-700"><span className="flex min-w-0 items-center gap-2"><TipoConta nome={x.nome} /><span className="truncate">{x.nome}</span></span></td>
                      <td className="py-1.5 text-right tabular-nums">{money(x.ini)}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-600">{money(x.ent)}</td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600">{money(x.sai)}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{money(x.fim)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-ink-400">Entradas e saídas por conta incluem as transferências entre as próprias contas; no total elas se anulam.</p>
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Relatório interno × contabilidade</p>
          {[
            ["Resultado do exercício", p.resultado, ""],
            ["(−) Abaixo do resultado", p.abaixo, "empréstimos, previdência, distribuição"],
          ].map(([r, v, s]) => (
            <div key={r} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px]">
              <span className="truncate text-ink-600">{r}{s && <span className="ml-1.5 text-[11px] text-ink-400">{s}</span>}</span>
              <span className="tabular-nums text-ink-800">{money(v)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px] font-semibold"><span>= Resultado líquido do relatório</span><span className="tabular-nums">{money(p.liquidoRelatorio)}</span></div>
          <div className="flex items-baseline justify-between gap-3 py-2 text-[13px]"><span className="text-ink-600">Movimento de caixa na contabilidade</span><span className="tabular-nums font-medium text-sky-600">{money(p.mov)}</span></div>
          <div className={`mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
            <span>{ok ? "Relatório = contabilidade" : "Diferença"}</span>
            <span className="tabular-nums">{ok ? money(0) : money(p.diferenca)}</span>
          </div>
          {!ok && p.nota && <p className="mt-2 text-[11.5px] leading-5 text-ink-400">{p.nota}</p>}
        </div>
      </div>
    </div>
  );
}

export function Demonstrativo({ dados, regime }) {
  const d = dados || {};
  const c = d.cascata || {};
  const despesas = (c.pessoal || 0) + (c.impostos || 0) + (c.gerais || 0);
  const achDespesas = (c.achado?.pessoal || 0) + (c.achado?.impostos || 0) + (c.achado?.gerais || 0);
  const margem = c.receita ? (c.ebit / c.receita) * 100 : null;
  // conferência geral: quanto do relatório (em valor) foi achado na contabilidade
  const linhas = [...(d.blocos || []).flatMap((b) => b.linhas), ...(d.abaixo?.linhas || [])];
  const totalAbs = linhas.reduce((s, l) => s + Math.abs(l.total || 0), 0);
  const naoAbs = linhas.reduce((s, l) => s + Math.abs(l.nao || 0), 0);
  const conferido = totalAbs ? ((totalAbs - naoAbs) / totalAbs) * 100 : 100;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Cartao rotulo="Receitas" valor={c.receita} cor={NAVY} icone={CircleDollarSign} selo={<SeloAchado achado={c.achado?.receita} total={c.receita} />} />
        <Cartao rotulo="Despesas operacionais" valor={despesas} cor={ROSA} icone={Wallet} selo={<SeloAchado achado={achDespesas} total={despesas} />} sub="pessoal + impostos + gerais" />
        <Cartao rotulo="EBIT(DA)" valor={c.ebit} cor={VERDE} icone={TrendingUp} negativo={c.ebit < 0} sub={margem == null ? "" : `${dec(margem)}% da receita`} />
        <Cartao rotulo="Resultado líquido" valor={c.liquido} cor={LARANJA} icone={Landmark} negativo={c.liquido < 0} destaque sub="depois de empréstimos e distribuição" />
        <Cartao rotulo="Conferência" valor={null} cor={AZUL} icone={BadgeCheck} selo={<span className={`text-[22px] font-bold leading-7 tabular-nums ${conferido > 99.995 ? "text-emerald-600" : "text-amber-600"}`}>{dec(Math.min(conferido, conferido > 99.995 ? 100 : 99.9))}%</span>} sub="do relatório achado na contabilidade" />
      </div>
      {d.prova && <Prova p={d.prova} />}
      <Tabela d={d} regime={regime} />
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
  const [centavos, setCentavos] = useState(COM_CENTAVOS);
  COM_CENTAVOS = centavos;
  const trocaCentavos = () => { const v = !centavos; try { localStorage.setItem(CHAVE_CENTAVOS, v ? "1" : "0"); } catch { /* sem armazenamento */ } setCentavos(v); };

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
          </div>
          {meses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {aba === "interno" && (
                <button type="button" onClick={trocaCentavos} aria-pressed={centavos} title={centavos ? "Mostrar os valores sem centavos" : "Mostrar os valores com centavos"} className="flex items-center gap-2 rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-700 hover:border-accent-500/50">
                  <span className={`relative h-4 w-7 rounded-full transition-colors ${centavos ? "bg-accent-500" : "bg-ink-200/70"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${centavos ? "left-3.5" : "left-0.5"}`} /></span>
                  Centavos
                </button>
              )}
              <select value={mes || ""} onChange={(e) => setMes(e.target.value)} className={select} aria-label="Mês">
                {meses.map((m) => <option key={m} value={m}>{mesRotulo(m)}</option>)}
              </select>
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
          <Demonstrativo dados={atual.dados} regime={regime} />
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
