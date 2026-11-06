'use strict';
// Foto pela câmera com moldura 3×4. O Chromium usa uma câmera falsa (flags abaixo): valida o fluxo
// da tela (abrir, capturar, recortar 3×4, cair no mesmo fluxo da foto escolhida) e o fallback.
// Não valida a câmera real nem as permissões do iframe do Apps Script: isso só se testa no aparelho.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => {
  browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
});
after(async () => { await browser.close(); });

async function abrirFormulario(opts) {
  const backend = criarBackend();
  const s = await abrir(browser, backend, opts);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1');
  await esperarTela(s.page, 'home');
  await s.page.evaluate(() => navigateTo('membros'));
  await esperarTela(s.page, 'membros');
  await s.page.waitForSelector('.mb-tab');
  await s.page.evaluate(() => mbNovoMembro());
  await s.page.waitForSelector('#mb-btn-camera');
  return s;
}

test('câmera: abre com moldura 3×4, captura, recorta em 3×4 e alimenta o formulário', async () => {
  const { page, erros } = await abrirFormulario({ permissions: ['camera'], viewport: { width: 390, height: 844 } });
  await page.click('#mb-btn-camera');
  await page.waitForSelector('#mb-cam-video');
  await page.waitForFunction(() => document.getElementById('mb-cam-video').videoWidth > 0, null, { timeout: 8000 });
  const moldura = await page.evaluate(() => { const r = document.getElementById('mb-cam-frame').getBoundingClientRect(); return r.width / r.height; });
  assert.ok(Math.abs(moldura - 0.75) < 0.02, 'moldura não é 3×4: ' + moldura);
  await page.click('#mb-cam-shot');
  await page.waitForFunction(() => window.MB && MB.fotoNova === true && MB.fotoData.startsWith('data:image/jpeg'), null, { timeout: 8000 });
  const dim = await page.evaluate(() => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = MB.fotoData; }));
  assert.ok(Math.abs(dim[0] / dim[1] - 0.75) < 0.01, 'foto não ficou 3×4: ' + dim);
  assert.ok(dim[0] >= 400 && dim[1] >= 530, 'abaixo do mínimo de qualidade da carteirinha: ' + dim);
  assert.equal(await page.evaluate(() => !!document.getElementById('mb-cam')), false, 'a câmera devia fechar após capturar');
  assert.equal(await page.evaluate(() => MB_CAM.stream), null, 'o stream devia ser encerrado');
  assert.equal(await page.evaluate(() => document.getElementById('mb-zoom-wrap').style.display), 'block');
  assert.deepEqual(erros, []);
});

test('câmera: cancelar fecha a tela e desliga a câmera', async () => {
  const { page } = await abrirFormulario({ permissions: ['camera'] });
  await page.click('#mb-btn-camera');
  await page.waitForFunction(() => document.getElementById('mb-cam-video') && document.getElementById('mb-cam-video').videoWidth > 0);
  await page.click('.mb-cam-bar button:first-child');
  assert.equal(await page.evaluate(() => !!document.getElementById('mb-cam')), false);
  assert.equal(await page.evaluate(() => MB_CAM.stream), null);
  assert.equal(await page.evaluate(() => MB.fotoNova), false);
});

test('câmera: sem acesso à câmera ao vivo, cai na câmera nativa do aparelho', async () => {
  const { page } = await abrirFormulario({});
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('NotAllowedError')); window.__nativa = 0; document.getElementById('mb-foto-input-cam').click = () => { window.__nativa++; }; });
  await page.click('#mb-btn-camera');
  await page.waitForFunction(() => window.__nativa === 1, null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => !!document.getElementById('mb-cam')), false);
});

test('câmera: trocar de tela com a câmera aberta desliga o stream', async () => {
  const { page } = await abrirFormulario({ permissions: ['camera'] });
  await page.click('#mb-btn-camera');
  await page.waitForFunction(() => MB_CAM.stream);
  await page.evaluate(() => navigateTo('home'));
  await esperarTela(page, 'home');
  await page.evaluate(() => mbFecharCamera());
  assert.equal(await page.evaluate(() => MB_CAM.stream), null);
});
