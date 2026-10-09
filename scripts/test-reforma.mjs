// Testes do motor da Reforma Tributária (src/lib/reforma) — casos
// calculados à mão. Rodar: node scripts/test-reforma.mjs
import { ANOS, PARAMETROS_PADRAO, SIMPLES_ANEXOS, aliquotasDoAno, mesclarParametros, simplesAliquota } from "../src/lib/reforma/parametros.js";
import { calcularSimulacao } from "../src/lib/reforma/calculo.js";
import { categoriaSugerida, sugestaoLc214 } from "../src/lib/reforma/lc214.js";
import { lerNumero } from "../src/lib/reforma/formato.js";
import { avisoDeRegime, comprasDaDominio, nbsFormatado, ncmFormatado, resumoFiscal, sincronizarCategorias, vendasDaDominio } from "../src/lib/reforma/fiscal.js";

let falhas = 0;
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function confere(rotulo, ok, detalhe) {
  console.log(`${ok ? "OK  " : "FALHA"} ${rotulo}${ok ? "" : ` → ${JSON.stringify(detalhe)}`}`);
  if (!ok) falhas += 1;
}
const P = structuredClone(PARAMETROS_PADRAO);
const ano = (cenario, a) => cenario.anos.find((linha) => linha.ano === a);

// ── Tabelas e calendário ──
Object.entries(SIMPLES_ANEXOS).forEach(([anexo, tabela]) => {
  tabela.faixas.forEach((faixa, i) => {
    const total = Object.values(faixa.rep).reduce((s, v) => s + v, 0);
    confere(`Simples anexo ${anexo} faixa ${i + 1}: repartição soma 100%`, perto(total, 100, 1e-9), total);
  });
});
const s600 = simplesAliquota("I", 600000);
confere("Simples I, RBT12 600 mil: faixa 3, efetiva 7,19%", s600.faixa === 3 && perto(s600.efetiva, 0.0719), s600);
confere("Simples acima de 4,8 mi: fora do limite", simplesAliquota("III", 5_000_000).foraDoLimite === true);
const a2027 = aliquotasDoAno(P, 2027);
confere("2027: CBS cheia − 0,1 p.p. (8,7%), IBS 0,1%, sem PIS/Cofins/IPI", perto(a2027.cbs, 0.087) && perto(a2027.ibs, 0.001) && !a2027.pisCofins && !a2027.ipi, a2027);
const a2029 = aliquotasDoAno(P, 2029);
confere("2029: IBS 10% da referência (1,77%), ICMS/ISS 90%", perto(a2029.ibs, 0.0177) && perto(a2029.icmsIss, 0.9) && perto(a2029.cbs, 0.088), a2029);
const a2033 = aliquotasDoAno(P, 2033);
confere("2033: CBS 8,8% + IBS 17,7%, sem ICMS/ISS", perto(a2033.cbs, 0.088) && perto(a2033.ibs, 0.177) && a2033.icmsIss === 0, a2033);
confere("calendário 2026–2033", ANOS.join(",") === "2026,2027,2028,2029,2030,2031,2032,2033");
const mesclado = mesclarParametros({ cbs: 9, transicao: [{ ano: 2029, icmsIss: 85 }] });
confere("parâmetros salvos valem por cima do padrão", mesclado.cbs === 9 && mesclado.ibs === 17.7 && mesclado.transicao.find((l) => l.ano === 2029).icmsIss === 85 && mesclado.transicao.find((l) => l.ano === 2030).icmsIss === 80, mesclado.transicao[3]);

