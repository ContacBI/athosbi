import { useState } from "react";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachJournalMonths } from "../lib/journalMonths.js";
import { fetchDominioEntries, isDominioPending, unmappedAccounts } from "../lib/dominioSync.js";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(competencia) {
  const [year, month] = competencia.split("-");
  return `${MONTH_SHORT[Number(month) - 1]}/${year.slice(2)}`;
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

// Cartão "Domínio" da tela Dados (RelatoriosMensais.jsx): mostra os meses
// que a Central mandou direto do banco da Domínio (ver lib/dominioSync.js e
// supabase/functions/dominio-sync) comparados com o razão atual, e aplica
// no razão os pendentes — sempre por clique, nunca sozinho. Os dados vêm
// de useDominioSync (a página compartilha com os quadrados dos meses). As
// mensagens de andamento/erro usam a mesma faixa da página (props).
export default function DominioSyncCard({ dominio, onBusy, onDone, onError, onProgress }) {
  const state = useAppState();
  const { codigo, cnpj, months, loadError, reload } = dominio;
  const [applying, setApplying] = useState(false);

  const withStatus = months || [];
  const pending = withStatus.filter((month) => isDominioPending(month.status));
  const lastSync = withStatus.reduce((latest, month) => (month.syncedAt > latest ? month.syncedAt : latest), "");

  async function apply(targets) {
    if (!targets.length || applying) return;
    setApplying(true);
    try {
      onBusy("Buscando os lançamentos da Domínio…");
      const entries = await fetchDominioEntries(codigo, cnpj, targets, state.mappings);
      const labels = targets.map((month) => monthLabel(month.competencia)).join(", ");
      const semDePara = unmappedAccounts(entries, state.mappings);
      const aviso = semDePara.length
        ? `\n\nAtenção: ${semDePara.length} conta${semDePara.length === 1 ? "" : "s"} ainda sem De/Para (ex.: ${semDePara.slice(0, 3).join(", ")}). Os lançamentos entram, mas essas contas ficam fora dos relatórios até serem vinculadas.`
        : "";
      if (!window.confirm(`Substituir ${targets.length === 1 ? "o mês" : `${targets.length} meses`} ${labels} pelos ${entries.length} lançamentos da Domínio? Os outros meses não são afetados.${aviso}`)) {
        onDone("");
        return;
      }
      // Mesmo caminho da importação de diário: troca só esses meses e só
      // resolve depois que o Supabase confirmou (desfaz tudo se falhar).
      await attachJournalMonths(entries, { onProgress: onProgress("Salvando os lançamentos da Domínio...") });
      onDone(`Atualizado com a Domínio: ${labels}.`);
    } catch (error) {
      console.error("Falha ao aplicar os lançamentos da Domínio:", error);
      onError(error?.message?.includes("recarregue") ? error.message : "Não consegui trazer os lançamentos da Domínio — nada foi alterado. Tenta de novo.");
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
  } else if (!withStatus.length) {
    body = <p className="text-[12.5px] text-ink-400">Nada recebido da Domínio ainda para o código {codigo} com o CNPJ desta empresa. Quando a Central sincronizar, os meses aparecem aqui.</p>;
  } else {
    body = (
      <>
        <p className="text-[12px] text-ink-400">
          Código {codigo} · CNPJ conferido · última sincronização {new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {pending.length ? ` · ${pending.length} ${pending.length === 1 ? "mês pendente" : "meses pendentes"}` : " · tudo igual ao portal"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {withStatus.map((month) => {
            const clickable = isDominioPending(month.status);
            return (
              <button
                key={month.competencia}
                type="button"
                disabled={!clickable || applying}
                onClick={() => apply([month])}
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
          onClick={() => apply(pending)}
          disabled={!pending.length || applying}
          className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Atualizar com a Domínio{pending.length ? ` (${pending.length})` : ""}
        </button>
      </div>
    </div>
  );
}
