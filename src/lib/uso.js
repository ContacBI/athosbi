// Central (Parâmetros › Central): registro do uso do portal e as contas da
// tela. O app grava em `uso_eventos` (supabase/schema.sql):
//   - "acesso": cada vez que a pessoa entra (aba nova, ou volta depois de 30
//     minutos parada);
//   - "tela": o tempo em cada tela — só contando com a aba visível e alguém
//     mexendo (5 minutos sem mexer = parado). Uma visita longa pode virar
//     mais de uma linha (o pedaço gravado ao trocar de aba ou fechar); todas
//     têm o mesmo `visita`.
// E-mail, "interno" (equipe) e a hora são carimbados no servidor.

import { state } from "../data/store.js";
import { supabase } from "./supabaseClient.js";

const NOVO_ACESSO_MS = 30 * 60 * 1000;
const PARADO_MS = 5 * 60 * 1000;
const TIQUE_MS = 10 * 1000;
const ENVIO_MS = 2 * 60 * 1000;
const CHAVE_ULTIMO = "athosbi.uso.ultimo";
// Lá no Supabase, o "dono da Central" (vê também a equipe) — ver
// e_dono_da_central() em supabase/schema.sql. Aqui só decide se a aba
// aparece; quem libera os dados é o banco.
export const DONO_DA_CENTRAL = "izaiascontac@gmail.com";

// ---------------------------------------------------------------------------
// Nome de cada tela (rota → como aparece na Central).

const TELAS = [
  [/^\/$/, "Início"],
  [/^\/empresas$/, "Escolher empresa"],
  [/^\/carteira$/, "Carteira"],
  [/^\/definir-senha$/, "Definir senha"],
  [/^\/empresa\/?$/, "Empresa · início"],
  [/^\/empresa\/celular$/, "Resumo no celular"],
  [/^\/empresa\/personalizar$/, "Personalizar"],
  [/^\/empresa\/demonstrativos$/, "Demonstrativos"],
  [/^\/empresa\/dfc$/, "DFC"],
  [/^\/empresa\/de-para$/, "De/Para da empresa"],
  [/^\/empresa\/conferencia$/, "Conferência"],
  [/^\/empresa\/vinculo-dfc$/, "Vínculo DFC"],
  [/^\/empresa\/relatorios$/, "Relatórios mensais"],
  [/^\/empresa\/apresentacoes$/, "Apresentações"],
  [/^\/empresa\/apresentacoes\/.+/, "Apresentação aberta"],
  [/^\/empresa\/orcamento$/, "Orçamento"],
  [/^\/empresa\/carga-tributaria$/, "Carga tributária"],
  [/^\/empresa\/analise-desempenho$/, "Análise de desempenho"],
  [/^\/reforma(\/.*)?$/, "Reforma Tributária"],
  [/^\/parametros\/central$/, "Parâmetros · Central"],
  [/^\/parametros\/(\w[\w-]*)/, "Parâmetros"],
];

// Aba do B.I. (/empresa/painel/<id>): o nome da aba, quando dá pra achar.
export function nomeDaTela(caminho, abas = []) {
  const rota = String(caminho || "/").replace(/\/+$/, "") || "/";
  const painel = rota.match(/^\/empresa\/painel\/([^/]+)/);
  if (painel) {
    const id = decodeURIComponent(painel[1]);
    const todas = (abas || []).flatMap((aba) => [aba, ...(aba.subTabs || aba.children || [])]);
    const aba = todas.find((item) => item?.id === id);
    return `B.I. · ${aba?.name || "aba"}`;
  }
  const achada = TELAS.find(([padrao]) => padrao.test(rota));
  if (!achada) return rota;
  if (achada[1] === "Parâmetros") {
    const parte = rota.split("/")[2] || "";
    return `Parâmetros · ${parte.charAt(0).toUpperCase()}${parte.slice(1).replace(/-/g, " ")}`;
  }
  return achada[1];
}

export function dispositivoAtual(largura = typeof window !== "undefined" ? window.innerWidth : 1280, toque = typeof window !== "undefined" && "ontouchstart" in window) {
  if (largura < 768) return "celular";
  if (toque && largura < 1180) return "tablet";
  return "computador";
}

// ---------------------------------------------------------------------------
// Coleta.

let token = "";
let fila = [];
let visita = null;
let ultimaAtividade = Date.now();
let ultimoTique = Date.now();
let ligado = false;
let envioFalhou = false;