// ── Presumido, serviço com ISS 5% (R$ 100) ──
const servico = calcularSimulacao({ regime: "presumido", vendas: [{ id: "s", tipo: "servico", receita: 100, iss: 5, b2b: 0 }] }, P);
const sh = ano(servico.cenarios.atual, "hoje");
const s33 = ano(servico.cenarios.atual, 2033);
confere("serviço Presumido hoje: PIS/Cofins 3,65 + ISS 5 = 8,65", perto(sh.aRecolher, 8.65) && perto(sh.debitos.pisCofins, 3.65) && perto(sh.debitos.iss, 5), sh.debitos);
// b = 91,35 → CBS 8,0388 + IBS 16,16895 = 24,20775; preço 115,55775
confere("serviço 2033: CBS+IBS = 26,5% de 91,35 = 24,20775", perto(s33.aRecolher, 24.20775) && perto(s33.debitos.cbs, 8.0388) && perto(s33.debitos.ibs, 16.16895), s33.debitos);
confere("serviço 2033: preço pra manter a margem +15,56%", perto(s33.precoVar, 0.1555775) && perto(s33.precoConsumidorVar, 0.1555775), s33.precoVar);
// preço mantido: 91,35 × (100/115,55775 − 1) = −12,29857...
confere("serviço 2033: preço mantido perde R$ 12,30 de margem", perto(s33.margemPrecoMantido, 91.35 * (100 / 115.55775 - 1)), s33.margemPrecoMantido);
confere("2026 (ano-teste compensado) = hoje", perto(ano(servico.cenarios.atual, 2026).aRecolher, 8.65));
// 2029: ISS 90% (4,5%) por dentro + PIS/Cofins extinto; V = 91,35/(1−0,045)
const s29 = ano(servico.cenarios.atual, 2029);
const V29 = 91.35 / (1 - 0.045);
confere("serviço 2029: ISS 4,5% por dentro + CBS 8,8% + IBS 1,77% sobre 91,35", perto(s29.debitos.iss, 0.045 * V29) && perto(s29.debitos.cbs, 0.088 * 91.35) && perto(s29.debitos.ibs, 0.0177 * 91.35), s29.debitos);

const saude = calcularSimulacao({ regime: "presumido", vendas: [{ id: "s", tipo: "servico", receita: 100, iss: 5, categoria: "red60" }] }, P);
confere("saúde (redução 60%) 2033: CBS+IBS = 10,6% de 91,35 = 9,6831", perto(ano(saude.cenarios.atual, 2033).aRecolher, 9.6831), ano(saude.cenarios.atual, 2033).aRecolher);

// ── Lucro Real, mercadoria com ICMS 18% (R$ 100), cliente empresa ──
const real = calcularSimulacao({ regime: "real", vendas: [{ id: "m", tipo: "mercadoria", receita: 100, icms: 18, b2b: 100 }] }, P);
const rh = ano(real.cenarios.atual, "hoje");
const r33 = ano(real.cenarios.atual, 2033);
// ICMS 18 + PIS/Cofins 9,25% de 82 = 7,585 → b = 74,415
confere("mercadoria Real hoje: ICMS 18 + PIS/Cofins 7,585", perto(rh.debitos.icms, 18) && perto(rh.debitos.pisCofins, 7.585), rh.debitos);
confere("mercadoria Real 2033: CBS+IBS = 26,5% de 74,415 = 19,719975; preço −5,87%", perto(r33.aRecolher, 19.719975) && perto(r33.precoVar, 94.134975 / 100 - 1), [r33.aRecolher, r33.precoVar]);
confere("cliente empresa: custo líquido igual (74,415) hoje e em 2033", perto(rh.custoClienteEmpresa, 74.415) && perto(r33.custoClienteEmpresa, 74.415) && perto(r33.custoClienteEmpresaVar, 0), [rh.custoClienteEmpresa, r33.custoClienteEmpresa]);
const r29 = ano(real.cenarios.atual, 2029);
const V = 74.415 / (1 - 0.162);
confere("mercadoria 2029: ICMS 16,2% por dentro + CBS + IBS 1,77%", perto(r29.debitos.icms, 0.162 * V) && perto(r29.preco, V + 0.088 * 74.415 + 0.0177 * 74.415), [r29.debitos.icms, r29.preco]);

