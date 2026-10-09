import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, ChevronRight, LayoutList, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { setData, useAppState } from "../../data/useStore.js";
import { temReforma } from "../../lib/modulos.js";
import { criarEmpresa, listarAcessos, listarEmpresas, listarSimulacoes } from "../../lib/reforma/api.js";
import { dadosIniciais } from "../../lib/reforma/calculo.js";
import ReformaShell from "../../components/reforma/ReformaShell.jsx";
import { Cartao, Indicador, botaoPrimario, botaoSecundario } from "../../components/reforma/ui.jsx";
import { cnpjFormatado, soDigitos } from "../../lib/reforma/formato.js";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const campo = "rounded-md border border-line-strong bg-surface-card px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-accent-500";

// Cadastro de uma empresa na Reforma. Dá pra partir de uma empresa do B.I.
// (traz nome/CNPJ e deixa o "Trazer da contabilidade" ligado), mas a
// empresa da Reforma é um cadastro à parte — o cliente dela não ganha
// acesso nenhum ao B.I. por isso.
function NovaEmpresaModal({ onFechar, onCriada }) {
  const state = useAppState();
  const [biId, setBiId] = useState("");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const carteira = useMemo(() => [...state.companies].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")), [state.companies]);

  function escolherDoBi(id) {
    setBiId(id);
    const company = state.companies.find((item) => item.id === id);
    if (company) {
      setNome(company.name || "");
      setCnpj(cnpjFormatado(company.cnpj));
    }
  }

  async function salvar(event) {
    event.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome da empresa.");
      return;
    }
    const digitos = soDigitos(cnpj);
    if (digitos && digitos.length !== 14) {
      setErro("O CNPJ precisa ter 14 dígitos (ou deixe em branco).");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      onCriada(await criarEmpresa({ nome, cnpj: digitos, biCompanyId: biId, config: dadosIniciais() }));
    } catch (error) {
      console.error("Falha ao cadastrar a empresa:", error);
      setErro("Não consegui cadastrar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Cadastrar empresa na Reforma">
      <form onSubmit={salvar} className="w-full max-w-[480px] rounded-xl bg-surface-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Cadastrar empresa na Reforma</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">Depois você configura o regime, os produtos e libera o acesso do dono.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted">
            <X size={16} />
          </button>
        </div>

        {carteira.length > 0 && (
          <label className="mt-4 flex flex-col gap-1 text-[12px] text-ink-600">
            Já está no B.I.? (opcional)
            <select aria-label="Empresa do B.I." value={biId} onChange={(event) => escolherDoBi(event.target.value)} className={campo}>
              <option value="">— Não, é uma empresa nova —</option>
              {carteira.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.codigo ? `${company.codigo} · ` : ""}
                  {company.name}
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-ink-400">Ligando à empresa do B.I., dá pra trazer o faturamento e as compras da contabilidade.</span>
          </label>
        )}
        <label className="mt-3 flex flex-col gap-1 text-[12px] text-ink-600">
          Nome da empresa
          <input aria-label="Nome da empresa" value={nome} onChange={(event) => setNome(event.target.value.slice(0, 160))} className={campo} placeholder="Razão social ou nome fantasia" />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-[12px] text-ink-600">
          CNPJ (opcional)
          <input aria-label="CNPJ" value={cnpj} onChange={(event) => setCnpj(event.target.value.slice(0, 18))} onBlur={() => setCnpj(cnpjFormatado(cnpj))} className={campo} placeholder="00.000.000/0000-00" inputMode="numeric" />
        </label>

        {erro && <p className="mt-3 text-[12px] text-danger-600">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={botaoPrimario}>
            {salvando ? "Cadastrando…" : "Cadastrar e configurar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Escritório: lista das empresas da Reforma, com quantos acessos e
// simulações cada uma tem. Cliente: vai direto pra empresa dele (ou escolhe,
// se tiver mais de uma).
export default function ReformaHome() {
  const state = useAppState();
  const navigate = useNavigate();
  const escritorio = state.isReformaEscritorio;
  const [empresas, setEmpresas] = useState(state.reformaEmpresas);
  const [simulacoes, setSimulacoes] = useState(null);
  const [acessos, setAcessos] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    if (!escritorio) return;
    let ativo = true;
    Promise.all([listarEmpresas(), listarSimulacoes(), listarAcessos()])
      .then(([listaEmpresas, listaSimulacoes, listaAcessos]) => {
        if (!ativo) return;
        setEmpresas(listaEmpresas);
        setData({ reformaEmpresas: listaEmpresas });
        setSimulacoes(listaSimulacoes);
        setAcessos(listaAcessos);
      })
      .catch((error) => {
        console.error("Falha ao carregar a Reforma Tributária:", error);
        if (ativo) {
          setErro("Não consegui carregar as empresas agora. Tente de novo em instantes.");
          setSimulacoes([]);
          setAcessos([]);
        }
      });
    return () => {
      ativo = false;
    };
  }, [escritorio]);

  const porEmpresa = useMemo(() => {
    const mapa = new Map();
    const de = (id) => mapa.get(id) || (mapa.set(id, { simulacoes: 0, acessos: 0, ultima: null, regime: null }), mapa.get(id));
    (simulacoes || []).forEach((sim) => {
      const item = de(sim.empresa_id);
      item.simulacoes += 1;
      if (!item.ultima || sim.updated_at > item.ultima) item.ultima = sim.updated_at;
    });
    (acessos || []).forEach((acesso) => {
      de(acesso.empresa_id).acessos += 1;
    });
    return mapa;
  }, [simulacoes, acessos]);

  const visiveis = useMemo(() => {
    const termo = norm(busca);
    const digitos = soDigitos(busca);
    return empresas.filter((empresa) => !termo || norm(empresa.nome).includes(termo) || (digitos.length >= 3 && soDigitos(empresa.cnpj).includes(digitos)));
  }, [empresas, busca]);

  if (!temReforma(state)) return <Navigate to="/" replace />;
  if (!escritorio && empresas.length === 1) return <Navigate to={`/reforma/empresa/${empresas[0].id}`} replace />;

  function criada(empresa) {
    const lista = [...empresas, empresa].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    setEmpresas(lista);
    setData({ reformaEmpresas: lista });
    navigate(`/reforma/empresa/${empresa.id}?aba=configuracao`);
  }

  const comAcesso = empresas.filter((empresa) => porEmpresa.get(empresa.id)?.acessos).length;
  const clientesComSimulacao = new Set((simulacoes || []).map((sim) => sim.empresa_id)).size;

  return (
    <ReformaShell
      titulo={escritorio ? "Empresas da Reforma" : "Suas empresas"}
      subtitulo={
        escritorio
          ? "Cadastre a empresa, configure caso a caso e libere o acesso do dono — ele entra direto nos parâmetros que vocês configuraram."
          : "Escolha a empresa pra ver e fazer as simulações."
      }
      acoes={
        escritorio && (
          <>
            <button type="button" onClick={() => navigate("/reforma/painel")} className="flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-white/10">
              <LayoutList size={14} />
              Painel do escritório
            </button>
            <button type="button" onClick={() => navigate("/parametros/reforma")} className="flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-white/10">
              <SlidersHorizontal size={14} />
              Alíquotas e transição
            </button>
          </>
        )
      }
    >
      {cadastrando && <NovaEmpresaModal onFechar={() => setCadastrando(false)} onCriada={criada} />}

      {escritorio && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Indicador rotulo="Empresas cadastradas" valor={String(empresas.length)} />
          <Indicador rotulo="Com o dono liberado" valor={acessos ? String(comAcesso) : "…"} apoio={acessos ? `${acessos.length} ${acessos.length === 1 ? "pessoa liberada" : "pessoas liberadas"}` : ""} />
          <Indicador rotulo="Com simulação" valor={simulacoes ? String(clientesComSimulacao) : "…"} apoio={simulacoes ? `${simulacoes.length} ${simulacoes.length === 1 ? "simulação" : "simulações"} no total` : ""} />
        </div>
      )}

      <Cartao
        titulo={escritorio ? "Empresas" : undefined}
        acoes={
          escritorio && (
            <>
              <label className="flex items-center gap-1.5 rounded-md border border-line-strong px-2 py-1">
                <Search size={14} className="text-ink-400" />
                <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome ou CNPJ" aria-label="Buscar empresa" className="w-[180px] bg-transparent text-[12.5px] text-ink-900 outline-none" />
              </label>
              <button type="button" onClick={() => setCadastrando(true)} className={botaoPrimario}>
                <Plus size={14} />
                Cadastrar empresa
              </button>
            </>
          )
        }
      >
        {erro && <p className="mb-2 text-[12.5px] text-danger-600">{erro}</p>}
        {empresas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
            <Building2 size={26} strokeWidth={1.5} className="text-accent-500" />
            {escritorio ? (
              <>
                <p className="text-[13.5px] font-medium text-ink-900">Nenhuma empresa cadastrada ainda</p>
                <p className="max-w-md text-[12.5px] text-ink-400">Cadastre a primeira, configure o regime e os produtos dela e convide o dono pelo e-mail.</p>
                <button type="button" onClick={() => setCadastrando(true)} className={`${botaoPrimario} mt-2`}>
                  <Plus size={14} />
                  Cadastrar a primeira empresa
                </button>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-medium text-ink-900">Nenhuma empresa liberada</p>
                <p className="max-w-md text-[12.5px] text-ink-400">Ainda não há empresa liberada pra você na Reforma Tributária. Fale com o escritório.</p>
              </>
            )}
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-[13px] text-ink-400">Nada encontrado nessa busca.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visiveis.map((empresa) => {
              const info = porEmpresa.get(empresa.id);
              return (
                <button
                  key={empresa.id}
                  type="button"
                  onClick={() => navigate(`/reforma/empresa/${empresa.id}`)}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent-200 hover:bg-surface-muted"
                >
                  <span className="min-w-[220px] flex-1">
                    <span className="block text-[13.5px] font-medium text-ink-900">{empresa.nome}</span>
                    <span className="block text-[11.5px] text-ink-400">
                      {empresa.cnpj ? cnpjFormatado(empresa.cnpj) : "Sem CNPJ"}
                      {empresa.bi_company_id ? " · ligada ao B.I." : ""}
                    </span>
                  </span>
                  {escritorio && (
                    <span className="flex flex-wrap gap-4 text-[12px] text-ink-500">
                      <span>
                        <strong className="font-mono text-ink-800">{info?.acessos || 0}</strong> {info?.acessos === 1 ? "acesso" : "acessos"}
                      </span>
                      <span>
                        <strong className="font-mono text-ink-800">{info?.simulacoes || 0}</strong> {info?.simulacoes === 1 ? "simulação" : "simulações"}
                      </span>
                      <span className="min-w-[120px]">{info?.ultima ? `última ${new Date(info.ultima).toLocaleDateString("pt-BR")}` : "sem simulação"}</span>
                    </span>
                  )}
                  <ChevronRight size={16} className="text-ink-300" />
                </button>
              );
            })}
          </div>
        )}
      </Cartao>
    </ReformaShell>
  );
}
