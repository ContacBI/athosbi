import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownCircle, ArrowDownRight, ArrowUpCircle, ArrowUpRight, BarChart3, ChevronDown, ChevronRight, Download, FileSpreadsheet, Lightbulb, Percent, Scale, Search, TrendingUp, Wallet, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { activeWorkspaceName, groupCompanies } from "../lib/groups.js";
import { exportLedgerExcel, exportLedgerPdf } from "../lib/exportLoaders.js";
import { slug } from "../lib/demonstrativoExport.js";
import Avatar from "../components/Avatar.jsx";
import { CARTAO, MES_CURTO, MES_LONGO, NAVY, ROSA, VERDE, brlCompacto, dec, eixo, moneyFull, pct } from "../lib/fmtNotas.js";
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

function Cartao({ rotulo, valor, sub, cor = VERDE, icone: Icone, negativo, delta, onClick }) {
  return (
    <div onClick={onClick} onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} title={onClick ? "Clique para ver a análise" : undefined} className={`${CARTAO} group relative flex min-w-0 flex-col justify-between overflow-hidden p-4 ${onClick ? "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/40" : ""}`}>
      <span className="absolute inset-y-0 left-0 w-1 opacity-90" style={{ background: cor }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
        <span className="flex items-center gap-1.5">{onClick && <ChevronRight size={14} className="-translate-x-1 text-accent-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />}{Icone && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600"><Icone size={14} /></span>}</span>
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


// Janela de lançamentos por trás de um valor da DRE (clique no valor). Mesmo modelo do "Diário da conta" dos demonstrativos (LedgerModal): janela sobreposta no centro,
// totais em cartões, busca, tabela e rodapé; com os botões de PDF e Excel.
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
    const l = linhas.filter((x) => !q || `${x.descricao} ${x.plano} ${x.loja} ${x.dia}`.toLowerCase().includes(q));
    return l.sort((a, b) => (ordem === "valor" ? Math.abs(b.valor) - Math.abs(a.valor) : a.mes - b.mes || a.dia.localeCompare(b.dia)));
  }, [linhas, busca, ordem]);
  const total = filtradas.reduce((s, x) => s + x.valor, 0);
  const maior = filtradas.reduce((m, x) => (Math.abs(x.valor) > Math.abs(m?.valor || 0) ? x : m), null);
  const mostraPlano = painel.alvo.tipo === "pag" && (painel.alvo.nomes || []).length > 1;
  const periodo = painel.mes ? `${MES_LONGO[painel.mes - 1]} de ${dados.ano}` : `${MES_LONGO[dados.mesDe - 1]} a ${MES_LONGO[dados.mesAte - 1]} de ${dados.ano}`;
  const negativo = total < 0;
  const th = "whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide";

  function baixar(formato) {
    const mm = (n) => String(n).padStart(2, "0");
    const exp = {
      label: painel.titulo,
      companyName: activeWorkspaceName(),
      classificacaoLabel: `${periodo}${ehConsolidado ? " · todas as lojas" : ""}`,
      totalLabel: `${filtradas.length} lançamento${filtradas.length === 1 ? "" : "s"} · Total ${moneyFull(total)}`,
      creditoPositivo: true,
      showCompany: ehConsolidado,
      rows: filtradas.map((x) => ({ data: `${dados.ano}-${mm(x.mes)}-${x.dia.slice(0, 2)}`, historico: x.descricao, counterpartText: [x.plano, x.situacao].filter(Boolean).join(" · "), debito: x.valor < 0 ? Math.abs(x.valor) : 0, credito: x.valor > 0 ? x.valor : 0, companyName: lojaCurta(x.loja) })),
      fileLabel: `lancamentos_${slug(painel.titulo)}`,
    };
    if (formato === "excel") exportLedgerExcel(exp);
    else exportLedgerPdf(exp);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex h-full max-h-[820px] w-full max-w-6xl flex-col rounded-2xl bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="flex items-center gap-3.5">
            <Avatar name={painel.titulo} size={44} />
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Lançamentos</span>
              <h2 className="mt-0.5 text-[19px] font-semibold text-ink-900">{painel.titulo}</h2>
              <p className="mt-0.5 text-[13px] text-ink-400">{periodo}{ehConsolidado ? " · todas as lojas" : ""} · {linhas.length} lançamentos</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => baixar("pdf")} disabled={!filtradas.length} title="Baixar PDF" className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} /> Baixar PDF</button>
            <button type="button" onClick={() => baixar("excel")} disabled={!filtradas.length} title="Baixar Excel" className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet size={14} /> Excel</button>
            <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface-page px-6 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${negativo ? "bg-danger-50 text-danger-600" : "bg-success-50 text-success-600"}`}>{negativo ? <ArrowDownCircle size={18} strokeWidth={1.8} /> : <ArrowUpCircle size={18} strokeWidth={1.8} />}</span>
            <div>
              <p className="text-[11px] text-ink-400">{busca.trim() ? "Total da busca" : "Total do período"}</p>
              <p className={`text-[16px] font-semibold ${negativo ? "text-danger-600" : "text-success-600"}`}>{moneyFull(total)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-500"><Search size={17} strokeWidth={1.8} /></span>
            <div className="min-w-0">
              <p className="text-[11px] text-ink-400">Maior lançamento</p>
              <p className="truncate text-[14px] font-semibold text-ink-900" title={maior?.descricao}>{maior ? `${moneyFull(maior.valor)} · ${maior.descricao}` : "—"}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-line px-6 py-2.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição, valor, plano ou data..." className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
          </div>
          {busca.trim() && <p className="mt-1.5 text-[11px] text-ink-400">{filtradas.length} de {linhas.length} lançamentos</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="sticky top-0 bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className={`${th} pl-6`}>Data</th>
                {ehConsolidado && <th className={th}>Loja</th>}
                <th className={`${th} w-full`}>Descrição</th>
                <th className={th}>Situação</th>
                <th className={`${th} cursor-pointer pr-6 text-right`} onClick={() => setOrdem((o) => (o === "valor" ? "data" : "valor"))} title="Clique para ordenar por valor / data">Valor {ordem === "valor" ? "↓" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((x, i) => (
                <tr key={i} className={`transition-colors hover:bg-accent-50/40 ${i % 2 ? "bg-surface-muted/70" : "bg-surface-card"}`}>
                  <td className="whitespace-nowrap px-4 py-2 pl-6 align-top tabular-nums text-ink-600">{x.dia}</td>
                  {ehConsolidado && <td className="whitespace-nowrap px-4 py-2 align-top text-[12px] text-ink-600">{lojaCurta(x.loja)}</td>}
                  <td className="max-w-0 px-4 py-2 align-top text-ink-900">
                    <p className="truncate" title={x.descricao}>{x.descricao}</p>
                    {mostraPlano && x.plano && <p className="mt-0.5 truncate text-[11px] text-ink-400">{x.plano}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 align-top text-ink-500">{x.situacao}</td>
                  <td className={`whitespace-nowrap px-4 py-2 pr-6 align-top text-right tabular-nums ${x.valor < 0 ? "text-danger-600" : "text-success-600"}`}>{num(x.valor)}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={ehConsolidado ? 5 : 4} className="px-6 py-10 text-center text-ink-400">{semDetalhe && !linhas.length ? "Este mês ainda não tem o detalhe dos lançamentos. Ele chega no próximo envio da Central." : linhas.length === 0 ? "Nenhum lançamento neste recorte." : "Nenhum lançamento encontrado para essa busca."}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-6 border-t border-line px-6 py-3 text-[12px]">
          <span className="text-ink-400">Total: <span className={`font-semibold ${negativo ? "text-danger-600" : "text-success-600"}`}>{moneyFull(total)}</span> · {filtradas.length} lançamento{filtradas.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Painel de ANÁLISE (clique num cartão ou numa barra de mês). Mesma ideia do Entradas x Saídas: cada número abre as comparações, a composição e uma leitura rápida.
const KPI_DEF = {
  receita: { nome: "Receita bruta", pegar: (r) => r.receita },
  margem: { nome: "Margem de contribuição", pegar: (r) => r.margem },
  operacional: { nome: "Resultado operacional", pegar: (r) => r.operacional },
  resultado: { nome: "Resultado", pegar: (r) => r.resultado },
};
const maiorTotal = (linhas, n, i) => linhas.filter((l) => (i == null ? l.t : l.v[i]) < 0).sort((a, b) => (i == null ? a.t - b.t : a.v[i] - b.v[i])).slice(0, n);
const todasLinhas = (r, grupos) => grupos.flatMap((g) => r[g].linhas);

function leituraKpi(tipo, ctx) {
  const { r, comp, lojas, ehConsolidado, ano, meses } = ctx;
  const f = KPI_DEF[tipo].pegar(r);
  const vals = meses.filter((m) => r.meses[m - 1].lojas > 0).map((m) => ({ m, v: f.v[m - 1], rec: r.receita.v[m - 1] }));
  const out = [];
  if (!vals.length) return out;
  const melhor = vals.reduce((a, b) => (b.v > a.v ? b : a));
  const pior = vals.reduce((a, b) => (b.v < a.v ? b : a));
  if (tipo === "receita") {
    if (comp?.temAnterior) out.push(`A receita ${comp.totais.ah >= 0 ? "subiu" : "caiu"} ${dec(Math.abs(comp.totais.ah))}% frente a ${ano - 1} nos meses fechados dos dois anos (${moneyFull(comp.totais.atual)} contra ${moneyFull(comp.totais.ant)}).`);
    if (vals.length > 1) out.push(`O melhor mês foi ${MES_LONGO[melhor.m - 1]} (${moneyFull(melhor.v)}) e o mais fraco, ${MES_LONGO[pior.m - 1]} (${moneyFull(pior.v)}).`);
    if (ehConsolidado && lojas.length > 1) {
      const lider = [...lojas].sort((a, b) => b.r.receita.t - a.r.receita.t)[0];
      out.push(`${lojaCurta(lider.membro.name)} responde por ${pct(lider.r.receita.t, r.receita.t)} da receita do grupo.`);
    }
  } else if (tipo === "margem") {
    out.push(`A margem de contribuição foi de ${pct(f.t, r.receita.t)} da receita (${moneyFull(f.t)}); os custos variáveis levaram ${pct(-r.variaveis.t, r.receita.t)}.`);
    const compras = r.variaveis.linhas.find((l) => l.nome === "Compras");
    if (compras) out.push(`Só as compras equivalem a ${pct(-compras.t, r.receita.t)} da receita.`);
    const pcts = vals.filter((x) => x.rec > 0).map((x) => ({ m: x.m, p: (x.v / x.rec) * 100 }));
    if (pcts.length > 1) {
      const a = pcts.reduce((x, y) => (y.p > x.p ? y : x));
      const b = pcts.reduce((x, y) => (y.p < x.p ? y : x));
      out.push(`A margem ficou entre ${dec(b.p)}% (${MES_LONGO[b.m - 1]}) e ${dec(a.p)}% (${MES_LONGO[a.m - 1]}).`);
    }
  } else if (tipo === "operacional") {
    out.push(`As despesas fixas consumiram ${pct(-r.fixas.t, r.receita.t)} da receita (${moneyFull(-r.fixas.t)}); o resultado operacional foi de ${moneyFull(f.t)}.`);
    const top = maiorTotal(r.fixas.linhas, 3);
    if (top.length) out.push(`As maiores despesas fixas: ${top.map((l) => `${l.nome} (${moneyFull(-l.t)})`).join(", ")}.`);
    const neg = vals.filter((x) => x.v < 0).length;
    out.push(neg ? `${neg} de ${vals.length} meses fecharam com resultado operacional negativo.` : "Nenhum mês do período fechou com resultado operacional negativo.");
  } else {
    out.push(`O resultado foi de ${moneyFull(f.t)} (${pct(f.t, r.receita.t)} da receita).`);
    const neg = vals.filter((x) => x.v < 0).length;
    out.push(neg ? `${neg} de ${vals.length} meses fecharam negativos; o pior foi ${MES_LONGO[pior.m - 1]} (${moneyFull(pior.v)}).` : "Todos os meses do período fecharam positivos.");
    if (r.financiamento.t) out.push(`Retiradas de sócios e empréstimos levaram ${moneyFull(-r.financiamento.t)} (${pct(-r.financiamento.t, r.receita.t)} da receita).`);
    const nc = r.fora.naoClass.reduce((s, l) => s + l.t, 0);
    if (nc) out.push(`Há ${moneyFull(-nc)} em despesas não classificadas fora da DRE; com elas o resultado seria ${moneyFull(r.resultadoAposNaoClass.t)}.`);
  }
  return out;
}

function leituraMes(m, ctx) {
  const { r, comp, ano, mesDe } = ctx;
  const i = m - 1;
  const out = [];
  const rec = r.receita.v[i];
  const dm = comp?.porMes.find((x) => x.mes === m);
  if (dm?.temAnt && !dm.parcial && dm.ant) out.push(`A receita de ${MES_LONGO[i]} ${dm.atual >= dm.ant ? "superou" : "ficou abaixo de"} ${ano - 1} em ${dec(Math.abs(((dm.atual - dm.ant) / dm.ant) * 100))}% (${moneyFull(dm.atual)} contra ${moneyFull(dm.ant)}).`);
  if (dm?.parcial) out.push("Mês em andamento: os números ainda mudam até o fechamento.");
  if (m - 1 >= mesDe && r.meses[m - 2]?.lojas > 0 && r.receita.v[m - 2]) out.push(`Frente a ${MES_LONGO[m - 2]}, a receita ${rec >= r.receita.v[m - 2] ? "subiu" : "caiu"} ${dec(Math.abs(((rec - r.receita.v[m - 2]) / r.receita.v[m - 2]) * 100))}%.`);
  if (rec) out.push(`Margem de contribuição de ${pct(r.margem.v[i], rec)} e resultado de ${moneyFull(r.resultado.v[i])} (${pct(r.resultado.v[i], rec)} da receita).`);
  const top = maiorTotal(todasLinhas(r, ["variaveis", "fixas", "financiamento", "outras"]), 3, i);
  if (top.length) out.push(`Maiores saídas do mês: ${top.map((l) => `${l.nome} (${moneyFull(-l.v[i])})`).join(", ")}.`);
  return out;
}

function Gaveta({ titulo, sub, onClose, children, extra }) {
  useEffect(() => {
    const fecha = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fecha);
    return () => window.removeEventListener("keydown", fecha);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex h-full max-h-[820px] w-full max-w-4xl flex-col rounded-2xl bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="flex items-center gap-3.5">
            <Avatar name={titulo} size={44} />
            <div className="min-w-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Análise</span>
              <h2 className="mt-0.5 truncate text-[19px] font-semibold text-ink-900">{titulo}</h2>
              <p className="mt-0.5 text-[13px] text-ink-400">{sub}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {extra}
            <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-page p-6 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-surface-card p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{titulo}</p>
      {children}
    </section>
  );
}

function Leitura({ frases }) {
  if (!frases.length) return null;
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700"><Lightbulb size={13} /> Leitura rápida</p>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[12.5px] leading-5 text-ink-700">{frases.map((f, i) => <li key={i}>{f}</li>)}</ul>
    </section>
  );
}

function BarraLinha({ rotulo, valor, total, max, onClick, sub, cor }) {
  const w = max ? Math.min(100, (Math.abs(valor) / max) * 100) : 0;
  return (
    <div onClick={onClick} className={`grid grid-cols-[minmax(110px,1.2fr)_minmax(80px,2fr)_auto] items-center gap-3 rounded-lg px-1.5 py-1 text-[12.5px] ${onClick ? "cursor-pointer hover:bg-surface-muted" : ""}`}>
      <span className="truncate text-ink-800" title={rotulo}>{rotulo}{sub ? <span className="ml-1 text-ink-400">{sub}</span> : null}</span>
      <span className="h-2 overflow-hidden rounded bg-surface-muted"><i className="block h-full rounded" style={{ width: `${w}%`, background: cor || (valor < 0 ? ROSA : VERDE) }} /></span>
      <span className={`text-right tabular-nums ${valor < 0 ? "text-rose-600" : "text-ink-900"}`}>{num(valor)}{total ? <span className="ml-1.5 text-ink-400">{pct(valor, total)}</span> : null}</span>
    </div>
  );
}

function PainelAnalise({ alvo, ctx, onClose, onAbrir, onLanc, onFoco }) {
  const { r, comp, lojas, ehConsolidado, ano, mesDe, mesAte, meses } = ctx;
  if (alvo.tipo === "mes") {
    const m = alvo.mes;
    const i = m - 1;
    const prox = (d) => { const n = m + d; if (n >= mesDe && n <= mesAte) onAbrir({ tipo: "mes", mes: n }); };
    const linhas = todasLinhas(r, ["variaveis", "fixas", "financiamento", "outras"]);
    const top = maiorTotal(linhas, 8, i);
    const maxTop = top.length ? Math.abs(top[0].v[i]) : 0;
    const dm = comp?.porMes.find((x) => x.mes === m);
    const quatro = [["Receita bruta", r.receita.v[i]], ["Margem de contribuição", r.margem.v[i]], ["Resultado operacional", r.operacional.v[i]], ["Resultado", r.resultado.v[i]]];
    return (
      <Gaveta titulo={`${MES_LONGO[i][0].toUpperCase()}${MES_LONGO[i].slice(1)} de ${ano}`} sub={ehConsolidado ? "Consolidado do grupo" : "Empresa"} onClose={onClose}
        extra={<><button type="button" onClick={() => prox(-1)} disabled={m <= mesDe} className="rounded-lg p-1.5 text-ink-500 hover:bg-surface-muted disabled:opacity-30" aria-label="Mês anterior">‹</button><button type="button" onClick={() => prox(1)} disabled={m >= mesAte} className="rounded-lg p-1.5 text-ink-500 hover:bg-surface-muted disabled:opacity-30" aria-label="Próximo mês">›</button></>}>
        <div className="grid grid-cols-2 gap-3">
          {quatro.map(([nome, v]) => (
            <div key={nome} className="rounded-xl border border-line/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{nome}</p>
              <p className={`text-[20px] font-bold tabular-nums ${v < 0 ? "text-rose-600" : "text-ink-900"}`}>{brlCompacto(v)}</p>
              <p className="text-[11.5px] text-ink-400">{nome === "Receita bruta" ? (dm?.temAnt && !dm.parcial && dm.ant ? <>{ano - 1}: {brlCompacto(dm.ant)} <Variacao ah={((dm.atual - dm.ant) / dm.ant) * 100} /></> : "vendas concretizadas") : `${pct(v, r.receita.v[i])} da receita`}</p>
            </div>
          ))}
        </div>
        {ehConsolidado && lojas.length > 1 && (
          <Secao titulo="Por loja neste mês (clique para focar a loja)">
            {[...lojas].sort((a, b) => b.r.receita.v[i] - a.r.receita.v[i]).map((l) => (
              <BarraLinha key={l.membro.id} rotulo={lojaCurta(l.membro.name)} valor={l.r.receita.v[i]} total={r.receita.v[i]} max={Math.max(...lojas.map((x) => x.r.receita.v[i]), 1)} cor={NAVY} onClick={() => onFoco(l.membro.id)} sub={`· resultado ${brlCompacto(l.r.resultado.v[i])}`} />
            ))}
          </Secao>
        )}
        <Secao titulo="Maiores saídas do mês (clique para ver os lançamentos)">
          {top.length === 0 ? <p className="text-[12.5px] text-ink-400">Sem saídas neste mês.</p> : top.map((l) => <BarraLinha key={l.nome} rotulo={l.nome} valor={l.v[i]} max={maxTop} total={r.receita.v[i]} onClick={() => onLanc({ tipo: "pag", nomes: [l.nome] }, l.nome, m)} />)}
        </Secao>
        <Leitura frases={leituraMes(m, ctx)} />
      </Gaveta>
    );
  }

  const def = KPI_DEF[alvo.kpi];
  const f = def.pegar(r);
  const dados = meses.map((m) => {
    const pm = comp?.porMes.find((x) => x.mes === m);
    return { m, mes: MES_CURTO[m - 1], valor: f.v[m - 1], [ano - 1]: alvo.kpi === "receita" && pm?.temAnt ? pm.ant : null };
  });
  const passos = [["Receita bruta", r.receita.t, "receita"], ["(−) Custos variáveis", r.variaveis.t], ["(=) Margem de contribuição", r.margem.t, "margem"], ["(−) Custos e despesas fixas", r.fixas.t], ["(=) Resultado operacional", r.operacional.t, "operacional"], ["(+) Rendimento de aplicações", r.investimento.t], ["(−) Financiamento", r.financiamento.t], ["(−) Outras receitas/despesas", r.outras.t], ["(=) Resultado", r.resultado.t, "resultado"]];
  const ate = { receita: 1, margem: 3, operacional: 5, resultado: 9 }[alvo.kpi];
  const gruposDoKpi = { margem: ["variaveis"], operacional: ["variaveis", "fixas"], resultado: ["variaveis", "fixas", "financiamento", "outras"] }[alvo.kpi];
  const top = gruposDoKpi ? maiorTotal(todasLinhas(r, gruposDoKpi), 8) : [];
  const maxTop = top.length ? Math.abs(top[0].t) : 0;
  const porLoja = ehConsolidado && lojas.length > 1 ? [...lojas].map((l) => ({ l, v: def.pegar(l.r).t })).sort((a, b) => b.v - a.v) : [];
  const maxLoja = Math.max(...porLoja.map((x) => Math.abs(x.v)), 1);
  return (
    <Gaveta titulo={def.nome} sub={`${mesDe === mesAte ? MES_LONGO[mesDe - 1] : `${MES_LONGO[mesDe - 1]} a ${MES_LONGO[mesAte - 1]}`} de ${ano}${ehConsolidado ? " · consolidado" : ""}`} onClose={onClose}>
      <div className="flex flex-wrap items-end gap-3">
        <p className={`text-[28px] font-bold leading-8 tabular-nums ${f.t < 0 ? "text-rose-600" : "text-ink-900"}`}>{moneyFull(f.t)}</p>
        {alvo.kpi === "receita" && comp?.temAnterior && <span className="flex items-center gap-2 pb-1 text-[12px] text-ink-400"><Variacao ah={comp.totais.ah} /> vs. {ano - 1} ({brlCompacto(comp.totais.ant)})</span>}
        {alvo.kpi !== "receita" && r.receita.t ? <span className="pb-1 text-[12px] text-ink-400">{pct(f.t, r.receita.t)} da receita</span> : null}
      </div>
      <Secao titulo="Mês a mês — clique numa barra para abrir o mês">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,150,.18)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={eixo} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine y={0} stroke="rgba(120,130,150,.5)" />
              <Tooltip formatter={(v) => (v == null ? "—" : moneyFull(v))} />
              {alvo.kpi === "receita" && <Bar dataKey={ano - 1} name={String(ano - 1)} fill="#9db4d3" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
              <Bar dataKey="valor" name={def.nome} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer" onClick={(d) => d?.m && onAbrir({ tipo: "mes", mes: d.m })}>
                {dados.map((d) => <Cell key={d.m} fill={alvo.kpi === "receita" ? NAVY : d.valor < 0 ? ROSA : VERDE} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Secao>
      {porLoja.length > 0 && (
        <Secao titulo="Por loja (clique para focar a loja)">
          {porLoja.map(({ l, v }) => <BarraLinha key={l.membro.id} rotulo={lojaCurta(l.membro.name)} valor={v} max={maxLoja} total={alvo.kpi === "receita" ? f.t : l.r.receita.t} cor={alvo.kpi === "receita" ? NAVY : undefined} onClick={() => onFoco(l.membro.id)} />)}
        </Secao>
      )}
      {ate > 1 && (
        <Secao titulo="Como chega nesse número">
          {passos.slice(0, ate).map(([nome, v, destaque]) => <BarraLinha key={nome} rotulo={nome} valor={v} total={r.receita.t} max={Math.max(...passos.slice(0, ate).map((p) => Math.abs(p[1])), 1)} cor={destaque ? NAVY : undefined} />)}
        </Secao>
      )}
      {top.length > 0 && (
        <Secao titulo="O que mais pesa (clique para ver os lançamentos)">
          {top.map((l) => <BarraLinha key={l.nome} rotulo={l.nome} valor={l.t} max={maxTop} total={r.receita.t} onClick={() => onLanc({ tipo: "pag", nomes: [l.nome] }, l.nome, null)} />)}
        </Secao>
      )}
      {alvo.kpi === "receita" && <button type="button" onClick={() => onLanc({ tipo: "receita" }, "Receita bruta", null)} className="self-start rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:border-accent-500/50">Ver as vendas do período</button>}
      <Leitura frases={leituraKpi(alvo.kpi, ctx)} />
    </Gaveta>
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
  const [analise, setAnalise] = useState(null); // { tipo: "kpi", kpi } | { tipo: "mes", mes } — painel de análise
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
  const grafico = meses.map((m) => ({ m, mes: MES_CURTO[m - 1], receita: r.receita.v[m - 1], resultado: r.resultado.v[m - 1], parcial: r.meses[m - 1]?.parcial }));

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
            <div className="flex items-center rounded-lg bg-surface-muted p-0.5 text-[11.5px]" role="group" aria-label="Atalhos de período">
              {[["Ano", 1, ultimoMes], ["1º sem", 1, 6], ["2º sem", 7, 12], ["1º tri", 1, 3], ["2º tri", 4, 6], ["3º tri", 7, 9], ["4º tri", 10, 12]].map(([nome, de, ate]) => {
                const ativo = mesDe === de && mesAte === ate;
                const temDado = de <= ultimoMes; // período sem nenhum mês com dado fica desligado
                return (
                  <button key={nome} type="button" disabled={!temDado} onClick={() => { setMesDe(de); setMesAte(ate); }} title={temDado ? `${MES_LONGO[de - 1]} a ${MES_LONGO[ate - 1]}` : "Sem dados neste período"} className={`rounded-md px-2 py-1 font-medium transition-colors ${ativo ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"} ${temDado ? "" : "cursor-not-allowed opacity-40"}`}>{nome}</button>
                );
              })}
            </div>
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
        <Cartao onClick={() => setAnalise({ tipo: "kpi", kpi: "receita" })} rotulo="Receita bruta" valor={r.receita.t} sub={comp?.temAnterior ? `${ano - 1}: ${brlCompacto(comp.totais.ant)}` : "vendas concretizadas"} delta={comp?.temAnterior ? <Variacao ah={comp.totais.ah} titulo={`vs. ${ano - 1} nos meses fechados dos dois anos`} /> : null} icone={Wallet} cor={NAVY} />
        <Cartao onClick={() => setAnalise({ tipo: "kpi", kpi: "margem" })} rotulo="Margem de contribuição" valor={r.margem.t} sub={margemPct == null ? "" : `${dec(margemPct)}% da receita`} icone={Percent} cor={VERDE} negativo={r.margem.t < 0} />
        <Cartao onClick={() => setAnalise({ tipo: "kpi", kpi: "operacional" })} rotulo="Resultado operacional" valor={r.operacional.t} sub={r.receita.t ? `${dec((r.operacional.t / r.receita.t) * 100)}% da receita` : ""} icone={Scale} cor={VERDE} negativo={r.operacional.t < 0} />
        <Cartao onClick={() => setAnalise({ tipo: "kpi", kpi: "resultado" })} rotulo="Resultado" valor={r.resultado.t} sub={resPct == null ? "" : `${dec(resPct)}% da receita`} icone={TrendingUp} cor={r.resultado.t < 0 ? ROSA : VERDE} negativo={r.resultado.t < 0} />
      </div>

      {comp?.temAnterior && (() => {
        const nomeLoja = (m) => lojaCurta(m.name);
        const grafico2 = comp.porMes.map((x) => ({ m: x.mes, mes: MES_CURTO[x.mes - 1] + (x.parcial ? "*" : ""), [ano]: x.atual, [ano - 1]: x.temAnt ? x.ant : null }));
        const linhasLoja = [...comp.porLoja].sort((a, b) => b.atual - a.atual);
        const comAh = comp.porLoja.filter((l) => l.ah != null);
        const melhor = comAh.length > 1 ? comAh.reduce((a, b) => (b.ah > a.ah ? b : a)) : null;
        const pior = comAh.length > 1 ? comAh.reduce((a, b) => (b.ah < a.ah ? b : a)) : null;
        const alertas = [];
        const lojasAlerta = ehConsolidado ? lojas : membrosUso.map((m) => ({ membro: m, r }));
        const margemGrupo = r.receita.t ? (r.margem.t / r.receita.t) * 100 : null;
        for (const l of lojasAlerta) {
          const c = comp.porLoja.find((x) => x.membro.id === l.membro.id);
          if (c && c.ah != null && c.ah < 0) alertas.push({ sev: "crit", loja: nomeLoja(l.membro), id: l.membro.id, txt: `Queda de receita frente a ${ano - 1}`, val: `${dec(c.ah)}%` });
          if (l.r.operacional.t < 0) alertas.push({ sev: "crit", loja: nomeLoja(l.membro), id: l.membro.id, txt: `Resultado operacional negativo em ${ano}`, val: moneyFull(l.r.operacional.t) });
          const mp = l.r.receita.t ? (l.r.margem.t / l.r.receita.t) * 100 : null;
          if (ehConsolidado && mp != null && margemGrupo != null && margemGrupo - mp >= 5) alertas.push({ sev: "warn", loja: nomeLoja(l.membro), id: l.membro.id, txt: `Margem de contribuição ${dec(margemGrupo - mp)} p.p. abaixo da média do grupo (${dec(margemGrupo)}%)`, val: `${dec(mp)}%` });
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
                      <Bar dataKey={ano} name={String(ano)} fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer" onClick={(d) => d?.m && setAnalise({ tipo: "mes", mes: d.m })} />
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
                      <tr key={l.membro.id} onClick={() => setFoco(l.membro.id)} title="Clique para focar a loja" className="cursor-pointer border-t border-line/60 hover:bg-surface-muted/60"><td className="py-1.5 text-ink-800">{nomeLoja(l.membro)}</td><td className="py-1.5 text-right tabular-nums text-ink-500">{num(l.ant)}</td><td className="py-1.5 text-right tabular-nums text-ink-900">{num(l.atual)}</td><td className="py-1.5 text-right"><Variacao ah={l.ah} /></td></tr>
                    ))}
                    <tr className="border-t-2 border-line font-semibold"><td className="py-1.5 text-ink-900">{ehConsolidado ? "Total" : nomeLoja(membrosUso[0])}</td><td className="py-1.5 text-right tabular-nums text-ink-600">{num(comp.totais.ant)}</td><td className="py-1.5 text-right tabular-nums text-ink-900">{num(comp.totais.atual)}</td><td className="py-1.5 text-right"><Variacao ah={comp.totais.ah} /></td></tr>
                  </tbody>
                </table>
                {melhor && pior && ehConsolidado && (
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div onClick={() => setFoco(melhor.membro.id)} className="cursor-pointer rounded-xl bg-emerald-500/10 p-2.5 hover:brightness-95" title="Clique para focar a loja"><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Maior crescimento</p><p className="text-[13px] font-semibold text-ink-900">{nomeLoja(melhor.membro)} <span className="text-emerald-600">{melhor.ah >= 0 ? "+" : ""}{dec(melhor.ah)}%</span></p></div>
                    <div onClick={() => setFoco(pior.membro.id)} className="cursor-pointer rounded-xl bg-rose-500/10 p-2.5 hover:brightness-95" title="Clique para focar a loja"><p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Menor crescimento</p><p className="text-[13px] font-semibold text-ink-900">{nomeLoja(pior.membro)} <span className="text-rose-600">{pior.ah >= 0 ? "+" : ""}{dec(pior.ah)}%</span></p></div>
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
                    <li key={i} onClick={ehConsolidado ? () => setFoco(a.id) : undefined} className={`flex flex-wrap items-center gap-3 py-1.5 text-[12.5px] ${ehConsolidado ? "cursor-pointer hover:bg-surface-muted/60" : ""}`}>
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
              <Bar dataKey="receita" name="Receita bruta" fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer" onClick={(d) => d?.m && setAnalise({ tipo: "mes", mes: d.m })} />
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
      {analise && (
        <PainelAnalise
          alvo={analise}
          ctx={{ r, comp, lojas, ehConsolidado, ano, mesDe, mesAte, meses }}
          onClose={() => setAnalise(null)}
          onAbrir={setAnalise}
          onLanc={(alvo, titulo, mes) => setPainel({ alvo, titulo, mes })}
          onFoco={(id) => { setFoco(id); setAnalise(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}
      {painel && <PainelLancamentos painel={painel} dados={{ membros: membrosUso, brutos, ano, mesDe, mesAte }} ehConsolidado={ehConsolidado} onClose={() => setPainel(null)} />}
    </div>
  );
}
