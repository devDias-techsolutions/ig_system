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
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await s.page.evaluate(() => navigateTo('membros'));
  await esperarTela(s.page, 'membros');
  await s.page.waitForSelector('.tab');
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

// ── Foto escolhida ou tirada na câmera nativa: editor de enquadramento 3×4 ──
async function fotoDeTeste(page, w, h) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c33'); g.addColorStop(1, '#33c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  }, [w, h]);
  return { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

test('editor 3×4: foto da galeria/câmera nativa abre o editor, arrasta, dá zoom e grava recorte 3×4', async () => {
  const { page, erros } = await abrirFormulario({ viewport: { width: 390, height: 844 } });
  await page.setInputFiles('#mb-foto-input', await fotoDeTeste(page, 1600, 1200)); // paisagem
  await page.waitForSelector('#mb-crop-frame');
  const f = await page.evaluate(() => { const r = document.getElementById('mb-crop-frame').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  assert.ok(Math.abs(f[2] / f[3] - 0.75) < 0.02, 'moldura não é 3×4');
  await page.mouse.move(f[0] + f[2] / 2, f[1] + f[3] / 2);
  await page.mouse.down(); await page.mouse.move(f[0] + f[2] / 2 - 60, f[1] + f[3] / 2 + 10, { steps: 4 }); await page.mouse.up();
  await page.fill('#mb-crop-range', '2'); // dispara oninput do controle de zoom
  await page.evaluate(() => { const r = document.getElementById('mb-crop-range'); r.value = 2; r.dispatchEvent(new Event('input')); });
  assert.ok((await page.evaluate(() => MB_CROP.zoom)) > 1.9);
  await page.click('#mb-crop-ok');
  await page.waitForFunction(() => MB.fotoNova === true && MB.fotoData.startsWith('data:image/jpeg'));
  const dim = await page.evaluate(() => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = MB.fotoData; }));
  assert.deepEqual(dim, [720, 960]);
  assert.equal(await page.evaluate(() => !!document.getElementById('mb-crop')), false, 'editor devia fechar');
  assert.equal(await page.evaluate(() => [MB.fotoZoom, MB.fotoX, MB.fotoY].join()), '1,50,50');
  assert.deepEqual(erros, []);
});

test('editor 3×4: cancelar não altera a foto; foto pequena demais é recusada', async () => {
  const { page } = await abrirFormulario({});
  await page.setInputFiles('#mb-foto-input', await fotoDeTeste(page, 1000, 1333));
  await page.waitForSelector('#mb-crop-frame');
  await page.click('.mb-crop .mb-cam-bar button:first-child');
  assert.equal(await page.evaluate(() => [!!document.getElementById('mb-crop'), MB.fotoNova].join()), 'false,false');
  await page.setInputFiles('#mb-foto-input', await fotoDeTeste(page, 300, 400));
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !!document.getElementById('mb-crop')), false);
  assert.match(await page.evaluate(() => document.body.innerText), /Foto rejeitada/);
});

test('editor 3×4: foto grande é reduzida na memória (nunca mantém a original inteira)', async () => {
  const { page } = await abrirFormulario({});
  await page.setInputFiles('#mb-foto-input', await fotoDeTeste(page, 4000, 3000));
  await page.waitForSelector('#mb-crop-frame');
  const lado = await page.evaluate(() => Math.max(MB_CROP.canvas.width, MB_CROP.canvas.height));
  assert.ok(lado <= 1600, 'canvas de trabalho grande demais: ' + lado);
});

// ── Retomada do cadastro quando o navegador recarrega ao voltar da câmera do celular ──
test('retomada: recarregar a página no meio do cadastro reabre o formulário com o que foi digitado', async () => {
  const { page } = await abrirFormulario({});
  await page.fill('#mbf-nome', 'Maria Retomada');
  await page.fill('#mbf-celular', '(31) 99999-1111');
  await page.evaluate(() => { document.getElementById('mb-foto-input').click = () => {}; mbEscolherFoto(); }); // grava o rascunho como ao abrir a câmera
  await page.reload();
  await page.waitForFunction(() => App.currentView === 'membros' && document.getElementById('mbf-nome'), null, { timeout: 8000 });
  assert.equal(await page.inputValue('#mbf-nome'), 'Maria Retomada');
  assert.equal(await page.inputValue('#mbf-celular'), '(31) 99999-1111');
});

test('retomada: o rascunho some ao sair da tela de cadastro e no logout', async () => {
  const { page } = await abrirFormulario({});
  await page.fill('#mbf-nome', 'Alguém');
  await page.evaluate(() => { document.getElementById('mb-foto-input').click = () => {}; mbEscolherFoto(); });
  assert.ok(await page.evaluate(() => !!sessionStorage.getItem('draft_membros')));
  await page.evaluate(() => mbSetTab('lista'));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('draft_membros')), null);
  await page.evaluate(() => { mbSetTab('form'); });
  await page.waitForSelector('#mbf-nome');
  await page.evaluate(() => { document.getElementById('mb-foto-input').click = () => {}; mbEscolherFoto(); clearSession(); });
  assert.deepEqual(await page.evaluate(() => [sessionStorage.getItem('draft_membros'), sessionStorage.getItem('ad_retomar')]), [null, null]);
});

test('câmera ao vivo: quando falha, o aviso informa o motivo (para diagnóstico no Apps Script)', async () => {
  const { page } = await abrirFormulario({});
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); document.getElementById('mb-foto-input-cam').click = () => {}; });
  await page.click('#mb-btn-camera');
  await page.waitForFunction(() => document.body.innerText.includes('NotAllowedError'), null, { timeout: 4000 });
});
