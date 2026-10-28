import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Lightbulb, X } from "lucide-react";
import { NAVY, ROSA, VERDE, brlCompacto, dec, eixo, inteiro, moneyFull, pct } from "../lib/fmtNotas.js";

// Painel flutuante de comparações e análises de um cartão do Entradas x Saídas (clicar no cartão abre). Mostra: tendência dos últimos 12 meses com o período
// escolhido em destaque, período atual × anterior, ranking por empresa (grupo) e, só pra equipe, de onde vem o valor (acumuladores).
const META = {
  fat: { titulo: "Faturamento", sub: "saídas + serviços considerados", cor: VERDE, bomSobe: true, de: (x) => x.fat, fmt: brlCompacto },
  ent: { titulo: "Entradas", sub: "entradas consideradas", cor: ROSA, bomSobe: false, de: (x) => x.ent, fmt: brlCompacto },
  saldo: { titulo: "Faturamento − entradas", sub: "o que sai menos o que entra", cor: NAVY, bomSobe: true, de: (x) => x.saldo, fmt: brlCompacto },
  ticket: { titulo: "Ticket médio", sub: "faturamento ÷ vendas consideradas", cor: NAVY, bomSobe: true, de: (x) => x.ticket, fmt: moneyFull },
  ratio: { titulo: "Entradas ÷ faturamento", sub: "quanto do faturamento vira entrada", cor: ROSA, bomSobe: false, de: (x) => x.ratio, fmt: (v) => (v == null ? "—" : `${dec(v * 100)}%`) },
};

const flat = (res) => ({ fat: res.faturamento, ent: res.totais.E.v, saldo: res.saldo, ticket: res.ticket, ratio: res.faturamento ? res.totais.E.v / res.faturamento : null, vendas: res.vendas, comprasN: res.totais.E.c });

function Pill({ atual, anterior, bomSobe }) {
  if (anterior == null || atual == null || !anterior) return <span className="text-[11px] text-ink-300">—</span>;
  const v = (atual - anterior) / Math.abs(anterior);
  const subiu = v >= 0;
  const bom = bomSobe ? subiu : !subiu;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${bom ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
      {subiu ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {dec(Math.abs(v) * 100)}%
    </span>
  );
}

function Secao({ titulo, children, direita }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-surface-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink-900">{titulo}</h3>
        {direita && <span className="text-[11.5px] text-ink-400">{direita}</span>}
      </div>
      {children}
    </section>
  );
}

