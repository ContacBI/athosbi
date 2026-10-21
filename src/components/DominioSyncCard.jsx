import { useEffect, useRef, useState } from "react";
import { Check, Clock, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachJournalMonths } from "../lib/journalMonths.js";
import { applyBalancete, applyBalanceteAno } from "../lib/companies.js";
import {
  fetchDominioEntries,
  isDominioPending,
  isPedidoAberto,
  migrateMappings,
  monthLabel,
  monthsBetween,
  periodoLabel,
  sugerirVinculos,
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

const dataBr = (iso) => {
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
const periodo = (balancete) => `${dataBr(balancete.inicio)} a ${dataBr(balancete.fim)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

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
  const { codigo, cnpj, months, balancetes, pedido, loadError, balanceteError, reload, pedir, cancelarPedido } = dominio;
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
  // O balancete do ano da tela (o do ano corrente, ou o de um ano anterior
  // que veio de pedido à Central).
  const balancete = (balancetes || []).find((item) => item.ano === String(year)) || null;
  const pending = withStatus.filter((month) => isDominioPending(month.status) && noPeriodo(month.competencia));
  const balancetePendente = Boolean(balancete && balancete.status !== "igual");
  // Só dá pra pedir mês que já começou.
  const pedivel = monthsBetween(inicio, fim < agora ? fim : agora);
  const pedidoAberto = isPedidoAberto(pedido);

  // "Pedi e estou esperando": guardado na sessão pra sobreviver a um F5.
  const chaveAguardando = `dominioAguardando.${state.activeCompanyId}`;
  const aguardando = useRef(false);
  function marcarAguardando(valor) {
    aguardando.current = valor;
    try {
      if (valor) sessionStorage.setItem(chaveAguardando, "1");
      else sessionStorage.removeItem(chaveAguardando);
    } catch {
      /* sessionStorage indisponível: só perde o F5 */
    }
  }
  useEffect(() => {
    try {
      aguardando.current = sessionStorage.getItem(chaveAguardando) === "1";
    } catch {
      aguardando.current = false;
    }
  }, [chaveAguardando]);

  // O pedido terminou: traz sozinho os meses do período e o balancete.
  useEffect(() => {
    if (!aguardando.current || applying || months === null || !pedido) return;
    if (pedido.status === "erro") {
      marcarAguardando(false);
      return;
    }
    if (pedido.status !== "feito") return;
    marcarAguardando(false);
    if (!pending.length && !balancetePendente) {
      onDone("A Central terminou: o portal já está igual à Domínio nesse período.");
      return;
    }
    apply(pending, balancetePendente, { semPergunta: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, months, balancetes, applying]);

  async function handlePedir() {
    if (!pedivel.length || pedindo || pedidoAberto) return;
    const ultimo = pedivel[pedivel.length - 1];
    setPedindo(true);
    try {
      await pedir(inicio, ultimo);
      marcarAguardando(true);
      onDone(`Pedido enviado à Central: ${periodoLabel(inicio, ultimo)}. Quando ela terminar, os lançamentos e o balancete entram sozinhos — pode deixar esta tela aberta.`);
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

  async function apply(targets, withBalancete, { semPergunta = false } = {}) {
    const bal = withBalancete && balancete ? balancete : null;
    if ((!targets.length && !bal) || applying) return;
    setApplying(true);
    let balanceteSalvo = false;
    try {
      onBusy("Buscando os dados da Domínio…");
      // Balancete primeiro: o De/Para pode acompanhar conta renumerada na
      // Domínio (balancete principal) ou ganhar vínculo sugerido pras contas
      // que só existiam num ano anterior (balancete daquele ano) — e os meses
      // têm que chegar já carimbados com o De/Para novo.
      const doAno = bal?.destino === "ano";
      const migracao = bal && !doAno ? migrateMappings(state.mappings, bal.accounts) : { mappings: state.mappings, renumeradas: [], removidas: [] };
      const sugestao = doAno ? sugerirVinculos(bal.accounts, state.mappings) : null;
      const mappingsFinais = sugestao ? sugestao.mappings : migracao.mappings;
      const entries = targets.length ? await fetchDominioEntries(codigo, cnpj, targets, mappingsFinais) : [];
      const labels = targets.map((month) => monthLabel(month.competencia)).join(", ");
      const itens = [];
      if (bal) itens.push(`o balancete${doAno ? ` de ${bal.ano}` : ""} (${periodo(bal)}, ${plural(bal.accounts.length, "conta", "contas")})`);
      if (targets.length) itens.push(`${targets.length === 1 ? "o mês" : "os meses"} ${labels} (${plural(entries.length, "lançamento", "lançamentos")})`);

      const avisos = [];
      if (doAno) {
        const principal = state.companies.find((item) => item.id === state.activeCompanyId)?.lastBalanceteMeta;
        avisos.push(`Fica guardado como balancete de ${bal.ano}: o Balanço, o DFC e os indicadores usam ele quando o período começa em ${bal.ano}.${principal?.inicio ? ` O balancete atual (${periodo(principal)}) não muda.` : ""}`);
        const { contagem, novas, pendentes: semVinculo } = sugestao;
        if (novas.length) {
          const partes = [
            contagem.mesmaConta ? `${contagem.mesmaConta} mesma conta em outro número` : "",
            contagem.mesmoNome ? `${contagem.mesmoNome} pelo mesmo nome` : "",
            contagem.irmas ? `${contagem.irmas} pelas contas irmãs` : "",
          ].filter(Boolean);
          avisos.push(`${plural(novas.length, "conta que só existia", "contas que só existiam")} em ${bal.ano} ${novas.length === 1 ? "ganha" : "ganham"} vínculo sugerido (${partes.join(", ")}) — dá pra revisar no De/Para.`);
        }
        if (semVinculo.length) {
          avisos.push(`${plural(semVinculo.length, "conta", "contas")} de ${bal.ano} ${semVinculo.length === 1 ? "fica" : "ficam"} sem vínculo (ex.: ${semVinculo.slice(0, 3).map((account) => account.nome_conta).join(", ")}) — vincule no De/Para (marcadas "${bal.ano}").`);
        }
      }
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
      const semDePara = doAno
        ? unmappedAccounts(entries, mappingsFinais).filter((classificacao) => !sugestao.pendentes.some((account) => account.classificacao === classificacao))
        : [...new Set([...unmappedAccounts(entries, migracao.mappings), ...(bal ? unmappedBalanceteAccounts(bal.accounts, migracao.mappings).map((account) => account.classificacao) : [])])];
      if (semDePara.length) {
        avisos.push(`${plural(semDePara.length, "conta ainda sem", "contas ainda sem")} De/Para (ex.: ${semDePara.slice(0, 3).join(", ")}). Os valores entram, mas essas contas ficam fora dos relatórios até serem vinculadas.`);
      }
      const pergunta = `${doAno && !targets.length && bal.status === "novo" ? "Guardar" : "Substituir"} ${itens.join(" e ")} pelo que veio da Domínio?${targets.length ? " Os outros meses não são afetados." : ""}`;
      // Sem pergunta quando vem do "Pedir à Central"; só pergunta se o De/Para
      // for perder algum vínculo (o único caso destrutivo).
      const perdeVinculo = migracao.mappings.length < state.mappings.length;
      if ((!semPergunta || perdeVinculo) && !window.confirm(`${pergunta}${avisos.length ? `\n\n${avisos.map((aviso) => `• ${aviso}`).join("\n")}` : ""}`)) {
        onDone("");
        return;
      }
      if (bal) {
        onBusy("Salvando o balancete da Domínio…");
        const meta = {
          name: `Domínio · ${periodo(bal)}`,
          uploadedAt: new Date().toISOString(),
          accountsCount: bal.accounts.length,
          origem: "dominio",
          inicio: bal.inicio,
          fim: bal.fim,
          syncedAt: bal.syncedAt,
        };
        if (doAno) await applyBalanceteAno(bal.ano, bal.accounts, mappingsFinais, meta);
        else await applyBalancete(bal.accounts, migracao.mappings, meta);
        balanceteSalvo = true;
      }
      // Mesmo caminho da importação de diário: troca só esses meses e só
      // resolve depois que o Supabase confirmou (desfaz tudo se falhar).
      if (entries.length) await attachJournalMonths(entries, { onProgress: onProgress("Salvando os lançamentos da Domínio...") });
      onDone(`Pronto, veio da Domínio: ${[bal ? `balancete${doAno ? ` de ${bal.ano}` : ""}` : "", labels].filter(Boolean).join(" e ")}.${semDePara.length ? ` Atenção: ${plural(semDePara.length, "conta ainda sem", "contas ainda sem")} De/Para (veja a aba De/Para).` : ""}`);
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
    const ultimoPedivel = pedivel[pedivel.length - 1];
    body = (
      <>
        <p className="text-[12px] text-ink-400">Escolha o período e peça. A Central traz os lançamentos e o balancete da Domínio e eles entram aqui sozinhos.</p>
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
            disabled={!pedivel.length || pedindo || pedidoAberto || applying}
            title={
              pedidoAberto
                ? "Já tem um pedido aberto pra esta empresa — espere a Central terminar"
                : pedivel.length
                  ? `Pede à Central ${periodoLabel(inicio, ultimoPedivel)} e já traz os lançamentos e o balancete`
                  : "Esse período ainda não começou"
            }
            className="ml-1 flex h-8 items-center gap-1.5 rounded-md bg-accent-500 px-3 font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Send size={12.5} strokeWidth={1.9} />
            {pedindo ? "Pedindo…" : applying ? "Trazendo…" : "Pedir à Central"}
          </button>
        </div>
        {pedido && (
          <div className="mt-2">
            <PedidoStatus pedido={pedido} months={months} onCancelar={handleCancelar} cancelando={cancelando} />
          </div>
        )}
        {(loadError || balanceteError) && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warning-600">
            <TriangleAlert size={13} strokeWidth={2} />
            Não consegui consultar a Domínio agora.
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
    </div>
  );
}
