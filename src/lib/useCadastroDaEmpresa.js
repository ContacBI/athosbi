import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/useStore.js";
import { cnpjDigits, formatCnpj, lookupCnpj } from "./cnpj.js";
import { DEFAULT_NATURE_RULES, NATURE_ORDER, formatPrefixList, parsePrefixList } from "./accountNature.js";
import { createPlanoPadrao } from "./planosPadrao.js";
import { listAdmins, listColaboradores } from "./colaboradores.js";
import { INDICATOR_GOALS, cleanGoals } from "./metas.js";
import { carregarEmpresasDominio, conferirComDominio, jaCadastradas, sugerirEmpresas } from "./dominioEmpresas.js";

/**
 * Toda a lógica do cadastro/edição de empresa (campos, validações, busca de CNPJ, responsáveis, plano de contas, faixas de natureza, metas), separada da tela: o modal
 * do portal (CompanyModal) e o editor do console (equipe/EditorEmpresa) usam o mesmo hook e só mudam o visual.
 *
 * `dominio: true` liga a parte da Domínio (só o console): carrega a lista de empresas da Domínio (tabela dominio_empresas, só equipe lê), sugere enquanto digita o
 * código, preenche nome/CNPJ/cidade ao escolher e avisa de código/CNPJ que não batem com a Domínio ou que já estão cadastrados.
 */
