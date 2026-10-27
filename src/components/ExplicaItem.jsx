import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BarChart3, BookOpen, Calculator, CalendarRange, CheckCircle2, Eye, Info, Layers, Lightbulb, Package, Percent, PiggyBank, Receipt, Target, Wallet, X } from "lucide-react";
import { compactValue } from "../lib/presentations.js";
import { fmtPct } from "../lib/assistant/analysis.js";
import DeltaPill from "./DeltaPill.jsx";
import GraficoEvolucao from "./GraficoEvolucao.jsx";
import { rotuloMes, valorCheio, variacaoEntre } from "../lib/serieMensal.js";

// A explicação que abre por cima ao clicar num número ou alerta do cartão
// de uma empresa no Início do cliente: o valor da empresa (com a
// comparação), o que aconteceu e o que fazer (alertas) e o que o item
// significa (lib/glossario.js). No celular, sobe de baixo.
//
// Duas abas: "Explicação" e — quando o item é um número com série mês a
// mês (item.serie) — "Evolução": o gráfico do número nos últimos meses, com
// o período escolhido pela pessoa (só até o mês fechado). Fecha só no X ou
// em "Fechar" (e no Esc) — clicar fora não fecha.
//
// item: { rotulo, valor?, sub?, metric?, texto?, acao?, severity?, positivo?, explicacao?, serie?, tituloSerie?, tema? }
// mesesDisponiveis: meses com dados até o fechamento; carregarSerie(serie, inicio, fim).

// Saldos e percentuais em linha; o resto em barras.
const EM_LINHA = new Set(["caixa", "margem"]);
// Números em que cair é bom.
const MENOR_E_MELHOR = new Set(["despesas", "custos"]);
const ICONE_DO_TEMA = { lucro: PiggyBank, receita: Banknote, receitaBruta: Banknote, despesas: Receipt, custos: Package, lucroBruto: Layers, ebitda: Activity, margem: Percent, caixa: Wallet, orcamento: Target };
const formatoDa = (serie) => (serie === "margem" ? "percent" : "money");

// Atalhos de período que cabem nos meses com dados. "Tudo" quando são 12
// meses ou menos; "No ano" só quando há meses de outro ano.
function atalhosPara(meses) {
  const total = meses.length;
  const lista = [3, 5, 6, 12].filter((n) => n < total).map((n) => ({ id: String(n), rotulo: `${n} meses`, meses: n }));
  if (total <= 12) lista.push({ id: "tudo", rotulo: "Tudo", meses: total });
  const ultimo = meses[total - 1] || "";
  if (meses.some((mes) => !mes.startsWith(ultimo.slice(0, 4)))) lista.push({ id: "ano", rotulo: "No ano", meses: 0 });
  return lista;
}

function faixaDoAtalho(atalho, meses) {
  const fim = meses[meses.length - 1];
  if (atalho.meses) return { atalho: atalho.id, inicio: meses[Math.max(0, meses.length - atalho.meses)], fim };
  const doAno = meses.find((mes) => mes.startsWith(fim.slice(0, 4)));
  // "No ano" com um mês só (janeiro): mostra pelo menos os 2 últimos.
  return { atalho: atalho.id, inicio: doAno < fim ? doAno : meses[Math.max(0, meses.length - 2)], fim };
}