// ── Compras ──
const compra = { id: "c", tipo: "mercadoria", valor: 100, aliquota: 18, fornecedor: "normal" };
const compraReal = calcularSimulacao({ regime: "real", vendas: [], compras: [compra] }, P);
confere("compra no Real: custo líquido 74,415 hoje e em 2033 (crédito integral nos dois)", perto(ano(compraReal.cenarios.atual, "hoje").custoCompras, 74.415) && perto(ano(compraReal.cenarios.atual, 2033).custoCompras, 74.415), [ano(compraReal.cenarios.atual, "hoje").custoCompras, ano(compraReal.cenarios.atual, 2033).custoCompras]);
const compraPresumido = calcularSimulacao({ regime: "presumido", vendas: [], compras: [compra] }, P);
const cp33 = ano(compraPresumido.cenarios.atual, 2033);
confere("compra no Presumido: hoje só crédito de ICMS (custo 82); 2033 crédito amplo (custo 74,415) → ganha 7,585/mês", perto(ano(compraPresumido.cenarios.atual, "hoje").custoCompras, 82) && perto(cp33.custoCompras, 74.415) && perto(cp33.efeitoCompras, 7.585), [ano(compraPresumido.cenarios.atual, "hoje").custoCompras, cp33.custoCompras]);
confere("crédito de compra entra no a recolher (−19,72)", perto(cp33.aRecolher, -19.719975), cp33.aRecolher);
const semCredito = calcularSimulacao({ regime: "real", vendas: [], compras: [{ ...compra, fornecedor: "semCredito" }] }, P);
confere("compra sem crédito (pessoa física): custo 100 sempre", perto(ano(semCredito.cenarios.atual, 2033).custoCompras, 100) && perto(ano(semCredito.cenarios.atual, "hoje").custoCompras, 100));

// ── Simples, Anexo I, RBT12 600 mil, R$ 100, metade para empresas ──
const simples = calcularSimulacao({ regime: "simples", rbt12: 600000, anexoPadrao: "I", vendas: [{ id: "v", tipo: "mercadoria", receita: 100, b2b: 100 }] }, P);
const ph = ano(simples.cenarios.atual, "hoje");
const p33 = ano(simples.cenarios.atual, 2033);
const h33 = ano(simples.cenarios.hibrido, 2033);
// DAS consumo = 100 × 7,19% × (2,76 + 12,74 + 33,5)% = 3,5231 → b = 96,4769
confere("Simples hoje: parte de consumo do DAS = 3,5231", perto(ph.aRecolher, 3.5231) && perto(ph.debitos.das, 3.5231), ph.debitos);
confere("Simples permanecendo: DAS igual em 2033, preço igual", perto(p33.aRecolher, 3.5231) && perto(p33.precoVar, 0), [p33.aRecolher, p33.precoVar]);
// cliente hoje: ICMS do Simples 2,40865 + PIS/Cofins 9,25 → custo 88,34135; 2033: custo 96,4769
confere("Simples: cliente empresa perde o crédito de 9,25% de PIS/Cofins (+9,21% no custo dele)", perto(ph.custoClienteEmpresa, 100 - 2.40865 - 9.25) && perto(p33.custoClienteEmpresa, 96.4769) && perto(p33.custoClienteEmpresaVar, 96.4769 / 88.34135 - 1), [ph.custoClienteEmpresa, p33.custoClienteEmpresa]);
confere("Simples híbrido 2033: DAS sem consumo, CBS+IBS 26,5% de 96,4769 por fora", perto(h33.debitos.das, 0) && perto(h33.aRecolher, 0.265 * 96.4769) && perto(h33.preco, 96.4769 * 1.265), h33.debitos);
confere("Simples híbrido 2026 = permanecer (opção vale de 2027)", perto(ano(simples.cenarios.hibrido, 2026).aRecolher, ano(simples.cenarios.atual, 2026).aRecolher));
const comCompra = calcularSimulacao({ regime: "simples", rbt12: 600000, anexoPadrao: "I", vendas: [{ id: "v", tipo: "mercadoria", receita: 100 }], compras: [compra] }, P);
confere("Simples permanecendo não toma crédito; híbrido toma CBS/IBS das compras", perto(ano(comCompra.cenarios.atual, 2033).creditos.cbs, 0) && perto(ano(comCompra.cenarios.hibrido, 2033).creditos.cbs + ano(comCompra.cenarios.hibrido, 2033).creditos.ibs, 19.719975), [ano(comCompra.cenarios.hibrido, 2033).creditos]);
const mono = calcularSimulacao({ regime: "simples", rbt12: 600000, anexoPadrao: "I", vendas: [{ id: "v", tipo: "mercadoria", receita: 100, pisCofins: "monofasico", icmsSt: true }] }, P);
confere("Simples monofásico + ICMS-ST: sem PIS/Cofins/ICMS no DAS → consumo 0", perto(ano(mono.cenarios.atual, "hoje").debitos.das, 0), ano(mono.cenarios.atual, "hoje").debitos);

