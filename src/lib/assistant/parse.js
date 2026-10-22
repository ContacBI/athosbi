import {
  AUDIENCES,
  EMPHASIS,
  EXCLUDE_BEFORE,
  GOAL_METRICS,
  MONTHS,
  NUMBER_WORDS,
  OCCASIONS,
  SIZE_LARGE,
  SIZE_SMALL,
  TONES,
  TOPICS,
  TOPIC_BY_ID,
  norm,
} from "./vocab.js";

// Lê o pedido escrito (ou ditado) e devolve o que entendeu: período,
// público, ocasião, tom, tamanho, assuntos (com ênfase e exclusões), linhas
// do plano e contas citadas, metas, comparação e título. Tolera erro de
// digitação: cada palavra do vocabulário casa com a escrita exata ou com
// uma "parecida" (uma letra trocada, faltando, sobrando ou invertida; duas
// nas palavras longas) — e o que foi corrigido volta em `corrections`, pra
// tela mostrar "entendi faturamento".

// ---------------------------------------------------------------------------
// Palavras e semelhança

// Palavras comuns que NUNCA viram outra por semelhança ("baixa" não é
// "caixa", "meia" não é "meta", "custa" não é "custo"…).
const COMMON = new Set(
  (
    "a o e de da do das dos em no na nos nas um uma para pra pro por com sem que se mais menos muito pouco bem mal como quando onde qual quais " +
    "baixa baixo alta alto meia mesa mata seta custa custam ativa altiva caso casa cada base peso preso parte partes ponto pontos foram fora " +
    "seria serie series tudo todo toda todos todas isso isto esse essa este esta aquele aquela ele ela eles elas nos voce voces ser estar ter " +
    "fazer faz feito feita quero queria precisa preciso gostaria gosto mostrar mostra mostre ver veja colocar coloca coloque incluir inclua " +
    "apresentacao apresentacoes slide slides pagina paginas tela telas empresa empresas periodo periodos mes meses ano anos dia dias semana " +
    "nao sim tambem ja ainda depois antes agora hoje ontem amanha sobre entre ate desde pelo pela pelos pelas seu sua seus suas meu minha " +
    "nosso nossa vamos vai vou foi era sera tem tinha teve haver houve forma jeito tipo coisa coisas algo alguma algum bom boa ruim melhor pior " +
    "geral gerais final finais inicial iniciais novo nova velho velha grande grandes pequeno pequena maior menor maiores menores primeiro " +
    "segundo terceiro quarto ultimo ultimos ultima ultimas proximo proxima atual passado passada anterior seguinte"
  ).split(" ")
);

