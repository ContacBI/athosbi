import { Fragment, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Download, Search, X } from "lucide-react";
import { entriesForAccount, journalByCompanyAndDate, counterpartsForEntry } from "../data/calculations.js";
import { money } from "../lib/format.js";
import { exportLedgerPdf } from "../lib/ledgerPdf.js";
import { slug } from "../lib/demonstrativoExport.js";
import Avatar from "./Avatar.jsx";

// Nome de exibição de uma conta a partir de um lançamento — mesma
// prioridade de campo usada em vários lugares (descricao_conta primeiro).
function accountLabel(entry) {
  return entry.descricao_conta || entry.categoria_gerencial || entry.classificacao || "(sem nome)";
}

function moneyClass(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) < 0.005) return "text-ink-600";
  return numeric < 0 ? "text-danger-600" : "text-success-600";
}

function formatDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
}

// Sem acento e minúsculo — usado tanto pra montar o "haystack" de cada
// lançamento quanto pra normalizar o termo digitado na busca, pra "Fornec"
// achar "Fornecedores" e "PRONAMPE" achar "Pronampe" sem se importar com caixa.
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// "Sem contrapartida identificada" não é uma conta de verdade — é um balde
// (classificacao literal "sem-contrapartida") pra onde vai a PARTE de um
// lançamento de caixa que não fechou com nenhuma contrapartida (ver
// findCashPieces/addDfcAnalytic em calculations.js). entriesForAccount não
// acha nada pra esse código (nenhum lançamento real tem essa classificacao),
// então esse balde SEMPRE abria um diário vazio — os "71 lançamentos" do
// cabeçalho existiam, mas não tinha como ver nenhum deles. row.dfcEntries já
// carrega o pedaço real (data/histórico/valor da SOBRA, não o lançamento
// inteiro) de cada um — mesma fonte que os "qtd_lancamentos" mostrados na
// tela. Só entra por esse caminho aqui; contas de verdade continuam usando
// entriesForAccount (diário completo da conta, não só o pedaço batido na DFC).
const SEM_CONTRAPARTIDA_CODE = "sem-contrapartida";

