import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { filteredJournal } from "../data/calculations.js";
import { money } from "../lib/format.js";
import { buscarLancamentos, normalizarBusca } from "../lib/buscaLancamentos.js";

// "Buscar lançamento": uma consulta de lançamentos como a da Domínio, em cima do razão que já está carregado no período da tela. Acha pelo valor (exato ou faixa),
// por parte do histórico, pela conta e pela data, e ao clicar numa linha abre o diário daquela conta já rolado até o lançamento. Vale pra equipe e pro cliente
// (o cliente vê o mesmo razão que já abre ao clicar numa conta).
const LIMITE = 300;

function formatDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day.slice(0, 2)}/${month}/${year}` : value || "";
}

const campo = "w-full rounded-lg border border-line bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400";

export default function BuscaLancamentos({ onClose, onAbrir }) {
  const [historico, setHistorico] = useState("");
  const [valor, setValor] = useState("");
  const [conta, setConta] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [lado, setLado] = useState("todos"); // todos | debito | credito
  const primeiro = useRef(null);

  const base = useMemo(() => filteredJournal(), []);
  // Texto normalizado de cada lançamento, calculado uma vez só (digitar refaz a busca a cada tecla; refazer isso por tecla travaria em razão grande).
  const indice = useMemo(
    () => base.map((entry) => ({ entry, h: normalizarBusca(entry.historico), c: normalizarBusca(`${entry.classificacao} ${entry.descricao_conta || ""} ${entry.categoria_gerencial || ""}`) })),
    [base]
  );
  const multiEmpresa = useMemo(() => new Set(base.map((entry) => entry.companyName || "")).size > 1, [base]);

  const { resultado, valorInvalido } = useMemo(() => buscarLancamentos(indice, { historico, valor, conta, de, ate, lado }), [indice, historico, valor, conta, de, ate, lado]);
  const mostrados = resultado.lista.slice(0, LIMITE);
  const filtrando = Boolean(historico.trim() || valor.trim() || conta.trim() || de || ate || lado !== "todos");

  useEffect(() => {
    primeiro.current?.focus();
    const fecha = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", fecha);
    return () => window.removeEventListener("keydown", fecha);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">
      <div className="flex h-full max-h-[820px] w-full max-w-6xl flex-col rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Consulta de lançamentos</span>
            <h2 className="mt-0.5 text-[18px] font-semibold text-ink-900">Buscar lançamento</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">Procura em todos os lançamentos do período da tela ({base.length.toLocaleString("pt-BR")} lançamentos). Preencha o que souber: valor, parte do histórico, conta ou data.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface-page px-6 py-4 md:grid-cols-6">
          <label className="col-span-2 text-[11.5px] font-medium text-ink-500 md:col-span-2">
            Histórico
            <input ref={primeiro} value={historico} onChange={(event) => setHistorico(event.target.value)} placeholder="Parte do texto — ex.: aluguel janeiro" className={`${campo} mt-1`} />
          </label>
          <label className="text-[11.5px] font-medium text-ink-500">
            Valor
            <input value={valor} onChange={(event) => setValor(event.target.value)} placeholder="1.234,56 ou 1000 a 2000" inputMode="decimal" className={`${campo} mt-1 ${valorInvalido ? "border-danger-500" : ""}`} />
          </label>
          <label className="text-[11.5px] font-medium text-ink-500">
            Conta
            <input value={conta} onChange={(event) => setConta(event.target.value)} placeholder="Código ou nome" className={`${campo} mt-1`} />
          </label>
          <label className="text-[11.5px] font-medium text-ink-500">
            De
            <input type="date" value={de} onChange={(event) => setDe(event.target.value)} className={`${campo} mt-1`} />
          </label>
          <label className="text-[11.5px] font-medium text-ink-500">
            Até
            <input type="date" value={ate} onChange={(event) => setAte(event.target.value)} className={`${campo} mt-1`} />
          </label>
          <div className="col-span-2 flex items-center gap-1.5 text-[12px] md:col-span-6">
            {[["todos", "Débito e crédito"], ["debito", "Só débito"], ["credito", "Só crédito"]].map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setLado(id)} className={`rounded-full border px-3 py-1 font-medium transition-colors ${lado === id ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{nome}</button>
            ))}
            {filtrando && (
              <button type="button" onClick={() => { setHistorico(""); setValor(""); setConta(""); setDe(""); setAte(""); setLado("todos"); }} className="ml-2 text-[12px] font-medium text-accent-600 hover:underline">Limpar filtros</button>
            )}
            {valorInvalido && <span className="ml-2 text-[11.5px] text-danger-600">Não entendi o valor. Use 1.234,56 ou uma faixa como 1000 a 2000.</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-2 text-[12px] text-ink-500">
          <span>
            {filtrando ? <><b className="text-ink-900">{resultado.lista.length.toLocaleString("pt-BR")}</b> lançamento{resultado.lista.length === 1 ? "" : "s"} encontrado{resultado.lista.length === 1 ? "" : "s"}</> : "Preencha um filtro para buscar"}
            {resultado.lista.length > LIMITE && <> · mostrando os {LIMITE} primeiros (refine a busca)</>}
          </span>
          {filtrando && resultado.lista.length > 0 && <span>Débito {money(resultado.debito)} · Crédito {money(resultado.credito)}</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          {!base.length ? (
            <p className="px-6 py-10 text-center text-[13px] text-ink-400">Os lançamentos (razão) deste período ainda não estão carregados.</p>
          ) : (
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="sticky top-0 bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
                <tr>
                  <th className="w-px whitespace-nowrap px-6 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Data</th>
                  {multiEmpresa && <th className="w-px whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Empresa</th>}
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Conta</th>
                  <th className="w-full px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Histórico</th>
                  <th className="w-px whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Débito</th>
                  <th className="w-px whitespace-nowrap px-6 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">Crédito</th>
                </tr>
              </thead>
              <tbody>
                {mostrados.map((entry, index) => (
                  <tr key={`${entry.linha_origem}-${index}`} onClick={() => onAbrir(entry)} title="Abrir o diário desta conta neste lançamento" className={`cursor-pointer transition-colors hover:bg-accent-50/40 ${index % 2 ? "bg-surface-muted/70" : "bg-surface-card"}`}>
                    <td className="whitespace-nowrap px-6 py-2 align-top text-ink-600">{formatDate(entry.data)}</td>
                    {multiEmpresa && <td className="max-w-[200px] truncate whitespace-nowrap px-4 py-2 align-top text-[12px] text-ink-600" title={entry.companyName || ""}>{entry.companyName || "—"}</td>}
                    <td className="max-w-[260px] px-4 py-2 align-top text-ink-700">
                      <p className="truncate" title={entry.descricao_conta || ""}>{entry.descricao_conta || entry.categoria_gerencial || "(sem nome)"}</p>
                      <p className="truncate text-[11px] text-ink-400">{String(entry.classificacao || "").split("::").pop()}</p>
                    </td>
                    <td className="max-w-0 px-4 py-2 align-top text-ink-900"><p className="truncate" title={entry.historico}>{entry.historico}</p></td>
                    <td className="whitespace-nowrap px-4 py-2 align-top text-right tabular-nums text-ink-800">{entry.debito ? money(entry.debito) : ""}</td>
                    <td className="whitespace-nowrap px-6 py-2 align-top text-right tabular-nums text-ink-800">{entry.credito ? money(entry.credito) : ""}</td>
                  </tr>
                ))}
                {filtrando && !mostrados.length && (
                  <tr><td colSpan={multiEmpresa ? 6 : 5} className="px-6 py-10 text-center text-ink-400"><Search size={16} className="mx-auto mb-2" />Nenhum lançamento encontrado com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
