import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy, FileBarChart, Lock, Mail, MessageSquareText, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { setData, useAppState } from "../../data/useStore.js";
import { inviteUser } from "../../lib/access.js";
import {
  carregarEmpresa,
  carregarParametros,
  carregarSimulacao,
  criarSimulacao,
  excluirEmpresa,
  excluirSimulacao,
  liberarAcesso,
  listarAcessos,
  listarSimulacoes,
  retirarAcesso,
  salvarEmpresa,
} from "../../lib/reforma/api.js";
import { calcularSimulacao, dadosDaConfig } from "../../lib/reforma/calculo.js";
import { PARAMETROS_PADRAO, simplesAliquota } from "../../lib/reforma/parametros.js";
import ReformaShell from "../../components/reforma/ReformaShell.jsx";
import EmpresaForm from "../../components/reforma/EmpresaForm.jsx";
import DominioFiscal from "../../components/reforma/DominioFiscal.jsx";
import { ComprasTabela, VendasTabela } from "../../components/reforma/ItensTabela.jsx";
import { Cartao, botaoPrimario } from "../../components/reforma/ui.jsx";
import { REGIME_NOME, cnpjFormatado, porcento, reais, soDigitos } from "../../lib/reforma/formato.js";

const campo = "rounded-md border border-line-strong bg-surface-card px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-accent-500";

function resumoDaConfig(config) {
  const dados = dadosDaConfig(config);
  const partes = [REGIME_NOME[dados.regime] || "Regime não definido"];
  if (dados.regime === "simples") {
    const simples = simplesAliquota(dados.anexoPadrao, dados.rbt12);
    partes.push(`Anexo ${dados.anexoPadrao}`, `alíquota efetiva ${porcento(simples.efetiva, { casas: 2 })}`);
  }
  return partes.join(" · ");
}

// ── Simulações (escritório e cliente) ──