// ── Resumo e entradas estranhas ──
confere("resumo traz carga hoje e 2033", perto(servico.resumo.cargaHoje, 0.0865) && perto(servico.resumo.carga2033, 0.2420775) && servico.resumo.hibrido === undefined, servico.resumo);
confere("resumo do Simples traz o híbrido", Boolean(simples.resumo.hibrido) && perto(simples.resumo.hibrido.aRecolher2033, 0.265 * 96.4769), simples.resumo.hibrido);
const vazio = calcularSimulacao({}, P);
confere("simulação vazia não quebra (tudo zero)", vazio.cenarios.atual.anos.every((linha) => linha.aRecolher === 0 && linha.precoVar === 0));
const lixo = calcularSimulacao({ regime: "x", vendas: [{ receita: "abc", icms: "-5", categoria: "?" }] }, P);
confere("entrada inválida vira zero/padrão", lixo.dados.regime === "presumido" && lixo.dados.vendas[0].receita === 0 && lixo.dados.vendas[0].icms === 0 && lixo.dados.vendas[0].categoria === "padrao");

// ── Notas fiscais da Domínio → itens da simulação ──
const fiscal = {
  meses: 12,
  vendas: [
    { ncm: "90213190", servico: "", descricao: "PLACA DE TITANIO", produtos: 12, valor: 1200000, valor_pj: 1080000, icms: 144000, icms_st: false, ipi: 60000, iss: 0, pis_cofins: "normal" },
    { ncm: "", servico: "4.03", descricao: "Instrumentação", produtos: 1, valor: 60000, valor_pj: 60000, icms: 0, icms_st: false, ipi: 0, iss: 3000, pis_cofins: "normal" },
    ...Array.from({ length: 60 }, (_, i) => ({ ncm: String(30049000 + i).padStart(8, "0"), servico: "", descricao: `ITEM ${i}`, produtos: 1, valor: 100 + i, valor_pj: 0, icms: 18 + i * 0.18, icms_st: i % 2 === 0, ipi: 0, iss: 0, pis_cofins: i < 40 ? "monofasico" : "normal" })),
  ],
  compras: [
    { tipo: "mercadoria", fornecedor: "normal", ncm: "90213190", descricao: "PLACA", valor: 480000, icms: 57600, icms_creditado: 57600, ipi: 24000, iss: 0 },
    { tipo: "mercadoria", fornecedor: "simples", ncm: "90213190", descricao: "PLACA", valor: 24000, icms: 0, icms_creditado: 0, ipi: 0, iss: 0 },
    { tipo: "energia", fornecedor: "normal", ncm: "", descricao: "", valor: 24000, icms: 4320, icms_creditado: 0, ipi: 0, iss: 0 },
    { tipo: "servico", fornecedor: "normal", ncm: "", descricao: "", valor: 12000, icms: 0, icms_creditado: 0, ipi: 0, iss: 600 },
  ],
};
const vendasF = vendasDaDominio(fiscal, { anexoPadrao: "I" });
const placa = vendasF[0];
confere("NCM formatado 9021.31.90", ncmFormatado("90213190") === "9021.31.90");
confere("NBS formatado 1.1103.22.00; item da LC 116 fica como veio", nbsFormatado("111032200") === "1.1103.22.00" && nbsFormatado("01.05") === "01.05");
confere("venda principal: receita/mês, % p/ empresas, ICMS e IPI efetivos", placa.codigo === "9021.31.90" && placa.receita === 100000 && placa.b2b === 90 && placa.icms === 12 && placa.ipi === 5 && placa.tipo === "mercadoria" && placa.descricao.includes("+11"), placa);
const servF = vendasF.find((item) => item.tipo === "servico");
confere("serviço: ISS 5%, anexo III, código do serviço", servF?.iss === 5 && servF.anexo === "III" && servF.codigo === "4.03" && servF.receita === 5000, servF);
confere("um item por NCM/serviço quando cabem (62 linhas, sem 'Demais')", vendasF.length === 62 && !vendasF.some((item) => item.descricao.startsWith("Demais")), vendasF.length);
const muitos = { meses: 1, vendas: Array.from({ length: 120 }, (_, i) => ({ ncm: String(84710000 + i), servico: "", descricao: `X${i}`, produtos: 1, valor: 1000 - i, valor_pj: 0, icms: 0, ipi: 0, iss: 0, pis_cofins: "normal" })) };
const vendasMuitos = vendasDaDominio(muitos);
confere("acima de 80 NCMs, os menores viram 'Demais produtos' (80 linhas, sem perder valor)", vendasMuitos.length === 80 && vendasMuitos[79].descricao.startsWith("Demais produtos (41") && perto(vendasMuitos.reduce((s, v) => s + v.receita, 0), muitos.vendas.reduce((s, v) => s + v.valor, 0), 0.01), vendasMuitos.length);
const totalF = fiscal.vendas.reduce((s, v) => s + v.valor, 0) / 12;
confere("nenhum real se perde no agrupamento", perto(vendasF.reduce((s, v) => s + v.receita, 0), totalF, 0.05), [vendasF.reduce((s, v) => s + v.receita, 0), totalF]);
const comprasF = comprasDaDominio(fiscal);
const placaC = comprasF.find((item) => item.tipo === "mercadoria" && item.fornecedor === "normal");
confere("compra de mercadoria: valor/mês com IPI, ICMS 12% com crédito, IPI 5%", placaC?.valor === 42000 && placaC.aliquota === 12 && placaC.creditoIcms === true && placaC.ipi === 5, placaC);
const simplesC = comprasF.find((item) => item.fornecedor === "simples");
confere("compra de fornecedor do Simples vira linha própria", simplesC?.valor === 2000 && simplesC.creditoIcms === false && /Simples/.test(simplesC.descricao), simplesC);
const energiaC = comprasF.find((item) => item.tipo === "energia");
confere("energia: ICMS 18% embutido, sem crédito hoje", energiaC?.aliquota === 18 && energiaC.creditoIcms === false && energiaC.descricao === "Energia elétrica", energiaC);
const servC = comprasF.find((item) => item.tipo === "servico");
confere("serviço tomado: ISS 5% como alíquota embutida", servC?.aliquota === 5 && servC.creditoIcms === false, servC);
const retido = comprasDaDominio({ meses: 10, compras: [{ tipo: "servico", fornecedor: "normal", ncm: "", descricao: "", valor: 1000000, icms: 0, icms_creditado: 0, ipi: 0, iss: 5000 }] })[0];
confere("serviço tomado com só o ISS retido (0,5%): usa a alíquota de partida (5%)", retido.aliquota === 5 && retido.valor === 100000, retido);
const simF = calcularSimulacao({ regime: "real", vendas: vendasF, compras: comprasF }, P);
confere("simulação com os itens da Domínio calcula sem erro", Number.isFinite(simF.resumo.carga2033) && simF.resumo.receitaMensal > 0, simF.resumo);
const rf = resumoFiscal(fiscal);
confere("resumo fiscal: vendas/mês, NCMs e serviços", perto(rf.vendasMes, totalF, 0.01) && rf.ncms === 61 && rf.servicos === 1, rf);
const fiscalZero = { meses: 10, vendas: [{ ncm: "90213930", servico: "", descricao: "ENDOPROTESE", produtos: 1, valor: 900000, valor_pj: 900000, icms: 0, icms_st: false, ipi: 0, iss: 0, pis_cofins: "zero" }],
  compras: [{ tipo: "mercadoria", fornecedor: "normal", ncm: "90213930", descricao: "ENDOPROTESE", valor: 200000, icms: 0, icms_creditado: 0, ipi: 0, iss: 0 }, { tipo: "mercadoria", fornecedor: "normal", ncm: "48025610", descricao: "PAPEL", valor: 1000, icms: 180, icms_creditado: 180, ipi: 0, iss: 0 }] };
