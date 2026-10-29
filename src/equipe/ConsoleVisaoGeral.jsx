import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Boxes, Building2, Clock, Eye, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { primeiroNome, saudacao } from "../lib/inicio.js";
import { recentes } from "../lib/recentes.js";
import { haQuanto } from "../lib/uso.js";
import { unidadesDaCarteira } from "../lib/unidades.js";
import { COR_DO_STATUS, nomeCurto, problemasDaEmpresa, statusDaUnidade, useSaude } from "./useSaude.js";
import { BarraDeStatus, Cabecalho, Cartao, IconeDaUnidade, Numero, SeloDeStatus } from "./pecas.jsx";

const ORDEM = { critico: 0, atencao: 1, ok: 2 };

const ATALHOS = [
  { to: "/equipe/acessos", nome: "Acessos e convites", texto: "Quem entra e em qual grupo", icone: ShieldCheck },
  { to: "/equipe/grupo", nome: "Grupos", texto: "Montar e ajustar grupos", icone: Boxes },
  { to: "/equipe/empresas", nome: "Empresas", texto: "Cadastro e Domínio", icone: Building2 },
];

// Console › Visão geral: como está a carteira hoje e o que pede atenção,
// por grupo (a unidade de trabalho — ver lib/unidades.js).
export default function ConsoleVisaoGeral() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir, abrirBusca } = useOutletContext();
  const { healths, calculando } = useSaude(state.companies);
  const { grupos, avulsas } = useMemo(() => unidadesDaCarteira(state.companies, state.groups), [state.companies, state.groups]);

  const contagem = useMemo(() => {
    const c = { ok: 0, atencao: 0, critico: 0 };
    Object.values(healths).forEach((saude) => (c[saude.status] += 1));
    return c;
  }, [healths]);

  // Unidades com pendência: o grupo (com o nome da empresa em cada problema) ou a empresa avulsa.
  const pendentes = useMemo(() => {
    const lista = [...grupos.map((unidade) => ({ ...unidade, empresas: unidade.membros })), ...avulsas.map((unidade) => ({ ...unidade, empresas: [unidade.empresa] }))]
      .map((unidade) => {
        const status = statusDaUnidade(unidade.empresas, healths);
        const problemas = unidade.empresas.flatMap((company) => problemasDaEmpresa(healths[company.id]).map((check) => ({ ...check, empresa: company })));
        return { ...unidade, status, problemas };
      })
      .filter((unidade) => unidade.status === "critico" || unidade.status === "atencao");
    return lista.sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || b.problemas.length - a.problemas.length || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }, [grupos, avulsas, healths]);

  const abertas = useMemo(
    () =>
      recentes()
        .map((item) => {
          const registro = item.tipo === "grupo" ? state.groups.find((group) => group.id === item.id) : state.companies.find((company) => company.id === item.id);
          return registro ? { ...item, nome: registro.name } : null;
        })
        .filter(Boolean)
        .slice(0, 5),
    [state.companies, state.groups]
  );

  const nome = primeiroNome(state.nomeUsuario);
  const ficha = (item) => navigate(`/equipe/clientes/${item.tipo}/${item.id}`);

  return (
    <>
      <Cabecalho
        rotulo={`${saudacao()}${nome ? `, ${nome}` : ""}`}
        titulo="A carteira,"
        italico="hoje"
        texto="O que está em dia e o que pede atenção em cada grupo e empresa. Daqui se edita; para ver exatamente o que o cliente vê, use o portal."
        acoes={
          <>
            <button type="button" onClick={abrirBusca} className="hub-botao hub-botao-fantasma">
              <Search size={16} /> Buscar
            </button>
            <button type="button" onClick={() => navigate("/hub")} className="hub-botao hub-botao-primario">
              Abrir o portal <ArrowUpRight size={16} />
            </button>
          </>
        }
      />

      <Cartao className="p-7 sm:p-8">
        <div className="grid grid-cols-2 gap-7 sm:grid-cols-3 lg:grid-cols-5">
          <Numero valor={grupos.length} rotulo={grupos.length === 1 ? "grupo" : "grupos"} />
          <Numero valor={avulsas.length} rotulo={avulsas.length === 1 ? "empresa sem grupo" : "empresas sem grupo"} />
          <Numero valor={contagem.ok} rotulo="empresas em dia" cor={COR_DO_STATUS.ok} />
          <Numero valor={contagem.atencao} rotulo="pedem atenção" cor={COR_DO_STATUS.atencao} />
          <Numero valor={contagem.critico} rotulo="críticas" cor={COR_DO_STATUS.critico} />
        </div>
        <div className="mt-7">
          <BarraDeStatus {...contagem} />
          <p className="mt-2.5 text-[12.5px] text-[var(--hub-texto-3)]">
            {calculando ? `Conferindo ${Object.keys(healths).length} de ${state.companies.length} empresas…` : `${state.companies.length} empresas conferidas: balancete em dia, balanço fechando, De/Para e responsável.`}{" "}
            <button type="button" onClick={() => navigate("/equipe/carteira")} className="font-semibold text-[var(--hub-acento)] hover:underline">
              Ver a saúde em detalhe
            </button>
          </p>
        </div>
      </Cartao>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="hub-display text-[22px] font-bold">Precisa de atenção</h2>
            <button type="button" onClick={() => navigate("/equipe/clientes?ver=pendencias")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--hub-acento)] hover:underline">
              Ver todos <ArrowRight size={14} />
            </button>
          </div>
          <Cartao className="divide-y divide-[var(--hub-borda)] overflow-hidden">
            {pendentes.length === 0 && (
              <p className="flex items-center gap-2 px-6 py-10 text-[14px] text-[var(--hub-texto-2)]">
                <Sparkles size={16} className="text-[var(--hub-acento)]" />
                {calculando ? "Conferindo a carteira…" : "Nada pendente — tudo em dia."}
              </p>
            )}
            {pendentes.slice(0, 8).map((unidade) => (
              <div key={`${unidade.tipo}:${unidade.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:flex-nowrap">
                <button type="button" onClick={() => ficha(unidade)} className="flex min-w-0 flex-[1_1_100%] items-center gap-3.5 text-left sm:flex-1">
                  <IconeDaUnidade tipo={unidade.tipo} nome={unidade.nome} tamanho={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold">{unidade.nome}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {unidade.problemas.slice(0, 3).map((problema, i) => (
                        <span key={i} className="max-w-full truncate rounded-full bg-[var(--hub-fundo-2)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--hub-texto-2)]" title={problema.detail}>
                          {unidade.tipo === "grupo" ? `${nomeCurto(problema.empresa)}: ` : ""}
                          {problema.title}
                        </span>
                      ))}
                      {unidade.problemas.length > 3 && <span className="px-1 text-[11.5px] text-[var(--hub-texto-3)]">+{unidade.problemas.length - 3}</span>}
                    </span>
                  </span>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <SeloDeStatus status={unidade.status} />
                  <button type="button" onClick={() => abrir(unidade, { comoCliente: true })} title="Ver como o cliente vê" aria-label={`Ver ${unidade.nome} como o cliente vê`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--hub-borda)] text-[var(--hub-texto-2)] hover:border-[var(--hub-acento)] hover:text-[var(--hub-acento)]">
                    <Eye size={15} />
                  </button>
                  <button type="button" onClick={() => ficha(unidade)} title="Abrir a ficha" aria-label={`Abrir a ficha de ${unidade.nome}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--hub-borda)] text-[var(--hub-texto-2)] hover:border-[var(--hub-acento)] hover:text-[var(--hub-acento)]">
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ))}
          </Cartao>
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <section>
            <h2 className="hub-display mb-4 text-[22px] font-bold">Abertas por último</h2>
            <Cartao className="p-2">
              {abertas.length === 0 && <p className="px-4 py-6 text-[13.5px] text-[var(--hub-texto-3)]">Nenhuma ainda neste navegador.</p>}
              {abertas.map((item) => (
                <button key={`${item.tipo}:${item.id}`} type="button" onClick={() => ficha(item)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--hub-acento-suave)]">
                  <IconeDaUnidade tipo={item.tipo} nome={item.nome} tamanho={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{item.nome}</span>
                    <span className="flex items-center gap-1 text-[12px] text-[var(--hub-texto-3)]">
                      <Clock size={12} /> {item.tipo === "grupo" ? "Grupo" : "Empresa"} · {haQuanto(item.at)}
                    </span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-[var(--hub-texto-3)]" />
                </button>
              ))}
            </Cartao>
          </section>
          <section>
            <h2 className="hub-display mb-4 text-[22px] font-bold">Atalhos</h2>
            <div className="grid gap-3">
              {ATALHOS.map(({ to, nome: rotulo, texto, icone: Icone }) => (
                <button key={to} type="button" onClick={() => navigate(to)} className="hub-cartao hub-cartao-vivo flex items-center gap-3.5 p-4 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
                    <Icone size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{rotulo}</span>
                    <span className="block text-[12.5px] text-[var(--hub-texto-3)]">{texto}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-[var(--hub-texto-3)]" />
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
