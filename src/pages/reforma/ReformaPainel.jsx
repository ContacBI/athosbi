import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { listarAcessos, listarEmpresas, listarSimulacoes } from "../../lib/reforma/api.js";
import ReformaShell from "../../components/reforma/ReformaShell.jsx";
import { Cartao, Esqueleto, Indicador, RotuloDica } from "../../components/reforma/ui.jsx";
import { AJUDA } from "../../lib/reforma/textos.js";
import { porcento, reais } from "../../lib/reforma/formato.js";

const REGIME = { simples: "Simples", presumido: "Presumido", real: "Real" };
const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const th = "whitespace-nowrap px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-400";
const td = "whitespace-nowrap px-2 py-2 text-right font-mono text-[12.5px] tabular-nums text-ink-800";

// Painel do escritório: todas as simulações de todos os clientes, com os
// números principais (resumo gravado a cada salvamento). Só quem está em
// reforma_escritorio — a RLS devolve tudo só pra essas pessoas.
export default function ReformaPainel() {
  const state = useAppState();
  const navigate = useNavigate();
  const [simulacoes, setSimulacoes] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [empresas, setEmpresas] = useState(state.reformaEmpresas);
  // E-mails liberados como cliente (reforma_acessos) — pra separar o que os
  // CLIENTES simularam do que o escritório montou.
  const [clientesLiberados, setClientesLiberados] = useState(new Set());

  useEffect(() => {
    if (!state.isReformaEscritorio) return;
    listarEmpresas().then(setEmpresas).catch(() => {});
    listarAcessos()
      .then((acessos) => setClientesLiberados(new Set(acessos.map((acesso) => acesso.email))))
      .catch(() => setClientesLiberados(new Set()));
    listarSimulacoes()
      .then(setSimulacoes)
      .catch((error) => {
        console.error("Falha ao carregar o painel:", error);
        setErro("Não consegui carregar as simulações agora.");
        setSimulacoes([]);
      });
  }, [state.isReformaEscritorio]);

  const nomeEmpresa = useMemo(() => new Map(empresas.map((empresa) => [empresa.id, empresa.nome])), [empresas]);
  const linhas = useMemo(() => {
    const termo = norm(busca);
    return (simulacoes || []).filter((sim) => !termo || norm(`${nomeEmpresa.get(sim.empresa_id) || ""} ${sim.nome} ${sim.created_by || ""} ${sim.updated_by || ""}`).includes(termo));
  }, [simulacoes, busca, nomeEmpresa]);

  if (!state.isReformaEscritorio) return <Navigate to="/reforma" replace />;

  const comSimulacao = new Set((simulacoes || []).map((sim) => sim.empresa_id)).size;
  const doCliente = (simulacoes || []).filter((sim) => clientesLiberados.has(sim.created_by));
  const clientes = new Set(doCliente.map((sim) => sim.created_by)).size;
  const sobem = (simulacoes || []).filter((sim) => (sim.resumo?.carga2033 ?? 0) > (sim.resumo?.cargaHoje ?? 0) + 0.0005).length;

  return (
    <ReformaShell
      titulo="Painel do escritório"
      subtitulo="Todas as simulações dos clientes — pra montar os estudos."
      voltarPara="/reforma"
      voltarRotulo="Empresas da Reforma"
      acoes={
        <button type="button" onClick={() => navigate("/parametros/reforma")} className="flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-white/10">
          <SlidersHorizontal size={14} />
          Parâmetros
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Simulações" valor={simulacoes ? String(simulacoes.length) : "…"} apoio={`${comSimulacao} de ${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`} dica="Todas as simulações salvas, de todas as empresas da Reforma — do escritório e dos clientes." />
        <Indicador rotulo="Feitas por clientes" valor={simulacoes ? String(doCliente.length) : "…"} apoio={`${clientes} ${clientes === 1 ? "cliente já simulou" : "clientes já simularam"}`} dica="Simulações criadas por pessoas liberadas como cliente (aba Acesso do cliente) — o que o próprio dono testou." />
        <Indicador rotulo="Carga sobe em 2033" valor={simulacoes ? String(sobem) : "…"} apoio="Simulações em que o tributo sobre consumo aumenta" tom={sobem ? "negativo" : "neutro"} dica="Quantas simulações terminam 2033 com carga maior que a de hoje — bom ponto de partida pra montar os estudos." />
      </div>

      <Cartao
        titulo="Simulações"
        acoes={
          <label className="flex items-center gap-1.5 rounded-md border border-line-strong px-2 py-1">
            <Search size={14} className="text-ink-400" />
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Empresa, simulação ou pessoa" aria-label="Buscar" className="w-[220px] bg-transparent text-[12.5px] text-ink-900 outline-none" />
          </label>
        }
      >
        {erro && <p className="mb-2 text-[12.5px] text-danger-600">{erro}</p>}
        {simulacoes === null ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
            {[0, 1, 2, 3].map((item) => (
              <Esqueleto key={item} className="h-11 shadow-none ring-1 ring-line" />
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <p className="text-[13px] text-ink-400">{simulacoes.length ? "Nada encontrado nessa busca." : "Nenhuma simulação ainda. Cadastre a empresa em Empresas da Reforma, configure e libere o acesso do dono."}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={`${th} text-left`}>Empresa / simulação</th>
                  <th className={`${th} text-left`}>Regime</th>
                  <th className={th}>
                    <RotuloDica texto={AJUDA.vendaReceita}>Faturamento/mês</RotuloDica>
                  </th>
                  <th className={th}>
                    <RotuloDica texto={AJUDA.carga}>Carga hoje</RotuloDica>
                  </th>
                  <th className={th}>
                    <RotuloDica texto={`${AJUDA.carga} Em 2033 só existem CBS e IBS.`}>Carga 2033</RotuloDica>
                  </th>
                  <th className={th}>
                    <RotuloDica texto={AJUDA.precoVar}>Preço p/ margem</RotuloDica>
                  </th>
                  <th className={th}>
                    <RotuloDica texto={AJUDA.efeitoPrecoMantido}>Preço mantido 2033</RotuloDica>
                  </th>
                  <th className={`${th} text-left`}>Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((sim) => {
                  const resumo = sim.resumo || {};
                  return (
                    <tr key={sim.id} onClick={() => navigate(`/reforma/simulacao/${sim.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-muted">
                      <td className="px-2 py-2">
                        <p className="max-w-[300px] truncate text-[13px] font-medium text-ink-900">{nomeEmpresa.get(sim.empresa_id) || "(empresa removida)"}</p>
                        <p className="max-w-[300px] truncate text-[12px] text-ink-500">{sim.nome}</p>
                      </td>
                      <td className="px-2 py-2 text-[12.5px] text-ink-700">
                        {REGIME[resumo.regime] || "—"}
                        {resumo.hibrido && <span className="block text-[11px] text-ink-400">compara c/ IBS/CBS por fora</span>}
                      </td>
                      <td className={td}>{resumo.receitaMensal ? reais(resumo.receitaMensal) : "—"}</td>
                      <td className={td}>{resumo.receitaMensal ? porcento(resumo.cargaHoje) : "—"}</td>
                      <td className={td}>{resumo.receitaMensal ? porcento(resumo.carga2033) : "—"}</td>
                      <td className={td}>{resumo.receitaMensal ? porcento(resumo.precoVar2033, { sinal: true }) : "—"}</td>
                      <td className={td}>
                        {resumo.receitaMensal ? `${resumo.efeitoPrecoMantido2033 >= 0 ? "+" : "−"}${reais(Math.abs(resumo.efeitoPrecoMantido2033 || 0))}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-[12px] text-ink-500">
                        {new Date(sim.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        <span className="block max-w-[200px] truncate text-[11px] text-ink-400">
                          {sim.updated_by || sim.created_by || ""}
                          {clientesLiberados.has(sim.created_by) ? " · cliente" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </ReformaShell>
  );
}
