import { configDaPessoa, configHerdada } from "./visibilidade.js";

// O que o Início do hub mostra depende do que a pessoa TEM (pedido do Izaias, 23/11/2026): quem não tem B.I. não vê os blocos do B.I.; quem não tem acesso a nada vê só o
// básico. Regra pura: recebe as empresas/grupos que a pessoa enxerga e devolve quais áreas valem pra ela.
//
// Uma área vale se pelo menos UMA das empresas/grupos dela a deixa à mostra (cada empresa/grupo esconde o que quiser em `visibilidade.areasOcultas`, e cada pessoa pode ter
// um tipo de acesso próprio — `configDaPessoa`). O B.I. também some quando a empresa marcou só itens de fora dele; as Ferramentas somem quando nenhum módulo está liberado.
const AREAS = ["bi", "reforma", "servicos", "conteudos", "ferramentas"];

export function areasDoAcesso({ companies = [], groups = [], email = "", tudo = false, modulosFicha = [] } = {}) {
  const todas = Object.fromEntries(AREAS.map((area) => [area, true]));
  const temEmpresas = companies.length > 0 || groups.length > 0;
  if (tudo) return { ...todas, temAcesso: true, qtdEmpresas: companies.length, qtdGrupos: groups.length };

  const configs = [...groups.map((group) => group.visibilidade || null), ...companies.map((company) => configHerdada(company, groups)?.visibilidade || company.visibilidade || null)].map((visibilidade) => configDaPessoa(visibilidade, email));
  const valem = {};
  for (const area of AREAS) {
    valem[area] = configs.some((config) => {
      if ((config?.areasOcultas || []).includes(area)) return false;
      if (area === "bi" && config?.modo === "marcados") return (config.visiveis || []).some((chave) => String(chave).startsWith("bi:"));
      if (area === "ferramentas") return Array.isArray(config?.modulos) ? config.modulos.length > 0 : modulosFicha.length > 0;
      return true;
    });
  }
  // Sem nenhuma empresa/grupo liberado não há nada além do Início (pedido do Izaias, 23/11/2026): nem B.I., nem Ferramentas, nem as áreas de informação.
  if (!temEmpresas) {
    for (const area of AREAS) valem[area] = false;
  }
  return { ...valem, temAcesso: temEmpresas, qtdEmpresas: companies.length, qtdGrupos: groups.length };
}
