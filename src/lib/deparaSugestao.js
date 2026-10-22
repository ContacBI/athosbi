import { accountNature, planoNature } from "./accountNature.js";

// Sugestão automática de De/Para: para cada conta do balancete sem vínculo,
// a linha gerencial mais provável, com o grau de confiança e o motivo.
// As regras e réguas vêm de uma conferência feita na carteira real
// (out/2026, 21 empresas, 4.886 vínculos — escondendo o vínculo de cada
// conta e vendo se a regra acertava):
//  - mesma conta/nome nesta empresa: praticamente sempre certo;
//  - Balanço: contas irmãs (mesma conta-pai) todas no mesmo destino → 99%;
//    maioria de 60% com 3 ou mais irmãs → 96% na carteira, mas numa empresa
//    com irmãs divididas entre duas linhas parecidas o acerto cai para perto
//    da fatia da maioria. No resultado (DRE) as irmãs quase nunca vão pro
//    mesmo lugar — regra só vale com todas iguais;
//  - mesmo nome em outra empresa da carteira: 2+ empresas concordando → 95%,
//    uma empresa só → 91%, votos divididos → ~55%;
//  - nome parecido (palavras em comum) → 60–75%: sempre para revisar.
// Cada aceite vira vínculo, e os vínculos de todas as empresas alimentam a
// próxima sugestão — o app "aprende" com o uso.

const STOP = new Set(["das", "dos", "com", "para", "sobre", "outras", "outros", "outra", "outro", "ltda", "conta", "contas", "epp"]);

