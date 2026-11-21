import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Plus, Trash2, UserPlus, Users, Wrench, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import PreviaCliente from "./PreviaCliente.jsx";
import { MODELOS_TIPO, conjuntosDoModelo } from "../lib/tiposDeAcesso.js";
import { grantAccess, inviteUser, listAccessGrants, listAccessPeople, revokeAccess } from "../lib/access.js";
import { saveVisibilidadeEmpresa } from "../lib/companies.js";
import { saveVisibilidadeGrupo } from "../lib/groups.js";
import { WIDGET_CATALOG } from "../lib/dashboardWidgets.js";
import { MODULOS_COMPLEMENTARES, modulosAplicaveisAoAlvo } from "../lib/modulos.js";
import { BLOCOS_ENTRADAS_SAIDAS, AREAS_OCULTAVEIS, abasDoAlvo, configHerdada, kAba, kItem, kSubaba, todasAsChaves } from "../lib/visibilidade.js";

// "Acesso dos clientes" de uma empresa ou grupo (pedido do Izaias, 28/10/2026): numa tela só, QUEM tem acesso e O QUE cada módulo mostra pra eles.
// Tudo começa DESMARCADO (29/10/2026): a equipe marca o que o cliente deve ver (aba inteira, subaba ou item), com "Marcar todos" pra agilizar. A configuração vale pra todas as pessoas daquela empresa/grupo
// (lib/visibilidade.js). Ocultar é só da tela — a segurança de verdade continua sendo a lista de quem tem acesso.
//
// As seções espelham o menu do site (30/11/2026 — pedido do Izaias): "Meu B.I." (as abas e subabas do B.I da empresa) e "Ferramentas" (os módulos; os que são só de
// algumas empresas, como o DRE Gerencial do Gestão Click, só aparecem pra elas). À direita, "Como o cliente vê" mostra o menu como o cliente vai enxergar, ao vivo.
// A equipe sempre vê tudo — pra conferir como o cliente, use o olhinho (visão do cliente) do topo.
const SECOES = [
  { id: "pessoas", nome: "Quem tem acesso", icone: Users },
  { id: "inicio", nome: "Início", fixa: "A página inicial do site. Aparece sempre para o cliente, com os atalhos para o que ele tem liberado." },
  { id: "bi", nome: "Meu B.I." },
  { id: "reforma", nome: "Reforma Tributária", fixa: "Informativo sobre a Reforma Tributária. O acesso ao módulo de cadastro dela é próprio (Reforma Tributária, no console); aqui você só decide se o item aparece no menu do cliente." },
  { id: "servicos", nome: "Serviços", fixa: "Área ainda sem conteúdo no site; não há itens para marcar, só mostrar ou esconder do menu." },
  { id: "conteudos", nome: "Conteúdos", fixa: "Guias da DRE, do balanço, do fluxo de caixa e dos indicadores. Não há itens para marcar, só mostrar ou esconder do menu." },
  { id: "ferramentas", nome: "Ferramentas", icone: Wrench },
];

// Perfis no formato que vai pro cadastro (conjuntos viram listas ordenadas); também serve pra saber se algo mudou.
const perfilParaSalvar = (p) => ({ id: p.id, nome: p.nome, modo: "marcados", visiveis: [...p.visiveis].sort(), modulos: [...p.modulos].sort(), areasOcultas: [...p.areasOcultas].sort() });
const serializarPerfis = (lista) => JSON.stringify(lista.map(perfilParaSalvar));

