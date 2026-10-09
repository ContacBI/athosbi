import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CloudOff, Copy, Loader2, Lock } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { carregarEmpresa, carregarParametros, carregarSimulacao, criarSimulacao, salvarSimulacao } from "../../lib/reforma/api.js";
import { calcularSimulacao, dadosIniciais } from "../../lib/reforma/calculo.js";
import { sincronizarCategorias } from "../../lib/reforma/fiscal.js";
import { PARAMETROS_PADRAO } from "../../lib/reforma/parametros.js";
import ReformaShell from "../../components/reforma/ReformaShell.jsx";
import EmpresaForm from "../../components/reforma/EmpresaForm.jsx";
import DominioFiscal from "../../components/reforma/DominioFiscal.jsx";
import { ComprasTabela, VendasTabela } from "../../components/reforma/ItensTabela.jsx";
import ResultadoPainel from "../../components/reforma/ResultadoPainel.jsx";
import { Abas, Cartao, Dica, Esqueleto, botaoPrimario, botaoSecundario } from "../../components/reforma/ui.jsx";
import { AJUDA } from "../../lib/reforma/textos.js";
import { porcento, reais } from "../../lib/reforma/formato.js";

const ABAS = [
  { id: "empresa", rotulo: "1. Empresa", dica: "Regime tributário de hoje (Simples, Presumido ou Real) e, no Simples, faturamento e anexo." },
  { id: "vendas", rotulo: "2. Vendas", dica: "O que a empresa vende, item a item (NCM/NBS), com os tributos de hoje e a categoria na reforma." },
  { id: "compras", rotulo: "3. Compras e despesas", dica: "O que a empresa compra — é daqui que vêm os créditos, hoje e na reforma." },
  { id: "resultado", rotulo: "4. Resultado", dica: "Tributos ano a ano de hoje a 2033, preço pra manter a margem e o efeito produto a produto." },
];
const ESPERA_SALVAR_MS = 1200;

// Resumo que vai pro painel do escritório junto com cada salvamento.
const resumoParaSalvar = (resultado, dados) => ({ ...resultado.resumo, regime: dados.regime, itensVenda: dados.vendas.length, itensCompra: dados.compras.length });