export default function LedgerModal({ row, onClose }) {
  const [search, setSearch] = useState("");
  const rawEntries = row.classificacao === SEM_CONTRAPARTIDA_CODE && Array.isArray(row.dfcEntries)
    ? row.dfcEntries
    : entriesForAccount(row.classificacao);
  const showCompany = rawEntries.some((entry) => entry.companyName) && new Set(rawEntries.map((entry) => entry.companyName)).size > 1;
  // Uma linha somada entre empresas (ver mergeGroupRowsByName) mistura o
  // diário de cada uma sob a mesma conta. Intercalar tudo por data só pela
  // data deixa confuso qual lançamento é de qual empresa — em vez disso,
  // agrupa: todos os lançamentos de uma empresa primeiro (por data), depois
  // da próxima, e assim por diante.
  const entries = showCompany
    ? [...rawEntries].sort((a, b) => {
        const company = String(a.companyName || "").localeCompare(String(b.companyName || ""), "pt-BR");
        if (company) return company;
        return String(a.data).localeCompare(String(b.data));
      })
    : [...rawEntries].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const totalDebito = entries.reduce((sum, entry) => sum + Number(entry.debito || 0), 0);
  const totalCredito = entries.reduce((sum, entry) => sum + Number(entry.credito || 0), 0);
  // Agrupa o razão inteiro por empresa+dia uma vez só (modal acabou de
  // abrir) — cada linha reaproveita esse mapa em vez de varrer tudo de
  // novo; ver counterpartsForEntry/journalByCompanyAndDate em calculations.js.
  const journalByDate = useMemo(() => journalByCompanyAndDate(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Contrapartida (e o texto de busca de cada linha) é calculada uma vez só
  // aqui, junto com o resto — não no render da tabela. Isso é essencial:
  // digitar na busca reexecuta o componente a cada tecla, e recalcular a
  // busca de combinação (findClosingCombination) pra cada um dos milhares de
  // lançamentos a cada tecla travaria a digitação. Filtrar em cima do que já
  // foi calculado é barato; recalcular contrapartida não é.
  const entriesWithMeta = useMemo(
    () =>
      entries.map((entry) => {
        const dayKey = `${entry.companyId || ""}|${entry.data || ""}`;
        const counterparts = counterpartsForEntry(entry, journalByDate.get(dayKey));
        const counterpartText = counterparts.map(accountLabel).join(" · ");
        const haystack = normalizeText(
          [
            formatDate(entry.data),
            entry.data,
            entry.historico,
            counterpartText,
            entry.debito,
            entry.credito,
            money(entry.debito || 0),
            money(entry.credito || 0),
          ].join(" ")
        );
        return { entry, counterparts, counterpartText, haystack };
      }),
    [entries, journalByDate]
  );
  const filtered = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return entriesWithMeta;
    return entriesWithMeta.filter((item) => item.haystack.includes(term));
  }, [entriesWithMeta, search]);
  const label = row.nome_conta || row.categoria_gerencial;
  const isSemContrapartida = row.classificacao === SEM_CONTRAPARTIDA_CODE;
  // Linha somada entre empresas (ver mergeGroupRowsByName em calculations.js)
  // carrega um array de códigos em vez de um só — mostra quantas empresas
  // foram somadas nessa conta em vez do código cru de cada uma.
  const classificacaoLabel = Array.isArray(row.classificacao)
    ? `${row.classificacao.length} contas somadas (mesmo nome, empresas diferentes)`
    : row.classificacao;

  // Imprime exatamente o que está na tela no momento (respeitando a busca,
  // se houver uma ativa) — mesmo padrão dos outros exports do portal.
  // Quando showCompany, as linhas já chegam ordenadas empresa-a-empresa
  // (ver `entries` acima); exportLedgerPdf usa isso pra intercalar um
  // cabeçalho com o nome da empresa antes do primeiro lançamento dela, em
  // vez de misturar tudo só por data.
  function handleDownloadPdf() {
    exportLedgerPdf({
      label,
      classificacaoLabel,
      totalLabel: `${filtered.length} lançamento${filtered.length === 1 ? "" : "s"} · Saldo ${money(totalDebito - totalCredito)}`,
      showCompany,
      rows: filtered.map(({ entry, counterpartText }) => ({
        data: entry.data,
        historico: entry.historico,
        counterpartText,
        debito: entry.debito,
        credito: entry.credito,
        companyName: entry.companyName,
      })),
      fileLabel: `diario_${slug(label)}`,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]">
      <div className="flex h-full max-h-[820px] w-full max-w-6xl flex-col rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="flex items-center gap-3.5">
            <Avatar name={label} size={44} />
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Diário da conta</span>
              <h2 className="mt-0.5 text-[19px] font-semibold text-ink-900">{label}</h2>
              <p className="mt-0.5 text-[13px] text-ink-400">{classificacaoLabel} · {entries.length} lançamentos</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!filtered.length}
              title="Baixar PDF"
              className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isSemContrapartida && (
          <div className="border-b border-line bg-warning-500/10 px-6 py-2.5 text-[12px] text-ink-700">
            Cada linha abaixo é só a <strong>parte que sobrou</strong> de um lançamento de caixa composto — não achamos, no mesmo dia, nenhuma outra conta cuja soma fechasse o valor todo.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface-page px-6 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600">
              <ArrowDownCircle size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[11px] text-ink-400">Total débito</p>
              <p className="text-[16px] font-semibold text-success-600">{money(totalDebito)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
              <ArrowUpCircle size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[11px] text-ink-400">Total crédito</p>
              <p className="text-[16px] font-semibold text-danger-600">{money(totalCredito)}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-line px-6 py-2.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por valor, histórico, contrapartida ou data..."
              className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400"
            />
          </div>
          {search.trim() && (
            <p className="mt-1.5 text-[11px] text-ink-400">{filtered.length} de {entries.length} lançamentos</p>
          )}
        </div>

        <div className="overflow-y-auto scrollbar-thin">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col style={{ width: "104px" }} />
              <col />
              <col style={{ width: "128px" }} />
              <col style={{ width: "128px" }} />
            </colgroup>
            <thead className="sticky top-0 bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="px-6 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Data</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Histórico</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Débito</th>
                <th className="px-6 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const { entry, counterparts, counterpartText } = item;
                const newCompany = showCompany && entry.companyName !== filtered[index - 1]?.entry.companyName;
                return (
                  <Fragment key={`${entry.linha_origem}-${index}`}>
                    {newCompany && (
                      <tr key={`company-${entry.companyName}-${index}`} className="sticky top-9 z-[1]">
                        <td colSpan={4} className="border-y border-line bg-surface-muted px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                          {entry.companyName || "Empresa não identificada"}
                        </td>
                      </tr>
                    )}
                    <tr className={`transition-colors hover:bg-accent-50/40 ${index % 2 ? "bg-surface-muted/70" : "bg-surface-card"}`}>
                      <td className="whitespace-nowrap px-6 py-2 align-top text-ink-600">{formatDate(entry.data)}</td>
                      <td className="max-w-0 px-4 py-2 align-top text-ink-900">
                        <p className="truncate" title={entry.historico}>{entry.historico}</p>
                        <p className="mt-0.5 truncate text-[11px] text-ink-400" title={counterpartText || undefined}>
                          {counterparts.length === 0 ? (
                            <span className="italic text-warning-600">contrapartida não encontrada</span>
                          ) : (
                            counterpartText
                          )}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 align-top text-right tabular-nums text-success-600">{entry.debito ? money(entry.debito) : ""}</td>
                      <td className="whitespace-nowrap px-6 py-2 align-top text-right tabular-nums text-danger-600">{entry.credito ? money(entry.credito) : ""}</td>
                    </tr>
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-ink-400">
                    {entries.length === 0 ? "Nenhum lançamento no período selecionado." : "Nenhum lançamento encontrado para essa busca."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-6 border-t border-line px-6 py-3 text-[12px]">
          <span className="text-ink-400">Saldo do período: <span className={`font-semibold ${moneyClass(totalDebito - totalCredito)}`}>{money(totalDebito - totalCredito)}</span></span>
        </div>
      </div>
    </div>
  );
}