const comprasZero = comprasDaDominio(fiscalZero);
confere("compra de NCM vendido com PIS/Cofins zero: sem crédito de PIS/Cofins; o resto com", comprasZero.find((c) => c.ncm === "90213930")?.creditoPisCofins === false && comprasZero.find((c) => c.ncm === "48025610")?.creditoPisCofins === true, comprasZero);
const vendasZero = vendasDaDominio(fiscalZero);
const vendasRed = vendasZero.map((venda) => ({ ...venda, categoria: "red60" }));
const comprasSinc = sincronizarCategorias(vendasZero, vendasRed, comprasZero);
confere("categoria da venda vai pra compra do mesmo NCM (e só pra ela)", comprasSinc.find((c) => c.ncm === "90213930").categoria === "red60" && comprasSinc.find((c) => c.ncm === "48025610").categoria === "padrao", comprasSinc);
confere("sem mudança de categoria, compras ficam as mesmas", sincronizarCategorias(vendasZero, vendasZero.map((v) => ({ ...v, receita: 1 })), comprasZero) === comprasZero);
confere("aviso de regime: 1,08 mi/ano no Presumido não avisa; 108 mi avisa", avisoDeRegime(fiscalZero, "presumido") === null && Boolean(avisoDeRegime({ ...fiscalZero, meses: 0.1 }, "presumido")) === false && Boolean(avisoDeRegime({ meses: 10, vendas: [{ valor: 900_000_000 }] }, "presumido")) && avisoDeRegime({ meses: 10, vendas: [{ valor: 900_000_000 }] }, "real") === null);
// ── Anexos da LC 214 ──
const lc = (codigo, tipo) => sugestaoLc214(codigo, tipo);
confere("LC 214: endoprótese 9021.39.30 → zero, Anexo XII item 5 (prótese)", lc("9021.39.30").principal?.categoria === "zero" && lc("9021.39.30").principal.anexo === "XII" && lc("90213930").principal.itens[0].item === "XII/5");
confere("LC 214: 9021.39.91 está nas exceções do Anexo XII → sem redução", lc("90213991").principal === null && categoriaSugerida("90213991") === "padrao");
const cateter = lc("90183929");
confere("LC 214: cateter 9018.39.29 → 60% (Anexo IV) e zero só na venda ao poder público/SUS", cateter.principal?.categoria === "red60" && cateter.principal.anexo === "IV" && cateter.alternativas.some((a) => a.reducao === 100 && /SUS/.test(a.condicao)));
confere("LC 214: arroz 1006.30.21 → cesta básica (zero)", categoriaSugerida("10063021") === "zero" && lc("10063021").principal.titulo.startsWith("Cesta Básica"));
confere("LC 214: notebook 8471.30.12 → sem anexo (padrão); NCM incompleto → sem sugestão", categoriaSugerida("84713012") === "padrao" && categoriaSugerida("9021") === null);
const vendasLc = vendasDaDominio({ meses: 1, vendas: [{ ncm: "90213930", servico: "", descricao: "ENDOPROTESE", produtos: 1, valor: 100, valor_pj: 100, icms: 0, ipi: 0, iss: 0, pis_cofins: "zero" }, { ncm: "90183929", servico: "", descricao: "CATETER", produtos: 1, valor: 50, valor_pj: 50, icms: 0, ipi: 0, iss: 0, pis_cofins: "zero" }],
  compras: [] });
