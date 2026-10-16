import { useEffect, useState } from "react";
import { Check, Clock, LoaderCircle, RefreshCw, Send, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachJournalMonths } from "../lib/journalMonths.js";
import { applyBalancete } from "../lib/companies.js";
import {
  fetchDominioEntries,
  isDominioPending,
  isPedidoAberto,
  migrateMappings,
  monthLabel,
  monthsBetween,
  periodoLabel,
  unmappedAccounts,
  unmappedBalanceteAccounts,
} from "../lib/dominioSync.js";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const pad = (month) => String(month).padStart(2, "0");
const mesAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`;
};
const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const PEDIDO_PARADO_MS = 15 * 60 * 1000;
const PEDIDO_RECENTE_MS = 24 * 60 * 60 * 1000;
const SELECT_CLASS = "h-7 rounded-md border border-line-strong bg-surface-card px-1.5 text-[12px] text-ink-800 outline-none transition-colors focus:border-accent-500";

// Competências em sequência viram faixa: "Jan/25 a Mar/25, Mai/25".
function faixas(competencias) {
  const grupos = [];
  competencias.forEach((competencia) => {
    const ultimo = grupos[grupos.length - 1];
    const seguinte = ultimo && monthsBetween(ultimo.fim, competencia).length === 2;
    if (seguinte) ultimo.fim = competencia;
    else grupos.push({ inicio: competencia, fim: competencia });
  });
  return grupos.map((grupo) => periodoLabel(grupo.inicio, grupo.fim)).join(", ");
}

// Situação do último pedido de período à Central (ver lib/dominioSync.js).
function PedidoStatus({ pedido, months, onCancelar, cancelando }) {
  const periodo = periodoLabel(pedido.inicio, pedido.fim);
  const desde = Date.now() - new Date(pedido.updated_at).getTime();
  const cancelar = (
    <button type="button" onClick={onCancelar} disabled={cancelando} className="ml-1 font-medium text-ink-500 underline decoration-dotted underline-offset-2 hover:text-ink-800 disabled:opacity-50">
      cancelar pedido
    </button>
  );
  if (pedido.status === "pendente") {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-500">
        <Clock size={12} strokeWidth={2} className="shrink-0 text-accent-500" />
        Pedido à Central: {periodo} · feito em {hora(pedido.created_at)} · aguardando a Central pegar
        {desde > 2 * PEDIDO_PARADO_MS ? " (está demorando — confira se a Central está ligada e atualizada)" : ""} ·{cancelar}
      </p>
    );
  }
  if (pedido.status === "andamento") {
    const doPedido = monthsBetween(pedido.inicio, pedido.fim);
    const chegaram = (months || []).filter((month) => doPedido.includes(month.competencia) && month.syncedAt >= pedido.created_at).length;
    const parado = desde > PEDIDO_PARADO_MS;
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-500">
        <LoaderCircle size={12} strokeWidth={2} className={`shrink-0 text-accent-500 ${parado ? "" : "animate-spin"}`} />
        A Central está trazendo {periodo} · {chegaram} de {doPedido.length} {doPedido.length === 1 ? "mês" : "meses"} já chegaram
        {parado ? <> · parece parada há {Math.round(desde / 60000)} min ·{cancelar}</> : ""}
      </p>
    );
  }
  if (desde > PEDIDO_RECENTE_MS) return null;
  if (pedido.status === "erro") {
    return (
      <p className="flex items-start gap-1.5 text-[12px] text-warning-600">
        <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
        <span>
          A Central não conseguiu trazer {periodo}: {pedido.mensagem || "sem detalhe"}.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-success-600">
      <Check size={12} strokeWidth={2.2} className="shrink-0" />
      A Central trouxe {periodo} em {hora(pedido.updated_at)}
      {Number.isInteger(pedido.meses) ? ` (${pedido.meses} ${pedido.meses === 1 ? "mês" : "meses"})` : ""} — os que mudaram aparecem como pendentes.
    </p>
  );
}

const STATUS_STYLE = {
  igual: "border-line bg-surface-muted text-ink-500",
  novo: "border-warning-500/60 bg-warning-50 text-warning-700 hover:border-warning-500",
  pendente: "border-warning-500/60 bg-warning-50 text-warning-700 hover:border-warning-500",
  vazio: "border-line bg-surface-muted text-ink-400",
};

const STATUS_TITLE = {
  igual: "Igual ao que já está no portal",
  novo: "Pendente: mês que ainda não está no portal — clique pra trazer só este mês",
  pendente: "Pendente: mudou na Domínio (lançamento novo ou excluído, valor, conta ou histórico) — clique pra atualizar só este mês",
  vazio: "Vazio na Domínio, mas o portal tem lançamentos — não é aplicado automaticamente; exclua o mês manualmente se for o caso",
};

const BALANCETE_TITLE = {
  igual: "Igual ao balancete que já está no portal",
  novo: "Pendente: a empresa ainda não tem balancete no portal — clique pra trazer só o balancete",
  pendente: "Pendente: o balancete da Domínio mudou (saldo, movimento, conta nova ou renomeada) — clique pra atualizar só o balancete",
};

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso) => {
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
const periodo = (balancete) => `${dataBr(balancete.inicio)} a ${dataBr(balancete.fim)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// "Saldo inicial + lançamentos = saldo final" — ver checkBalancete.
function Conferencia({ check }) {
  const problemas = [];
  if (check.mesesSemEnvio.length) {
    problemas.push(`${check.mesesSemEnvio.map(monthLabel).join(", ")} não ${check.mesesSemEnvio.length === 1 ? "veio" : "vieram"} da Domínio`);
  }
  if (Math.abs(check.naoFecha) >= 0.01) problemas.push(`o balancete da Domínio não fecha (diferença de ${brl(check.naoFecha)})`);
  if (check.diferencas.length) {
    const exemplo = check.diferencas[0];
    problemas.push(
      `${plural(check.diferencas.length, "conta", "contas")} com movimento diferente dos lançamentos do portal — ex.: ${exemplo.classificacao} ${exemplo.nome}: balancete ${brl(exemplo.balancete)} × lançamentos ${brl(exemplo.lancamentos)}`
    );
  }
  if (!problemas.length) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-success-600">
        <Check size={12} strokeWidth={2.2} />
        Conferência: saldo inicial + lançamentos = saldo final {check.contas === 1 ? "na conta" : `nas ${check.contas} contas`}.
      </p>
    );
  }
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-warning-600">
      <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
      <span>Conferência: {problemas.join("; ")}.</span>
    </p>
  );
}