export default function EntradasSaidasDetalhe({ kpi, onClose, r, anterior, rotuloAnterior, serie, comparativo, ehConsolidado, equipe, valor, unidade, periodoRotulo }) {
  const meta = META[kpi];
  useEffect(() => {
    const aoTeclar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [onClose]);

  const atual = useMemo(() => flat(r), [r]);
  const prev = useMemo(() => (anterior ? { fat: anterior.faturamento, ent: anterior.totais.E.v, saldo: anterior.saldo, ticket: anterior.ticket, ratio: anterior.faturamento ? anterior.totais.E.v / anterior.faturamento : null, vendas: anterior.vendas, comprasN: anterior.totais.E.c } : null), [anterior]);
  const valorAtual = meta.de(atual);
  const valorAnterior = prev ? meta.de(prev) : null;
  const pontos = serie.filter((p) => meta.de(p) != null);
  const media = pontos.length ? pontos.reduce((s, p) => s + meta.de(p), 0) / pontos.length : null;
  const melhor = pontos.reduce((b, p) => (b == null || meta.de(p) > meta.de(b) ? p : b), null);
  const pior = pontos.reduce((b, p) => (b == null || meta.de(p) < meta.de(b) ? p : b), null);
  const dadosGrafico = serie.map((p) => ({ ...p, v: meta.de(p) }));

  const frases = [];
  if (media != null && valorAtual != null && media) frases.push(`O valor deste período está ${dec(Math.abs((valorAtual - media) / Math.abs(media)) * 100)}% ${valorAtual >= media ? "acima" : "abaixo"} da média dos últimos 12 meses (${meta.fmt(media)}).`);
  if (melhor && pior && melhor !== pior) frases.push(`Melhor mês da janela: ${melhor.rotulo} (${meta.fmt(meta.de(melhor))}). Mais fraco: ${pior.rotulo} (${meta.fmt(meta.de(pior))}).`);

  // por empresa (grupo consolidado)
  const porEmpresa = ehConsolidado
    ? comparativo.map(({ membro, r: re }) => ({ nome: String(membro.name).replace(/\s+(LTDA|S\/A|EPP|ME)\b.*$/i, ""), v: meta.de(flat(re)) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v)
    : [];
  const maxEmpresa = Math.max(...porEmpresa.map((x) => Math.abs(x.v)), 1);

  // de onde vem (só equipe): acumuladores considerados do tipo
  const tipos = kpi === "fat" || kpi === "ticket" ? ["S", "V"] : kpi === "ent" || kpi === "ratio" ? ["E"] : [];
  const origem = equipe
    ? tipos.flatMap((t) => r.linhas[t] || []).filter((l) => l.conta !== "nao").map((l) => ({ nome: `${l.codigo} · ${l.nome}`, v: kpi === "ticket" ? (l.notas ? (valor === "itens" ? l.vprod : l.vcon) / l.notas : 0) : valor === "itens" ? l.vprod : l.vcon, notas: l.notas })).sort((a, b) => b.v - a.v).slice(0, 7)
    : [];
  const totalOrigem = origem.reduce((s, x) => s + x.v, 0);
  const maxOrigem = Math.max(...origem.map((x) => x.v), 1);
  const saidasV = r.totais.S.v;
  const servicosV = r.totais.V.v;

  const linhasComparativo = [
    ["Faturamento", "fat", brlCompacto, true],
    ["Entradas", "ent", brlCompacto, false],
    ["Faturamento − entradas", "saldo", brlCompacto, true],
    ["Ticket médio", "ticket", moneyFull, true],
    ["Entradas ÷ faturamento", "ratio", (v) => (v == null ? "—" : `${dec(v * 100)}%`), false],
    [`Vendas (${unidade})`, "vendas", inteiro, true],
  ];

  // Portal no <body>: o painel é sempre centralizado na janela, mesmo dentro de uma tela com rolagem ou animação (um "fixed" dentro de elemento com transform fica preso a ele).
  // Não fecha clicando fora (pedido do Izaias): só pelo X ou pela tecla Esc.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label={meta.titulo}>
      <style>{`@keyframes esPainel { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } } .es-painel { animation: esPainel .22s ease-out both; } @media (prefers-reduced-motion: reduce) { .es-painel { animation: none; } }`}</style>
      <div className="es-painel relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface-page shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)]">
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.cor}, #e8681f)` }} />
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{meta.titulo} · {periodoRotulo}</p>
            <div className="mt-1 flex flex-wrap items-end gap-3">
              <span className="text-[34px] font-bold leading-10 tracking-tight tabular-nums text-ink-900">{kpi === "fat" || kpi === "ent" || kpi === "saldo" ? moneyFull(valorAtual) : meta.fmt(valorAtual)}</span>
              <Pill atual={valorAtual} anterior={valorAnterior} bomSobe={meta.bomSobe} />
              {valorAnterior != null && <span className="pb-1 text-[12px] text-ink-400">vs. {rotuloAnterior}: {kpi === "fat" || kpi === "ent" || kpi === "saldo" ? moneyFull(valorAnterior) : meta.fmt(valorAnterior)}</span>}
            </div>
            <p className="mt-0.5 text-[12px] text-ink-400">{meta.sub}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6">
          <Secao titulo="Últimos 12 meses" direita="o período escolhido está em destaque">
            <div className="h-[230px] text-ink-400">
              <ResponsiveContainer width="100%" height="100%">
                {kpi === "ticket" || kpi === "ratio" ? (
                  <LineChart data={dadosGrafico} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "currentColor" }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={(v) => (kpi === "ratio" ? `${dec(v * 100, 0)}%` : eixo(v))} tick={{ fontSize: 11, fill: "currentColor" }} width={48} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(128,128,128,0.2)" }} formatter={(v) => [meta.fmt(v), meta.titulo]} />
                    {media != null && <ReferenceLine y={media} stroke="currentColor" strokeDasharray="4 4" strokeOpacity={0.5} />}
                    <Line dataKey="v" stroke={meta.cor} strokeWidth={2.5} connectNulls isAnimationActive={false} dot={(p) => <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload.noPeriodo ? 5 : 3} fill={p.payload.noPeriodo ? meta.cor : "#fff"} stroke={meta.cor} strokeWidth={2} />} />
                  </LineChart>
                ) : (
                  <BarChart data={dadosGrafico} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "currentColor" }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={eixo} tick={{ fontSize: 11, fill: "currentColor" }} width={48} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(128,128,128,0.2)" }} formatter={(v) => [moneyFull(v), meta.titulo]} />
                    {media != null && <ReferenceLine y={media} stroke="currentColor" strokeDasharray="4 4" strokeOpacity={0.5} />}
                    <Bar dataKey="v" radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                      {dadosGrafico.map((p) => <Cell key={p.rotulo} fill={kpi === "saldo" && (p.v ?? 0) < 0 ? ROSA : meta.cor} fillOpacity={p.noPeriodo ? 1 : 0.35} />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {media != null && <p className="mt-1 text-[11.5px] text-ink-400">Linha tracejada: média dos 12 meses ({meta.fmt(media)}).</p>}
          </Secao>

          <div className="grid gap-4 lg:grid-cols-2">
            <Secao titulo="Período atual × anterior" direita={rotuloAnterior ? `vs. ${rotuloAnterior}` : "sem período anterior completo"}>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
                    <th className="pb-1.5">Indicador</th><th className="pb-1.5 text-right">Atual</th><th className="pb-1.5 text-right">Anterior</th><th className="pb-1.5 text-right">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasComparativo.map(([nome, chave, fmt, bomSobe]) => (
                    <tr key={chave} className={`border-t border-line/60 ${chave === kpi ? "bg-accent-500/[0.06] font-semibold" : ""}`}>
                      <td className="py-1.5 pr-2 text-ink-700">{nome}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(atual[chave])}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink-500">{prev ? fmt(prev[chave]) : "—"}</td>
                      <td className="py-1.5 pl-2 text-right"><Pill atual={atual[chave]} anterior={prev?.[chave]} bomSobe={bomSobe} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Secao>

            {ehConsolidado && porEmpresa.length > 1 ? (
              <Secao titulo="Por empresa" direita="no período">
                <div className="flex flex-col gap-2.5">
                  {porEmpresa.map((x) => (
                    <div key={x.nome}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]"><span className="truncate text-ink-700">{x.nome}</span><span className="tabular-nums font-medium text-ink-900">{meta.fmt(x.v)}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (Math.abs(x.v) / maxEmpresa) * 100)}%`, background: meta.cor }} /></div>
                    </div>
                  ))}
                </div>
              </Secao>
            ) : kpi === "fat" && saidasV > 0 && servicosV > 0 ? (
              <Secao titulo="De onde vem">
                {[["Vendas de mercadoria", saidasV], ["Serviços prestados", servicosV]].map(([nome, v]) => (
                  <div key={nome} className="mb-2.5">
                    <div className="mb-1 flex items-baseline justify-between text-[12.5px]"><span className="text-ink-700">{nome}</span><span className="tabular-nums font-medium">{brlCompacto(v)} · {pct(v, saidasV + servicosV)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${(v / (saidasV + servicosV)) * 100}%`, background: meta.cor }} /></div>
                  </div>
                ))}
              </Secao>
            ) : null}
          </div>

          {equipe && origem.length > 0 && (
            <Secao titulo={kpi === "ticket" ? "Ticket médio por acumulador" : "De onde vem o valor (acumuladores considerados)"} direita="só a equipe vê">
              <div className="flex flex-col gap-2.5">
                {origem.map((x) => (
                  <div key={x.nome}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]"><span className="truncate text-ink-700">{x.nome}</span><span className="shrink-0 tabular-nums font-medium text-ink-900">{kpi === "ticket" ? moneyFull(x.v) : `${brlCompacto(x.v)} · ${pct(x.v, totalOrigem)}`}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (x.v / maxOrigem) * 100)}%`, background: meta.cor }} /></div>
                  </div>
                ))}
              </div>
            </Secao>
          )}

          {frases.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {frases.map((f) => (
                <div key={f} className="flex items-start gap-2.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] px-3.5 py-3">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent-600" />
                  <p className="text-[12.5px] leading-[18px] text-ink-700">{f}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