const novaVisita = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function empresaAtual() {
  if (state.activeGroupId) {
    const grupo = (state.groups || []).find((item) => item.id === state.activeGroupId);
    return { empresa_id: `grupo:${state.activeGroupId}`, empresa: grupo?.name || "" };
  }
  const company = (state.companies || []).find((item) => item.id === state.activeCompanyId);
  return { empresa_id: company?.id || "", empresa: company?.name || "" };
}

// O pedaço de tempo da visita atual vai pra fila (mesmo `visita`).
function guardarPedaco(minimo = 3) {
  if (!visita) return;
  const segundos = Math.round(visita.segundos);
  if (segundos >= minimo) {
    fila.push({ tipo: "tela", rota: visita.rota, tela: visita.tela, visita: visita.id, empresa_id: visita.empresa_id, empresa: visita.empresa, segundos: Math.min(segundos, 86400), dispositivo: dispositivoAtual() });
    visita.segundos = 0;
  }
}

async function enviar({ saindo = false } = {}) {
  if (!fila.length || envioFalhou) return;
  const linhas = fila;
  fila = [];
  try {
    if (saindo && token) {
      // Fechando a aba: o fetch comum pode ser cortado — keepalive segura.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/uso_eventos`;
      await fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(linhas),
      });
      return;
    }
    const { error } = await supabase.from("uso_eventos").insert(linhas);
    if (error) throw error;
  } catch (error) {
    // Tabela ainda não criada (ou sem rede): não insiste nem atrapalha o uso.
    console.warn("Central: não consegui gravar o uso", error?.message || error);
    if (/uso_eventos|PGRST205|42P01/.test(String(error?.message || error?.code || ""))) envioFalhou = true;
    else fila = [...linhas, ...fila].slice(-200);
  }
}

function registrarAcessoSeNovo() {
  let ultimo = 0;
  try {
    ultimo = Number(sessionStorage.getItem(CHAVE_ULTIMO) || 0);
  } catch {
    ultimo = 0;
  }
  const agora = Date.now();
  if (!ultimo || agora - ultimo > NOVO_ACESSO_MS) fila.push({ tipo: "acesso", rota: window.location.pathname, tela: nomeDaTela(window.location.pathname), dispositivo: dispositivoAtual(), ...empresaAtual() });
  try {
    sessionStorage.setItem(CHAVE_ULTIMO, String(agora));
  } catch {
    /* sem sessionStorage — conta de novo na próxima, sem problema */
  }
}

function tique() {
  const agora = Date.now();
  const passou = Math.min(agora - ultimoTique, 2 * TIQUE_MS);
  ultimoTique = agora;
  if (!visita || document.visibilityState !== "visible" || agora - ultimaAtividade > PARADO_MS) return;
  visita.segundos += passou / 1000;
  try {
    sessionStorage.setItem(CHAVE_ULTIMO, String(agora));
  } catch {
    /* idem */
  }
}

// Liga a coleta (uma vez, depois do login). Não roda no `npm run dev`.
export function ligarRegistroDeUso() {
  if (ligado || typeof window === "undefined" || import.meta.env.DEV) return;
  ligado = true;
  supabase.auth.getSession().then(({ data }) => {
    token = data?.session?.access_token || "";
  });
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    token = sessao?.access_token || "";
  });
  const mexeu = () => {
    const agora = Date.now();
    // Voltou depois de muito tempo parado: conta um acesso novo.
    if (agora - ultimaAtividade > NOVO_ACESSO_MS) registrarAcessoSeNovo();
    ultimaAtividade = agora;
  };
  ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"].forEach((evento) => window.addEventListener(evento, mexeu, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      tique();
      guardarPedaco();
      enviar({ saindo: true });
    } else {
      ultimoTique = Date.now();
      mexeu();
    }
  });
  window.addEventListener("pagehide", () => {
    tique();
    guardarPedaco();
    enviar({ saindo: true });
  });
  setInterval(tique, TIQUE_MS);
  setInterval(() => {
    guardarPedaco(30);
    enviar();
  }, ENVIO_MS);
  registrarAcessoSeNovo();
}

// Trocou de tela (chamado pelo RegistroDeUso a cada mudança de rota).
export function mudouDeTela(caminho) {
  if (!ligado) return;
  tique();
  guardarPedaco();
  visita = { id: novaVisita(), rota: caminho, tela: nomeDaTela(caminho, state.dashboardTabs), segundos: 0, ...empresaAtual() };
  ultimoTique = Date.now();
  if (fila.length >= 20) enviar();
}

// ---------------------------------------------------------------------------
// Leitura e contas da Central.