// Cartão "Domínio" da tela Dados (RelatoriosMensais.jsx): mostra os meses
// (do ano escolhido na tela) e o balancete que a Central mandou direto do
// banco da Domínio (ver lib/dominioSync.js e supabase/functions/dominio-sync)
// comparados com o que está no portal, e aplica os pendentes do período
// escolhido — sempre por clique, nunca sozinho. Mês que não está na área de
// espera (ex.: 2025, que a rodada normal da Central não manda) se pede à
// Central pelo mesmo período. Os dados vêm de useDominioSync (a página
// compartilha com os quadrados dos meses). As mensagens de andamento/erro
// usam a mesma faixa da página (props).
export default function DominioSyncCard({ dominio, year, onBusy, onDone, onError, onProgress }) {
  const state = useAppState();
  const { codigo, cnpj, months, balancete, pedido, loadError, balanceteError, reload, pedir, cancelarPedido } = dominio;
  const [applying, setApplying] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Período dentro do ano da tela: o ano inteiro (até o mês atual, no ano
  // corrente) — volta pra isso ao trocar de ano.
  const agora = mesAtual();
  const ultimoMes = String(year) === agora.slice(0, 4) ? Number(agora.slice(5, 7)) : 12;
  const [de, setDe] = useState(1);
  const [ate, setAte] = useState(ultimoMes);
  useEffect(() => {
    setDe(1);
    setAte(ultimoMes);
  }, [year, ultimoMes]);
  const inicio = `${year}-${pad(de)}`;
  const fim = `${year}-${pad(ate)}`;
  const noPeriodo = (competencia) => competencia >= inicio && competencia <= fim;

  const withStatus = (months || []).filter((month) => month.competencia.startsWith(`${year}-`));
  const pending = withStatus.filter((month) => isDominioPending(month.status) && noPeriodo(month.competencia));
  const balancetePendente = Boolean(balancete && balancete.status !== "igual");
  const pendingCount = pending.length + (balancetePendente ? 1 : 0);
  const lastSync = [...withStatus.map((month) => month.syncedAt), balancete?.syncedAt || ""].reduce((latest, at) => (at > latest ? at : latest), "");
  const recebidos = new Set(withStatus.map((month) => month.competencia));
  // Só dá pra pedir mês que já começou.
  const pedivel = monthsBetween(inicio, fim < agora ? fim : agora);
  const faltando = pedivel.filter((competencia) => !recebidos.has(competencia));
  const pedidoAberto = isPedidoAberto(pedido);

  async function handlePedir() {
    if (!pedivel.length || pedindo || pedidoAberto) return;
    const ultimo = pedivel[pedivel.length - 1];
    setPedindo(true);
    try {
      await pedir(inicio, ultimo);
      onDone(`Pedido enviado à Central: ${periodoLabel(inicio, ultimo)}. Ela confere os pedidos a cada poucos minutos — os meses aparecem aqui como pendentes.`);
    } catch (error) {
      console.error("Falha ao pedir o período à Central:", error);
      onError(error?.message?.startsWith("Já tem um pedido") ? error.message : "Não consegui registrar o pedido — tenta de novo.");
    } finally {
      setPedindo(false);
    }
  }

  async function handleCancelar() {
    if (!pedido || cancelando || !window.confirm(`Cancelar o pedido de ${periodoLabel(pedido.inicio, pedido.fim)}?`)) return;
    setCancelando(true);
    try {
      await cancelarPedido();
      onDone("Pedido cancelado.");
    } catch (error) {
      console.error("Falha ao cancelar o pedido:", error);
      onError(error?.message?.startsWith("A Central já começou") ? error.message : "Não consegui cancelar o pedido — tenta de novo.");
    } finally {
      setCancelando(false);
    }
  }

  async function apply(targets, withBalancete) {
    const bal = withBalancete && balancete ? balancete : null;
    if ((!targets.length && !bal) || applying) return;
    setApplying(true);
    let balanceteSalvo = false;
    try {
      onBusy("Buscando os dados da Domínio…");
      // Balancete primeiro: o De/Para pode acompanhar conta renumerada na
      // Domínio, e os meses têm que chegar já carimbados com o De/Para novo.
      const migracao = bal ? migrateMappings(state.mappings, bal.accounts) : { mappings: state.mappings, renumeradas: [], removidas: [] };
      const entries = targets.length ? await fetchDominioEntries(codigo, cnpj, targets, migracao.mappings) : [];
      const labels = targets.map((month) => monthLabel(month.competencia)).join(", ");
      const itens = [];
      if (bal) itens.push(`o balancete (${periodo(bal)}, ${plural(bal.accounts.length, "conta", "contas")})`);
      if (targets.length) itens.push(`${targets.length === 1 ? "o mês" : "os meses"} ${labels} (${plural(entries.length, "lançamento", "lançamentos")})`);

      const avisos = [];
      if (migracao.renumeradas.length) {
        const ex = migracao.renumeradas[0];
        avisos.push(`${plural(migracao.renumeradas.length, "conta mudou", "contas mudaram")} de número na Domínio — o De/Para acompanha, pelo código da conta (ex.: ${ex.nome}: ${ex.de} → ${ex.para}).`);
      }
      if (migracao.removidas.length) {
        const ex = migracao.removidas[0];
        avisos.push(`${plural(migracao.removidas.length, "vínculo antigo sai", "vínculos antigos saem")} do De/Para: o número agora é de outra conta, que já tem o vínculo dela (ex.: ${ex.classificacao}, antes ${ex.nome_conta}).`);
      }
      if (migracao.mappings !== state.mappings) {
        avisos.push(`Desta vez não dá pra "voltar ao balancete anterior", porque o De/Para também muda.`);
        const outrosMeses = (months || []).filter((month) => isDominioPending(month.status) && !targets.some((target) => target.competencia === month.competencia));
        if (outrosMeses.length) avisos.push(`Atualize também ${outrosMeses.length === 1 ? "o mês pendente" : "os meses pendentes"} (${outrosMeses.map((month) => monthLabel(month.competencia)).join(", ")}) — vêm na numeração nova.`);
      }
      const semDePara = [...new Set([...unmappedAccounts(entries, migracao.mappings), ...(bal ? unmappedBalanceteAccounts(bal.accounts, migracao.mappings).map((account) => account.classificacao) : [])])];
      if (semDePara.length) {
        avisos.push(`${plural(semDePara.length, "conta ainda sem", "contas ainda sem")} De/Para (ex.: ${semDePara.slice(0, 3).join(", ")}). Os valores entram, mas essas contas ficam fora dos relatórios até serem vinculadas.`);
      }
      const pergunta = `Substituir ${itens.join(" e ")} pelo que veio da Domínio?${targets.length ? " Os outros meses não são afetados." : ""}`;
      if (!window.confirm(`${pergunta}${avisos.length ? `\n\n${avisos.map((aviso) => `• ${aviso}`).join("\n")}` : ""}`)) {
        onDone("");
        return;
      }
      if (bal) {
        onBusy("Salvando o balancete da Domínio…");
        await applyBalancete(bal.accounts, migracao.mappings, {
          name: `Domínio · ${periodo(bal)}`,
          uploadedAt: new Date().toISOString(),
          accountsCount: bal.accounts.length,
          origem: "dominio",
          inicio: bal.inicio,
          fim: bal.fim,
          syncedAt: bal.syncedAt,
        });
        balanceteSalvo = true;
      }
      // Mesmo caminho da importação de diário: troca só esses meses e só
      // resolve depois que o Supabase confirmou (desfaz tudo se falhar).
      if (entries.length) await attachJournalMonths(entries, { onProgress: onProgress("Salvando os lançamentos da Domínio...") });
      onDone(`Atualizado com a Domínio: ${[bal ? "balancete" : "", labels].filter(Boolean).join(", ")}.`);
    } catch (error) {
      console.error("Falha ao aplicar os dados da Domínio:", error);
      if (balanceteSalvo) onError("O balancete foi atualizado, mas os meses não — tente de novo os meses pendentes.");
      else onError(error?.message?.includes("recarregue") ? error.message : "Não consegui trazer os dados da Domínio — nada foi alterado. Tenta de novo.");
    } finally {
      setApplying(false);
    }
  }

  let body;
  if (!codigo || !cnpj) {
    body = <p className="text-[12.5px] text-ink-400">Cadastre o código e o CNPJ da empresa (os mesmos da Domínio) em Parâmetros › Empresas pra receber os lançamentos direto de lá.</p>;
  } else if (months === null) {
    body = <p className="text-[12.5px] text-ink-400">Verificando o que chegou da Domínio…</p>;
  } else if (loadError) {
    body = (
      <p className="flex items-center gap-1.5 text-[12.5px] text-warning-600">
        <TriangleAlert size={13} strokeWidth={2} />
        Não consegui consultar a Domínio agora.
      </p>
    );
  } else {
    const pendentes = [pending.length ? plural(pending.length, "mês", "meses") : "", balancetePendente ? "o balancete" : ""].filter(Boolean);
    const ultimoPedivel = pedivel[pedivel.length - 1];
    body = (
      <>
        <p className="text-[12px] text-ink-400">
          Código {codigo} · CNPJ conferido
          {lastSync ? ` · última sincronização ${hora(lastSync)}` : ""}
          {pendingCount ? ` · ${pendentes.join(" e ")} ${pendingCount === 1 ? "pendente" : "pendentes"}` : withStatus.length ? " · tudo igual ao portal" : ""}
        </p>
        {withStatus.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {withStatus.map((month) => {
              const clickable = isDominioPending(month.status);
              return (
                <button
                  key={month.competencia}
                  type="button"
                  disabled={!clickable || applying}
                  onClick={() => apply([month], false)}
                  title={`${STATUS_TITLE[month.status]} · ${month.qtd} lançamentos na Domínio${noPeriodo(month.competencia) ? "" : " · fora do período escolhido"}`}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all disabled:cursor-default ${STATUS_STYLE[month.status]} ${noPeriodo(month.competencia) ? "" : "opacity-45"}`}
                >
                  {month.status === "igual" && <Check size={11} strokeWidth={2.2} />}
                  {monthLabel(month.competencia)}
                  {month.status === "novo" && <span className="font-normal">· pendente (novo)</span>}
                  {month.status === "pendente" && <span className="font-normal">· pendente</span>}
                  {month.status === "vazio" && <span className="font-normal">· vazio</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-400">Nada de {year} chegou da Domínio ainda — a rodada normal da Central só manda o ano corrente. Peça o período abaixo.</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-ink-500">
          <span>Período</span>
          <select
            aria-label="Mês inicial do período"
            value={de}
            onChange={(event) => {
              const valor = Number(event.target.value);
              setDe(valor);
              if (valor > ate) setAte(valor);
            }}
            className={SELECT_CLASS}
          >
            {MESES.map((mes, index) => (
              <option key={mes} value={index + 1}>
                {mes}
              </option>
            ))}
          </select>
          <span>a</span>
          <select
            aria-label="Mês final do período"
            value={ate}
            onChange={(event) => {
              const valor = Number(event.target.value);
              setAte(valor);
              if (valor < de) setDe(valor);
            }}
            className={SELECT_CLASS}
          >
            {MESES.map((mes, index) => (
              <option key={mes} value={index + 1}>
                {mes}
              </option>
            ))}
          </select>
          <span>de {year}</span>
          <button
            type="button"
            onClick={handlePedir}
            disabled={!pedivel.length || pedindo || pedidoAberto}
            title={
              pedidoAberto
                ? "Já tem um pedido aberto pra esta empresa — espere a Central terminar"
                : pedivel.length
                  ? `Pede à Central os lançamentos de ${periodoLabel(inicio, ultimoPedivel)} direto da Domínio (os que já estão aqui vêm de novo, pra conferir)`
                  : "Esse período ainda não começou"
            }
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 font-medium text-ink-700 transition-colors hover:border-accent-300 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={12.5} strokeWidth={1.9} />
            {pedindo ? "Pedindo…" : "Pedir à Central"}
          </button>
          {faltando.length > 0 && !pedidoAberto && (
            <span className="text-ink-400">
              {faltando.length === pedivel.length
                ? "nenhum mês desse período chegou da Domínio ainda"
                : `${plural(faltando.length, "mês", "meses")} desse período ainda não ${faltando.length === 1 ? "chegou" : "chegaram"} da Domínio`}{" "}
              ({faixas(faltando)})
            </span>
          )}
        </div>
        {pedido && (
          <div className="mt-1.5">
            <PedidoStatus pedido={pedido} months={months} onCancelar={handleCancelar} cancelando={cancelando} />
          </div>
        )}
        {balancete && (
          <div className="mt-2.5 border-t border-line pt-2.5">
            <button
              type="button"
              disabled={!balancetePendente || applying}
              onClick={() => apply([], true)}
              title={`${BALANCETE_TITLE[balancete.status]} · ${balancete.accounts.length} contas na Domínio`}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-default ${STATUS_STYLE[balancete.status]}`}
            >
              {balancete.status === "igual" && <Check size={11} strokeWidth={2.2} />}
              Balancete {periodo(balancete)}
              {balancete.status === "novo" && <span className="font-normal">· pendente (novo)</span>}
              {balancete.status === "pendente" && <span className="font-normal">· pendente</span>}
            </button>
            <Conferencia check={balancete.check} />
          </div>
        )}
        {balanceteError && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warning-600">
            <TriangleAlert size={13} strokeWidth={2} />
            Não consegui consultar o balancete da Domínio agora.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Domínio · direto do banco</p>
        <div className="mt-1">{body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {codigo && cnpj && (
          <button
            type="button"
            onClick={reload}
            disabled={months === null || applying}
            title="Verificar de novo o que chegou da Domínio"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted disabled:opacity-40"
          >
            <RefreshCw size={14} strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onClick={() => apply(pending, balancetePendente)}
          disabled={!pendingCount || applying}
          title={`Traz pro portal os meses pendentes de ${periodoLabel(inicio, fim)}${balancetePendente ? " e o balancete" : ""} — os outros meses não mudam`}
          className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Atualizar com a Domínio{pendingCount ? ` (${pendingCount})` : ""}
        </button>
      </div>
    </div>
  );
}