export default function ReformaSimulacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const [simulacao, setSimulacao] = useState(null); // { id, empresa_id, nome, created_by, ... }
  const [empresa, setEmpresa] = useState(null); // empresa da Reforma (reforma_empresas)
  const [dados, setDados] = useState(null);
  const [nome, setNome] = useState("");
  const [params, setParams] = useState(PARAMETROS_PADRAO);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("empresa");
  const topoRef = useRef(null);
  const [situacao, setSituacao] = useState("salvo"); // salvo | pendente | salvando | erro
  const [salvoEm, setSalvoEm] = useState(null);
  const pendenteRef = useRef(null); // { nome, dados } ainda não gravado
  const timerRef = useRef(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([carregarSimulacao(id), carregarParametros().catch(() => ({ params: PARAMETROS_PADRAO }))])
      .then(async ([registro, parametros]) => {
        if (!ativo) return;
        if (!registro) {
          setErro("Simulação não encontrada — ela pode ter sido excluída, ou o seu acesso a essa empresa foi retirado.");
          return;
        }
        const daEmpresa = await carregarEmpresa(registro.empresa_id);
        if (!ativo) return;
        setEmpresa(daEmpresa);
        setSimulacao(registro);
        setNome(registro.nome);
        setDados({ ...dadosIniciais(), ...(registro.dados || {}) });
        setParams(parametros.params);
        setSalvoEm(registro.updated_at);
        if ((registro.dados?.vendas || []).length) setAba("resultado");
      })
      .catch((error) => {
        console.error("Falha ao abrir a simulação:", error);
        if (ativo) setErro("Não consegui abrir a simulação agora. Recarregue a página.");
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  const resultado = useMemo(() => (dados ? calcularSimulacao(dados, params) : null), [dados, params]);

  const gravar = useCallback(async () => {
    const pendente = pendenteRef.current;
    if (!pendente) return;
    pendenteRef.current = null;
    setSituacao("salvando");
    try {
      const resumo = resumoParaSalvar(calcularSimulacao(pendente.dados, params), pendente.dados);
      const salvo = await salvarSimulacao(id, { nome: pendente.nome.trim() || "Simulação sem nome", dados: pendente.dados, resumo });
      setSalvoEm(salvo.updated_at);
      setSituacao(pendenteRef.current ? "pendente" : "salvo");
    } catch (error) {
      console.error("Falha ao salvar a simulação:", error);
      // Volta pra fila — o próximo ajuste (ou o botão) tenta de novo.
      pendenteRef.current = pendenteRef.current || pendente;
      setSituacao("erro");
    }
  }, [id, params]);

  const agendar = useCallback(
    (proximoNome, proximosDados) => {
      pendenteRef.current = { nome: proximoNome, dados: proximosDados };
      setSituacao("pendente");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(gravar, ESPERA_SALVAR_MS);
    },
    [gravar]
  );

  // Saindo da tela (ou fechando a aba) com alteração não gravada: grava já.
  useEffect(() => {
    const aoSair = (event) => {
      if (!pendenteRef.current) return;
      gravar();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("beforeunload", aoSair);
      clearTimeout(timerRef.current);
      if (pendenteRef.current) gravar();
    };
  }, [gravar]);

  // Cliente só altera a simulação que ele mesmo criou (a RLS recusaria o
  // resto) — um estudo do escritório abre só pra leitura, com atalho pra
  // duplicar. Regime e Simples são da configuração do escritório: o
  // cliente não muda nem nas dele.
  const escritorio = state.isReformaEscritorio;
  const somenteLeitura = Boolean(simulacao) && !escritorio && simulacao.created_by !== state.userEmail;
  const [duplicando, setDuplicando] = useState(false);

  async function duplicarPraMim() {
    if (duplicando) return;
    setDuplicando(true);
    try {
      const copia = await criarSimulacao({ empresaId: simulacao.empresa_id, nome: `${nome} (minha versão)`.slice(0, 120), dados, resumo: resumoParaSalvar(resultado, dados) });
      navigate(`/reforma/simulacao/${copia.id}`);
    } catch (error) {
      console.error("Falha ao duplicar:", error);
      setErro("Não consegui duplicar a simulação agora. Recarregue a página e tente de novo.");
    } finally {
      setDuplicando(false);
    }
  }

  function alterar(patch) {
    if (somenteLeitura) return;
    const proximo = { ...dados, ...patch };
    setDados(proximo);
    agendar(nome, proximo);
  }

  function renomear(proximoNome) {
    if (somenteLeitura) return;
    setNome(proximoNome);
    agendar(proximoNome, dados);
  }

  // Troca de etapa sem pulo: se a pessoa rolou pra baixo, volta suave pro
  // começo do conteúdo (logo abaixo da barra fixa).
  function trocarAba(proxima) {
    setAba(proxima);
    const topo = topoRef.current;
    if (!topo) return;
    const alvo = topo.getBoundingClientRect().top + window.scrollY - 64;
    if (window.scrollY > alvo) window.scrollTo({ top: alvo, behavior: "smooth" });
  }

  // Empresa do B.I. ligada (só o escritório usa, pra trazer da contabilidade).
  const companyBi = (escritorio && state.companies.find((item) => item.id === empresa?.bi_company_id)) || null;
  const voltarPara = simulacao ? `/reforma/empresa/${simulacao.empresa_id}` : "/reforma";

  if (erro) {
    return (
      <ReformaShell titulo="Reforma Tributária" voltarPara={voltarPara} voltarRotulo="Simulações">
        <Cartao titulo="Não deu pra abrir">
          <p className="text-[13px] text-ink-600">{erro}</p>
        </Cartao>
      </ReformaShell>
    );
  }
  if (!dados || !resultado) {
    return (
      <ReformaShell titulo="Abrindo a simulação…" voltarPara={voltarPara} voltarRotulo="Simulações">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Carregando">
          {[0, 1, 2, 3].map((item) => (
            <Esqueleto key={item} className="h-24" />
          ))}
        </div>
        <Esqueleto className="h-72" />
        <Esqueleto className="h-48" />
      </ReformaShell>
    );
  }

  const hoje = resultado.cenarios.atual.anos[0];
  const fim = resultado.cenarios.atual.anos[resultado.cenarios.atual.anos.length - 1];
  const statusSalvo = {
    salvo: { icone: Check, texto: salvoEm ? `Salvo ${new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Salvo", cor: "text-ink-400" },
    pendente: { icone: Loader2, texto: "Salvando…", cor: "text-ink-400" },
    salvando: { icone: Loader2, texto: "Salvando…", cor: "text-ink-400" },
    erro: { icone: CloudOff, texto: "Não salvou — clique pra tentar de novo", cor: "text-danger-600" },
  }[situacao];
  const IconeStatus = statusSalvo.icone;
  const indice = ABAS.findIndex((item) => item.id === aba);
  const numeros = dados.vendas.length
    ? [
        { rotulo: "Tributos/mês", valor: `${reais(hoje.aRecolher)} → ${reais(fim.aRecolher)}`, ajuda: `${AJUDA.aRecolher} Hoje → 2033, já com as compras.` },
        { rotulo: "Carga", valor: `${porcento(hoje.carga)} → ${porcento(fim.carga)}`, ajuda: AJUDA.carga },
        { rotulo: "Preço p/ margem", valor: porcento(fim.precoVar, { sinal: true }), ajuda: AJUDA.precoVar },
      ]
    : [];

  return (
    <ReformaShell
      titulo={empresa?.nome || "Simulação"}
      voltarPara={voltarPara}
      voltarRotulo="Simulações"
      extra={
        <input
          aria-label="Nome da simulação"
          value={nome}
          onChange={(event) => renomear(event.target.value.slice(0, 120))}
          readOnly={somenteLeitura}
          className="w-full max-w-[520px] rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[14px] text-white outline-none transition-colors placeholder:text-white/40 hover:border-white/30 focus:border-accent-400"
          placeholder="Nome da simulação"
        />
      }
      barra={
        <>
          <Abas
            rotulo="Etapas da simulação"
            ativa={aba}
            onTrocar={trocarAba}
            itens={ABAS.map((item) => ({ ...item, contador: item.id === "vendas" ? dados.vendas.length : item.id === "compras" ? dados.compras.length : 0, dica: item.dica }))}
          />
          <div className="flex items-center gap-2 py-2">
            {numeros.map((item) => (
              <Dica key={item.rotulo} titulo={item.rotulo} texto={item.ajuda} className="hidden xl:inline-flex">
                <span tabIndex={0} className="flex cursor-help items-center gap-2 rounded-md bg-surface-card px-2.5 py-1 text-[12px] text-ink-500 shadow-sm outline-none ring-1 ring-line transition-colors hover:ring-accent-200 focus-visible:ring-accent-400">
                  {item.rotulo}
                  <strong className="font-mono font-semibold tabular-nums text-ink-900">{item.valor}</strong>
                </span>
              </Dica>
            ))}
            <button type="button" onClick={() => situacao === "erro" && gravar()} className={`ml-1 flex items-center gap-1.5 whitespace-nowrap text-[12px] ${statusSalvo.cor}`} disabled={situacao !== "erro"}>
              <IconeStatus size={13} className={situacao === "salvando" || situacao === "pendente" ? "animate-spin" : ""} />
              {statusSalvo.texto}
            </button>
          </div>
        </>
      }
    >
      <div ref={topoRef} className="-mt-5 h-0" aria-hidden="true" />
      <div key={aba} className="flex animate-entrar flex-col gap-4">
        {somenteLeitura && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-card px-4 py-2.5 shadow-sm">
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
              <Lock size={14} className="text-ink-400" />
              Simulação feita por {simulacao.created_by} — só leitura. Pra mudar algo, faça a sua versão.
            </p>
            <button type="button" onClick={duplicarPraMim} disabled={duplicando} className={botaoPrimario}>
              <Copy size={14} />
              {duplicando ? "Duplicando…" : "Fazer a minha versão"}
            </button>
          </div>
        )}
        {/* fieldset desabilitado trava todos os campos e botões de dentro de uma vez. */}
        {aba !== "resultado" && (
          <fieldset disabled={somenteLeitura || (aba === "empresa" && !escritorio)} className="flex min-w-0 flex-col gap-4">
            {aba === "empresa" && !escritorio && !somenteLeitura && (
              <p className="flex items-center gap-1.5 rounded-lg bg-accent-50 px-3 py-2 text-[12.5px] text-accent-700">
                <Lock size={13} />
                Regime e Simples definidos pela contabilidade. Se algo estiver diferente da realidade da empresa, fale com o escritório.
              </p>
            )}
            {aba === "empresa" && <EmpresaForm dados={dados} alterar={alterar} company={companyBi} />}
            {escritorio && (aba === "vendas" || aba === "compras") && <DominioFiscal cnpj={empresa?.cnpj} dados={dados} alterar={alterar} />}
            {aba === "vendas" && <VendasTabela dados={dados} onVendas={(vendas) => alterar({ vendas, compras: sincronizarCategorias(dados.vendas, vendas, dados.compras) })} />}
            {aba === "compras" && <ComprasTabela dados={dados} onCompras={(compras) => alterar({ compras })} />}
          </fieldset>
        )}
        {aba === "resultado" && <ResultadoPainel resultado={resultado} params={params} />}

        <div className="flex items-center justify-between gap-3">
          {indice > 0 ? (
            <button type="button" onClick={() => trocarAba(ABAS[indice - 1].id)} className={botaoSecundario}>
              <ArrowLeft size={14} />
              {ABAS[indice - 1].rotulo.replace(/^\d+\. /, "")}
            </button>
          ) : (
            <span />
          )}
          {indice < ABAS.length - 1 && (
            <button type="button" onClick={() => trocarAba(ABAS[indice + 1].id)} className={`${botaoPrimario} h-9 px-4 text-[13px]`}>
              Próximo: {ABAS[indice + 1].rotulo.replace(/^\d+\. /, "")}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
      {state.isReformaEscritorio && simulacao.created_by && (
        <p className="text-right text-[11.5px] text-ink-400">
          Criada por {simulacao.created_by} em {new Date(simulacao.created_at).toLocaleDateString("pt-BR")}
          {" · "}
          <button type="button" onClick={() => navigate("/reforma/painel")} className="text-accent-600 hover:underline">
            painel do escritório
          </button>
        </p>
      )}
    </ReformaShell>
  );
}