function Numero({ rotulo, valor, sub, children }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-muted/60 px-3 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">{rotulo}</p>
      {children || <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-ink-900">{valor}</p>}
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

function Evolucao({ item, meses, carregarSerie }) {
  const atalhos = useMemo(() => atalhosPara(meses), [meses]);
  const [faixa, setFaixa] = useState(() => faixaDoAtalho(atalhos.find((atalho) => atalho.id === "5") || atalhos.find((atalho) => atalho.id === "tudo") || atalhos[0], meses));
  const serie = useMemo(() => (faixa.inicio && faixa.fim && faixa.inicio < faixa.fim ? carregarSerie(item.serie, faixa.inicio, faixa.fim) : []), [item.serie, faixa.inicio, faixa.fim, carregarSerie]);
  const formato = formatoDa(item.serie);
  const comValor = serie.filter((ponto) => ponto.valor != null);
  const primeiro = comValor[0];
  const ultimo = comValor[comValor.length - 1];
  const variacao = comValor.length > 1 ? variacaoEntre(primeiro.valor, ultimo.valor, formato) : null;
  const maior = comValor.reduce((melhor, ponto) => (!melhor || ponto.valor > melhor.valor ? ponto : melhor), null);
  const menor = comValor.reduce((pior, ponto) => (!pior || ponto.valor < pior.valor ? ponto : pior), null);
  const media = comValor.length ? comValor.reduce((soma, ponto) => soma + ponto.valor, 0) / comValor.length : null;
  const subiu = variacao && variacao.valor > 0;
  const bom = variacao && Math.abs(variacao.valor) >= 0.05 ? (MENOR_E_MELHOR.has(item.serie) ? !subiu : subiu) : null;
  const seletor = "explica-mes cursor-pointer rounded-lg border border-line-strong bg-surface-card py-1.5 pl-2.5 pr-7 text-[12.5px] font-medium text-ink-800 outline-none transition-colors hover:border-ink-300 focus:border-accent-400";

  if (meses.length < 2) return <p className="py-16 text-center text-[13px] text-ink-400">Ainda não há meses fechados suficientes para mostrar a evolução.</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-0.5 rounded-xl bg-surface-muted p-1" role="group" aria-label="Período">
          {atalhos.map((atalho) => (
            <button key={atalho.id} type="button" aria-pressed={faixa.atalho === atalho.id} onClick={() => setFaixa(faixaDoAtalho(atalho, meses))} className={`explica-periodo rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all ${faixa.atalho === atalho.id ? "bg-surface-card text-ink-900 shadow-sm ring-1 ring-line" : "text-ink-500 hover:text-ink-900"}`}>
              {atalho.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <CalendarRange size={15} className="mr-0.5 text-ink-400" />
          <select aria-label="Do mês" value={faixa.inicio} onChange={(event) => setFaixa((atual) => ({ atalho: "", inicio: event.target.value, fim: atual.fim <= event.target.value ? meses[meses.indexOf(event.target.value) + 1] : atual.fim }))} className={`explica-de ${seletor}`}>
            {meses.slice(0, -1).map((mes) => (
              <option key={mes} value={mes}>
                {rotuloMes(mes)}
              </option>
            ))}
          </select>
          até
          <select aria-label="Até o mês" value={faixa.fim} onChange={(event) => setFaixa((atual) => ({ atalho: "", inicio: atual.inicio, fim: event.target.value }))} className={`explica-ate ${seletor}`}>
            {meses
              .filter((mes) => mes > faixa.inicio)
              .map((mes) => (
                <option key={mes} value={mes}>
                  {rotuloMes(mes)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {comValor.length > 0 && (
        <div className="explica-numeros mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero rotulo="No período" sub={primeiro && ultimo ? `${rotuloMes(primeiro.mes)} → ${rotuloMes(ultimo.mes)}` : ""}>
            {variacao ? (
              <p className={`mt-0.5 flex items-center gap-1 text-[15px] font-semibold tabular-nums ${bom == null ? "text-ink-700" : bom ? "text-success-600" : "text-danger-600"}`}>
                {Math.abs(variacao.valor) >= 0.05 && (subiu ? <ArrowUpRight size={16} strokeWidth={2.4} /> : <ArrowDownRight size={16} strokeWidth={2.4} />)}
                {variacao.texto}
              </p>
            ) : (
              <p className="mt-0.5 text-[15px] font-semibold text-ink-400">—</p>
            )}
          </Numero>
          <Numero rotulo={item.serie === "caixa" ? "Saldo médio" : "Média por mês"} valor={valorCheio(media, formato)} sub={`${comValor.length} meses`} />
          <Numero rotulo="Maior" valor={valorCheio(maior?.valor, formato)} sub={maior ? rotuloMes(maior.mes) : ""} />
          <Numero rotulo="Menor" valor={valorCheio(menor?.valor, formato)} sub={menor ? rotuloMes(menor.mes) : ""} />
        </div>
      )}

      <div className="mt-3 rounded-2xl px-1 pb-1 pt-4 ring-1 ring-line sm:px-4 sm:pb-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 sm:px-0">
          <p className="text-[13.5px] font-semibold text-ink-900">{item.tituloSerie || item.rotulo}</p>
          <p className="text-[11.5px] tabular-nums text-ink-400">
            {rotuloMes(faixa.inicio)} a {rotuloMes(faixa.fim)}
          </p>
        </div>
        <div className="px-2 sm:px-0">
          <GraficoEvolucao serie={serie} formato={formato} tipo={EM_LINHA.has(item.serie) ? "linha" : "barra"} />
        </div>
      </div>
    </div>
  );
}

// Os últimos meses em barrinhas, ao lado do valor (abre a aba Evolução).
function MiniBarras({ serie }) {
  const valores = serie.map((ponto) => ponto.valor ?? 0);
  const topo = Math.max(0, ...valores);
  const base = Math.min(0, ...valores);
  const altura = 40;
  const escala = (valor) => (topo === base ? altura : ((topo - valor) / (topo - base)) * altura);
  const zero = escala(0);
  const largura = 9;
  const passo = 14;
  return (
    <svg width={passo * valores.length - (passo - largura)} height={altura} aria-hidden="true" className="overflow-visible">
      {valores.map((valor, index) => {
        const y = Math.min(escala(valor), zero);
        const h = Math.max(2, Math.abs(zero - escala(valor)));
        return <rect key={index} x={index * passo} y={y} width={largura} height={h} rx={2} fill={valor < 0 ? "var(--color-danger-500)" : "var(--color-accent-500)"} fillOpacity={index === valores.length - 1 ? 1 : 0.4} />;
      })}
    </svg>
  );
}

function antes(metric) {
  if (!metric || metric.before == null || !Number.isFinite(metric.before)) return "";
  return metric.kind === "percent" ? fmtPct(metric.before) : compactValue(metric.before, "money");
}

function Gravidade({ item }) {
  if (item.positivo)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-600">
        <CheckCircle2 size={12} /> Ponto positivo
      </span>
    );
  if (item.severity == null) return null;
  const tom = item.severity >= 3 ? "bg-danger-50 text-danger-700" : item.severity === 2 ? "bg-warning-50 text-warning-700" : "bg-surface-muted text-ink-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tom}`}>
      <AlertTriangle size={12} /> {item.severity >= 3 ? "Importante" : item.severity === 2 ? "Pede atenção" : "Para acompanhar"}
    </span>
  );
}

export default function ExplicaItem({ item, empresa, periodo, prevLabel, onClose, onAbrirEmpresa, mesesDisponiveis = [], carregarSerie }) {
  const fechar = useRef(null);
  const temEvolucao = Boolean(item.serie && carregarSerie);
  const [aba, setAba] = useState("explicacao");
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    // A página de trás não rola com a explicação aberta.
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = rolagem;
    };
  }, [onClose]);

  const meses = mesesDisponiveis;
  const ultimos = useMemo(() => (temEvolucao && item.valor && meses.length >= 2 ? carregarSerie(item.serie, meses[Math.max(0, meses.length - 5)], meses[meses.length - 1]) : []), [temEvolucao, item.valor, item.serie, meses, carregarSerie]);
  const explicacao = item.explicacao;
  const valorAntes = antes(item.metric);
  const alerta = item.severity != null || item.positivo;
  const Icone = item.positivo ? CheckCircle2 : item.severity != null ? AlertTriangle : ICONE_DO_TEMA[item.tema || item.serie] || Info;
  const tomIcone = item.positivo ? "bg-success-50 text-success-600" : item.severity >= 3 ? "bg-danger-50 text-danger-600" : item.severity === 2 ? "bg-warning-50 text-warning-700" : item.severity != null ? "bg-surface-muted text-ink-500" : "bg-accent-50 text-accent-600";
  const abas = [
    { id: "explicacao", rotulo: "Explicação", icone: BookOpen },
    { id: "evolucao", rotulo: "Evolução", icone: BarChart3 },
  ];

  return (
    <div className="explica-item fixed inset-0 z-50 flex items-end justify-center bg-navy-950/55 backdrop-blur-[3px] animate-surgir sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={item.rotulo} className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface-card shadow-[0_24px_64px_-16px_rgba(8,29,51,0.45)] ring-1 ring-line animate-entrar sm:max-w-[720px] sm:rounded-3xl ${temEvolucao ? "sm:h-[min(740px,90vh)]" : ""}`}>
        <header className={`shrink-0 px-5 pt-3 sm:px-7 sm:pt-6 ${temEvolucao ? "" : "border-b border-line pb-5"}`}>
          <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-strong sm:hidden" />
          <div className="flex items-start gap-3.5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tomIcone}`}>
              <Icone size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium text-ink-400">
                {empresa}
                {periodo ? ` · ${periodo}` : ""}
              </p>
              <h2 className="mt-0.5 text-[19px] font-semibold leading-snug tracking-tight text-ink-900">{item.rotulo}</h2>
              {alerta && (
                <div className="mt-1.5">
                  <Gravidade item={item} />
                </div>
              )}
            </div>
            <button ref={fechar} type="button" onClick={onClose} aria-label="Fechar" className="-mr-1.5 -mt-1 rounded-xl p-2 text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400">
              <X size={19} />
            </button>
          </div>

          {temEvolucao && (
            <div className="mt-5 flex gap-6 border-b border-line" role="tablist">
              {abas.map(({ id, rotulo, icone: IconeAba }) => (
                <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`explica-aba-${id} -mb-px flex items-center gap-1.5 border-b-2 pb-3 text-[13.5px] font-medium transition-colors ${aba === id ? "border-accent-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"}`}>
                  <IconeAba size={15} /> {rotulo}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {aba === "evolucao" && temEvolucao ? (
            <Evolucao item={item} meses={meses} carregarSerie={carregarSerie} />
          ) : (
            <>
              {item.valor && (
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-surface-muted to-surface-muted/30 p-4 ring-1 ring-line sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums text-ink-900 sm:text-[32px]">{item.valor}</span>
                      <DeltaPill metric={item.metric} />
                    </div>
                    {(valorAntes || item.sub) && (
                      <p className="mt-2 text-[12.5px] text-ink-500">
                        {valorAntes && prevLabel ? `Em ${prevLabel}: ${valorAntes}` : ""}
                        {valorAntes && prevLabel && item.sub ? " · " : ""}
                        {item.sub || ""}
                      </p>
                    )}
                  </div>
                  {ultimos.length > 1 && (
                    <button type="button" onClick={() => setAba("evolucao")} className="explica-mini group/mini flex shrink-0 flex-col items-end gap-1.5 rounded-xl p-2 transition-colors hover:bg-surface-card" title="Ver a evolução">
                      <MiniBarras serie={ultimos} />
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-accent-600">
                        {ultimos.length} meses <ArrowRight size={12} className="transition-transform group-hover/mini:translate-x-0.5" />
                      </span>
                    </button>
                  )}
                </div>
              )}

              {item.texto && (
                <section className={item.valor ? "mt-5" : ""}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">{item.positivo ? "O que aconteceu de bom" : "O que aconteceu"}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-800">{item.texto}</p>
                </section>
              )}

              {item.acao && (
                <div className="mt-4 flex gap-3 rounded-2xl bg-accent-50 p-4 ring-1 ring-accent-200/80">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white">
                    <Lightbulb size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-700">O que fazer</p>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-ink-800">{item.acao}</p>
                  </div>
                </div>
              )}

              {explicacao && (
                <section className={item.texto || item.valor ? "mt-6" : ""}>
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                    <BookOpen size={15} className="text-ink-400" /> Entenda{explicacao.titulo ? `: ${explicacao.titulo}` : ""}
                  </h3>
                  <dl className="mt-3 divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
                    {[
                      { icone: Info, titulo: "O que é", texto: explicacao.oque },
                      { icone: Calculator, titulo: "Como é calculado", texto: explicacao.calculo },
                      { icone: Eye, titulo: "Como ler", texto: explicacao.leitura },
                    ]
                      .filter((linha) => linha.texto)
                      .map(({ icone: IconeLinha, titulo, texto }) => (
                        <div key={titulo} className="flex gap-3 p-3.5 sm:p-4">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-500">
                            <IconeLinha size={14} />
                          </span>
                          <div className="min-w-0">
                            <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">{titulo}</dt>
                            <dd className="mt-0.5 text-[13.5px] leading-relaxed text-ink-700">{texto}</dd>
                          </div>
                        </div>
                      ))}
                  </dl>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted/40 px-5 py-3.5 sm:px-7">
          <button type="button" onClick={onClose} className="explica-fechar rounded-full border border-line-strong bg-surface-card px-4 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:bg-surface-muted">
            Fechar
          </button>
          {onAbrirEmpresa && (
            <button type="button" onClick={onAbrirEmpresa} className="explica-abrir flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-accent-600/25 transition-colors hover:bg-accent-600">
              Ver na empresa <ArrowRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
