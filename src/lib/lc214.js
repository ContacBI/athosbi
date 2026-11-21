// Enquadramento do NCM nos anexos da LC 214, pela BASE PRÓPRIA (texto oficial do Planalto, pasta vigente de dados/lc214).
// Diferente da base de terceiros, aqui NÃO existe cClassTrib: a lei dá o anexo, o item e o tratamento. O cClassTrib vem de outra
// fonte oficial (tabela do Informe Técnico da NF-e), ainda a ser montada.
//
// Regras de casamento (como a lei escreve):
//  - o NCM/SH da lei vale como PREFIXO ("9021.3" = tudo que começa com 90213; "90.25" = capítulo.posição; "Cap. 25" = capítulo);
//  - as exceções ("exceto os códigos ...") também são prefixos e valem só dentro do item (ou da alínea, nos itens com alíneas);
//  - devolvemos TODOS os itens que casam, do mais específico (prefixo mais longo) para o mais geral, porque o benefício é do
//    produto descrito no item, não do NCM inteiro: quem decide qual item descreve o produto é o fiscal.

export function montarIndice(base) {
  const entradas = []
  const tratamentos = {}
  for (const a of base.anexos) {
    tratamentos[a.anexo] = { nome: a.nome, ...a.tratamento }
    for (const it of a.itens) {
      const grupos = it.grupos?.length ? it.grupos : [{ alinea: '', ncm: it.ncm, prefixos: it.prefixos, excecoes: it.excecoes }]
      for (const g of grupos) {
        g.prefixos.forEach((p, k) => {
          if (!p) return
          entradas.push({ anexo: a.anexo, item: it.item, descricao: it.descricao, prefixo: p, ncmLei: g.ncm?.[k] ?? p, alinea: g.alinea || '', excecoes: g.excecoes || [] })
        })
      }
    }
  }
  // lista de itens (um por item de anexo), para consultar e buscar por palavra
  const itens = base.anexos.flatMap((a) =>
    a.itens.map((i) => ({
      anexo: a.anexo,
      item: i.item,
      descricao: i.descricao,
      ncmLei: i.grupos?.length ? i.grupos.flatMap((g) => g.ncm) : i.ncm,
      prefixos: i.grupos?.length ? i.grupos.flatMap((g) => g.prefixos) : i.prefixos,
      tratamento: tratamentos[a.anexo],
      grupos: i.grupos || [],
      busca: semAcento(`${i.descricao} ${(i.ncm || []).join(' ')}`),
    })),
  )
  return { versao: base.versao, baixadoEm: base.baixadoEm, entradas, itens, tratamentos, complementos: base.complementos || {}, anexos: base.anexos.map((a) => a.anexo) }
}

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Busca de itens da lei. A pergunta pode ser:
//  - um NCM (ou começo dele): "9018.39.29", "9021", "90.25" -> itens cujo código na lei casa (por prefixo, nos dois sentidos);
//  - palavras: "cateter balão", "prótese" -> itens cuja descrição tem TODAS as palavras (sem acento, parte da palavra vale).
// filtros: { anexo, tratamento (rótulo), ncms (Set de NCMs de 8 dígitos: só itens que casam com algum deles) }
export function buscarItens(indice, pergunta, filtros = {}) {
  if (!indice) return []
  const q = String(pergunta || '').trim()
  const digitos = q.replace(/\D/g, '')
  const ehNcm = q !== '' && /^[\d.\s-]+$/.test(q) && digitos.length >= 2
  const palavras = ehNcm ? [] : semAcento(q).split(/\s+/).filter((t) => t.length >= 2)
  let r = indice.itens.filter((i) => {
    if (filtros.anexo && i.anexo !== filtros.anexo) return false
    if (filtros.tratamento && i.tratamento?.rotulo !== filtros.tratamento) return false
    if (ehNcm) return digitos.length === 8 ? enquadrar(indice, digitos).some((e) => e.anexo === i.anexo && e.item === i.item) : i.prefixos.some((p) => p.startsWith(digitos) || digitos.startsWith(p))
    return palavras.every((p) => i.busca.includes(p))
  })
  if (filtros.ncms) {
    const casam = new Set()
    for (const n of filtros.ncms) for (const e of enquadrar(indice, n)) casam.add(`${e.anexo}|${e.item}`)
    r = r.filter((i) => casam.has(`${i.anexo}|${i.item}`))
  }
  const ordemAnexo = (a) => indice.anexos.indexOf(a)
  return r.sort((a, b) => ordemAnexo(a.anexo) - ordemAnexo(b.anexo) || cmpItem(a.item, b.item))
}

