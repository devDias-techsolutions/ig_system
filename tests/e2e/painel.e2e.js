'use strict';
// Painel de controle (admin): porta das telas administrativas + atalhos definidos para todos.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test('painel: menu tem um item só, sem bolinha no topo; cartões abrem as telas e voltam ao painel', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  assert.equal(await page.locator('#avatar-btn').count(), 0, 'sem a bolinha com as iniciais no topo');
  const itens = await page.$$eval('#app-sidebar .sb-item span', (n) => n.map((x) => x.textContent));
  assert.ok(itens.includes('Painel de controle'));
  for (const solto of ['Usuários', 'Identidade', 'Alertas']) assert.ok(!itens.includes(solto), solto + ' não fica solto no menu');
  await page.click('#app-sidebar .sb-item:has-text("Painel de controle")');
  await esperarTela(page, 'painel');
  assert.deepEqual(await page.$$eval('.pn-card .pn-nome', (n) => n.map((x) => x.textContent)), ['Usuários', 'Identidade', 'Alertas', 'Atalhos']);
  await page.click('.pn-card:has-text("Alertas")');
  await esperarTela(page, 'alertas');
  // desktop (1280): o caminho fica na barra superior; a barra do módulo é só do celular
  assert.match(await page.innerText('#topnav-crumb'), /Painel de controle/);
  await page.click('#topnav-crumb .crumb-link');
  await esperarTela(page, 'painel');
  assert.equal(await page.locator('#app-sidebar .sb-item.active:has-text("Painel de controle")').count(), 1);
  assert.deepEqual(erros, []);
});

test('painel: secretaria não vê o painel e segue com Usuários no menu', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  const itens = await page.$$eval('#app-sidebar .sb-item span', (n) => n.map((x) => x.textContent));
  assert.ok(itens.includes('Usuários') && !itens.includes('Painel de controle'));
  await page.evaluate(() => navigateTo('painel'));
  await page.waitForTimeout(300);
  assert.notEqual(await page.evaluate(() => App.currentView), 'painel');
  assert.deepEqual(erros, []);
});

test('painel: admin esconde atalhos, salva na planilha e a barra do módulo muda para todos', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('painel-atalhos'));
  await esperarTela(page, 'painel-atalhos');
  assert.equal(await page.locator('.pn-sec', { hasText: 'Membros' }).count(), 1);
  assert.equal(await page.locator('input[data-mod="membros"][data-id="lista"]').isDisabled(), true, 'tela inicial é fixa');
  assert.equal(await page.locator('#pn-salvar').isDisabled(), true);
  await page.locator('input[data-mod="membros"][data-id="cartas"]').evaluate((i) => i.click());
  assert.equal(await page.locator('#pn-salvar').isDisabled(), false);
  await page.click('#pn-salvar');
  await page.waitForFunction(() => document.getElementById('pn-status').textContent === 'Tudo salvo');
  assert.equal(backend.env.run("Config.get('ATALHOS_OCULTOS', '')"), '{"membros":["cartas"]}');
  await page.evaluate(() => navigateTo('membros'));
  await esperarTela(page, 'membros');
  await page.waitForSelector('.mb-atalhos');
  assert.deepEqual(await page.$$eval('.mb-atalhos .hm-mod .hm-mod-name', (n) => n.map((x) => x.textContent)), ['Membros', 'Carteirinhas']);
  // quem entra depois (outro usuário/aparelho) já recebe a escolha do admin
  const outro = await abrir(browser, backend);
  await entrar(outro.page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await outro.page.evaluate(() => navigateTo('membros'));
  await esperarTela(outro.page, 'membros');
  await outro.page.waitForSelector('.mb-atalhos');
  assert.equal(await outro.page.locator('.mb-atalhos .hm-mod').count(), 2);
  assert.deepEqual(erros, []);
  assert.deepEqual(outro.erros, []);
});
