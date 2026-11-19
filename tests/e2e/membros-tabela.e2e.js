'use strict';
// Membros no desktop: tabela ordenável, filtros, paginação e painel lateral.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { criarBackend, abrir, entrar } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test('lista desktop: tabela, ordenação, filtro por função, paginação e painel lateral', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend, { viewport: { width: 1280, height: 720 } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('membros'));
  await page.waitForSelector('#mb-lista-container');
  const nomes = ['Ana Lima', 'Bruno Costa', 'Carla Dias', 'Davi Souza', 'Elisa Rocha', 'Fábio Reis', 'Gisele Melo', 'Hugo Neves'];
  for (let i = 0; i < 16; i++) {
    const r = await page.evaluate((d) => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_salvarMembro(App.session.token, d)),
      { nome: nomes[i % 8] + (i > 7 ? ' Filho' : ''), ativo: i !== 3, funcao: i % 4 === 0 ? 'Diácono' : 'Membro', celular: '(31) 99999-00' + (10 + i) });
    assert.equal(r.success, true);
  }
  await page.evaluate(() => mbSetTab('lista'));
  await page.evaluate(() => new Promise((ok) => _mbLoad(ok)));
  await page.evaluate(() => _mbRenderPanel());
  await page.waitForSelector('table.mb-tbl');

  assert.ok((await page.locator('.mb-tr').count()) >= 5, 'linhas na tabela');
  assert.equal(await page.locator('.mb-pg').count(), 1, 'paginação aparece quando há mais linhas que a página');
  assert.match(await page.textContent('#mb-side'), /Selecione um membro/, 'painel lateral vazio no início');

  await page.click('.mb-th:has-text("Nome")');
  assert.equal(await page.getAttribute('th:has(.mb-th.on)', 'aria-sort'), 'descending');
  const primeiro = await page.textContent('.mb-tr .mb-td-nome');
  assert.match(primeiro, /Hugo/, 'ordem decrescente por nome');

  await page.selectOption('#mb-filtro-funcao', 'Diácono');
  assert.ok(await page.locator('.mb-tr').count() <= 4, 'filtro por função');
  await page.click('.mb-tr >> nth=0');
  await page.waitForSelector('#mb-side .mb-side-nome');
  assert.equal(await page.locator('#mb-side .mb-card').count(), 1, 'mini carteirinha no painel');
  assert.ok((await page.locator('#mb-side .mb-card').boundingBox()).x > 800, 'painel na coluna da direita');
  await page.click('#mb-side >> text=Editar');
  await page.waitForSelector('#mb-live');
});
