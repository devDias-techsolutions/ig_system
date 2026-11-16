'use strict';
// Tela Alertas: configurar destinatários, ligar o envio automático, testar e enviar agora.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

// Acionadores com memória (o simulado padrão não guarda nada)
const GATILHOS = `var __tg = [];
  ScriptApp.getProjectTriggers = () => __tg;
  ScriptApp.deleteTrigger = (t) => { __tg = __tg.filter((x) => x !== t); };
  ScriptApp.newTrigger = (fn) => ({ fn, getHandlerFunction: () => fn, timeBased() { return this; }, everyDays() { return this; }, atHour() { return this; }, onWeekDay() { return this; }, create() { __tg.push(this); return this; } });`;

async function comoAdmin() {
  const backend = criarBackend();
  backend.env.run(GATILHOS);
  const s = await abrir(browser, backend);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await s.page.evaluate(() => navigateTo('alertas'));
  await s.page.waitForSelector('#alt-salvar');
  return { ...s, backend };
}

test('alertas: admin adiciona destinatário, liga o envio automático e salva', async () => {
  const { page, erros, backend } = await comoAdmin();
  assert.equal(await page.isDisabled('#alt-salvar'), true, 'sem alterações o botão fica desabilitado');
  assert.ok(await page.locator('.alt-vazio').count(), 'lista vazia mostra orientação');
  await page.fill('#alt-n-email', 'sem-arroba');
  await page.click('#alt-adicionar');
  assert.equal(await page.locator('.alt-linha').count(), 0, 'e-mail inválido não entra');
  await page.fill('#alt-n-nome', 'Pastor');
  await page.fill('#alt-n-email', 'pastor@igreja.test');
  await page.click('#alt-adicionar');
  assert.equal(await page.locator('.alt-linha').count(), 1);
  await page.locator('label.sw:has(#alt-ativo)').click();
  assert.equal(await page.isDisabled('#alt-salvar'), false);
  assert.equal(await page.isDisabled('#alt-testar'), true, 'testar só depois de salvar');
  await page.click('#alt-salvar');
  await page.waitForFunction(() => ALT.orig && ALT.orig.ativo === true);
  assert.match(await page.innerText('#alt-estado'), /Agendado/);
  assert.equal(backend.env.run('__tg.length'), 2);
  const cfg = JSON.parse(backend.env.scriptProps.getProperty('ALERTAS_CONFIG'));
  assert.deepEqual([cfg.ativo, cfg.destinatarios[0].email], [true, 'pastor@igreja.test']);
  assert.equal(await page.isDisabled('#alt-salvar'), true);
  // desligar remove os agendamentos
  await page.locator('label.sw:has(#alt-ativo)').click();
  await page.click('#alt-salvar');
  await page.waitForFunction(() => ALT.orig.ativo === false);
  assert.equal(backend.env.run('__tg.length'), 0);
  assert.deepEqual(erros, []);
});

test('alertas: teste manda e-mail para o próprio admin; descartar volta ao salvo', async () => {
  const { page, backend } = await comoAdmin();
  await page.click('#alt-testar');
  await page.waitForFunction(() => /Teste enviado/.test(document.getElementById('alt-resultado').textContent));
  assert.equal(backend.env.calls.emails.at(-1)[0], 'admin@igreja.test');
  await page.fill('#alt-n-email', 'a@igreja.test');
  await page.click('#alt-adicionar');
  assert.equal(await page.locator('.alt-linha').count(), 1);
  await page.click('#alt-descartar');
  await page.waitForSelector('.alt-vazio');
});

test('alertas: secretaria não vê o item no menu nem abre a tela', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  assert.equal(await page.locator('#app-sidebar [data-rota="alertas"], #app-sidebar >> text=Alertas').count(), 0);
  await page.evaluate(() => navigateTo('alertas'));
  assert.equal(await page.locator('#alt-salvar').count(), 0);
});