function osa(a, b, max) {
  // Distância de edição com transposição (Damerau "OSA"), parando cedo.
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prev2[j - 2] + 1);
      cur[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

const similarCache = new Map();

// 0 = igual, 0.5 = flexão (plural), 1 = parecida (erro de digitação),
// -1 = diferente. Palavra comum ou curta só vale igual.
export function wordMatch(typed, word) {
  if (typed === word) return 0;
  const key = `${typed}|${word}`;
  if (similarCache.has(key)) return similarCache.get(key);
  let result = -1;
  if (COMMON.has(typed) || typed.length < 4 || word.length < 4) result = -1;
  else if (typed === `${word}s` || word === `${typed}s` || typed === `${word}es` || word === `${typed}es`) result = 0.5;
  else if (typed[0] === word[0] && !/\d/.test(typed + word)) {
    const len = word.length;
    const max = len >= 9 ? 2 : len >= 5 ? 1 : 0;
    if (max > 0 && osa(typed, word, max) <= max) result = 1;
  }
  similarCache.set(key, result);
  return result;
}

// Texto → palavras com a posição de cada uma no texto normalizado.
function tokenize(text) {
  const tokens = [];
  const re = /[a-z0-9&]+/g;
  let m;
  while ((m = re.exec(text))) tokens.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return tokens;
}

function phraseTokens(phrase) {
  return phrase.split(/[^a-z0-9&]+/).filter(Boolean);
}

// Acha cada frase do vocabulário no texto (palavra por palavra, tolerando
// erro de digitação em cada uma). Devolve {phrase, start, end, fuzzy, typed}.
function findPhrases(tokens, text, phrases) {
  const hits = [];
  phrases.forEach((phrase) => {
    const parts = phraseTokens(phrase);
    if (!parts.length) return;
    for (let i = 0; i + parts.length <= tokens.length; i += 1) {
      let fuzzy = false;
      let ok = true;
      for (let k = 0; k < parts.length; k += 1) {
        const r = wordMatch(tokens[i + k].w, parts[k]);
        if (r < 0) {
          ok = false;
          break;
        }
        if (r === 1) fuzzy = true;
      }
      if (!ok) continue;
      const start = tokens[i].start;
      const end = tokens[i + parts.length - 1].end;
      hits.push({ phrase, start, end, fuzzy, typed: text.slice(start, end), tokenIndex: i, size: parts.length });
    }
  });
  // Onde a escrita bate exatamente com alguma expressão, as "parecidas" no
  // mesmo trecho saem ("lucro" não vira "lucrou").
  return hits.filter((hit) => !hit.fuzzy || !hits.some((other) => !other.fuzzy && other.start === hit.start && other.end === hit.end));
}

// ---------------------------------------------------------------------------
// Período

function ymd(year, month, last = false) {
  const day = last ? new Date(year, month, 0).getDate() : 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

const MONTH_NAMES_FULL = MONTHS.map(([full]) => full);
const MONTH_ABBR = MONTHS.map(([, abbr]) => abbr);

// Palavras a uma letra de um mês que NÃO são o mês ("abrir" ≠ abril,
// "marca" ≠ março, "junto" ≠ junho, "maior" ≠ maio).
const NOT_MONTHS = new Set(["abrir", "abriu", "abrira", "abriram", "abram", "marca", "marcas", "marcar", "marcou", "marcos", "junto", "juntos", "junta", "juntas", "julgo", "julga", "maior", "maiores", "maios", "mairo", "agostos"]);

function monthIndexOf(token) {
  // Nome completo (tolerando erro) ou abreviação exata.
  if (NOT_MONTHS.has(token)) return null;
  for (let i = 0; i < 12; i += 1) {
    const r = token.length >= 4 ? wordMatch(token, MONTH_NAMES_FULL[i]) : -1;
    if (r === 0 || r === 1) return { index: i + 1, full: true, fuzzy: r === 1 };
  }
  const abbr = MONTH_ABBR.indexOf(token);
  if (abbr >= 0) return { index: abbr + 1, full: false, fuzzy: false };
  return null;
}

const ORDINALS = { primeiro: 1, "1o": 1, "1": 1, segundo: 2, "2o": 2, "2": 2, terceiro: 3, "3o": 3, "3": 3, quarto: 4, "4o": 4, "4": 4 };

function parsePeriod(text, tokens, ctx) {
  const months = ctx.months || [];
  if (!months.length) return null;
  const lastData = months[months.length - 1];
  const firstData = months[0];
  // "Mês passado"/"últimos 3 meses" contam do último mês FECHADO: se o
  // último mês com lançamentos é o mês corrente (ainda aberto), volta um.
  const today = ctx.today ? new Date(ctx.today) : new Date();
  const currentMonth = monthKey(today.getFullYear(), today.getMonth() + 1);
  const lastClosed = lastData >= currentMonth && months.length > 1 ? months[months.length - 2] : lastData;
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const defaultYear = years.length ? years[years.length - 1] : Number(lastData.slice(0, 4));
  const corrections = [];

  const clamp = (startKey, endKey, label, note) => {
    let s = startKey < firstData ? firstData : startKey;
    let e = endKey > lastData ? lastData : endKey;
    if (s > e) return { error: `Não há lançamentos em ${label.toLowerCase()} — mantive o período atual.` };
    const [sy, sm] = s.split("-").map(Number);
    const [ey, em] = e.split("-").map(Number);
    const clipped = s !== startKey || e !== endKey;
    return { start: ymd(sy, sm), end: ymd(ey, em, true), note: clipped ? `Ajustei aos meses com lançamentos (${note || label}).` : note || "" };
  };

  // 1) "últimos N meses", "último mês", "mês passado"
  const lastN = text.match(/\bultimos?\s+(\d{1,2}|[a-z]+)\s+meses\b/);
  if (lastN) {
    const n = Number(lastN[1]) || NUMBER_WORDS[lastN[1]] || 0;
    if (n > 0) return { ...clamp(addMonths(lastClosed, -(n - 1)), lastClosed, `Últimos ${n} meses`), corrections };
  }
  if (/\b(mes atual|este mes|esse mes|mes corrente|neste mes|nesse mes)\b/.test(text)) return { ...clamp(lastData, lastData, "Mês atual"), corrections };
  if (/\b(ultimo mes|mes passado|mes anterior|mes fechado|ultimo fechamento)\b/.test(text) && !/\b(comparar|comparando|versus|vs|contra|em relacao)\b/.test(text)) return { ...clamp(lastClosed, lastClosed, "Último mês fechado"), corrections };
  const firstN = text.match(/\bprimeiros?\s+(\d{1,2}|[a-z]+)\s+meses\b/);
  if (firstN) {
    const n = Number(firstN[1]) || NUMBER_WORDS[firstN[1]] || 0;
    if (n > 0) return { ...clamp(monthKey(defaultYear, 1), monthKey(defaultYear, n), `Primeiros ${n} meses`), corrections };
  }

  // 2) Meses citados ("abril e maio", "de jan a mar", "04/2026", "abril/26").
  const found = [];
  tokens.forEach((token, i) => {
    const hit = monthIndexOf(token.w);
    if (!hit) return;
    const next = tokens[i + 1];
    const prev = tokens[i - 1];
    // "dez slides" é número, não dezembro; abreviação só vale com ano
    // grudado ou ao lado de outro mês.
    if (token.w === "dez" && next && /^(slides?|paginas?|telas?|meses|dias|anos|itens|topicos)$/.test(next.w)) return;
    let year = null;
    const after = text.slice(token.end, token.end + 8).match(/^\s*(?:\/|de\s+|-)?\s*(\d{2,4})\b/);
    if (after) year = after[1].length === 2 ? 2000 + Number(after[1]) : Number(after[1]);
    if (!hit.full && !year && !found.length) {
      const neighbor = tokens.slice(i + 1, i + 4).some((t) => monthIndexOf(t.w)) || (prev && monthIndexOf(prev.w));
      if (!neighbor) return;
    }
    if (hit.fuzzy) corrections.push({ typed: token.w, understood: MONTH_NAMES_FULL[hit.index - 1] });
    found.push({ month: hit.index, year, pos: token.start });
  });
  [...text.matchAll(/\b(0?[1-9]|1[0-2])\/(\d{4}|\d{2})\b/g)].forEach((m) => {
    found.push({ month: Number(m[1]), year: m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), pos: m.index });
  });
  if (found.length) {
    found.sort((a, b) => a.pos - b.pos);
    // Ano: o do próprio mês; senão o do mês seguinte citado; senão o padrão.
    for (let i = found.length - 1; i >= 0; i -= 1) {
      if (!found[i].year) found[i].year = found[i + 1]?.year && found[i].month <= found[i + 1].month ? found[i + 1].year : found[i + 1]?.year ? found[i + 1].year - (found[i].month > found[i + 1].month ? 1 : 0) : defaultYear;
    }
    const keys = found.map((f) => monthKey(f.year, f.month)).sort();
    let startKey = keys[0];
    let endKey = keys[keys.length - 1];
    // "desde março" (sem fim) → até o último mês; "até junho" → desde janeiro.
    if (found.length === 1 && /\b(desde|a partir de|de)\s+\S+\s*$/.test(text.slice(Math.max(0, found[0].pos - 14), found[0].pos + 1)) && /\b(desde|a partir)\b/.test(text.slice(Math.max(0, found[0].pos - 14), found[0].pos))) endKey = lastData;
    if (found.length === 1 && /\bate\s+$/.test(text.slice(Math.max(0, found[0].pos - 6), found[0].pos))) startKey = monthKey(found[0].year, 1);
    return { ...clamp(startKey, endKey, "Os meses pedidos"), corrections };
  }

  // 3) Trimestre, semestre, bimestre.
  const quarter = text.match(/\b(primeiro|segundo|terceiro|quarto|[1-4]o?)\s*(tri|trimestre)\b/) || text.match(/\b(?:t|q)([1-4])\b/) || text.match(/\b([1-4])t(?:\d{2})?\b/);
  if (quarter) {
    const q = ORDINALS[quarter[1]] || Number(quarter[1]);
    return { ...clamp(monthKey(defaultYear, (q - 1) * 3 + 1), monthKey(defaultYear, q * 3), `${q}º trimestre de ${defaultYear}`), corrections };
  }
  if (/\b(ultimo|este|esse|atual|neste|nesse)\s+trimestre\b/.test(text) || /\btrimestre (atual|passado)\b/.test(text)) {
    const [y, m] = lastClosed.split("-").map(Number);
    const q = Math.ceil(m / 3) - (/\btrimestre passado\b/.test(text) ? 1 : 0);
    const qy = q < 1 ? y - 1 : y;
    const qq = q < 1 ? 4 : q;
    return { ...clamp(monthKey(qy, (qq - 1) * 3 + 1), monthKey(qy, qq * 3), "Último trimestre"), corrections };
  }
  const semester = text.match(/\b(primeiro|segundo|[12]o?)\s*(sem|semestre)\b/) || text.match(/\bh([12])\b/);
  if (semester) {
    const s = ORDINALS[semester[1]] || Number(semester[1]);
    return { ...clamp(monthKey(defaultYear, s === 1 ? 1 : 7), monthKey(defaultYear, s === 1 ? 6 : 12), `${s}º semestre de ${defaultYear}`), corrections };
  }
  const bimester = text.match(/\b(primeiro|segundo|terceiro|quarto|quinto|sexto|[1-6]o?)\s*(bimestre)\b/);
  if (bimester) {
    const map = { quinto: 5, sexto: 6, "5o": 5, "6o": 6, 5: 5, 6: 6 };
    const b = ORDINALS[bimester[1]] || map[bimester[1]] || Number(bimester[1]);
    return { ...clamp(monthKey(defaultYear, (b - 1) * 2 + 1), monthKey(defaultYear, b * 2), `${b}º bimestre de ${defaultYear}`), corrections };
  }

  // 4) Ano.
  if (/\b(ano passado|ano anterior|exercicio anterior)\b/.test(text) && !/\b(comparar|comparativo|versus|vs|contra|frente|em relacao)\b/.test(text)) {
    const y = Number(lastData.slice(0, 4)) - 1;
    return { ...clamp(monthKey(y, 1), monthKey(y, 12), `Ano de ${y}`), corrections };
  }
  if (/\b(ano todo|ano inteiro|ano completo|no ano|acumulado|acumulado do ano|ate agora|ate o momento|ytd|desde janeiro|este ano|esse ano|ano atual|ano corrente|fechamento do ano|fechamento anual|balanco anual|resultado do ano|exercicio)\b/.test(text) || years.length) {
    const y = years.length ? defaultYear : Number(lastData.slice(0, 4));
    // Ano corrente: até o último mês fechado (o mês aberto ainda é parcial).
    const yearEnd = lastClosed.startsWith(`${y}-`) && lastClosed < lastData ? lastClosed : monthKey(y, 12);
    return { ...clamp(monthKey(y, 1), yearEnd, `Ano de ${y}`), corrections };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Números e metas

function parseAmount(raw, unit) {
  let text = String(raw).trim();
  if (/,/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  let value = Number(text);
  if (!Number.isFinite(value)) return null;
  const u = String(unit || "").trim();
  if (u === "mil" || u === "k") value *= 1e3;
  else if (/^(milhao|milhoes|mi|mm)$/.test(u)) value *= 1e6;
  else if (/^(bi|bilhao|bilhoes)$/.test(u)) value *= 1e9;
  return value;
}

function parseGoals(text) {
  const goals = [];
  const metricWords = GOAL_METRICS.flatMap((metric) => metric.words.map((word) => ({ word, metric }))).sort((a, b) => b.word.length - a.word.length);
  const re = /\bmeta(?:s)?\s+(?:de|do|da|para|pro|pra)?\s*(?:o|a)?\s*([a-z ]{3,22}?)\s*(?:de|em|=|:|para|pra|chegar a|chegando a|batendo|bater)?\s*(?:r\$\s*)?(\d[\d.,]*)\s*(milhoes|milhao|mil|mi|mm|k|bilhoes|bilhao|bi|%|por cento)?\b/g;
  let m;
  while ((m = re.exec(text))) {
    const phrase = m[1].trim();
    const found = metricWords.find(({ word }) => phrase === word || phrase.startsWith(`${word} `) || phrase.endsWith(` ${word}`) || phrase.includes(word));
    if (!found) continue;
    const isPercent = m[3] === "%" || m[3] === "por cento";
    const value = parseAmount(m[2], isPercent ? "" : m[3]);
    if (value == null) continue;
    const metric = found.metric.format === "percent" || isPercent ? GOAL_METRICS.find((g) => g.id === (found.metric.format === "percent" ? found.metric.id : "margem_liquida")) : found.metric;
    goals.push({ metricId: metric.id, widgetId: metric.widgetId, label: metric.label, format: metric.format, target: value });
  }
  return goals;
}

function parseSize(text) {
  for (const n of text.matchAll(/\b(\d{1,2}|[a-z]+(?: duzia)?)\s+(slides?|paginas?|telas?|laminas?)\b/g)) {
    const value = Number(n[1]) || NUMBER_WORDS[n[1]] || 0;
    if (value >= 2) return { target: Math.min(30, value), source: "numero" };
  }
  const has = (list) => list.some((word) => new RegExp(`\\b${word}\\b`).test(text));
  if (has(SIZE_SMALL)) return { target: 6, source: "curta" };
  if (has(SIZE_LARGE)) return { target: 15, source: "completa" };
  return null;
}

function parseTitle(original, text) {
  const m = text.match(/\b(?:titulo|chamada|nome da apresentacao|nome do arquivo|intitulada|chamar de|com o nome)\s*(?:de|:|-|=|e)?\s*["“']?([^"”'\n.;,]{3,70})/);
  if (!m) return null;
  const start = m.index + m[0].length - m[1].length;
  return original.slice(start, start + m[1].length).trim();
}

// ---------------------------------------------------------------------------
// Linhas do plano e contas citadas pelo nome ("evidenciar caixa e
// equivalentes", "abrir despesas com pessoal", "destacar o banco itaú").

function lineCandidates(catalog) {
  const topicWords = new Set(TOPICS.flatMap((topic) => topic.words).filter((w) => !w.includes(" ")));
  const topicPhrases = new Set(TOPICS.flatMap((topic) => topic.words));
  const out = [];
  (catalog.lines || []).forEach((line) => {
    const name = norm(line.name).replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
    const parts = phraseTokens(name);
    if (!parts.length) return;
    out.push({ ...line, normName: name, parts, topicWords, topicPhrases });
  });
  (catalog.accounts || []).forEach((account) => {
    const name = norm(account.name).replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
    const parts = phraseTokens(name);
    if (parts.length < 2 || name.length < 8) return;
    out.push({ ...account, kind: "account", normName: name, parts, topicWords, topicPhrases });
  });
  return out;
}

// Palavras de ligação nos nomes das linhas — não contam como "casou".
const FILLER = new Set(["e", "de", "da", "do", "das", "dos", "com", "para", "a", "o", "os", "as", "em", "na", "no", "nas", "nos", "por", "sem", "sobre", "ao", "aos", "-", "&"]);

function findLines(tokens, catalog) {
  const candidates = lineCandidates(catalog);
  const hits = [];
  candidates.forEach((cand) => {
    const { parts } = cand;
    // Quantas palavras do começo do nome precisam aparecer: o nome todo
    // quando é curto; nomes longos aceitam o começo ("caixa e equivalentes"
    // de "caixa e equivalentes de caixa"), com pelo menos 2 palavras de
    // verdade — ou 1 palavra longa que não seja de assunto ("fornecedores").
    const meaningful = parts.filter((p) => !FILLER.has(p));
    for (let i = 0; i < tokens.length; i += 1) {
      let k = 0;
      let fuzzy = false;
      while (k < parts.length && i + k < tokens.length) {
        const r = wordMatch(tokens[i + k].w, parts[k]);
        if (r < 0) break;
        if (r === 1) fuzzy = true;
        k += 1;
      }
      if (!k) continue;
      // "e", "de", "com" não contam: "caixa e" não é "caixa e fundos fixos".
      while (k > 0 && FILLER.has(parts[k - 1])) k -= 1;
      if (!k) continue;
      const hitMeaningful = parts.slice(0, k).filter((p) => !FILLER.has(p)).length;
      const typed = tokens.slice(i, i + k).map((t) => t.w).join(" ");
      // Uma palavra só (o nome inteiro ou o começo dele) vale quando é
      // longa e não é palavra de assunto: "fornecedores" não, "resultados"
      // não ("resultado de abril" é o assunto, não a linha do PL).
      const single = k === 1 && parts[0].length >= 8 && !cand.topicWords.has(parts[0]) && !cand.topicWords.has(tokens[i].w) && meaningful.length <= 3;
      const needMeaningful = Math.min(meaningful.length, meaningful.length <= 2 ? meaningful.length : Math.max(2, Math.ceil(meaningful.length / 2)));
      const enough = hitMeaningful >= 2 ? hitMeaningful >= needMeaningful : single;
      if (!enough) continue;
      // Linha de topo ("Receita bruta", "Despesas administrativas") dita
      // como assunto só vira destaque com verbo de destaque antes.
      const asTopic = cand.topicPhrases.has(typed) || cand.topicPhrases.has(cand.normName);
      if (asTopic && Number(cand.nivel || 9) <= 2 && !/\b(evidenciar|evidenciando|destacar|destacando|destaque|abrir|abrindo|detalhar|detalhando|mostrar a conta|mostrar a linha|ressaltar)\b[^.]{0,40}$/.test(tokens.slice(Math.max(0, i - 8), i).map((t) => t.w).join(" "))) continue;
      hits.push({ cand, start: tokens[i].start, end: tokens[i + k - 1].end, fuzzy, matched: k, typed });
    }
  });
  // Mais palavras casadas vence; empate → linha mais alta do plano.
  hits.sort((a, b) => b.matched - a.matched || (a.cand.nivel || 9) - (b.cand.nivel || 9) || a.start - b.start);
  const used = [];
  const chosen = [];
  hits.forEach((hit) => {
    if (used.some(([s, e]) => hit.start < e && hit.end > s)) return;
    used.push([hit.start, hit.end]);
    chosen.push(hit);
  });
  return chosen.slice(0, 8).sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------

export function parseRequest(original, catalog = {}) {
  const full = norm(original);
  const title = parseTitle(original, full);
  // O título ("título: Raio-X da Termoplex") não entra na leitura dos
  // assuntos — senão "raio-x" do título virava "visão geral".
  const text = title ? full.replace(norm(title), " ".repeat(title.length)) : full;
  const tokens = tokenize(text);
  const corrections = [];
  const warnings = [];

  // Assuntos (com exclusão e ênfase).
  const topicPhrases = TOPICS.flatMap((topic) => topic.words);
  const topicOf = new Map();
  TOPICS.forEach((topic) => topic.words.forEach((word) => topicOf.set(word, topic.id)));
  const audienceHits = findPhrases(tokens, text, AUDIENCES.flatMap((a) => a.words));
  const topicHits = findPhrases(tokens, text, topicPhrases)
    // Frase mais longa vence onde duas se sobrepõem ("margem bruta" > "margem").
    .sort((a, b) => b.size - a.size || a.start - b.start)
    .filter((hit, index, list) => !list.slice(0, index).some((other) => other.start <= hit.start && other.end >= hit.end && other.size > hit.size));
  const emphasisHits = findPhrases(tokens, text, EMPHASIS);
  const topics = new Map();
  const excluded = new Set();
  topicHits
    .sort((a, b) => a.start - b.start)
    .forEach((hit) => {
      const id = topicOf.get(hit.phrase);
      // "bancos"/"credito" dentro de "apresentação para o banco" é público.
      if (id === "caixa" && /^bancos?$/.test(hit.phrase) && /\b(para|pro|pros|ao|aos|com|levar|apresentar|mostrar)\s+(o\s+|os\s+)?$/.test(text.slice(Math.max(0, hit.start - 16), hit.start))) return;
      const before = text.slice(Math.max(0, hit.start - 40), hit.start);
      if (EXCLUDE_BEFORE.test(before) && !/\b(com|e)\s+$/.test(before.slice(-5))) {
        excluded.add(id);
        return;
      }
      if (hit.fuzzy) corrections.push({ typed: hit.typed, understood: hit.phrase });
      const sentenceStart = Math.max(text.lastIndexOf(".", hit.start), text.lastIndexOf("\n", hit.start), 0);
      const emphasis = emphasisHits.some((e) => e.start >= sentenceStart && e.start < hit.start && hit.start - e.end < 90);
      const current = topics.get(id);
      if (!current) topics.set(id, { id, label: TOPIC_BY_ID[id].label, order: hit.start, emphasis, typed: hit.typed });
      else if (emphasis) current.emphasis = true;
    });
  excluded.forEach((id) => topics.delete(id));

  // Público. "banco" sozinho só conta como público quando é "para o banco".
  let audience = null;
  const bankAudience = /\b(para|pro|pros|ao|aos|com|levar|apresentar|mostrar|reuniao com|enviar|mandar)\s+(o\s+|os\s+|a\s+)?(banco|bancos|gerente|cooperativa|sicoob|sicredi|itau|bradesco|santander)\b/.test(text);
  audienceHits
    .sort((a, b) => a.start - b.start)
    .some((hit) => {
      const found = AUDIENCES.find((a) => a.words.includes(hit.phrase));
      if (!found) return false;
      if (found.id === "banco" && /^bancos?$/.test(hit.phrase) && !bankAudience) return false;
      if (found.id === "gestao" && hit.phrase === "time" && !/\b(para|pro|com)\s+(o\s+)?time\b/.test(text)) return false;
      if (hit.fuzzy) corrections.push({ typed: hit.typed, understood: hit.phrase });
      audience = { id: found.id, label: found.label };
      return true;
    });
  if (!audience && bankAudience) audience = { id: "banco", label: "Banco" };

  const occasionHit = findPhrases(tokens, text, OCCASIONS.flatMap((o) => o.words)).sort((a, b) => b.size - a.size || a.start - b.start)[0];
  const occasionDef = occasionHit ? OCCASIONS.find((o) => o.words.includes(occasionHit.phrase)) : null;
  const occasion = occasionDef ? { id: occasionDef.id, label: occasionDef.label } : null;
  if (occasionHit?.fuzzy) corrections.push({ typed: occasionHit.typed, understood: occasionHit.phrase });

  const toneHits = findPhrases(tokens, text, TONES.flatMap((t) => t.words));
  const tones = [...new Set(toneHits.map((hit) => TONES.find((t) => t.words.includes(hit.phrase)).id))];

  const period = parsePeriod(text, tokens, catalog);
  if (period?.corrections) corrections.push(...period.corrections);
  if (period?.error) warnings.push(period.error);

  // Comparação.
  let compare = null;
  if (/\b(ano passado|ano anterior|mesmo periodo do ano|ano contra ano|yoy|exercicio anterior)\b/.test(text) && (topics.has("comparativo") || /\b(comparar|comparando|versus|vs|contra|frente|em relacao|comparado)\b/.test(text))) compare = "yoy";
  else if (/\b(periodo anterior|mes anterior|trimestre anterior|semestre anterior|bimestre anterior)\b/.test(text)) compare = "anterior";
  else if (topics.has("comparativo")) compare = "yoy";
  if (compare && !topics.has("comparativo")) topics.set("comparativo", { id: "comparativo", label: TOPIC_BY_ID.comparativo.label, order: text.length, emphasis: false });

  const goals = parseGoals(text);
  if (goals.length && !topics.has("metas")) topics.set("metas", { id: "metas", label: TOPIC_BY_ID.metas.label, order: text.length, emphasis: true });

  const monthly = /\b(mes a mes|mes-a-mes|mensal|mensalmente|por mes|cada mes|evolucao mensal|ao longo dos meses|mes por mes)\b/.test(text);

  const lines = findLines(tokens, catalog).map((hit) => {
    if (hit.fuzzy) corrections.push({ typed: hit.typed, understood: hit.cand.normName });
    return hit.cand.kind === "account"
      ? { kind: "account", source: hit.cand.source, code: hit.cand.code, name: hit.cand.name, classificacao: hit.cand.classificacao }
      : { kind: "line", source: hit.cand.source, code: hit.cand.code, name: hit.cand.name };
  });

  // Marca citada no texto ("com a logo da Contac") — a tela oferece trocar.
  const brandHit = text.match(/\b(athos|contac)\b/);

  const seen = new Set();
  return {
    text: original,
    brand: brandHit ? brandHit[1] : null,
    period: period && !period.error ? period : null,
    compare,
    audience,
    occasion,
    tones,
    size: parseSize(text),
    topics: [...topics.values()].sort((a, b) => Number(b.emphasis) - Number(a.emphasis) || a.order - b.order),
    excluded: [...excluded],
    lines,
    goals,
    monthly,
    title,
    corrections: corrections.filter((c) => c.typed !== c.understood && !seen.has(c.understood) && seen.add(c.understood)),
    warnings,
  };
}