function Caixa({ marcado, onChange, disabled, children, recuo = 0, forte = false }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-surface-muted ${disabled ? "opacity-45" : ""}`} style={{ marginLeft: recuo * 20 }}>
      <input type="checkbox" checked={marcado} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#e8681f]" />
      <span className={`min-w-0 truncate text-[13px] ${forte ? "font-semibold text-ink-900" : "text-ink-700"}`}>{children}</span>
      {!marcado && <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-ink-400"><EyeOff size={12} /> oculto</span>}
    </label>
  );
}

export default function AcessoClientesModal({ tipo, item, onClose, secaoInicial = "pessoas" }) {
  const ehGrupo = tipo === "grupo";
  const scopeType = ehGrupo ? "group" : "company";
  const { companies, groups } = useAppState();
  // `secaoInicial` pode vir como o id de um módulo (versão antiga do menu): agora todos moram em "Ferramentas".
  const [secao, setSecao] = useState(SECOES.some((s) => s.id === secaoInicial) ? secaoInicial : MODULOS_COMPLEMENTARES.some((m) => m.id === secaoInicial) ? "ferramentas" : "pessoas");
  const configAnterior = item.visibilidade;
  const naoConfigurado = configAnterior?.modo !== "marcados" && !Array.isArray(configAnterior?.ocultos);
  // Empresa sem configuração própria herda a do grupo (lib/visibilidade.js): o que aparece marcado aqui já é o que o cliente vê. Só vira configuração própria se você mexer e salvar.
  const heranca = ehGrupo ? null : configHerdada(item, groups);
  const baseV = heranca ? heranca.visibilidade : configAnterior;
  const semConfigEfetiva = naoConfigurado && !heranca;
  const [visiveis, setVisiveis] = useState(() => {
    if (baseV?.modo === "marcados") return new Set(baseV.visiveis || []);
    // configuração antiga (lista de ocultos): converte pro que o cliente vê hoje, pra não mudar nada ao salvar
    if (Array.isArray(baseV?.ocultos)) { const oc = new Set(baseV.ocultos); return new Set(todasAsChaves(item).filter((k) => !oc.has(k))); }
    return new Set(); // ainda não configurado: tudo desmarcado
  });
  const configuradoProprio = Array.isArray(item.visibilidade?.modulos);
  const configurado = Array.isArray(baseV?.modulos);
  const [modulos, setModulos] = useState(() => new Set(baseV?.modulos || []));
  const [areasOcultas, setAreasOcultas] = useState(() => new Set((baseV?.areasOcultas || []).filter((id) => AREAS_OCULTAVEIS.includes(id))));
  const areasIniciais = useRef(areasOcultas);
  // Perfis de acesso (lib/visibilidade.js › configDaPessoa): `perfilAtivo` null = editando o padrão; senão o id do perfil. As caixas sempre editam o que está "vivo" (visiveis/modulos/areasOcultas);
  // ao trocar de perfil, o que estava na tela é guardado (padraoGuardado ou o próprio perfil) e o do perfil escolhido é carregado.
  const [perfis, setPerfis] = useState(() => (baseV?.perfis || []).map((p) => ({ id: p.id, nome: p.nome || "Perfil", visiveis: new Set(p.visiveis || []), modulos: new Set(p.modulos || []), areasOcultas: new Set((p.areasOcultas || []).filter((id) => AREAS_OCULTAVEIS.includes(id))) })));
  const perfisIniciais = useRef(serializarPerfis(perfis));
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [padraoGuardado, setPadraoGuardado] = useState(null);
  const [perfilPorPessoa, setPerfilPorPessoa] = useState(() => ({ ...(baseV?.perfilPorPessoa || {}) }));
  const pessoasIniciais = useRef(JSON.stringify(baseV?.perfilPorPessoa || {}));
  // Como tudo abriu — pra só gravar o que a pessoa mexeu de verdade (ver salvar).
  const visiveisIniciais = useRef(visiveis);
  const modulosIniciais = useRef(modulos);
  const [grants, setGrants] = useState(null);
  const [fichas, setFichas] = useState(new Map());
  const [erro, setErro] = useState("");
  const [email, setEmail] = useState("");
  const [convidar, setConvidar] = useState(true);
  const [trabalhando, setTrabalhando] = useState(false);

  async function recarregar() {
    const [g, f] = await Promise.all([listAccessGrants(), listAccessPeople().catch(() => new Map())]);
    setGrants(g);
    setFichas(f);
    return { g, f };
  }
  useEffect(() => {
    recarregar()
      .then(({ g, f }) => {
        // empresa ainda sem módulos configurados: começa pelo que as fichas das pessoas dela já liberam hoje
        if (!configurado) {
          const uniao = new Set();
          g.filter((x) => x.scope_type === scopeType && x.scope_id === item.id).forEach((x) => (f.get(x.email)?.modulos || []).forEach((id) => uniao.add(id)));
          modulosIniciais.current = uniao;
          setModulos(uniao);
        }
      })
      .catch((err) => setErro(`Não consegui carregar os acessos: ${err.message || err}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAlvo = useMemo(() => (grants || []).filter((x) => x.scope_type === scopeType && x.scope_id === item.id), [grants, scopeType, item.id]);
  const abas = useMemo(() => abasDoAlvo(item), [item]);
  const nomeWidget = (id) => WIDGET_CATALOG.find((d) => d.id === id)?.label || id;

  const marcarVisivel = (chave, visivel) =>
    setVisiveis((atual) => {
      const novo = new Set(atual);
      if (visivel) novo.add(chave);
      else novo.delete(chave);
      return novo;
    });
  const marcarVarias = (chaves, visivel) =>
    setVisiveis((atual) => {
      const novo = new Set(atual);
      chaves.forEach((k) => (visivel ? novo.add(k) : novo.delete(k)));
      return novo;
    });
  const chavesBi = useMemo(() => todasAsChaves(item).filter((k) => k.startsWith("bi:")), [item]);

  async function darAcesso() {
    const limpo = email.trim().toLowerCase();
    if (!limpo || !limpo.includes("@")) { setErro("Digite um e-mail válido."); return; }
    setTrabalhando(true);
    setErro("");
    try {
      await grantAccess({ email: limpo, scopeType, scopeId: item.id });
      if (convidar) await inviteUser(limpo).catch((e) => setErro(`Acesso dado, mas o convite por e-mail falhou: ${e.message || e}`));
      setEmail("");
      await recarregar();
    } catch (err) {
      setErro(`Não consegui dar o acesso: ${err.message || err}`);
    } finally {
      setTrabalhando(false);
    }
  }
  async function tirarAcesso(grant) {
    if (!window.confirm(`Tirar o acesso de ${fichas.get(grant.email)?.nome || grant.email} a ${item.name}?`)) return;
    setTrabalhando(true);
    try {
      await revokeAccess(grant.id);
      await recarregar();
    } catch (err) {
      setErro(`Não consegui tirar o acesso: ${err.message || err}`);
    } finally {
      setTrabalhando(false);
    }
  }

  const vivo = () => ({ visiveis, modulos, areasOcultas });
  const mudouPadrao = (conj) => conj.visiveis.size !== visiveisIniciais.current.size || [...conj.visiveis].some((k) => !visiveisIniciais.current.has(k)) || conj.modulos.size !== modulosIniciais.current.size || [...conj.modulos].some((k) => !modulosIniciais.current.has(k));
  const carregar = (conjuntos) => {
    setVisiveis(conjuntos.visiveis);
    setModulos(conjuntos.modulos);
    setAreasOcultas(conjuntos.areasOcultas);
  };
  const guardarAtual = (lista) => (perfilAtivo === null ? lista : lista.map((p) => (p.id === perfilAtivo ? { ...p, ...vivo() } : p)));
  function trocarPerfil(novoId) {
    if (novoId === perfilAtivo) return;
    if (perfilAtivo === null) setPadraoGuardado(vivo());
    else setPerfis((atual) => guardarAtual(atual));
    carregar(novoId === null ? padraoGuardado : perfis.find((p) => p.id === novoId));
    setPerfilAtivo(novoId);
  }
  // Cria um tipo de acesso (já guardando o que estava na tela) e, se pedido, passa a editá-lo.
  function criarTipo(novo, ativar) {
    if (perfilAtivo === null) setPadraoGuardado(vivo());
    setPerfis((atual) => [...guardarAtual(atual), novo]);
    if (ativar) {
      carregar(novo);
      setPerfilAtivo(novo.id);
    }
  }
  // Modelo pré-preenchido (Financeiro, Comercial, Marketing): se a empresa ainda não tem, cria com o que o modelo libera nas abas dela. Devolve o id.
  function criarDoModelo(modeloId, ativar) {
    if (perfis.some((p) => p.id === modeloId)) {
      if (ativar) trocarPerfil(modeloId);
      return modeloId;
    }
    const modelo = MODELOS_TIPO.find((m) => m.id === modeloId);
    const conjuntos = conjuntosDoModelo(modeloId, { abas, chaves: todasAsChaves(item), modulosAplicaveis: aplicaveis.map((m) => m.id), blocos: BLOCOS_ENTRADAS_SAIDAS.map((b) => b.id) });
    criarTipo({ id: modeloId, nome: modelo.nome, ...conjuntos }, ativar);
    return modeloId;
  }
  // Tipo em branco da equipe (nome livre): nasce como cópia do padrão (ou com tudo marcado, se o padrão ainda não foi configurado).
  function outroTipo() {
    const padraoAgora = perfilAtivo === null ? vivo() : padraoGuardado;
    const tudo = { visiveis: new Set(todasAsChaves(item)), modulos: new Set(aplicaveis.map((m) => m.id)), areasOcultas: new Set() };
    const base = semConfigEfetiva && !mudouPadrao(padraoAgora) ? tudo : { visiveis: new Set(padraoAgora.visiveis), modulos: new Set(padraoAgora.modulos), areasOcultas: new Set(padraoAgora.areasOcultas) };
    criarTipo({ id: `perfil_${Date.now().toString(36)}`, nome: `Novo tipo ${perfis.filter((p) => p.id.startsWith("perfil_")).length + 1}`, ...base }, true);
  }
  function excluirPerfil() {
    const atual = perfis.find((p) => p.id === perfilAtivo);
    if (!atual || !window.confirm(`Excluir o tipo de acesso “${atual.nome}”? As pessoas dele voltam ao padrão.`)) return;
    setPerfis((lista) => lista.filter((p) => p.id !== perfilAtivo));
    setPerfilPorPessoa((mapa) => Object.fromEntries(Object.entries(mapa).filter(([, id]) => id !== perfilAtivo)));
    carregar(padraoGuardado);
    setPerfilAtivo(null);
  }
  const renomearPerfil = (nome) => setPerfis((lista) => lista.map((p) => (p.id === perfilAtivo ? { ...p, nome } : p)));

  // Grava só o que mudou: um grupo/empresa ainda sem configuração continua
  // assim (o cliente vê tudo; os módulos seguem a ficha de cada pessoa) se
  // ninguém mexeu naquela parte — antes, "Salvar alterações" depois de só
  // dar acesso a alguém gravava tudo desmarcado e o cliente perdia o B.I.
  function salvar() {
    const mudou = (inicial, atual) => inicial.size !== atual.size || [...atual].some((chave) => !inicial.has(chave));
    // o que vale como padrão: o que está na tela, ou o guardado se um perfil estava aberto
    const padrao = perfilAtivo === null ? vivo() : padraoGuardado;
    const perfisFinal = guardarAtual(perfis);
    const mapaFinal = Object.fromEntries(Object.entries(perfilPorPessoa).filter(([, id]) => perfisFinal.some((p) => p.id === id)));
    const mexeuNoBi = mudou(visiveisIniciais.current, padrao.visiveis);
    const mexeuNosModulos = mudou(modulosIniciais.current, padrao.modulos);
    const mexeuNasAreas = mudou(areasIniciais.current, padrao.areasOcultas);
    const mexeuNosPerfis = serializarPerfis(perfisFinal) !== perfisIniciais.current || JSON.stringify(mapaFinal) !== pessoasIniciais.current;
    const visibilidade = { ...(configAnterior || {}) };
    // empresa que herdava do grupo e mexeu em qualquer parte: grava a configuração própria COMPLETA (B.I., módulos, áreas e perfis), senão a parte que não mexeu perderia a herança
    const herdeiraQueMexeu = Boolean(heranca) && (mexeuNoBi || mexeuNosModulos || mexeuNasAreas || mexeuNosPerfis);
    if (!naoConfigurado || mexeuNoBi || herdeiraQueMexeu) {
      Object.assign(visibilidade, { modo: "marcados", visiveis: [...padrao.visiveis] });
      delete visibilidade.ocultos;
    }
    if (configuradoProprio || mexeuNosModulos || (herdeiraQueMexeu && configurado)) visibilidade.modulos = [...padrao.modulos];
    if (mexeuNasAreas || herdeiraQueMexeu || Array.isArray(configAnterior?.areasOcultas)) visibilidade.areasOcultas = [...padrao.areasOcultas];
    if (mexeuNosPerfis || herdeiraQueMexeu) {
      if (perfisFinal.length) {
        visibilidade.perfis = perfisFinal.map(perfilParaSalvar);
        visibilidade.perfilPorPessoa = mapaFinal;
      } else {
        delete visibilidade.perfis;
        delete visibilidade.perfilPorPessoa;
      }
    }
    if (naoConfigurado && !mexeuNoBi && !configuradoProprio && !mexeuNosModulos && !mexeuNasAreas && !mexeuNosPerfis) {
      onClose();
      return;
    }
    if (ehGrupo) saveVisibilidadeGrupo(item.id, visibilidade);
    else saveVisibilidadeEmpresa(item.id, visibilidade);
    onClose();
  }

  const ToggleArea = ({ id, nome }) => (
    <div className="mt-3 max-w-xl rounded-xl border border-line p-1.5">
      <Caixa forte marcado={!areasOcultas.has(id)} onChange={(v) => setAreasOcultas((atual) => { const novo = new Set(atual); if (v) novo.delete(id); else novo.add(id); return novo; })}>Mostrar “{nome}” no menu do cliente</Caixa>
    </div>
  );
  const aplicaveis = useMemo(() => modulosAplicaveisAoAlvo(item, ehGrupo, companies), [item, ehGrupo, companies]);
  const abaTotal = abas.length;

  // ---- "Como o cliente vê": o menu do site com o que está marcado agora (mesmas regras de lib/visibilidade.js e lib/modulos.js)
  const mudou = (inicial, atual) => inicial.size !== atual.size || [...atual].some((chave) => !inicial.has(chave));
  const biLivre = perfilAtivo === null && semConfigEfetiva && !mudou(visiveisIniciais.current, visiveis); // ainda sem configuração e sem mexer: o cliente vê tudo
  const veBi = (chave) => biLivre || visiveis.has(chave);
  const modulosLivre = perfilAtivo === null && !configurado && !mudou(modulosIniciais.current, modulos); // sem lista da empresa: vale a ficha de cada pessoa
  const veModulo = (id) => modulosLivre || modulos.has(id);
  const abasVistas = abas.filter((aba) => veBi(kAba(aba.id))).map((aba) => ({
    ...aba,
    subs: (aba.subTabs || []).filter((sub) => veBi(kSubaba(aba.id, sub.id))),
  }));
  const ferramentasVistas = aplicaveis.filter((m) => veModulo(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <div className="flex h-[88vh] w-full max-w-[1360px] flex-col overflow-hidden rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Acesso dos clientes</span>
            <h2 className="mt-1 truncate text-[18px] font-semibold text-ink-900">{item.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">Vale para todas as pessoas {ehGrupo ? "que abrem este grupo" : "desta empresa"}. {heranca ? `Esta empresa ainda não tem configuração própria: vale a do grupo ${heranca.grupo.name}${heranca.varios ? " (a mais recente entre os grupos dela)" : ""}. Se você mexer e salvar aqui, ela passa a ter a própria.` : naoConfigurado ? "Ainda sem configuração: hoje o cliente vê tudo — só muda o que você marcar e salvar." : "Marque o que o cliente vê; o que ficar desmarcado fica oculto."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="w-[210px] shrink-0 overflow-y-auto border-r border-line bg-surface-muted/50 p-3">
            {SECOES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSecao(s.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${secao === s.id ? "bg-surface-card font-semibold text-ink-900 shadow-sm" : "text-ink-600 hover:bg-surface-card/70"}`}>
                {s.icone ? <s.icone size={14} /> : <Eye size={14} className="text-ink-400" />}
                <span className="truncate">{s.nome}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {erro && <p className="mb-3 rounded-lg bg-danger-500/10 px-3 py-2 text-[12.5px] text-danger-700">{erro}</p>}

            {secao !== "pessoas" && (
              <div className="mb-4 rounded-xl border border-line bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Tipo de acesso que você está configurando</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => trocarPerfil(null)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${perfilAtivo === null ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-card"}`}>Padrão (todos)</button>
                  {perfis.map((p) => (
                    <button key={p.id} type="button" onClick={() => trocarPerfil(p.id)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${perfilAtivo === p.id ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-card"}`}>{p.nome}</button>
                  ))}
                  {MODELOS_TIPO.filter((m) => !perfis.some((p) => p.id === m.id)).map((m) => (
                    <button key={m.id} type="button" onClick={() => criarDoModelo(m.id, true)} title={`Cria o tipo ${m.nome} já pré-preenchido: ${m.texto}`} className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1 text-[12.5px] font-medium text-accent-600 hover:bg-surface-card"><Plus size={13} /> {m.nome}</button>
                  ))}
                  <button type="button" onClick={outroTipo} className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1 text-[12.5px] font-medium text-accent-600 hover:bg-surface-card"><Plus size={13} /> Outro tipo</button>
                </div>
                {perfilAtivo !== null ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input value={perfis.find((p) => p.id === perfilAtivo)?.nome || ""} onChange={(e) => renomearPerfil(e.target.value)} aria-label="Nome do tipo de acesso" className="w-56 rounded-lg border border-line bg-surface-card px-3 py-1.5 text-[13px] outline-none focus:border-accent-500" />
                    <button type="button" onClick={excluirPerfil} className="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-surface-card hover:text-danger-600"><Trash2 size={13} /> Excluir tipo</button>
                    <span className="text-[11.5px] text-ink-400">O que você marcar abaixo vale só para quem tem este tipo de acesso. Escolha o tipo de cada pessoa em “Quem tem acesso”.</span>
                  </div>
                ) : (
                  <p className="mt-2 text-[11.5px] text-ink-400">O padrão vale para quem não tem tipo de acesso. Clique em Financeiro, Comercial ou Marketing para criar o tipo já pré-preenchido (você ajusta depois), ou em “Outro tipo” para criar o seu.</p>
                )}
              </div>
            )}

            {secao === "pessoas" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Quem tem acesso</h3>
                <p className="mt-1 text-[12.5px] text-ink-400">Pessoas que abrem {item.name}. Ao lado de cada uma, escolha o tipo de acesso (Padrão, Financeiro, Comercial, Marketing ou outro que você criar): cada tipo vê o que for configurado nas outras abas.</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && darAcesso()} placeholder="e-mail da pessoa" className="min-w-[240px] flex-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-[13px] outline-none focus:border-accent-500" />
                  <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600"><input type="checkbox" checked={convidar} onChange={(e) => setConvidar(e.target.checked)} className="accent-[#e8681f]" /> enviar convite por e-mail</label>
                  <button type="button" onClick={darAcesso} disabled={trabalhando} className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"><UserPlus size={14} /> Dar acesso</button>
                </div>
                <div className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {grants === null && <p className="p-4 text-[12.5px] text-ink-400">Carregando…</p>}
                  {grants && !doAlvo.length && <p className="p-4 text-[12.5px] text-ink-400">Ninguém tem acesso ainda.</p>}
                  {doAlvo.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-900">{fichas.get(g.email)?.nome || "Sem nome"}</p>
                        <p className="truncate text-[12px] text-ink-400">{g.email}</p>
                      </div>
                      <select
                        value={perfilPorPessoa[g.email.toLowerCase()] || ""}
                        onChange={(e) => {
                          const escolha = e.target.value;
                          const chave = g.email.toLowerCase();
                          // modelo que ainda não existe nesta empresa: cria já pré-preenchido e atribui
                          const id = escolha.startsWith("modelo:") ? criarDoModelo(escolha.slice(7), false) : escolha;
                          setPerfilPorPessoa((mapa) => { const novo = { ...mapa }; if (id) novo[chave] = id; else delete novo[chave]; return novo; });
                        }}
                        aria-label={`Tipo de acesso de ${g.email}`}
                        title="Tipo de acesso: define o que esta pessoa vê"
                        className="rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-700 outline-none focus:border-accent-500"
                      >
                        <option value="">Padrão</option>
                        {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        {MODELOS_TIPO.filter((m) => !perfis.some((p) => p.id === m.id)).length > 0 && (
                          <optgroup label="Criar e usar">
                            {MODELOS_TIPO.filter((m) => !perfis.some((p) => p.id === m.id)).map((m) => <option key={m.id} value={`modelo:${m.id}`}>{m.nome}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <button type="button" onClick={() => tirarAcesso(g)} disabled={trabalhando} title="Tirar o acesso" className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong text-ink-500 hover:bg-surface-muted hover:text-danger-600 disabled:opacity-40"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {secao === "bi" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Meu B.I.</h3>
                <ToggleArea id="bi" nome="Meu B.I." />
                <p className="mt-1 text-[12.5px] text-ink-400">As abas e itens do B.I {ehGrupo ? "deste grupo" : "desta empresa"}. Marque o que o cliente deve ver: uma aba inteira, uma subaba ou só alguns itens (por exemplo, indicadores específicos).</p>
                {semConfigEfetiva && <p className="mt-3 rounded-lg bg-warning-500/10 px-3 py-2 text-[12px] text-warning-800">Ainda não configurado: hoje o cliente vê tudo. Ao salvar, ele passa a ver só o que estiver marcado aqui.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => marcarVarias(chavesBi, true)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Marcar todos</button>
                  <button type="button" onClick={() => marcarVarias(chavesBi, false)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
                </div>
                {!abaTotal && <p className="mt-4 text-[12.5px] text-ink-400">Esta {ehGrupo ? "grupo" : "empresa"} ainda não tem abas montadas no B.I (Personalizar).</p>}
                <div className="mt-4 flex flex-col gap-3">
                  {abas.map((aba) => {
                    const abaOculta = !visiveis.has(kAba(aba.id));
                    const subs = aba.subTabs || [];
                    return (
                      <div key={aba.id} className="rounded-xl border border-line p-2">
                        <Caixa forte marcado={!abaOculta} onChange={(v) => marcarVisivel(kAba(aba.id), v)}>{aba.name}</Caixa>
                        {!subs.length && (aba.widgets || []).map((w, i) => (
                          <Caixa key={`${w.id}-${i}`} recuo={1} marcado={!abaOculta && visiveis.has(kItem(aba.id, null, w.id))} disabled={abaOculta} onChange={(v) => marcarVisivel(kItem(aba.id, null, w.id), v)}>{nomeWidget(w.id)}</Caixa>
                        ))}
                        {subs.map((sub) => {
                          const subOculta = !visiveis.has(kSubaba(aba.id, sub.id));
                          return (
                            <div key={sub.id}>
                              <Caixa recuo={1} marcado={!abaOculta && !subOculta} disabled={abaOculta} onChange={(v) => marcarVisivel(kSubaba(aba.id, sub.id), v)}>{sub.name}</Caixa>
                              {(sub.widgets || []).map((w, i) => (
                                <Caixa key={`${w.id}-${i}`} recuo={2} marcado={!abaOculta && !subOculta && visiveis.has(kItem(aba.id, sub.id, w.id))} disabled={abaOculta || subOculta} onChange={(v) => marcarVisivel(kItem(aba.id, sub.id, w.id), v)}>{nomeWidget(w.id)}</Caixa>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {SECOES.find((x) => x.id === secao)?.fixa && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">{SECOES.find((x) => x.id === secao).nome}</h3>
                <p className="mt-2 max-w-xl rounded-xl border border-line bg-surface-muted/50 px-4 py-3 text-[12.5px] leading-relaxed text-ink-600">{SECOES.find((x) => x.id === secao).fixa}</p>
                {AREAS_OCULTAVEIS.includes(secao) && <ToggleArea id={secao} nome={SECOES.find((x) => x.id === secao).nome} />}
              </div>
            )}

            {secao === "ferramentas" && (
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Ferramentas</h3>
                <ToggleArea id="ferramentas" nome="Ferramentas" />
                <p className="mt-1 text-[12.5px] text-ink-400">Os módulos da área Ferramentas do site. Marque os que o cliente {ehGrupo ? "do grupo" : "da empresa"} vê. Os que são só de algumas empresas (como o DRE Gerencial do Gestão Click) só aparecem aqui para elas.</p>
                {!configurado && <p className="mt-3 rounded-lg bg-warning-500/10 px-3 py-2 text-[12px] text-warning-800">Ainda sem lista: hoje valem as fichas de cada pessoa. Ao salvar, esta lista passa a valer para todos {ehGrupo ? "do grupo" : "da empresa"}.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setModulos(new Set(aplicaveis.map((m) => m.id)))} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Marcar todos</button>
                  <button type="button" onClick={() => setModulos(new Set())} className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-muted">Desmarcar todos</button>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {aplicaveis.map((modulo) => (
                    <div key={modulo.id} className="rounded-xl border border-line p-2">
                      <Caixa forte marcado={modulos.has(modulo.id)} onChange={(v) => setModulos((atual) => { const novo = new Set(atual); if (v) novo.add(modulo.id); else novo.delete(modulo.id); return novo; })}>{modulo.nome}</Caixa>
                      <p className="ml-[38px] pb-1 text-[11.5px] text-ink-400">{modulo.descricao}</p>
                      {modulo.id === "entradas-saidas" && BLOCOS_ENTRADAS_SAIDAS.map((b) => (
                        <Caixa key={b.id} recuo={1} marcado={visiveis.has(b.id)} disabled={!modulos.has("entradas-saidas")} onChange={(v) => marcarVisivel(b.id, v)}>{b.nome}</Caixa>
                      ))}
                    </div>
                  ))}
                </div>
                {aplicaveis.some((m) => m.id === "entradas-saidas") && <p className="mt-2 text-[11.5px] text-ink-400">Em Entradas x Saídas, a tabela de acumuladores é sempre só da equipe.</p>}
              </div>
            )}
          </div>

          {secao !== "pessoas" && (
            <PreviaCliente secao={secao} nomeAlvo={item.name} abasVistas={abasVistas} ferramentasVistas={ferramentasVistas} ferramentasPelaFicha={modulosLivre} veBi={veBi} nomeWidget={nomeWidget} semConfiguracao={biLivre || modulosLivre} textoFixa={SECOES.find((x) => x.id === secao)?.fixa || null} areasOcultas={areasOcultas} rotuloPerfil={perfilAtivo ? perfis.find((p) => p.id === perfilAtivo)?.nome : null} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">Cancelar</button>
          <button type="button" onClick={salvar} className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600">Salvar alterações</button>
        </div>
      </div>
    </div>
  );
}
