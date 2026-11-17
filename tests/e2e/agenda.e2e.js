'use strict';
// Início no desktop: sem cartão institucional, com calendário e eventos programados.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function inicio(opts) {
  const s = await abrir(browser, criarBackend(), opts || { viewport: { width: 1440, height: 900 } });
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await s.page.waitForSelector('.ag-dia');
  return s;
}

test('agenda: desktop não tem o cartão institucional; o título fica no canto e a agenda na lateral', async () => {
  const { page, erros } = await inicio();
  assert.equal(await page.isVisible('.hm-hero'), false);
  assert.match(await page.innerText('.hm-head .page-title'), /^(Bom dia|Boa tarde|Boa noite), Ana/);
  const lateral = await page.locator('.hm-side .ag').boundingBox();
  const principal = await page.locator('.hm-main').boundingBox();
  assert.ok(lateral.x > principal.x + principal.width - 1, 'agenda à direita da coluna principal');
  assert.equal(await page.locator('.ag-dia.hoje').count(), 1);
  assert.deepEqual(erros, []);
});

test('agenda: sem eventos mostra orientação e o botão de agendar; agendar, ver no dia, editar e cancelar', async () => {
  const { page, erros } = await inicio();
  assert.match(await page.innerText('.ag-lista'), /Nenhum evento agendado/);
  await page.click('.ag-lista .btn-primary');
  await page.fill('#ag-nome', '   ');
  await page.click('#ag-salvar');
  assert.match(await page.innerText('#ag-erro'), /nome do evento/);
  const amanha = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await page.fill('#ag-nome', 'Culto de doutrina');
  await page.fill('#ag-data', amanha);
  await page.fill('#ag-hora', '19:30');
  await page.fill('#ag-local', 'Templo');
  await page.click('#ag-salvar');
  await page.waitForSelector('.ag-ev');
  assert.match(await page.innerText('.ag-lista'), /Culto de doutrina[\s\S]*19:30 · Templo/);
  assert.ok(await page.locator('.ag-dia.tem').count() >= 1);

  // editar
  await page.click('.ag-ev');
  await page.fill('#ag-nome', 'Culto de ensino');
  await page.click('#ag-salvar');
  await page.waitForFunction(() => /Culto de ensino/.test(document.querySelector('.ag-lista').innerText));

  // dia escolhido
  await page.click('.ag-dia.tem');
  assert.match(await page.innerText('.ag-lt'), /,/);
  await page.click('.ag-lh button');
  assert.match(await page.innerText('.ag-lt'), /Próximos eventos/);

  // cancelar
  await page.click('.ag-ev');
  await page.click('#ag-overlay .btn-danger');
  await page.click('#confirm-ok-btn');
  await page.waitForFunction(() => /Nenhum evento agendado/.test(document.querySelector('.ag-lista').innerText));
  assert.deepEqual(erros, []);
});

test('agenda: celular mantém o cartão institucional e mostra a agenda no fim', async () => {
  const { page } = await inicio({ viewport: { width: 390, height: 844 } });
  assert.equal(await page.isVisible('.hm-hero'), true);
  assert.equal(await page.isVisible('.hm-head'), false);
  assert.equal(await page.isVisible('.ag'), true);
});
