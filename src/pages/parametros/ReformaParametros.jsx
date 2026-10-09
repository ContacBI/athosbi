import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RotateCcw, Scale } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { carregarParametros, salvarParametros } from "../../lib/reforma/api.js";
import { PARAMETROS_PADRAO, aliquotasDoAno } from "../../lib/reforma/parametros.js";
import PageHeader from "../../components/PageHeader.jsx";
import { Cartao, NumeroInput, botaoPrimario, botaoSecundario } from "../../components/reforma/ui.jsx";
import { porcento } from "../../lib/reforma/formato.js";

const CAMPOS = [
  { campo: "cbs", rotulo: "CBS — alíquota de referência", ajuda: "Federal. Estimativa até o Senado fixar." },
  { campo: "ibs", rotulo: "IBS — alíquota de referência", ajuda: "Estadual + municipal. Estimativa até o Senado fixar." },
  { campo: "pisCofinsCumulativo", rotulo: "PIS/Cofins cumulativo (Presumido)", ajuda: "0,65% + 3%." },
  { campo: "pisCofinsNaoCumulativo", rotulo: "PIS/Cofins não cumulativo (Real)", ajuda: "1,65% + 7,6%." },
  { campo: "pisCofinsFornecedorMercadoria", rotulo: "PIS/Cofins embutido — fornecedor de mercadoria", ajuda: "Usado pra estimar o valor das compras sem tributo." },
  { campo: "pisCofinsFornecedorServico", rotulo: "PIS/Cofins embutido — fornecedor de serviço", ajuda: "Idem, pra serviços tomados." },
  { campo: "creditoFornecedorSimples", rotulo: "Crédito de compra de fornecedor do Simples", ajuda: "IBS/CBS que ele paga dentro do DAS, em % do valor." },
];

const COLUNAS_ANO = [
  { campo: "cbsFixo", rotulo: "CBS fixa %", numero: true, vazio: true },
  { campo: "cbsFracao", rotulo: "CBS × ref.", numero: true, casas: 2 },
  { campo: "cbsAbatimento", rotulo: "CBS − p.p.", numero: true },
  { campo: "ibsFixo", rotulo: "IBS fixa %", numero: true, vazio: true },
  { campo: "ibsFracao", rotulo: "IBS × ref.", numero: true, casas: 2 },
  { campo: "icmsIss", rotulo: "ICMS/ISS %", numero: true, casas: 0 },
  { campo: "pisCofins", rotulo: "PIS/Cofins" },
  { campo: "ipi", rotulo: "IPI" },
  { campo: "seletivo", rotulo: "Seletivo" },
  { campo: "compensado", rotulo: "Ano-teste" },
];

