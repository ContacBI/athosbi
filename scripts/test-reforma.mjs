// Testes do motor da Reforma Tributária (src/lib/reforma) — casos
// calculados à mão. Rodar: node scripts/test-reforma.mjs
import { ANOS, PARAMETROS_PADRAO, SIMPLES_ANEXOS, aliquotasDoAno, mesclarParametros, simplesAliquota } from "../src/lib/reforma/parametros.js";
import { calcularSimulacao } from "../src/lib/reforma/calculo.js";

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

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