export function useCadastroDaEmpresa(company = null, { dominio = false } = {}) {
  const state = useAppState();
  const isEditing = Boolean(company);
  const [codigo, setCodigo] = useState(company?.codigo || "");
  const [cnpj, setCnpj] = useState(company?.cnpj || "");
  const [name, setName] = useState(company?.name || "");
  const [atividade, setAtividade] = useState(company?.atividade || "");
  const [municipio, setMunicipio] = useState(company?.municipio || "");
  const [uf, setUf] = useState(company?.uf || "");
  const [representanteIds, setRepresentanteIds] = useState(company?.representanteIds || []);
  const [planoPadraoId, setPlanoPadraoId] = useState(company?.planoPadraoId || "");
  // Modelo de DFC: "padrao" = Modelo 1 (recomendado); "instituto" = Modelo 2 (estrutura e contas da Domínio).
  const [dfcModelo, setDfcModelo] = useState(company?.dfcModelo === "instituto" ? "instituto" : "padrao");
  const [novoPlanoOpen, setNovoPlanoOpen] = useState(false);
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [lookupState, setLookupState] = useState(company?.atividade ? "done" : "idle");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("dados");
  // Metas dos indicadores (lib/metas.js): o texto digitado; vazio = padrão.
  const [metas, setMetas] = useState(() =>
    Object.fromEntries(INDICATOR_GOALS.map((goal) => [goal.id, company?.metasIndicadores?.[goal.id] != null ? String(company.metasIndicadores[goal.id]).replace(".", ",") : ""]))
  );
  const [natureText, setNatureText] = useState(() => {
    const rules = company?.natureRules || DEFAULT_NATURE_RULES;
    return Object.fromEntries(NATURE_ORDER.map((nature) => [nature, formatPrefixList(rules[nature])]));
  });
  // Empresa nova já vem com quem está criando pré-marcado — sem isso a pessoa ficaria trancada pra fora da própria empresa que acabou de cadastrar (RLS só deixa
  // editar quem já está em `responsaveis`), mas dá pra desmarcar e escolher outra gente antes de salvar.
  const [responsaveis, setResponsaveis] = useState(() => company?.responsaveis || [state.userEmail]);
  const [pessoas, setPessoas] = useState([]); // Total + Restrito, pra escolher responsável

  useEffect(() => {
    Promise.all([listAdmins(), listColaboradores()])
      .then(([admins, colaboradores]) => {
        setPessoas([
          ...admins.map((item) => ({ ...item, categoria: "Total" })),
          ...colaboradores.map((item) => ({ ...item, categoria: "Restrito" })),
        ]);
      })
      .catch((err) => console.error("Falha ao carregar colaboradores pro seletor de responsáveis:", err));
  }, []);

  // ---- Domínio (só quando `dominio: true`)
  const [listaDominio, setListaDominio] = useState(null); // null = carregando / não pedida; [] = a Central ainda não mandou
  const [erroDominio, setErroDominio] = useState("");
  useEffect(() => {
    if (!dominio) return undefined;
    let ativo = true;
    carregarEmpresasDominio()
      .then((lista) => ativo && setListaDominio(lista))
      .catch((err) => {
        console.error("Falha ao carregar a lista de empresas da Domínio:", err);
        if (ativo) {
          setListaDominio([]);
          setErroDominio("Não consegui carregar a lista da Domínio agora. Dá para preencher à mão.");
        }
      });
    return () => {
      ativo = false;
    };
  }, [dominio]);
  const [buscaDominio, setBuscaDominio] = useState("");
  const sugestoes = useMemo(() => (dominio ? sugerirEmpresas(listaDominio, buscaDominio) : []), [dominio, listaDominio, buscaDominio]);
  const conferencia = useMemo(() => (dominio ? conferirComDominio(listaDominio, { codigo, cnpj }) : { tipo: "vazio" }), [dominio, listaDominio, codigo, cnpj]);
  const duplicadas = useMemo(() => (dominio ? jaCadastradas(state.companies, { codigo, cnpj, idAtual: company?.id }) : []), [dominio, state.companies, codigo, cnpj, company?.id]);

  // Busca o resto no cadastro público do CNPJ (atividade, cidade, UF). `manterNome`: veio da Domínio — o nome da Domínio vale mais que o da Receita.
  async function buscarPeloCnpj(formatted, { manterNome = false } = {}) {
    if (cnpjDigits(formatted).length !== 14) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      const data = await lookupCnpj(formatted);
      if (!manterNome) setName(data.name);
      setAtividade(data.atividade);
      setMunicipio(data.municipio);
      setUf(data.uf);
      setLookupState("done");
    } catch {
      setLookupState("error");
      setError("Não encontrei esse CNPJ. Preencha o nome manualmente.");
    }
  }

  function handleCnpjChange(event) {
    const formatted = formatCnpj(event.target.value);
    setCnpj(formatted);
    setError("");
    return buscarPeloCnpj(formatted);
  }

  /** Escolheu uma empresa da lista da Domínio: preenche código, nome e CNPJ (e a cidade/UF da Domínio); o CNPJ completa a atividade. */
  function escolherDaDominio(empresa) {
    setError("");
    setCodigo(empresa.codigo);
    setName(empresa.nome);
    setBuscaDominio("");
    if (empresa.cidade) setMunicipio(empresa.cidade);
    if (empresa.uf) setUf(empresa.uf);
    if (empresa.cnpj) {
      const formatted = formatCnpj(empresa.cnpj);
      setCnpj(formatted);
      void buscarPeloCnpj(formatted, { manterNome: true });
    } else {
      setCnpj("");
      setLookupState("idle");
    }
  }

  function toggleRepresentante(id) {
    setRepresentanteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function toggleResponsavel(email) {
    setResponsaveis((current) => (current.includes(email) ? current.filter((item) => item !== email) : current.concat(email)));
  }

  function handleCreatePlano() {
    const created = createPlanoPadrao(novoPlanoNome);
    if (!created) return;
    setPlanoPadraoId(created.id);
    setNovoPlanoNome("");
    setNovoPlanoOpen(false);
  }

  /** Valida e devolve os campos pra salvar; em erro, mostra a mensagem, leva pra aba certa e devolve null. */
  function validarEMontar() {
    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      setTab("dados");
      return null;
    }
    // Só obrigatório pra empresa NOVA — as já existentes ainda não têm plano padrão nenhum (ver lib/companies.js createCompany/updateCompany) e isso não pode travar
    // quem só quer editar outro campo delas.
    if (!isEditing && !planoPadraoId) {
      setError("Escolha um plano de contas pra essa empresa.");
      setTab("dados");
      return null;
    }
    // Sem pelo menos um responsável, ninguém Restrito jamais conseguiria editar essa empresa (ver is_responsavel em supabase/schema.sql) — sempre obrigatório,
    // criando ou editando. O campo também mora em Parâmetros → Responsáveis (ResponsaveisAdmin.jsx), mas editar aqui direto é mais rápido no dia a dia.
    if (!responsaveis.length) {
      setError("Marque pelo menos um responsável pela empresa.");
      setTab("dados");
      return null;
    }
    const natureRules = Object.fromEntries(NATURE_ORDER.map((nature) => [nature, parsePrefixList(natureText[nature])]));
    return { codigo, cnpj, name, atividade, municipio, uf, representanteIds, natureRules, planoPadraoId: planoPadraoId || null, responsaveis, dfcModelo, metasIndicadores: cleanGoals(metas) };
  }

  /** Handler pronto pro <form onSubmit>: `onSubmit={cadastro.handleSubmit(onSubmit)}`. */
  const handleSubmit = (onSubmit) => (event) => {
    event?.preventDefault?.();
    const campos = validarEMontar();
    if (campos) onSubmit(campos);
  };

  const socios = state.representantes.filter((representante) => representante.tipo !== "contador");
  const contadores = state.representantes.filter((representante) => representante.tipo === "contador");
  const planoOptions = state.planosPadrao.map((plano) => ({ value: plano.id, label: plano.nome }));

  return {
    isEditing, codigo, setCodigo, cnpj, name, setName, atividade, municipio, uf, representanteIds, planoPadraoId, setPlanoPadraoId, dfcModelo, setDfcModelo,
    novoPlanoOpen, setNovoPlanoOpen, novoPlanoNome, setNovoPlanoNome, lookupState, error, setError, tab, setTab, metas, setMetas, natureText, setNatureText,
    responsaveis, pessoas, socios, contadores, planoOptions,
    handleCnpjChange, toggleRepresentante, toggleResponsavel, handleCreatePlano, validarEMontar, handleSubmit,
    // Domínio
    listaDominio, erroDominio, buscaDominio, setBuscaDominio, sugestoes, conferencia, duplicadas, escolherDaDominio,
  };
}
