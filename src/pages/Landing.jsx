import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock, HelpCircle, LayoutGrid, Lock, LogOut, MessageSquare, Network, Presentation, Scale, Search, Settings, Target, Wallet } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAppState } from "../data/useStore.js";
import { temBi as temModuloBi, temReforma as temModuloReforma } from "../lib/modulos.js";
import { groupCompanies } from "../lib/groups.js";
import { ensureCompanyJournalLoaded } from "../lib/companies.js";
import { mesesComDados, primeiroNome, resumoCarteira, resumoDaEmpresa, saudacao, serieDoItem } from "../lib/inicio.js";
import { mesFechadoDa } from "../lib/fechamento.js";
import { recentes } from "../lib/recentes.js";
import { useAbrirWorkspace } from "../lib/useAbrirWorkspace.js";
import { compactValue } from "../lib/presentations.js";
import { alertasDoResumo, blocosVisiveis, configResumo, tilesDoResumo } from "../lib/resumoCelular.js";
import { fmtPct } from "../lib/assistant/analysis.js";
import { bridgeSentence } from "../lib/cashBridge.js";
import DeltaPill from "../components/DeltaPill.jsx";
import ExplicaItem from "../components/ExplicaItem.jsx";
import { GLOSSARIO, explicacaoDoAssunto } from "../lib/glossario.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import AthosMark from "../components/AthosMark.jsx";
import Avatar from "../components/Avatar.jsx";
import WorkspaceLoading from "../components/WorkspaceLoading.jsx";

// Início: a primeira tela depois do login, diferente pra cada um.
//  - Cliente: a(s) empresa(s) dele em cartões, com o resultado do mês
//    fechado e do ano, o recado do escritório e atalho pra última
//    apresentação. Tudo só até o mês fechado
//    (lib/fechamento.js). Com poucas empresas, o razão já vem carregando
//    aqui — abrir fica rápido.
//  - Equipe: busca pra abrir qualquer empresa, as abertas por último,
//    atalhos e — só pra quem tem acesso total (admin) — a situação da
//    carteira.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (mes) => MESES[Number(String(mes).slice(5, 7)) - 1] || "";
const mesCurto = (mes) => (mes ? `${nomeDoMes(mes).slice(0, 3)}/${String(mes).slice(2, 4)}` : "");
const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Cliente com até tantas empresas: os números de cada uma são calculados
// aqui (precisa do razão). Mais que isso, o cartão mostra só o fechamento —
// não vale baixar o razão de todas só pra tela inicial.
const MAX_COM_NUMEROS = 4;

function quando(iso) {
  const dias = Math.floor((Date.now() - Date.parse(iso || "")) / 86400000);
  if (!Number.isFinite(dias)) return "";
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "há 1 mês" : `há ${meses} meses`;
}

function hojePorExtenso() {
  const texto = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Topo({ staff, onConfig }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 sm:px-8">
      <span className="flex items-center gap-2.5">
        <AthosMark size={28} />
        <span className="text-[16px] font-semibold tracking-tight text-white">AthosBI</span>
      </span>
      <span className="flex items-center gap-1">
        <ThemeToggle />
        {staff && (
          <button type="button" onClick={onConfig} aria-label="Configurações" title="Configurações" className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white">
            <Settings size={19} />
          </button>
        )}
        <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sair" title="Sair" className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut size={18} />
        </button>
      </span>
    </div>
  );
}

function Titulo({ icone: Icone, children }) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
      {Icone && <Icone size={13} />}
      {children}
    </h2>
  );
}