// Parâmetros da simulação da Reforma Tributária — só o escritório da
// Reforma (reforma_escritorio) vê e altera; valem pra todas as simulações
// de todos os clientes assim que salvos.
export default function ReformaParametros() {
  const state = useAppState();
  const [params, setParams] = useState(null);
  const [meta, setMeta] = useState({});
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!state.isReformaEscritorio) return;
    carregarParametros()
      .then((resultado) => {
        setParams(resultado.params);
        setMeta({ em: resultado.atualizadoEm, por: resultado.atualizadoPor });
      })
      .catch((error) => {
        console.error("Falha ao carregar os parâmetros:", error);
        setErro("Não consegui carregar os parâmetros.");
        setParams(structuredClone(PARAMETROS_PADRAO));
      });
  }, [state.isReformaEscritorio]);

  if (!state.isReformaEscritorio) return <Navigate to="/parametros/empresas" replace />;

  const mudar = (campo, valor) => setParams((atual) => ({ ...atual, [campo]: valor }));
  const mudarAno = (ano, campo, valor) => setParams((atual) => ({ ...atual, transicao: atual.transicao.map((linha) => (linha.ano === ano ? { ...linha, [campo]: valor } : linha)) }));

  async function salvar() {
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      await salvarParametros(params, state.userEmail);
      setMeta({ em: new Date().toISOString(), por: state.userEmail });
      setAviso("Salvo. As simulações de todos os clientes já passam a usar esses parâmetros.");
    } catch (error) {
      console.error("Falha ao salvar os parâmetros:", error);
      setErro("Não consegui salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function restaurar() {
    if (!confirm("Voltar todos os parâmetros pros valores padrão? (Só grava quando clicar em Salvar.)")) return;
    setParams(structuredClone(PARAMETROS_PADRAO));
  }

  return (
    <div>
      <PageHeader eyebrow="Reforma Tributária" title="Parâmetros da simulação" icon={Scale} />
      {!params ? (
        <p className="text-[13px] text-ink-400">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Cartao
            titulo="Alíquotas"
            subtitulo={meta.em ? `Última alteração em ${new Date(meta.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${meta.por ? ` por ${meta.por}` : ""}.` : "Usando os valores padrão do sistema."}
            acoes={
              <>
                <button type="button" onClick={restaurar} className={botaoSecundario}>
                  <RotateCcw size={14} />
                  Valores padrão
                </button>
                <button type="button" onClick={salvar} disabled={salvando} className={botaoPrimario}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </>
            }
          >
            {erro && <p className="mb-2 text-[12.5px] text-danger-600">{erro}</p>}
            {aviso && <p className="mb-2 text-[12.5px] text-success-600">{aviso}</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {CAMPOS.map((item) => (
                <label key={item.campo} className="flex flex-col gap-1 text-[12.5px] text-ink-700">
                  {item.rotulo}
                  <NumeroInput valor={params[item.campo]} onChange={(valor) => mudar(item.campo, valor)} sufixo="%" max={100} className="max-w-[160px]" ariaLabel={item.rotulo} />
                  <span className="text-[11.5px] text-ink-400">{item.ajuda}</span>
                </label>
              ))}
            </div>
          </Cartao>

          <Cartao titulo="Calendário de transição" subtitulo="CBS/IBS de cada ano = alíquota fixa (se preenchida) ou a referência × fração, menos o abatimento em pontos percentuais. ICMS/ISS = quanto do de hoje continua.">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">Ano</th>
                    {COLUNAS_ANO.map((coluna) => (
                      <th key={coluna.campo} className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
                        {coluna.rotulo}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-400">CBS + IBS no ano</th>
                  </tr>
                </thead>
                <tbody>
                  {params.transicao.map((linha) => {
                    const efetivas = aliquotasDoAno(params, linha.ano);
                    return (
                      <tr key={linha.ano} className="border-b border-line last:border-0">
                        <td className="px-2 py-1.5 font-mono text-[13px] font-semibold text-ink-900">{linha.ano}</td>
                        {COLUNAS_ANO.map((coluna) => (
                          <td key={coluna.campo} className="px-1.5 py-1.5">
                            {coluna.numero ? (
                              coluna.vazio && (linha[coluna.campo] === null || linha[coluna.campo] === undefined || linha[coluna.campo] === "") ? (
                                <button type="button" onClick={() => mudarAno(linha.ano, coluna.campo, 0)} className="w-[80px] rounded-md border border-dashed border-line-strong px-2 py-1.5 text-[11.5px] text-ink-400 hover:border-accent-300">
                                  usar ref.
                                </button>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <NumeroInput valor={linha[coluna.campo]} onChange={(valor) => mudarAno(linha.ano, coluna.campo, valor)} casas={coluna.casas ?? 2} max={coluna.campo.endsWith("Fracao") ? 1 : 100} className="w-[80px]" ariaLabel={`${coluna.rotulo} ${linha.ano}`} />
                                  {coluna.vazio && (
                                    <button type="button" onClick={() => mudarAno(linha.ano, coluna.campo, null)} title="Voltar a usar a referência × fração" className="text-[11px] text-ink-400 hover:text-danger-600">
                                      ×
                                    </button>
                                  )}
                                </span>
                              )
                            ) : (
                              <input type="checkbox" checked={Boolean(linha[coluna.campo])} onChange={(event) => mudarAno(linha.ano, coluna.campo, event.target.checked)} aria-label={`${coluna.rotulo} ${linha.ano}`} />
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right font-mono text-[12.5px] tabular-nums text-ink-800">
                          {porcento(efetivas.cbs, { casas: 2 })} + {porcento(efetivas.ibs, { casas: 2 })}
                          {efetivas.compensado && <span className="block text-[11px] text-ink-400">compensado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Cartao>
        </div>
      )}
    </div>
  );
}