const numItem = (s) => String(s).split('.').map(Number)
const cmpItem = (a, b) => {
  const x = numItem(a)
  const y = numItem(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1)
  return 0
}

export function enquadrar(indice, ncm) {
  if (!indice || !ncm || !/^\d{8}$/.test(ncm)) return []
  const achados = new Map()
  for (const e of indice.entradas) {
    if (!ncm.startsWith(e.prefixo) || e.excecoes.some((x) => ncm.startsWith(x))) continue
    const k = `${e.anexo}|${e.item}`
    const atual = achados.get(k)
    if (!atual || e.prefixo.length > atual.prefixo.length) achados.set(k, { ...e, tratamento: indice.tratamentos[e.anexo] })
  }
  const ordemAnexo = (a) => indice.anexos.indexOf(a)
  return [...achados.values()].sort((a, b) => b.prefixo.length - a.prefixo.length || ordemAnexo(a.anexo) - ordemAnexo(b.anexo) || cmpItem(a.item, b.item))
}

// ---------------------------------------------------------------------------------------------------------------
// Sugestão do item mais parecido com a descrição do produto. É só uma SUGESTÃO: compara palavras (as raras pesam mais) e
// diz a confiança; quem decide é o fiscal. Não usa inteligência artificial nem dado externo.
const PARADAS = new Set('para com sem por dos das aos nas nos uma uns umas que como entre sobre ate tipo modelo kit conjunto unidade unidades individualmente ou seu sua seus suas outros outras demais etc nao mais menos cada todo toda todos todas'.split(' '))

// Abreviações comuns nas descrições de produto (só se aplicam à descrição do PRODUTO, nunca ao texto da lei)
const ABREVIACOES = { cat: 'cateter', bal: 'balao', ablac: 'ablacao', diag: 'diagnostico', hid: 'hidrofilico', introd: 'introdutor', endoprot: 'endoprotese', prot: 'protese' }
const expande = (txt) => semAcento(txt).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((t) => ABREVIACOES[t] || t)

const palavrasDe = (txt, abreviacoes = false) => {
  const toks = abreviacoes ? expande(txt) : semAcento(txt).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
  return [...new Set(toks.filter((t) => t.length >= 4 && !/\d/.test(t) && !PARADAS.has(t)))]
}

// "Nome principal": as palavras do começo da descrição, até a primeira preposição ou complemento.
//   "Introdutor para cateter com e sem válvula" -> [introdutor];  "Sondas, cateteres e cânulas, individualmente..." -> [sondas, cateteres, canulas]
//   "CATETER BALAO PARA DILATACAO HERCULES HD" -> [cateter, balao]
// palavras genéricas não identificam o produto ("sistema de aspiração" não é o "sistema de drenagem mediastinal")
const GENERICAS = new Set(['sistema', 'sistemas', 'conjunto', 'aparelho', 'aparelhos', 'dispositivo', 'dispositivos', 'artigo', 'artigos', 'instrumento', 'instrumentos', 'outros', 'material', 'produto', 'produtos', 'equipamento', 'equipamentos'])
const CORTE = new Set(['para', 'com', 'sem', 'exceto', 'individualmente', 'em', 'no', 'na', 'destinados', 'destinado', 'destinada', 'utilizado', 'usado'])
function cabeca(txt, abreviacoes = false) {
  const toks = abreviacoes ? expande(txt) : semAcento(txt).replace(/[^a-z0-9,. ]/g, ' ').replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)
  const saida = []
  for (const t of toks) {
    if (CORTE.has(t)) break
    if (t.length >= 4 && !/\d/.test(t) && !PARADAS.has(t) && !GENERICAS.has(t)) saida.push(t)
    if (saida.length >= 4) break
  }
  return saida
}

