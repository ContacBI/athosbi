import { Fragment } from "react";
import { ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { entriesForAccount } from "../data/calculations.js";
import { money } from "../lib/format.js";
import Avatar from "./Avatar.jsx";

function moneyClass(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) < 0.005) return "text-ink-600";
  return numeric < 0 ? "text-danger-600" : "text-success-600";
}

function formatDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
}

export default function LedgerModal({ row, onClose }) {
  const rawEntries = entriesForAccount(row.classificacao);
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
  const label = row.nome_conta || row.categoria_gerencial;
  // Linha somada entre empresas (ver mergeGroupRowsByName em calculations.js)
  // carrega um array de códigos em vez de um só — mostra quantas empresas
  // foram somadas nessa conta em vez do código cru de cada uma.
  const classificacaoLabel = Array.isArray(row.classificacao)
    ? `${row.classificacao.length} contas somadas (mesmo nome, empresas diferentes)`
    : row.classificacao;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]">
      <div className="flex h-full max-h-[820px] w-full max-w-4xl flex-col rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="flex items-center gap-3.5">
            <Avatar name={label} size={44} />
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Diário da conta</span>
              <h2 className="mt-0.5 text-[19px] font-semibold text-ink-900">{label}</h2>
              <p className="mt-0.5 text-[13px] text-ink-400">{classificacaoLabel} · {entries.length} lançamentos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>

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

        <div className="overflow-y-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="px-6 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Data</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Histórico</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Débito</th>
                <th className="px-6 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const newCompany = showCompany && entry.companyName !== entries[index - 1]?.companyName;
                return (
                  <Fragment key={`${entry.linha_origem}-${index}`}>
                    {newCompany && (
                      <tr key={`company-${entry.companyName}-${index}`} className="sticky top-9 z-[1]">
                        <td colSpan={4} className="border-y border-line bg-surface-muted px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                          {entry.companyName || "Empresa não identificada"}
                        </td>
                      </tr>
                    )}
                    <tr className={`transition-colors hover:bg-surface-muted ${index % 2 ? "bg-surface-page/60" : "bg-surface-card"}`}>
                      <td className="whitespace-nowrap px-6 py-2 text-ink-600">{formatDate(entry.data)}</td>
                      <td className="px-4 py-2 text-ink-900">{entry.historico}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-success-600">{entry.debito ? money(entry.debito) : ""}</td>
                      <td className="whitespace-nowrap px-6 py-2 text-right tabular-nums text-danger-600">{entry.credito ? money(entry.credito) : ""}</td>
                    </tr>
                  </Fragment>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-ink-400">Nenhum lançamento no período selecionado.</td>
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