// Os registros desde `desde` (ISO) — clientes ou equipe. O banco só devolve
// o que quem está logado pode ver. Lê em páginas de 1000.
export async function carregarUso({ desde, interno = false }) {
  const linhas = [];
  for (let pagina = 0; pagina < 60; pagina += 1) {
    const { data, error } = await supabase
      .from("uso_eventos")
      .select("email, tipo, tela, visita, empresa, segundos, dispositivo, criado_em")
      .eq("interno", interno)
      .gte("criado_em", desde)
      .order("criado_em", { ascending: true })
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

const diaLocal = (data) => {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function contarMaior(mapa) {
  let melhor = "";
  let maior = -1;
  mapa.forEach((valor, chave) => {
    if (valor > maior) {
      maior = valor;
      melhor = chave;
    }
  });
  return melhor;
}

// Tudo que a Central mostra, de uma lista de registros entre `inicio` e
// `fim` (Date): totais, acessos por dia, telas com mais tempo, pessoas,
// horários (dia da semana × hora), dispositivos e empresas.
export function resumoDeUso(linhas, { inicio, fim }) {
  const dentro = linhas.filter((linha) => {
    const quando = new Date(linha.criado_em);
    return quando >= inicio && quando < fim;
  });
  const acessos = dentro.filter((linha) => linha.tipo === "acesso");
  const telas = dentro.filter((linha) => linha.tipo === "tela");
  const segundos = telas.reduce((soma, linha) => soma + Number(linha.segundos || 0), 0);

  const dias = [];
  for (let dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()); dia < fim; dia.setDate(dia.getDate() + 1)) {
    dias.push({ dia: diaLocal(dia), acessos: 0, segundos: 0, pessoas: new Set() });
  }
  const porDia = new Map(dias.map((item) => [item.dia, item]));
  dentro.forEach((linha) => {
    const item = porDia.get(diaLocal(linha.criado_em));
    if (!item) return;
    if (linha.tipo === "acesso") item.acessos += 1;
    else item.segundos += Number(linha.segundos || 0);
    item.pessoas.add(linha.email);
  });

  const porTela = new Map();
  telas.forEach((linha) => {
    const item = porTela.get(linha.tela) || { tela: linha.tela, segundos: 0, visitas: new Set(), pessoas: new Set() };
    item.segundos += Number(linha.segundos || 0);
    item.visitas.add(linha.visita || `${linha.email}${linha.criado_em}`);
    item.pessoas.add(linha.email);
    porTela.set(linha.tela, item);
  });

  const porPessoa = new Map();
  dentro.forEach((linha) => {
    const item = porPessoa.get(linha.email) || { email: linha.email, acessos: 0, segundos: 0, ultimo: "", telas: new Map(), empresas: new Map(), dispositivos: new Map() };
    if (linha.tipo === "acesso") {
      item.acessos += 1;
      item.dispositivos.set(linha.dispositivo || "computador", (item.dispositivos.get(linha.dispositivo || "computador") || 0) + 1);
    } else {
      const s = Number(linha.segundos || 0);
      item.segundos += s;
      item.telas.set(linha.tela, (item.telas.get(linha.tela) || 0) + s);
      if (linha.empresa) item.empresas.set(linha.empresa, (item.empresas.get(linha.empresa) || 0) + s);
    }
    if (linha.criado_em > item.ultimo) item.ultimo = linha.criado_em;
    porPessoa.set(linha.email, item);
  });

  const porEmpresa = new Map();
  telas.forEach((linha) => {
    if (!linha.empresa) return;
    const item = porEmpresa.get(linha.empresa) || { empresa: linha.empresa, segundos: 0, pessoas: new Set() };
    item.segundos += Number(linha.segundos || 0);
    item.pessoas.add(linha.email);
    porEmpresa.set(linha.empresa, item);
  });

  // Horários: em que dia da semana e hora as pessoas entram (acessos) — e,
  // sem acessos ainda, pelo tempo de uso.
  const horarios = Array.from({ length: 7 }, () => Array(24).fill(0));
  (acessos.length ? acessos : telas).forEach((linha) => {
    const d = new Date(linha.criado_em);
    horarios[d.getDay()][d.getHours()] += acessos.length ? 1 : Number(linha.segundos || 0);
  });

  const dispositivos = { computador: 0, celular: 0, tablet: 0 };
  acessos.forEach((linha) => {
    dispositivos[linha.dispositivo || "computador"] = (dispositivos[linha.dispositivo || "computador"] || 0) + 1;
  });

  return {
    acessos: acessos.length,
    pessoas: new Set(dentro.map((linha) => linha.email)).size,
    segundos,
    mediaPorAcesso: acessos.length ? segundos / acessos.length : 0,
    porDia: dias.map((item) => ({ dia: item.dia, acessos: item.acessos, segundos: item.segundos, pessoas: item.pessoas.size })),
    telas: [...porTela.values()]
      .map((item) => ({ tela: item.tela, segundos: item.segundos, visitas: item.visitas.size, pessoas: item.pessoas.size, mediaPorVisita: item.visitas.size ? item.segundos / item.visitas.size : 0 }))
      .sort((a, b) => b.segundos - a.segundos),
    pessoasLista: [...porPessoa.values()]
      .map((item) => ({ email: item.email, acessos: item.acessos, segundos: item.segundos, ultimo: item.ultimo, tela: contarMaior(item.telas), empresas: [...item.empresas.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome), dispositivo: contarMaior(item.dispositivos) || "computador" }))
      .sort((a, b) => b.segundos - a.segundos || b.acessos - a.acessos),
    empresas: [...porEmpresa.values()].map((item) => ({ empresa: item.empresa, segundos: item.segundos, pessoas: item.pessoas.size })).sort((a, b) => b.segundos - a.segundos),
    horarios,
    dispositivos,
  };
}

// "Pistas pra melhorar": frases curtas tiradas dos números do período —
// onde está a atenção, telas abertas e largadas rápido, peso do celular,
// quem não entrou, tendência e o horário de pico.
const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function pistasDeUso(resumo, { anterior = null, naoEntraram = 0, interno = false } = {}) {
  if (!resumo) return [];
  const pistas = [];
  const [primeira] = resumo.telas;
  if (primeira && resumo.segundos > 0) {
    const fatia = Math.round((primeira.segundos / resumo.segundos) * 100);
    pistas.push({ tipo: "foco", texto: `“${primeira.tela}” fica com ${fatia}% do tempo — é a vitrine do portal; vale caprichar nela.` });
  }
  const rapida = resumo.telas.filter((tela) => tela.visitas >= 5 && tela.mediaPorVisita < 20).sort((a, b) => b.visitas - a.visitas)[0];
  if (rapida) pistas.push({ tipo: "atencao", texto: `“${rapida.tela}” é aberta e largada rápido (${duracao(rapida.mediaPorVisita)} por visita, ${rapida.visitas} visitas) — talvez a pessoa não ache o que procura.` });
  const totalAcessos = Object.values(resumo.dispositivos || {}).reduce((soma, valor) => soma + valor, 0);
  const celular = totalAcessos ? Math.round(((resumo.dispositivos.celular || 0) / totalAcessos) * 100) : 0;
  if (celular >= 20) pistas.push({ tipo: "celular", texto: `${celular}% dos acessos são pelo celular — o resumo do celular pesa na experiência.` });
  if (naoEntraram > 0) pistas.push({ tipo: "atencao", texto: interno ? `${naoEntraram} pessoa${naoEntraram === 1 ? "" : "s"} da equipe não ${naoEntraram === 1 ? "entrou" : "entraram"} no período.` : `${naoEntraram} cliente${naoEntraram === 1 ? "" : "s"} com acesso não ${naoEntraram === 1 ? "entrou" : "entraram"} no período — um lembrete pode ajudar.` });
  if (anterior?.acessos >= 5) {
    const variacao = Math.round(((resumo.acessos - anterior.acessos) / anterior.acessos) * 100);
    if (Math.abs(variacao) >= 20) pistas.push({ tipo: variacao > 0 ? "bom" : "atencao", texto: `Os acessos ${variacao > 0 ? "subiram" : "caíram"} ${Math.abs(variacao)}% em relação ao período anterior.` });
  }
  const pico = resumo.horarios.flatMap((linha, dia) => linha.map((valor, hora) => ({ dia, hora, valor }))).sort((a, b) => b.valor - a.valor)[0];
  if (pico?.valor > 1) pistas.push({ tipo: "horario", texto: `Mais movimento ${pico.dia === 0 || pico.dia === 6 ? "no" : "na"} ${DIAS_DA_SEMANA[pico.dia]} por volta das ${pico.hora}h — bom horário pra avisar de novidades.` });
  return pistas.slice(0, 5);
}

// "1 h 20 min", "12 min", "45 s".
export function duracao(segundos) {
  const s = Math.round(Number(segundos || 0));
  if (s < 60) return `${s} s`;
  const minutos = Math.round(s / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias".
export function haQuanto(iso, agora = new Date()) {
  if (!iso) return "—";
  const ms = agora - new Date(iso);
  const min = Math.floor(ms / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}