function TituloBloco({ icone: Icone, children, tom = "text-ink-400" }) {
  return (
    <span className={`mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${tom}`}>
      {Icone && <Icone size={12.5} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

// O número cuja evolução faz sentido mostrar para cada assunto de alerta.
const SERIE_DO_ASSUNTO = { resultado: "lucro", comparativo: "lucro", sazonalidade: "lucro", receita: "receita", composicaoReceita: "receita", despesas: "despesas", pareto: "despesas", margens: "margem", ebitda: "ebitda", caixa: "caixa", fluxo: "caixa" };
const TITULO_DA_SERIE = { lucro: "Lucro mês a mês", receita: "Receita mês a mês", despesas: "Despesas operacionais mês a mês", margem: "Margem líquida mês a mês", ebitda: "EBITDA mês a mês", caixa: "Caixa no fim de cada mês" };
const serieDoAssunto = (topic) => (SERIE_DO_ASSUNTO[topic] ? { serie: SERIE_DO_ASSUNTO[topic], tituloSerie: TITULO_DA_SERIE[SERIE_DO_ASSUNTO[topic]] } : {});

// Clique num número/alerta = abre a explicação (ExplicaItem). Estilo comum
// dos itens clicáveis do cartão.
const CLICAVEL = "cursor-pointer rounded-xl text-left transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

// Uma linha de "Pede atenção": ícone na cor da gravidade (ou verde, nos
// pontos positivos), título e o texto da análise.
function LinhaAnalise({ titulo, texto, tom, positivo, onClick }) {
  const Icone = positivo ? CheckCircle2 : AlertTriangle;
  return (
    <button type="button" onClick={onClick} className={`inicio-explicar group/linha -mx-2.5 flex items-start gap-3 px-2.5 py-2 ${CLICAVEL}`}>
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tom}`}>
        <Icone size={14.5} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-snug text-ink-900">{titulo}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">{texto}</span>
      </span>
      <ChevronRight size={15} className="mt-1.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover/linha:opacity-100" />
    </button>
  );
}

// Colunas dos quadrinhos pela largura do cartão (não da tela) e pela
// quantidade: sem um quadrinho sozinho na última linha quando dá.
function colunasDosNumeros(quantos) {
  if (quantos <= 2) return "grid-cols-2";
  if (quantos === 3) return "grid-cols-2 @md:grid-cols-3";
  if (quantos === 4) return "grid-cols-2 @2xl:grid-cols-4";
  if (quantos <= 6) return "grid-cols-2 @lg:grid-cols-3";
  return "grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4";
}

const NA_ESQUERDA = new Set(["recado", "resultado", "numeros", "caixa"]);

const TOM_GRAVIDADE = (severity) => (severity >= 3 ? "bg-danger-50 text-danger-600" : severity === 2 ? "bg-warning-50 text-warning-700" : "bg-surface-muted text-ink-500");

// Cartão de uma empresa (cliente): o resumo do celular da empresa, na
// ordem e com os blocos configurados em Personalizar › Resumo do celular
// (lib/resumoCelular.js) — só sem o gráfico mês a mês. Tudo do mês fechado,
// comparado com o mês anterior. Cada número e alerta abre a explicação.
function CartaoEmpresa({ company, resumo, calculando, grande, onAbrir, onApresentacao, onExplicar }) {
  const config = configResumo(company.resumoCelular);
  const visiveis = blocosVisiveis(config);
  // Só as liberadas pro cliente (ver apresentacoesVisiveis).
  const ultimaApresentacao = visiveis.includes("apresentacao") ? [...(company.presentations || []).filter((deck) => deck.liberada === true)].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null : null;
  const fechado = resumo?.mes || mesFechadoDa(company);
  const facts = resumo?.analysis?.facts || null;
  const cmp = resumo?.analysis?.comparison || null;
  const { alertas, positivos } = alertasDoResumo(resumo?.analysis, config, { equipe: false });
  const tiles = tilesDoResumo(facts, cmp);
  const px = grande ? "px-6 sm:px-7" : "px-5 sm:px-6";
  const ate = resumo ? `Janeiro a ${nomeDoMes(resumo.mes)}` : "";

  const blocos = {
    recado: () => (
      <div className="flex gap-3 rounded-2xl bg-accent-50 p-3.5 ring-1 ring-accent-200/80">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white">
          <MessageSquare size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-accent-700">Recado do escritório</p>
          <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-snug text-ink-800">{config.recado.trim()}</p>
        </div>
      </div>
    ),
    resultado: () => {
      if (!resumo) return null;
      const prejuizo = resumo.lucroMes < -0.5;
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
          <button
            type="button"
            onClick={() => onExplicar({ rotulo: `${prejuizo ? "Prejuízo" : "Lucro"} de ${nomeDoMes(resumo.mes)}`, valor: compactValue(resumo.lucroMes, "money"), metric: cmp?.lucro, sub: facts?.receitaLiquida > 0.5 ? `Margem de ${fmtPct(facts.margemLiquida)} da receita` : "", explicacao: GLOSSARIO.lucro, serie: "lucro", tituloSerie: "Lucro mês a mês" })}
            className={`inicio-explicar -mx-2.5 px-2.5 py-2 ${CLICAVEL}`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              {prejuizo ? "Prejuízo" : "Lucro"} de {nomeDoMes(resumo.mes)}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className={`text-[34px] font-semibold leading-none tracking-tight tabular-nums ${prejuizo ? "text-danger-600" : "text-ink-900"}`}>{compactValue(resumo.lucroMes, "money")}</span>
              <DeltaPill metric={cmp?.lucro} />
            </span>
            <span className="mt-2 block text-[12px] text-ink-400">
              {facts?.receitaLiquida > 0.5 ? `Margem de ${fmtPct(facts.margemLiquida)} da receita` : ""}
              {facts?.receitaLiquida > 0.5 && resumo.prevLabel ? " · " : ""}
              {resumo.prevLabel ? `comparado a ${resumo.prevLabel}` : ""}
            </span>
          </button>
          <div className="flex overflow-hidden rounded-2xl bg-surface-muted/60 sm:min-w-[200px] sm:flex-col">
            <p className="hidden px-3.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 sm:block">No ano · até {mesCurto(resumo.mes)}</p>
            {[
              { rotulo: resumo.lucroAno < -0.5 ? "Prejuízo" : "Lucro", valor: resumo.lucroAno, explicar: { rotulo: `${resumo.lucroAno < -0.5 ? "Prejuízo" : "Lucro"} no ano`, explicacao: GLOSSARIO.lucroAno, serie: "lucro", tituloSerie: "Lucro mês a mês" } },
              { rotulo: "Receita", valor: resumo.receitaAno, explicar: { rotulo: "Receita no ano", explicacao: GLOSSARIO.receitaAno, serie: "receita", tituloSerie: "Receita mês a mês" } },
            ].map((item) => (
              <button key={item.rotulo} type="button" onClick={() => onExplicar({ ...item.explicar, valor: compactValue(item.valor, "money"), sub: ate })} className="inicio-explicar flex flex-1 flex-col px-3.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-[11.5px] text-ink-500">
                  {item.rotulo}
                  <span className="sm:hidden"> no ano</span>
                </span>
                <span className={`text-[15px] font-semibold tabular-nums ${item.valor < -0.5 ? "text-danger-600" : "text-ink-900"}`}>{compactValue(item.valor, "money")}</span>
              </button>
            ))}
          </div>
        </div>
      );
    },
    numeros: () => {
      const lista = config.numeros.map((id) => tiles[id]).filter(Boolean);
      if (!lista.length) return null;
      return (
        <div className="@container">
          <div className={`grid gap-2.5 ${colunasDosNumeros(lista.length)}`}>
            {lista.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => onExplicar({ rotulo: tile.label, valor: tile.value, metric: tile.metric, sub: tile.sub, explicacao: GLOSSARIO[tile.id], serie: tile.id, tituloSerie: `${tile.label} mês a mês` })}
                className="inicio-explicar group/tile flex min-w-0 flex-col rounded-2xl bg-surface-card p-3.5 text-left ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <span className="flex items-start justify-between gap-1.5">
                  <span className="line-clamp-2 text-[11.5px] leading-tight text-ink-500">{tile.label}</span>
                  <HelpCircle size={13} className="shrink-0 text-ink-300 transition-colors group-hover/tile:text-accent-500" />
                </span>
                <span className="mt-auto block truncate pt-2 text-[18px] font-semibold leading-tight tracking-tight tabular-nums text-ink-900">{tile.value}</span>
                {/* Cartão estreito: o complemento vai pra linha de baixo (sempre
                    reservada, pra os valores ficarem alinhados na fileira). */}
                <span className="mt-1.5 flex min-h-[20px] flex-wrap items-center gap-x-1.5 gap-y-1">
                  <DeltaPill metric={tile.metric} />
                  <span className="min-h-[14px] min-w-0 basis-full truncate text-[10.5px] text-ink-400 @lg:min-h-0 @lg:basis-auto">{tile.sub || ""}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    },
    atencao: () =>
      resumo?.analysis && (
        <div>
          {alertas.length > 0 && (
            <>
              <TituloBloco icone={AlertTriangle} tom="text-warning-700">
                Pede atenção
              </TituloBloco>
              <div className="flex flex-col">
                {alertas.map((alerta) => (
                  <LinhaAnalise key={alerta.id} titulo={alerta.title} texto={alerta.text} tom={TOM_GRAVIDADE(alerta.severity)} onClick={() => onExplicar({ rotulo: alerta.title, texto: alerta.text, acao: alerta.action, severity: alerta.severity, explicacao: explicacaoDoAssunto(alerta.topic), ...serieDoAssunto(alerta.topic) })} />
                ))}
              </div>
            </>
          )}
          {positivos.length > 0 && (
            <div className={alertas.length ? "mt-4" : ""}>
              <TituloBloco icone={CheckCircle2} tom="text-success-600">
                {alertas.length ? "Pontos positivos" : "Tudo em ordem"}
              </TituloBloco>
              <div className="flex flex-col">
                {positivos.map((item) => (
                  <LinhaAnalise key={item.id} positivo titulo={item.title} texto={item.text} tom="bg-success-50 text-success-600" onClick={() => onExplicar({ rotulo: item.title, texto: item.text, positivo: true, explicacao: explicacaoDoAssunto(item.topic), ...serieDoAssunto(item.topic) })} />
                ))}
              </div>
            </div>
          )}
          {!alertas.length && !positivos.length && (
            <p className="flex items-center gap-2 text-[13px] text-ink-500">
              <CheckCircle2 size={15} className="text-success-500" /> Nenhum alerta neste mês.
            </p>
          )}
        </div>
      ),
    caixa: () =>
      facts?.bridge && (
        <button type="button" onClick={() => onExplicar({ rotulo: "Do lucro ao caixa", texto: bridgeSentence(facts.bridge), explicacao: GLOSSARIO.ponteCaixa, serie: "caixa", tituloSerie: "Caixa no fim de cada mês" })} className={`inicio-explicar group/linha -mx-2.5 flex w-[calc(100%+1.25rem)] items-start gap-3 px-2.5 py-2 ${CLICAVEL}`}>
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700/10 text-navy-700">
            <Wallet size={14.5} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-ink-900">Do lucro ao caixa</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-600">{bridgeSentence(facts.bridge)}</span>
          </span>
          <ChevronRight size={15} className="mt-1.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover/linha:opacity-100" />
        </button>
      ),
    orcamento: () => {
      const budget = resumo?.budget;
      if (!budget) return null;
      return (
        <button type="button" onClick={() => onExplicar({ rotulo: `Orçamento ${budget.ano}`, texto: `Receita: ${compactValue(budget.receita.realizado, "money")} de ${compactValue(budget.receita.orcado, "money")} orçados. Resultado: ${compactValue(budget.resultado.realizado, "money")} de ${compactValue(budget.resultado.orcado, "money")} orçados.`, explicacao: GLOSSARIO.orcamento, tema: "orcamento" })} className={`inicio-explicar -mx-2.5 block w-[calc(100%+1.25rem)] px-2.5 py-2 ${CLICAVEL}`}>
          <TituloBloco icone={Target}>Orçamento {budget.ano}</TituloBloco>
          <span className="grid grid-cols-2 gap-3 text-[12.5px]">
            {[
              { rotulo: "Receita", item: budget.receita },
              { rotulo: "Resultado", item: budget.resultado },
            ].map(({ rotulo, item }) => {
              const alcance = item.reach != null && item.orcado > 0 && item.reach >= 0 ? Math.min(100, item.reach) : null;
              const cor = item.tone === "bom" ? "bg-success-500" : item.tone === "ruim" ? "bg-danger-500" : item.tone === "atencao" ? "bg-warning-500" : "bg-ink-300";
              return (
                <span key={rotulo} className="block">
                  <span className="block text-ink-500">{rotulo}</span>
                  <span className="block text-[15px] font-semibold tabular-nums text-ink-900">{compactValue(item.realizado, "money")}</span>
                  {alcance != null && (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <span className={`block h-full rounded-full ${cor}`} style={{ width: `${alcance}%` }} />
                    </span>
                  )}
                  <span className="mt-1 block text-[11.5px] text-ink-400">
                    de {compactValue(item.orcado, "money")} orçados{item.reach != null && item.orcado > 0 && item.reach >= 0 && item.reach <= 300 ? ` · ${Math.round(item.reach)}%` : ""}
                  </span>
                </span>
              );
            })}
          </span>
        </button>
      );
    },
  };

  // No Início ficam de fora o gráfico mês a mês e a última apresentação
  // (essa vira o botão do rodapé).
  const conteudo = calculando ? [] : visiveis.filter((id) => id !== "tendencia" && id !== "apresentacao").map((id) => [id, blocos[id]?.()]).filter(([, bloco]) => bloco);
  const comDivisa = new Set(["atencao", "caixa", "orcamento"]);
  // Empresa única (cartão grande) em tela larga: números e caixa à
  // esquerda; alertas e orçamento à direita.
  const esquerda = conteudo.filter(([id]) => NA_ESQUERDA.has(id));
  const direita = conteudo.filter(([id]) => !NA_ESQUERDA.has(id));
  const dividir = grande && esquerda.length > 0 && direita.length > 0;
  const bloco = ([id, elemento], index, primeiroDaColuna = false) => (
    <div key={id} className={`inicio-bloco-${id} mt-5 ${index > 0 && comDivisa.has(id) ? `border-t border-line pt-4 ${primeiroDaColuna ? "@5xl:border-t-0 @5xl:pt-0" : ""}` : ""}`}>
      {elemento}
    </div>
  );

  return (
    <article className="inicio-empresa @container flex flex-col overflow-hidden rounded-3xl bg-surface-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] ring-1 ring-line">
      <header className={`flex items-center gap-3.5 border-b border-line bg-gradient-to-b from-surface-muted/50 to-transparent py-4 ${px}`}>
        <Avatar name={company.name} size={grande ? 46 : 42} className="rounded-2xl shadow-sm" />
        <div className="min-w-0 flex-1">
          <h3 className={`truncate font-semibold tracking-tight text-ink-900 ${grande ? "text-[19px]" : "text-[16px]"}`}>{company.name}</h3>
          <p className="truncate text-[12px] tabular-nums text-ink-400">{company.cnpj || "\u00a0"}</p>
        </div>
        <span className="inicio-fechado flex shrink-0 items-center gap-1.5 rounded-full bg-surface-card px-2.5 py-1 text-[11px] font-medium text-ink-500 ring-1 ring-line" title="Os números vão até o último mês fechado pelo escritório">
          <Lock size={11} /> <span className="hidden sm:inline">Fechado até</span> {mesCurto(fechado)}
        </span>
      </header>

      <div className={`flex flex-col pb-2 ${px}`}>
        {calculando && (
          <div className="mt-6 flex flex-col gap-3" aria-label="Calculando os números">
            <span className="h-3 w-28 animate-pulse rounded bg-surface-muted" />
            <span className="h-9 w-48 animate-pulse rounded-lg bg-surface-muted" />
            <span className="mt-2 grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((item) => (
                <span key={item} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
              ))}
            </span>
          </div>
        )}
        {dividir ? (
          <div className="@5xl:grid @5xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @5xl:gap-x-10">
            <div>{esquerda.map((item, index) => bloco(item, index))}</div>
            <div className="@5xl:border-l @5xl:border-line @5xl:pl-10">{direita.map((item, index) => bloco(item, esquerda.length + index, index === 0))}</div>
          </div>
        ) : (
          conteudo.map((item, index) => bloco(item, index))
        )}
      </div>

      <footer className={`mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line py-4 ${px}`}>
        {conteudo.length > 0 && resumo ? (
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <HelpCircle size={13} /> Toque num número ou alerta para entender
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {ultimaApresentacao && (
            <button type="button" onClick={() => onApresentacao(ultimaApresentacao.id)} title={ultimaApresentacao.name} className="inicio-apresentacao flex min-w-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-surface-muted">
              <Presentation size={14} className="shrink-0" />
              <span className="truncate">Última apresentação</span>
            </button>
          )}
          <button type="button" onClick={onAbrir} className="inicio-abrir flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-accent-600/25 transition-all hover:-translate-y-0.5 hover:bg-accent-600">
            Abrir a empresa <ArrowRight size={15} />
          </button>
        </div>
      </footer>
    </article>
  );
}

const TONS = {
  laranja: "bg-accent-50 text-accent-600",
  azul: "bg-navy-700/10 text-navy-700",
  cinza: "bg-surface-muted text-ink-500",
};

function Atalho({ icone: Icone, titulo, texto, tom = "cinza", onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3 rounded-xl bg-surface-card p-3.5 text-left shadow-sm ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONS[tom]}`}>
        <Icone size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink-900">{titulo}</span>
        {texto && <span className="block truncate text-[11.5px] text-ink-400">{texto}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// Situação da carteira (admin): a proporção em uma barra (crítica / em
// atenção / em dia — cor de status sempre com o número e o nome ao lado) e
// as pendências mais comuns.
function Carteira({ resumo, total, onAbrir }) {
  const partes = [
    { id: "critico", rotulo: resumo?.critico === 1 ? "crítica" : "críticas", valor: resumo?.critico || 0, cor: "bg-danger-500" },
    { id: "atencao", rotulo: "em atenção", valor: resumo?.atencao || 0, cor: "bg-warning-500" },
    { id: "ok", rotulo: "em dia", valor: resumo?.ok || 0, cor: "bg-success-500" },
  ];
  return (
    <button type="button" onClick={onAbrir} className="inicio-carteira group w-full rounded-2xl bg-surface-card p-5 text-left shadow-sm ring-1 ring-line transition-all hover:shadow-md">
      {!resumo ? (
        <span className="text-[13px] text-ink-400">{total ? "Calculando a situação das empresas…" : "Nenhuma empresa cadastrada ainda."}</span>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={partes.map((parte) => `${parte.valor} ${parte.rotulo}`).join(", ")}>
            {partes
              .filter((parte) => parte.valor > 0)
              .map((parte) => (
                <span key={parte.id} className={`${parte.cor} first:rounded-l-full last:rounded-r-full`} style={{ flexGrow: parte.valor }} title={`${parte.valor} ${parte.rotulo}`} />
              ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
            {partes.map((parte) => (
              <span key={parte.id} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${parte.cor}`} />
                <span className="text-[24px] font-semibold leading-none tabular-nums text-ink-900">{parte.valor}</span>
                <span className="text-[13px] text-ink-500">{parte.rotulo}</span>
              </span>
            ))}
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-500 sm:ml-2 sm:border-l sm:border-line sm:pl-6">
              <span>
                <strong className="font-semibold text-ink-800">{resumo.atrasadas}</strong> com dados atrasados
              </span>
              <span>
                <strong className="font-semibold text-ink-800">{resumo.depara}</strong> com De/Para pendente
              </span>
            </span>
            <span className="ml-auto flex items-center gap-1 text-[12.5px] font-medium text-accent-600">
              Ver a carteira <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </>
      )}
    </button>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const state = useAppState();
  const staff = Boolean(state.isAdmin || state.isColaborador);
  // Um caminho por módulo liberado (ver lib/modulos.js) — cliente só da
  // Reforma Tributária nem vê o B.I.
  const temBi = temModuloBi(state);
  const temReforma = temModuloReforma(state);
  const { pending, abrirEmpresa, abrirGrupo, cancelar } = useAbrirWorkspace();
  const nome = primeiroNome(state.nomeUsuario);
  const ola = `${saudacao()}${nome ? `, ${nome}` : ""}`;

  // Grupos que o cliente enxerga inteiros (mesma regra de Empresas.jsx).
  const gruposCliente = useMemo(
    () => (staff ? [] : state.groups.filter((group) => (group.companyIds || []).length > 0 && groupCompanies(group).length === group.companyIds.length)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, state.groups, state.companies]
  );

  // ── Cliente: números de cada empresa (razão carregando aqui mesmo) ──
  const [numeros, setNumeros] = useState({}); // id → números | null (sem dados)
  // A explicação aberta por cima (clique num número/alerta do cartão).
  const [explicando, setExplicando] = useState(null); // { item, company, resumo }
  const fecharExplicacao = useCallback(() => setExplicando(null), []);
  // Aba "Evolução": a série do número na empresa da explicação aberta.
  const empresaExplicada = explicando?.company?.id;
  const carregarSerie = useCallback(
    (serie, inicio, fim) => {
      const company = state.companies.find((item) => item.id === empresaExplicada);
      return company ? serieDoItem(company, serie, { inicio, fim }) : [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empresaExplicada]
  );
  const calcularNumeros = !staff && temBi && state.companies.length <= MAX_COM_NUMEROS;
  const chaveEmpresas = state.companies.map((company) => `${company.id}:${mesFechadoDa(company)}`).join("|");
  useEffect(() => {
    if (!calcularNumeros) return undefined;
    let vivo = true;
    (async () => {
      for (const company of state.companies) {
        try {
          const carregado = company.journalLoaded ? company : await ensureCompanyJournalLoaded(company);
          if (!vivo) return;
          const pronto = carregado && !carregado.journalLoadFailed ? { ...company, ...carregado, journalLoaded: true } : null;
          const valor = pronto ? resumoDaEmpresa(pronto, { ate: mesFechadoDa(company) }) : null;
          setNumeros((atual) => ({ ...atual, [company.id]: valor }));
        } catch (error) {
          console.warn("Início: sem números de", company.name, error?.message || error);
          if (vivo) setNumeros((atual) => ({ ...atual, [company.id]: null }));
        }
        // Uma por vez, devolvendo a vez pro navegador entre elas.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcularNumeros, chaveEmpresas]);

  // ── Equipe: busca, abertas por último e (admin) a carteira ──
  const [busca, setBusca] = useState("");
  const buscaRef = useRef(null);
  const resultados = useMemo(() => {
    const termo = norm(busca.trim());
    if (!staff || !termo) return [];
    const grupos = state.groups.filter((group) => norm(group.name).includes(termo)).map((group) => ({ tipo: "grupo", id: group.id, nome: group.name, detalhe: `Grupo · ${(group.companyIds || []).length} empresas` }));
    const empresas = state.companies.filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(termo)).map((company) => ({ tipo: "empresa", id: company.id, nome: company.name, detalhe: [company.codigo, company.cnpj].filter(Boolean).join(" · ") }));
    return [...grupos, ...empresas].slice(0, 8);
  }, [staff, busca, state.companies, state.groups]);

  const abertas = useMemo(() => {
    if (!staff) return [];
    return recentes()
      .map((item) => {
        const registro = item.tipo === "grupo" ? state.groups.find((group) => group.id === item.id) : state.companies.find((company) => company.id === item.id);
        return registro ? { ...item, nome: registro.name } : null;
      })
      .filter(Boolean)
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, state.companies, state.groups]);

  const [carteira, setCarteira] = useState(null);
  useEffect(() => {
    if (!state.isAdmin || !state.companies.length) return undefined;
    // Depois da primeira pintura: com muitas empresas são alguns instantes.
    const timer = setTimeout(() => {
      try {
        setCarteira(resumoCarteira(state.companies));
      } catch (error) {
        console.warn("Início: resumo da carteira falhou", error);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [state.isAdmin, state.companies]);

  // "/" vai pra busca (mesmo atalho da lista de empresas).
  useEffect(() => {
    if (!staff) return undefined;
    function tecla(event) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      buscaRef.current?.focus();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [staff]);

  const abrir = (item, destino) => (item.tipo === "grupo" ? abrirGrupo(item.id, destino) : abrirEmpresa(item.id, destino));
  const totalCliente = state.companies.length + gruposCliente.length;

  const hero = (
    <div className="relative z-10 bg-navy-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(700px circle at 15% -10%, rgba(47,111,237,0.34), transparent 60%), radial-gradient(520px circle at 95% 130%, rgba(232,105,31,0.20), transparent 60%)" }} />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "linear-gradient(to bottom, black, transparent)" }}
        />
        <AthosMark size={200} className="absolute bottom-6 right-[7%] hidden opacity-[0.045] lg:block" />
      </div>
      <div className="relative">
        <Topo staff={staff} onConfig={() => navigate("/parametros")} />
        <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-3 sm:px-8 sm:pb-12 sm:pt-5">
          <p className="text-[12.5px] font-medium text-white/50">{hojePorExtenso()}</p>
          <h1 className="inicio-ola mt-1 text-[30px] font-semibold leading-tight tracking-tight sm:text-[38px]">{ola}</h1>
          <p className="mt-1.5 text-[14.5px] text-white/60">
            {staff
              ? `${state.companies.length} ${state.companies.length === 1 ? "empresa" : "empresas"} na carteira${state.groups.length ? ` · ${state.groups.length} ${state.groups.length === 1 ? "grupo" : "grupos"}` : ""}`
              : temBi
                ? `Os números ${totalCliente > 1 ? "das suas empresas" : "da sua empresa"}, fechados pelo escritório.`
                : temReforma
                  ? "Simule o impacto da Reforma Tributária na sua empresa, produto a produto."
                  : ""}
          </p>

          {staff && (
            <div className="relative mt-7 max-w-2xl">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/55" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && resultados[0]) abrir(resultados[0]);
                  if (event.key === "Escape") setBusca("");
                }}
                placeholder="Abrir empresa ou grupo — nome, código ou CNPJ"
                className="inicio-busca h-[52px] w-full rounded-2xl border border-white/15 bg-white/[0.08] pl-12 pr-12 text-[15px] text-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] outline-none backdrop-blur placeholder:text-white/45 focus:border-white/35 focus:bg-white/[0.12]"
              />
              <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/20 px-1.5 py-0.5 text-[11px] text-white/50 sm:block">/</kbd>
              {busca.trim() && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl bg-surface-card text-ink-900 shadow-2xl ring-1 ring-line">
                  {resultados.length === 0 ? (
                    <p className="px-4 py-3 text-[13px] text-ink-400">Nada encontrado para "{busca.trim()}".</p>
                  ) : (
                    resultados.map((item, index) => (
                      <button key={`${item.tipo}:${item.id}`} type="button" onClick={() => abrir(item)} className={`inicio-resultado flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted ${index === 0 ? "bg-surface-muted/60" : ""}`}>
                        <Avatar name={item.nome} size={30} className="rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{item.nome}</span>
                          {item.detalhe && <span className="block truncate text-[11.5px] text-ink-400">{item.detalhe}</span>}
                        </span>
                        {index === 0 && <span className="shrink-0 rounded border border-line px-1.5 text-[10.5px] text-ink-400">Enter</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="inicio min-h-screen bg-surface-page pb-16">
      {pending && <WorkspaceLoading name={pending.name} isGroup={pending.isGroup} phase={pending.phase} progress={state.journalLoadProgress} onCancel={cancelar} />}
      {explicando && (
        <ExplicaItem
          item={explicando.item}
          empresa={explicando.company.name}
          periodo={explicando.resumo?.mes ? `${nomeDoMes(explicando.resumo.mes)}/${explicando.resumo.mes.slice(2, 4)}` : ""}
          prevLabel={explicando.resumo?.prevLabel || ""}
          onClose={fecharExplicacao}
          mesesDisponiveis={mesesComDados(explicando.company, { ate: mesFechadoDa(explicando.company) })}
          carregarSerie={carregarSerie}
          onAbrirEmpresa={() => {
            const id = explicando.company.id;
            setExplicando(null);
            abrirEmpresa(id);
          }}
        />
      )}
      {hero}

      <main className="mx-auto flex max-w-[1600px] flex-col gap-9 px-5 pt-8 sm:px-8">
        {staff ? (
          <>
            {abertas.length > 0 && (
              <section>
                <Titulo icone={Clock}>Abertas por último</Titulo>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {abertas.map((item) => (
                    <button key={`${item.tipo}:${item.id}`} type="button" onClick={() => abrir(item)} className="inicio-recente group flex items-center gap-3 rounded-xl bg-surface-card p-3.5 text-left shadow-sm ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <Avatar name={item.nome} size={38} className="rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink-900">{item.nome}</span>
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-400">
                          {item.tipo === "grupo" && (
                            <>
                              <Network size={11} /> Grupo ·{" "}
                            </>
                          )}
                          {quando(item.at)}
                        </span>
                      </span>
                      <ArrowRight size={15} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-600" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {state.isAdmin && (
              <section>
                <Titulo icone={Activity}>Situação da carteira</Titulo>
                <Carteira resumo={carteira} total={state.companies.length} onAbrir={() => navigate("/carteira")} />
              </section>
            )}

            <section>
              <Titulo>Atalhos</Titulo>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <Atalho icone={LayoutGrid} tom="laranja" titulo="Empresas" texto="Todas, com grupos e filtros" onClick={() => navigate("/empresas")} />
                <Atalho icone={Activity} tom="azul" titulo="Carteira" texto="Saúde dos dados" onClick={() => navigate("/carteira")} />
                {temReforma && <Atalho icone={Scale} tom="azul" titulo="Reforma Tributária" texto="Simulações" onClick={() => navigate("/reforma")} />}
                <Atalho icone={Settings} tom="cinza" titulo="Parâmetros" texto="Cadastros e acessos" onClick={() => navigate("/parametros")} />
              </div>
            </section>
          </>
        ) : (
          <>
            {temBi && totalCliente > 0 && (
              <section className="flex flex-col gap-4">
                <Titulo>{totalCliente === 1 ? "Sua empresa" : "Suas empresas"}</Titulo>
                {gruposCliente.map((group) => (
                  <button key={group.id} type="button" onClick={() => abrirGrupo(group.id)} className="inicio-grupo group -mt-1 flex items-center gap-4 rounded-2xl bg-navy-900 p-4 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:px-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                      <Network size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{group.name}</span>
                      <span className="block truncate text-[12px] text-white/55">Consolidado de {(group.companyIds || []).length} empresas · {groupCompanies(group).map((company) => company.name).join(", ")}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-medium sm:flex">
                      Abrir o consolidado <ArrowRight size={15} />
                    </span>
                    <ArrowRight size={18} className="shrink-0 sm:hidden" />
                  </button>
                ))}
                <div className={`grid grid-cols-1 gap-5 ${state.companies.length > 1 ? "lg:grid-cols-2" : ""}`}>
                  {state.companies.map((company) => (
                    <CartaoEmpresa
                      key={company.id}
                      company={company}
                      grande={state.companies.length === 1}
                      resumo={numeros[company.id]}
                      calculando={calcularNumeros && !(company.id in numeros)}
                      onAbrir={() => abrirEmpresa(company.id)}
                      onApresentacao={(deckId) => abrirEmpresa(company.id, `/empresa/apresentacoes/${deckId}?apresentar=1`)}
                      onExplicar={(item) => setExplicando({ item, company, resumo: numeros[company.id] })}
                    />
                  ))}
                </div>
              </section>
            )}

            {temReforma && (
              <section>
                <Atalho icone={Scale} tom="azul" titulo="Reforma Tributária" texto="Simule o impacto da reforma na sua empresa, produto a produto" onClick={() => navigate("/reforma")} />
              </section>
            )}

            {!temBi && !temReforma && (
              <div className="rounded-2xl bg-surface-card p-8 text-center shadow-sm ring-1 ring-line">
                <p className="text-[14px] font-medium text-ink-900">Nenhum acesso liberado ainda</p>
                <p className="mt-1 text-[13px] text-ink-400">Fale com o escritório para liberar as suas empresas.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
