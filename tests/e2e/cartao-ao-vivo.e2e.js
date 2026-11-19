'use strict';
// Cadastro de membro: a carteirinha se monta enquanto se digita e gira para o verso.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { criarBackend, abrir, entrar } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test('cartão ao vivo: frente acompanha a digitação, verso gira no foco e mostra "—" nos vazios', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend, { viewport: { width: 1280, height: 720 } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('membros'));
  await page.waitForSelector('#mb-panel');
  await page.evaluate(() => mbNovoMembro());
  await page.waitForSelector('#mb-live-f .mb-card');

  assert.match(await page.textContent('#mb-live-lbl'), /Frente/);
  await page.fill('#mbf-nome', 'Maria da Silva Souza');
  assert.match(await page.textContent('#mb-live-f'), /Maria/, 'nome aparece na frente em tempo real');
  await page.fill('#mbf-funcao', 'Diaconisa');
  assert.match(await page.textContent('#mb-live-f'), /Diaconisa/);

  await page.focus('#mbf-nascimento');
  await page.waitForSelector('#mb-live-flip.virado');
  assert.match(await page.textContent('#mb-live-lbl'), /Verso/);
  assert.match(await page.textContent('#mb-live-b'), /—/, 'campo vazio aparece como traço');
  await page.fill('#mbf-nascimento', '12031990');
  assert.match(await page.textContent('#mb-live-b'), /12\/03\/1990/);
  assert.match(await page.textContent('#mb-live-txt'), /Verso: 1 de 6/);

  await page.focus('#mbf-nome');
  await page.waitForSelector('#mb-live-flip:not(.virado)');
  assert.equal(await page.locator('#mb-live .qr-box').count(), 0, 'prévia nunca mostra QR');
  const box = await page.locator('#mb-live').boundingBox();
  assert.ok(box.x > 700, 'prévia fica na coluna da direita no desktop');
});
