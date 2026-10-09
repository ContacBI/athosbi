import { useState } from "react";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachJournalMonths } from "../lib/journalMonths.js";
import { applyBalancete } from "../lib/companies.js";
import { fetchDominioEntries, isDominioPending, migrateMappings, monthLabel, unmappedAccounts, unmappedBalanceteAccounts } from "../lib/dominioSync.js";

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

// Cartão "Domínio" da tela Dados (RelatoriosMensais.jsx): mostra os meses e
// o balancete que a Central mandou direto do banco da Domínio (ver
// lib/dominioSync.js e supabase/functions/dominio-sync) comparados com o
// que está no portal, e aplica os pendentes — sempre por clique, nunca
// sozinho. Os dados vêm de useDominioSync (a página compartilha com os
// quadrados dos meses). As mensagens de andamento/erro usam a mesma faixa
// da página (props).
export default function DominioSyncCard({ dominio, onBusy, onDone, onError, onProgress }) {
  const state = useAppState();
  const { codigo, cnpj, months, balancete, loadError, balanceteError, reload } = dominio;
  const [applying, setApplying] = useState(false);

  const withStatus = months || [];
  const pending = withStatus.filter((month) => isDominioPending(month.status));
  const balancetePendente = Boolean(balancete && balancete.status !== "igual");
  const pendingCount = pending.length + (balancetePendente ? 1 : 0);
  const lastSync = [...withStatus.map((month) => month.syncedAt), balancete?.syncedAt || ""].reduce((latest, at) => (at > latest ? at : latest), "");

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
        const outrosMeses = pending.filter((month) => !targets.includes(month));
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
  } else if (!withStatus.length && !balancete) {
    body = <p className="text-[12.5px] text-ink-400">Nada recebido da Domínio ainda para o código {codigo} com o CNPJ desta empresa. Quando a Central sincronizar, os meses aparecem aqui.</p>;
  } else {
    const pendentes = [pending.length ? plural(pending.length, "mês", "meses") : "", balancetePendente ? "o balancete" : ""].filter(Boolean);
    body = (
      <>
        <p className="text-[12px] text-ink-400">
          Código {codigo} · CNPJ conferido · última sincronização {new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {pendingCount ? ` · ${pendentes.join(" e ")} ${pendingCount === 1 ? "pendente" : "pendentes"}` : " · tudo igual ao portal"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {withStatus.map((month) => {
            const clickable = isDominioPending(month.status);
            return (
              <button
                key={month.competencia}
                type="button"
                disabled={!clickable || applying}
                onClick={() => apply([month], false)}
                title={`${STATUS_TITLE[month.status]} · ${month.qtd} lançamentos na Domínio`}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-default ${STATUS_STYLE[month.status]}`}
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
          className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Atualizar com a Domínio{pendingCount ? ` (${pendingCount})` : ""}
        </button>
      </div>
    </div>
  );
}
