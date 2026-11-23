import { useEffect, useMemo, useState } from "react";
import { listAccessGrants, listAccessPeople } from "../lib/access.js";
import { pessoasDoAlvo, pessoasParaVerComo } from "../lib/verComo.js";

// As pessoas liberadas pra empresa/grupo aberto agora (o "Ver como" e a tela em branco quando ninguém tem acesso). As concessões são lidas uma vez por sessão; `ativo` = só
// busca quando alguém precisa (o login de visualização e a equipe no portal).
let guardado = null;

export function usePessoasDoAlvo(state, ativo) {
  const [dados, setDados] = useState(guardado);
  useEffect(() => {
    if (!ativo || dados) return;
    Promise.all([listAccessGrants(), listAccessPeople()])
      .then(([grants, fichas]) => {
        guardado = { grants, fichas };
        setDados(guardado);
      })
      .catch(() => setDados({ grants: [], fichas: new Map(), erro: true }));
  }, [ativo, dados]);

  const pessoas = useMemo(() => (dados ? pessoasParaVerComo({ ...dados, companies: state.companies, groups: state.groups }) : []), [dados, state.companies, state.groups]);
  const doAlvo = useMemo(() => pessoasDoAlvo(pessoas, { companyId: state.activeCompanyId, groupId: state.activeGroupId, groups: state.groups }), [pessoas, state.activeCompanyId, state.activeGroupId, state.groups]);
  return { carregado: Boolean(dados) && !dados.erro, erro: Boolean(dados?.erro), pessoas, doAlvo };
}