export function normName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(name) {
  return new Set(
    normName(name)
      .split(" ")
      .filter((token) => token.length >= 3 && !STOP.has(token))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((token) => {
    if (b.has(token)) shared += 1;
  });
  return shared / (a.size + b.size - shared);
}

const parentOf = (classificacao) => String(classificacao || "").replace(/\.[^.]+$/, "");
const groupOf = (classificacao) => String(classificacao || "").split(".")[0];
const subgroupOf = (classificacao) => String(classificacao || "").split(".").slice(0, 2).join(".");

export const CONFIDENCE_LABELS = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const CONFIDENCE_STYLE = {
  alta: "bg-success-50 text-success-600",
  media: "bg-warning-50 text-warning-700",
  baixa: "bg-surface-muted text-ink-500",
};
const RANK = { alta: 3, media: 2, baixa: 1 };

// Destino mais votado: { code, votes, total, share }.
function topVote(counter) {
  let best = null;
  let total = 0;
  counter.forEach((votes, code) => {
    total += votes;
    if (!best || votes > best.votes || (votes === best.votes && code < best.code)) best = { code, votes };
  });
  return best ? { ...best, total, share: best.votes / total } : null;
}

// Outras empresas só votam com linhas do plano global ou do mesmo plano
// padrão: as contas extras de planos padrão diferentes podem ter o mesmo
// código com significado diferente.
//
// currentAccounts: classificações do balancete atual. Os vínculos das contas
// de agora mostram o critério de agora; contas que só existiam em anos
// anteriores podem ter ficado com um critério antigo — por isso, havendo
// irmãs atuais vinculadas, o voto das irmãs usa só elas.
export function suggestDepara({ accounts = [], mappings = [], otherCompanies = [], plano = [], natureRules, planoPadraoId = null, globalCodes = null, currentAccounts = null } = {}) {
  const planByCode = new Map(plano.filter((row) => row.aceita_depara === "sim").map((row) => [row.codigo_gerencial, row]));
  const mapped = new Set(mappings.map((row) => row.classificacao));
  const pending = accounts.filter((account) => account.tipo_sintetica === "nao" && !mapped.has(account.classificacao));

  // Índices desta empresa.
  const ownByCodeName = new Map();
  const ownByName = new Map();
  const ownByParent = new Map();
  const ownByParentNow = new Map();
  // Banco de nomes das outras empresas para a busca por palavras: um item
  // por (grupo, nome, destino), com as empresas que usam; índice palavra →
  // itens.
  const fuzzyItems = new Map();
  const addFuzzy = (row, company) => {
    const key = `${groupOf(row.classificacao)}|${normName(row.nome_conta)}|${row.codigo_gerencial}`;
    if (!fuzzyItems.has(key)) fuzzyItems.set(key, { tokens: tokens(row.nome_conta), group: groupOf(row.classificacao), code: row.codigo_gerencial, name: row.nome_conta, companies: new Set() });
    fuzzyItems.get(key).companies.add(company);
  };
  mappings.forEach((row) => {
    if (!row.codigo_gerencial) return;
    const key = `${String(row.codigo_conta ?? "").trim()}|${normName(row.nome_conta)}`;
    if (String(row.codigo_conta ?? "").trim()) ownByCodeName.set(key, row);
    const nameKey = `${subgroupOf(row.classificacao)}|${normName(row.nome_conta)}`;
    if (!ownByName.has(nameKey)) ownByName.set(nameKey, row);
    const parent = parentOf(row.classificacao);
    if (!ownByParent.has(parent)) ownByParent.set(parent, []);
    ownByParent.get(parent).push(row);
    if (currentAccounts?.has(row.classificacao)) {
      if (!ownByParentNow.has(parent)) ownByParentNow.set(parent, []);
      ownByParentNow.get(parent).push(row);
    }
  });

  // Outras empresas da carteira: mesmo nome (no mesmo grupo) → votos por
  // empresa, e o banco de nomes para a busca por palavras.
  const othersByName = new Map();
  otherCompanies.forEach((company) => {
    const samePlan = (company.planoPadraoId || null) === (planoPadraoId || null);
    (company.mappings || []).forEach((row) => {
      if (!row.codigo_gerencial) return;
      if (!samePlan && globalCodes && !globalCodes.has(row.codigo_gerencial)) return;
      const name = normName(row.nome_conta);
      if (name) {
        const key = `${groupOf(row.classificacao)}|${name}`;
        if (!othersByName.has(key)) othersByName.set(key, new Map());
        const byCode = othersByName.get(key);
        if (!byCode.has(row.codigo_gerencial)) byCode.set(row.codigo_gerencial, new Set());
        byCode.get(row.codigo_gerencial).add(company.id);
      }
      addFuzzy(row, company.name || company.id);
    });
  });
  const byToken = new Map();
  fuzzyItems.forEach((item) => {
    item.tokens.forEach((token) => {
      if (!byToken.has(token)) byToken.set(token, []);
      byToken.get(token).push(item);
    });
  });
  const planTokens = [...planByCode.values()].map((row) => ({ row, tokens: tokens(row.nome) }));

  const suggestions = pending.map((account) => {
    const nature = accountNature(account.classificacao, natureRules);
    const valid = (code) => {
      const row = planByCode.get(code);
      if (!row) return null;
      const target = planoNature(row);
      return !nature || !target || target === nature ? row : null;
    };
    const make = (code, confidence, reason) => {
      const row = valid(code);
      return row ? { row, confidence, reason } : null;
    };
    const name = normName(account.nome_conta);
    const patrimonial = ["1", "2"].includes(groupOf(account.classificacao));
    let found = null;

    // Contas irmãs (mesma conta-pai) já vinculadas nesta empresa.
    const siblingsNow = ownByParentNow.get(parentOf(account.classificacao)) || [];
    const siblings = siblingsNow.length >= 2 ? siblingsNow : ownByParent.get(parentOf(account.classificacao)) || [];
    const siblingVote = topVote(siblings.reduce((counter, row) => counter.set(row.codigo_gerencial, (counter.get(row.codigo_gerencial) || 0) + 1), new Map()));
    const siblingsAgree = siblingVote && siblingVote.total >= 2 && siblingVote.share === 1;
    const siblingsStrong = siblingVote && patrimonial && (siblingsAgree || (siblingVote.total >= 3 && siblingVote.share >= 0.6));
    // Um vínculo antigo que destoa da maioria das irmãs (ex.: a mesma conta
    // com o número do ano passado, vinculada a outra linha — ou um cliente
    // em "PIS a recuperar") costuma ser engano ou critério antigo: as irmãs
    // de agora valem mais.
    const fightsSiblings = (code) => siblingsStrong && siblingVote.total >= 3 && siblingVote.code !== code;

    // 1. A mesma conta (código reduzido e nome) já vinculada com outro número.
    const sameAccount = ownByCodeName.get(`${String(account.codigo ?? "").trim()}|${name}`);
    if (sameAccount && !fightsSiblings(sameAccount.codigo_gerencial)) found = make(sameAccount.codigo_gerencial, "alta", `a mesma conta já está vinculada com outro número (${sameAccount.classificacao})`);

    // 2. Conta com o mesmo nome nesta empresa, no mesmo subgrupo — a não
    // ser que destoe das irmãs.
    if (!found && name) {
      const sameName = ownByName.get(`${subgroupOf(account.classificacao)}|${name}`);
      const odd = sameName && siblings.length >= 3 && siblings.filter((row) => row.codigo_gerencial === sameName.codigo_gerencial).length / siblings.length < 0.2;
      if (sameName && !odd && !fightsSiblings(sameName.codigo_gerencial)) found = make(sameName.codigo_gerencial, "alta", `conta com o mesmo nome nesta empresa (${sameName.classificacao})`);
    }

    // 3. Balanço: as irmãs concordam (todas, ou 60% com 3 ou mais). Com
    // irmãs divididas o acerto fica perto da fatia da maioria: abaixo de 80%
    // é confiança média.
    if (!found && siblingsStrong) {
      const confidence = siblingsAgree || siblingVote.share >= 0.8 ? "alta" : "media";
      found = make(siblingVote.code, confidence, siblingsAgree ? `as ${siblingVote.total} contas irmãs estão todas nessa linha` : `${siblingVote.votes} de ${siblingVote.total} contas irmãs estão nessa linha`);
    }

    // 4. Mesmo nome em outras empresas da carteira.
    if (!found && name) {
      const byCode = othersByName.get(`${groupOf(account.classificacao)}|${name}`);
      if (byCode) {
        const vote = topVote(new Map([...byCode].map(([code, companies]) => [code, companies.size])));
        if (vote) {
          const confidence = vote.share === 1 ? "alta" : vote.share >= 0.6 ? "media" : "baixa";
          const who = vote.total === 1 ? "1 outra empresa da carteira" : `${vote.votes} de ${vote.total} empresas da carteira`;
          found = make(vote.code, confidence, `conta com o mesmo nome: ${who} ${vote.votes === 1 ? "usa" : "usam"} essa linha`);
        }
      }
    }

    // 5. Resultado com todas as irmãs no mesmo lugar (raro, mas certeiro).
    if (!found && siblingsAgree && !patrimonial) found = make(siblingVote.code, "media", `as ${siblingVote.total} contas irmãs estão todas nessa linha`);

    // 6. Nome parecido (palavras em comum) com uma conta de outra empresa da
    // carteira, ou com o nome da própria linha do plano gerencial — fica com
    // o mais parecido. (Nome parecido dentro desta empresa não entra: aqui as
    // contas de nome parecido costumam ser justamente as que vão para linhas
    // diferentes, como "Banco X conta movimento" e "Banco X aplicação".)
    if (!found) {
      const mine = tokens(account.nome_conta);
      const group = groupOf(account.classificacao);
      const seen = new Set();
      let best = null;
      mine.forEach((token) => {
        (byToken.get(token) || []).forEach((item) => {
          if (seen.has(item)) return;
          seen.add(item);
          if (item.group !== group || !valid(item.code)) return;
          const score = jaccard(mine, item.tokens);
          const weight = item.companies.size;
          if (!best || score > best.score || (score === best.score && weight > best.weight)) best = { item, score, weight };
        });
      });
      let bestPlan = null;
      planTokens.forEach((entry) => {
        if (!valid(entry.row.codigo_gerencial)) return;
        const score = jaccard(mine, entry.tokens);
        if (score > (bestPlan?.score || 0)) bestPlan = { ...entry, score };
      });
      if (bestPlan && bestPlan.score >= 0.5 && bestPlan.score >= (best?.score || 0)) {
        found = { row: bestPlan.row, confidence: "baixa", reason: "nome parecido com o da linha do plano gerencial" };
      } else if (best && best.score >= 0.34) {
        const { item } = best;
        const where = item.companies.size === 1 ? [...item.companies][0] : `${item.companies.size} empresas da carteira`;
        found = make(item.code, best.score >= 0.5 ? "media" : "baixa", `nome parecido com “${item.name}” (${where})`);
      }
    }

    return found ? { account, nature, ...found } : { account, nature, row: null, confidence: null, reason: "" };
  });

  const counts = { alta: 0, media: 0, baixa: 0, sem: 0 };
  suggestions.forEach((item) => {
    counts[item.confidence || "sem"] += 1;
  });
  return { pending, suggestions, counts };
}

// O vínculo pronto para gravar a partir de uma sugestão aceita.
export function mappingFromSuggestion(item) {
  const { account, row, confidence, reason } = item;
  return {
    codigo_conta: account.codigo,
    classificacao: account.classificacao,
    nome_conta: account.nome_conta,
    tipo_conta: "",
    codigo_gerencial: row.codigo_gerencial,
    categoria_gerencial: row.nome,
    demonstrativo: row.demonstrativo,
    grupo_macro: row.grupo_macro,
    observacao: `Sugerido (${CONFIDENCE_LABELS[confidence]}): ${reason}`,
  };
}

export function confidenceRank(confidence) {
  return RANK[confidence] || 0;
}