// duas palavras "casam" se são iguais, uma contém a outra (cateter/cateteres, protese/endoprotese) ou começam igual (7+ letras)
const singular = (t) => (t.length > 5 && t.endsWith('es') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t)
function casam(x, y) {
  const a = singular(x)
  const b = singular(y)
  if (a === b) return true
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true
  if (Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a))) return true // microguia / guia, microcateter / cateter
  const n = Math.min(a.length, b.length)
  return n >= 7 && a.slice(0, 7) === b.slice(0, 7)
}

function pesos(indice) {
  if (indice._idf) return indice._idf
  const df = new Map()
  for (const i of indice.itens) for (const w of palavrasDe(i.descricao)) df.set(w, (df.get(w) || 0) + 1)
  const n = indice.itens.length
  const idf = new Map([...df].map(([w, c]) => [w, Math.log(n / c) + 1]))
  indice._idf = idf
  return idf
}

// Parecença entre a descrição de um produto e a de um item, de 0 a 1:
//   60% = o NOME PRINCIPAL do produto bate com o nome principal do item ("cateter" com "sondas, cateteres e cânulas")
//   40% = fração do peso das palavras do item que aparecem em qualquer lugar do produto (palavras raras pesam mais)
// Assim "cateter" dentro de "Introdutor para cateter…" (só um complemento) vale muito menos que "cateteres" como nome do item.
export function parecenca(indice, descricaoProduto, descricaoItem) {
  const idf = pesos(indice)
  const prod = palavrasDe(descricaoProduto, true)
  const item = palavrasDe(descricaoItem)
  if (!prod.length || !item.length) return { score: 0, palavras: [], nome: false }
  let total = 0
  let achado = 0
  const palavras = []
  for (const w of item) {
    const p = idf.get(w) ?? 1
    total += p
    if (prod.some((x) => casam(x, w))) {
      achado += p
      palavras.push(w)
    }
  }
  const nomeProd = cabeca(descricaoProduto, true)
  const nomeItem = cabeca(descricaoItem)
  const nome = nomeProd.some((a) => nomeItem.some((b) => casam(a, b)))
  return { score: 0.6 * (nome ? 1 : 0) + 0.4 * (total ? achado / total : 0), palavras, nome }
}

// Confiança: alta = nome principal bate e o item está bem à frente do 2º colocado; média = bate, mas há concorrente próximo; baixa = só palavras soltas
function confianca(score, margem, nome) {
  if (score <= 0) return 'nenhuma'
  if (nome && score >= 0.6 && margem >= 0.15) return 'alta'
  if (nome && score >= 0.6) return 'média'
  return 'baixa'
}

// Itens que casam com o NCM, ordenados do mais parecido com a descrição para o menos. Cada um traz score, palavras em comum, se o nome
// principal bate e a confiança. Se NADA se parece, a confiança é 'nenhuma' (e a tela não deve apontar item: o produto pode nem ser do benefício).
export function sugerir(indice, descricaoProduto, ncm) {
  const enq = enquadrar(indice, ncm)
  if (!enq.length) return []
  const pontuados = enq.map((e) => ({ ...e, ...parecenca(indice, descricaoProduto, e.descricao) }))
  pontuados.sort((a, b) => b.score - a.score || b.prefixo.length - a.prefixo.length)
  const margem = pontuados.length > 1 ? pontuados[0].score - pontuados[1].score : pontuados[0].score
  return pontuados.map((p, k) => ({ ...p, confianca: k === 0 ? confianca(p.score, margem, p.nome) : confianca(p.score, 0, p.nome) }))
}

// Resumo curto para a tabela: "Anexo XII · item 5" ou "Anexo IV · 7 itens"
export function resumo(enq) {
  if (!enq.length) return ''
  const anexos = [...new Set(enq.map((e) => e.anexo))]
  const itens = enq.length === 1 ? `item ${enq[0].item}` : `${enq.length} itens`
  return `Anexo ${anexos.join(', ')} · ${itens}`
}