function SimulacoesAba({ empresa, escritorio, eu }) {
  const navigate = useNavigate();
  const [simulacoes, setSimulacoes] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    listarSimulacoes({ empresaId: empresa.id })
      .then((lista) => ativo && setSimulacoes(lista))
      .catch((error) => {
        console.error("Falha ao listar simulações:", error);
        if (ativo) {
          setErro("Não consegui carregar as simulações agora. Tente de novo em instantes.");
          setSimulacoes([]);
        }
      });
    return () => {
      ativo = false;
    };
  }, [empresa.id]);

  async function novaSimulacao() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const criada = await criarSimulacao({ empresaId: empresa.id, nome: `Simulação ${(simulacoes?.length || 0) + 1}`, dados: dadosDaConfig(empresa.config) });
      navigate(`/reforma/simulacao/${criada.id}`);
    } catch (error) {
      console.error("Falha ao criar simulação:", error);
      setErro("Não consegui criar a simulação. Tente de novo.");
      setOcupado(false);
    }
  }

  async function duplicar(simulacao) {
    setOcupado(true);
    setErro("");
    try {
      const completa = await carregarSimulacao(simulacao.id);
      const copia = await criarSimulacao({ empresaId: empresa.id, nome: `${simulacao.nome} (cópia)`.slice(0, 120), dados: completa.dados, resumo: completa.resumo });
      setSimulacoes((lista) => [copia, ...(lista || [])]);
    } catch (error) {
      console.error("Falha ao duplicar:", error);
      setErro("Não consegui duplicar a simulação.");
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(simulacao) {
    if (!confirm(`Excluir a simulação "${simulacao.nome}"? Não dá pra desfazer.`)) return;
    try {
      await excluirSimulacao(simulacao.id);
      setSimulacoes((lista) => (lista || []).filter((item) => item.id !== simulacao.id));
    } catch (error) {
      console.error("Falha ao excluir:", error);
      setErro("Não consegui excluir a simulação.");
    }
  }

  return (
    <>
      {!escritorio && empresa.orientacao && (
        <Cartao>
          <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-accent-600">
            <MessageSquareText size={14} />
            Recado da contabilidade
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[13.5px] text-ink-800">{empresa.orientacao}</p>
        </Cartao>
      )}

      <Cartao
        titulo="Simulações"
        subtitulo={
          escritorio
            ? "Cada simulação começa da configuração da empresa. O que o cliente simular aparece aqui e no painel do escritório."
            : `Cada simulação começa dos parâmetros que a contabilidade configurou (${resumoDaConfig(empresa.config)}). Ajuste os produtos e as compras e veja o resultado.`
        }
        acoes={
          <button type="button" onClick={novaSimulacao} disabled={ocupado} className={botaoPrimario}>
            <Plus size={14} />
            Nova simulação
          </button>
        }
      >
        {erro && <p className="mb-2 text-[12.5px] text-danger-600">{erro}</p>}
        {simulacoes === null ? (
          <p className="text-[13px] text-ink-400">Carregando…</p>
        ) : simulacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
            <FileBarChart size={26} strokeWidth={1.5} className="text-accent-500" />
            <p className="text-[13.5px] font-medium text-ink-900">Nenhuma simulação ainda</p>
            <p className="max-w-md text-[12.5px] text-ink-400">A primeira já sai com o regime, os produtos e as compras configurados — é só conferir os valores e ver o resultado.</p>
            <button type="button" onClick={novaSimulacao} disabled={ocupado} className={`${botaoPrimario} mt-2`}>
              <Plus size={14} />
              Criar a primeira simulação
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {simulacoes.map((simulacao) => {
              const resumo = simulacao.resumo || {};
              const podeMexer = escritorio || simulacao.created_by === eu;
              return (
                <div key={simulacao.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-accent-200 hover:bg-surface-muted">
                  <button type="button" onClick={() => navigate(`/reforma/simulacao/${simulacao.id}`)} className="min-w-[200px] flex-1 text-left">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
                      {simulacao.nome}
                      {!podeMexer && (
                        <span className="flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 text-[10.5px] font-medium text-ink-500">
                          <Lock size={10} />
                          só leitura
                        </span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-ink-400">
                      Atualizada em {new Date(simulacao.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {simulacao.updated_by ? ` por ${simulacao.updated_by}` : ""}
                    </p>
                  </button>
                  {resumo.receitaMensal > 0 && (
                    <div className="flex flex-wrap gap-4 text-[12px]">
                      <span className="text-ink-500">
                        Faturamento <strong className="font-mono text-ink-800">{reais(resumo.receitaMensal)}</strong>/mês
                      </span>
                      <span className="text-ink-500">
                        Carga hoje <strong className="font-mono text-ink-800">{porcento(resumo.cargaHoje)}</strong> → 2033 <strong className="font-mono text-ink-800">{porcento(resumo.carga2033)}</strong>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => duplicar(simulacao)} disabled={ocupado} title="Duplicar (pra testar outro cenário)" aria-label={`Duplicar ${simulacao.nome}`} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-card hover:text-ink-700">
                      <Copy size={14} />
                    </button>
                    {podeMexer && (
                      <button type="button" onClick={() => excluir(simulacao)} title="Excluir" aria-label={`Excluir ${simulacao.nome}`} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </>
  );
}

// ── Configuração (só escritório) ──

const rascunhoDe = (empresa) => ({
  nome: empresa.nome,
  cnpj: cnpjFormatado(empresa.cnpj),
  biCompanyId: empresa.bi_company_id || "",
  orientacao: empresa.orientacao || "",
  config: dadosDaConfig(empresa.config),
});

function ConfiguracaoAba({ empresa, onSalva, onSujo }) {
  const state = useAppState();
  const navigate = useNavigate();
  const [original, setOriginal] = useState(() => rascunhoDe(empresa));
  const [rascunho, setRascunho] = useState(original);
  const [params, setParams] = useState(PARAMETROS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(original);

  useEffect(() => {
    carregarParametros()
      .then((resultado) => setParams(resultado.params))
      .catch(() => setParams(PARAMETROS_PADRAO));
  }, []);

  useEffect(() => {
    onSujo(sujo);
    if (!sujo) return undefined;
    const aoSair = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo, onSujo]);

  const carteira = useMemo(() => [...state.companies].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")), [state.companies]);
  const companyBi = state.companies.find((company) => company.id === rascunho.biCompanyId) || null;
  const previa = useMemo(() => (rascunho.config.vendas.length ? calcularSimulacao(rascunho.config, params) : null), [rascunho.config, params]);

  const mudar = (patch) => {
    setAviso("");
    setRascunho((atual) => ({ ...atual, ...patch }));
  };
  const mudarConfig = (patch) => mudar({ config: { ...rascunho.config, ...patch } });

  async function salvar() {
    if (!rascunho.nome.trim()) {
      setErro("Informe o nome da empresa.");
      return;
    }
    const digitos = soDigitos(rascunho.cnpj);
    if (digitos && digitos.length !== 14) {
      setErro("O CNPJ precisa ter 14 dígitos (ou deixe em branco).");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const salva = await salvarEmpresa(empresa.id, { nome: rascunho.nome, cnpj: digitos, biCompanyId: rascunho.biCompanyId, orientacao: rascunho.orientacao, config: rascunho.config });
      const proximo = rascunhoDe(salva);
      setOriginal(proximo);
      setRascunho(proximo);
      onSalva(salva);
      setAviso("Configuração salva. As próximas simulações da empresa já começam dela — as que já existem ficam como estão.");
    } catch (error) {
      console.error("Falha ao salvar a configuração:", error);
      setErro("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir "${empresa.nome}" da Reforma Tributária? Vão junto todas as simulações dela e o acesso de quem foi liberado. Não dá pra desfazer.`)) return;
    try {
      await excluirEmpresa(empresa.id);
      setData({ reformaEmpresas: state.reformaEmpresas.filter((item) => item.id !== empresa.id) });
      onSujo(false);
      navigate("/reforma", { replace: true });
    } catch (error) {
      console.error("Falha ao excluir a empresa:", error);
      setErro("Não consegui excluir a empresa agora.");
    }
  }

  const hoje = previa?.cenarios.atual.anos[0];
  const fim = previa?.cenarios.atual.anos[previa.cenarios.atual.anos.length - 1];

  return (
    <>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-card/95 px-4 py-2.5 shadow-sm backdrop-blur">
        <p className="text-[12.5px] text-ink-600">
          {sujo ? (
            <span className="font-medium text-warning-600">Alterações não salvas</span>
          ) : aviso ? (
            <span className="text-success-600">{aviso}</span>
          ) : (
            "O cliente entra com o que estiver salvo aqui: regime e Simples ficam travados pra ele; produtos e compras ele ajusta na simulação."
          )}
        </p>
        <button type="button" onClick={salvar} disabled={!sujo || salvando} className={botaoPrimario}>
          <Save size={14} />
          {salvando ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>
      {erro && <p className="text-[12.5px] text-danger-600">{erro}</p>}

      <Cartao titulo="Cadastro">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-[12px] text-ink-600">
            Nome da empresa
            <input aria-label="Nome da empresa" value={rascunho.nome} onChange={(event) => mudar({ nome: event.target.value.slice(0, 160) })} className={campo} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-600">
            CNPJ
            <input aria-label="CNPJ" value={rascunho.cnpj} onChange={(event) => mudar({ cnpj: event.target.value.slice(0, 18) })} onBlur={() => mudar({ cnpj: cnpjFormatado(rascunho.cnpj) })} className={campo} placeholder="00.000.000/0000-00" inputMode="numeric" />
          </label>
          {carteira.length > 0 && (
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Empresa no B.I. (pra trazer da contabilidade)
              <select aria-label="Empresa no B.I." value={rascunho.biCompanyId} onChange={(event) => mudar({ biCompanyId: event.target.value })} className={campo}>
                <option value="">— Nenhuma —</option>
                {carteira.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.codigo ? `${company.codigo} · ` : ""}
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Cartao>

      <Cartao titulo="Recado para o cliente" subtitulo="Aparece no topo da tela dele — ex.: o que conferir, o que já foi considerado, próximos passos.">
        <textarea
          aria-label="Recado para o cliente"
          value={rascunho.orientacao}
          onChange={(event) => mudar({ orientacao: event.target.value.slice(0, 4000) })}
          rows={3}
          placeholder="Ex.: Já cadastramos seus principais produtos com base na contabilidade de 2025. Confira o faturamento de cada um e veja o resultado."
          className={`${campo} w-full resize-y`}
        />
      </Cartao>

      <EmpresaForm dados={rascunho.config} alterar={mudarConfig} company={companyBi} />
      <DominioFiscal cnpj={soDigitos(rascunho.cnpj)} dados={rascunho.config} alterar={mudarConfig} />
      <VendasTabela dados={rascunho.config} onVendas={(vendas) => mudarConfig({ vendas })} />
      <ComprasTabela dados={rascunho.config} onCompras={(compras) => mudarConfig({ compras })} />

      {previa && (
        <Cartao titulo="Prévia com essa configuração">
          <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-600">
            <span>
              Tributos/mês <strong className="font-mono text-ink-900">{reais(hoje.aRecolher)}</strong> hoje → <strong className="font-mono text-ink-900">{reais(fim.aRecolher)}</strong> em 2033
            </span>
            <span>
              Carga <strong className="font-mono text-ink-900">{porcento(hoje.carga)}</strong> → <strong className="font-mono text-ink-900">{porcento(fim.carga)}</strong>
            </span>
            <span>
              Preço p/ manter a margem <strong className="font-mono text-ink-900">{porcento(fim.precoVar, { sinal: true })}</strong>
            </span>
          </p>
        </Cartao>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={excluir} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] text-danger-600 hover:bg-danger-50">
          <Trash2 size={14} />
          Excluir empresa da Reforma
        </button>
      </div>
    </>
  );
}

// ── Acessos do cliente (só escritório) ──

function AcessosAba({ empresa }) {
  const [acessos, setAcessos] = useState(null);
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const recarregar = () =>
    listarAcessos({ empresaId: empresa.id })
      .then(setAcessos)
      .catch((error) => {
        console.error("Falha ao listar acessos:", error);
        setErro("Não consegui carregar os acessos agora.");
        setAcessos([]);
      });

  useEffect(() => {
    recarregar();
  }, [empresa.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function liberar(event) {
    event.preventDefault();
    const limpo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
      setErro("Confira o e-mail.");
      return;
    }
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      await liberarAcesso(empresa.id, limpo);
      try {
        const resultado = await inviteUser(limpo);
        setAviso(resultado?.alreadyExists ? `${limpo} já tinha conta — acesso liberado. É só entrar no portal.` : `Acesso liberado e convite enviado pra ${limpo}.`);
      } catch (inviteError) {
        console.error("Falha ao convidar:", inviteError);
        setAviso(`Acesso liberado, mas o e-mail de convite não saiu agora — use "Reenviar convite" daqui a pouco.`);
      }
      setEmail("");
      await recarregar();
    } catch (error) {
      console.error("Falha ao liberar acesso:", error);
      setErro("Não consegui liberar o acesso agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function reenviar(acesso) {
    setErro("");
    setAviso("");
    try {
      const resultado = await inviteUser(acesso.email);
      setAviso(resultado?.alreadyExists ? `${acesso.email} já tem conta — é só entrar no portal.` : `Convite reenviado pra ${acesso.email}.`);
    } catch (error) {
      console.error("Falha ao reenviar:", error);
      setErro("Não consegui reenviar o convite agora.");
    }
  }

  async function retirar(acesso) {
    if (!confirm(`Tirar o acesso de ${acesso.email} a ${empresa.nome}? As simulações que essa pessoa fez continuam aqui.`)) return;
    try {
      await retirarAcesso(acesso.id);
      setAcessos((lista) => (lista || []).filter((item) => item.id !== acesso.id));
    } catch (error) {
      console.error("Falha ao retirar acesso:", error);
      setErro("Não consegui tirar o acesso agora.");
    }
  }

  return (
    <Cartao
      titulo="Quem do cliente entra nesta empresa"
      subtitulo="A pessoa recebe um e-mail pra criar a senha e, ao entrar, cai direto nesta empresa com os parâmetros configurados. Ela vê só a Reforma Tributária desta empresa — nada do B.I."
    >
      <form onSubmit={liberar} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[12px] text-ink-600">
          E-mail do dono (ou de quem ele indicar)
          <input type="email" aria-label="E-mail do cliente" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="dono@empresa.com.br" className={campo} />
        </label>
        <button type="submit" disabled={salvando || !email.trim()} className={botaoPrimario}>
          <UserPlus size={14} />
          {salvando ? "Liberando…" : "Liberar e convidar"}
        </button>
      </form>
      {erro && <p className="mt-2 text-[12px] text-danger-600">{erro}</p>}
      {aviso && <p className="mt-2 text-[12px] text-accent-600">{aviso}</p>}

      <div className="mt-3 flex flex-col gap-1.5">
        {acessos === null ? (
          <p className="text-[12.5px] text-ink-400">Carregando…</p>
        ) : acessos.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">Ninguém liberado ainda.</p>
        ) : (
          acessos.map((acesso) => (
            <div key={acesso.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-ink-800">{acesso.email}</p>
                <p className="text-[11px] text-ink-400">
                  Liberado em {new Date(acesso.created_at).toLocaleDateString("pt-BR")}
                  {acesso.created_by ? ` por ${acesso.created_by}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => reenviar(acesso)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-accent-600 hover:underline">
                  <Mail size={12} />
                  Reenviar convite
                </button>
                <button type="button" onClick={() => retirar(acesso)} aria-label={`Tirar acesso de ${acesso.email}`} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Cartao>
  );
}

// ── Página da empresa ──

const ABAS = [
  { id: "simulacoes", rotulo: "Simulações" },
  { id: "configuracao", rotulo: "Configuração" },
  { id: "acessos", rotulo: "Acesso do cliente" },
];

export default function ReformaEmpresa() {
  const { id } = useParams();
  const state = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const escritorio = state.isReformaEscritorio;
  const aba = escritorio && ABAS.some((item) => item.id === searchParams.get("aba")) ? searchParams.get("aba") : "simulacoes";
  const [empresa, setEmpresa] = useState(null);
  const [erro, setErro] = useState("");
  const sujoRef = useRef(false);
  const marcarSujo = useCallback((valor) => {
    sujoRef.current = valor;
  }, []);

  useEffect(() => {
    let ativo = true;
    setEmpresa(null);
    setErro("");
    carregarEmpresa(id)
      .then((registro) => {
        if (!ativo) return;
        if (registro) setEmpresa(registro);
        else setErro("Empresa não encontrada — ela pode ter sido excluída, ou o seu acesso foi retirado.");
      })
      .catch((error) => {
        console.error("Falha ao abrir a empresa:", error);
        if (ativo) setErro("Não consegui abrir a empresa agora. Recarregue a página.");
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  if (!escritorio && state.reformaEmpresas.length === 0) return <Navigate to="/" replace />;

  function trocarAba(proxima) {
    if (proxima === aba) return;
    if (sujoRef.current && !confirm("Sair da configuração sem salvar as alterações?")) return;
    sujoRef.current = false;
    setSearchParams(proxima === "simulacoes" ? {} : { aba: proxima }, { replace: true });
  }

  function salva(atualizada) {
    setEmpresa(atualizada);
    setData({
      reformaEmpresas: state.reformaEmpresas
        .map((item) => (item.id === atualizada.id ? { id: atualizada.id, nome: atualizada.nome, cnpj: atualizada.cnpj, bi_company_id: atualizada.bi_company_id, updated_at: atualizada.updated_at } : item))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  }

  // Cliente com uma empresa só: "voltar" é o início do portal (a lista de
  // empresas da Reforma o mandaria de volta pra cá).
  const voltar = escritorio || state.reformaEmpresas.length > 1 ? { para: "/reforma", rotulo: escritorio ? "Empresas da Reforma" : "Suas empresas" } : { para: "/", rotulo: "Início" };

  if (erro || !empresa) {
    return (
      <ReformaShell titulo={erro ? "Não deu pra abrir" : "Carregando…"} voltarPara={voltar.para} voltarRotulo={voltar.rotulo}>
        {erro ? (
          <Cartao>
            <p className="text-[13px] text-ink-600">{erro}</p>
          </Cartao>
        ) : (
          <p className="text-[13px] text-ink-400">Carregando…</p>
        )}
      </ReformaShell>
    );
  }

  return (
    <ReformaShell
      titulo={empresa.nome}
      subtitulo={[empresa.cnpj ? cnpjFormatado(empresa.cnpj) : null, resumoDaConfig(empresa.config)].filter(Boolean).join(" · ")}
      voltarPara={voltar.para}
      voltarRotulo={voltar.rotulo}
      extra={
        escritorio && (
          <nav className="-mb-5 flex gap-1 overflow-x-auto" aria-label="Seções da empresa">
            {ABAS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => trocarAba(item.id)}
                className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${aba === item.id ? "bg-surface-page text-ink-900" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
              >
                {item.rotulo}
              </button>
            ))}
          </nav>
        )
      }
    >
      {aba === "simulacoes" && <SimulacoesAba empresa={empresa} escritorio={escritorio} eu={state.userEmail} />}
      {aba === "configuracao" && <ConfiguracaoAba key={empresa.id} empresa={empresa} onSalva={salva} onSujo={marcarSujo} />}
      {aba === "acessos" && <AcessosAba empresa={empresa} />}
    </ReformaShell>
  );
}