confere("trazer da Domínio já aplica a categoria da LC 214 (zero e 60%)", vendasLc[0].categoria === "zero" && vendasLc[1].categoria === "red60", vendasLc.map((v) => v.categoria));
const comprasLc = comprasDaDominio({ meses: 1, vendas: [], compras: [{ tipo: "mercadoria", fornecedor: "normal", ncm: "90213930", descricao: "ENDOPROTESE", valor: 100, icms: 0, icms_creditado: 0, ipi: 0, iss: 0 }, { tipo: "uso_consumo", fornecedor: "normal", ncm: "", descricao: "", valor: 10, icms: 0, icms_creditado: 0, ipi: 0, iss: 0 }] });
confere("compra de mercadoria sem ICMS = isenta (0%), categoria do NCM; uso e consumo sem destaque = 18% de partida", comprasLc[0].aliquota === 0 && comprasLc[0].categoria === "zero" && comprasLc[1].aliquota === 18, comprasLc);
confere("lerNumero entende ponto de milhar (3.642.286) e vírgula decimal", lerNumero("3.642.286") === 3642286 && lerNumero("10.432.364,67") === 10432364.67 && lerNumero("1.5") === 1.5);
confere("resumo vazio não quebra", vendasDaDominio({ meses: 12, vendas: [], compras: [] }).length === 0 && comprasDaDominio({}).length === 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
