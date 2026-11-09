'use strict';
// Remover a foto de um membro já cadastrado (defeito do teste manual: o ✕ não valia ao salvar).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function abrirEdicaoComFoto() {
  const backend = criarBackend();
  const s = await abrir(browser, backend);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const token = await s.page.evaluate(() => App.session.token);
  backend.env.ctx.__t = token;
  backend.env.ctx.__m = { nome: 'Com Foto', sexo: 'Feminino', nascimento: '10/05/1990', nomeMae: 'Mae Teste', nomePai: 'Pai Teste', estadoCivil: 'Solteiro(a)', batismo: '01/2020', Igreja: 'Igreja Teste', funcao: 'Membro', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Betim', estado: 'MG', cep: '32600-000', celular: '(31) 98888-7777', ativo: true, foto: 'ARQUIVO_DRIVE_1', fotoZoom: 1.4, fotoX: 40, fotoY: 60 };
  const id = backend.env.run('mb_salvarMembro(__t, __m)').data.id;
  await s.page.evaluate(() => navigateTo('membros'));
  await esperarTela(s.page, 'membros');
  await s.page.waitForSelector('.tab');
  await s.page.evaluate(([id, px]) => { MB._fotoCache['ARQUIVO_DRIVE_1'] = px; mbEditarMembro(id); }, [id, PIXEL]);
  await s.page.waitForSelector('#mbf-nome');
  return { ...s, backend, id };
}
const fotoNaPlanilha = (backend, id) => {
  backend.env.ctx.__t2 = backend.env.ctx.__t;
  return backend.env.run("mb_listarMembros(__t2).data.filter(function(m){return m.id==='" + id + "'})[0].foto");
};

test('foto: remover (✕) e salvar limpa a foto do membro na planilha', async () => {
  const { page, backend, id, erros } = await abrirEdicaoComFoto();
  assert.equal(fotoNaPlanilha(backend, id), 'ARQUIVO_DRIVE_1');
  await page.click('[onclick*="mbRemoverFoto"]');
  await page.evaluate(() => mbSalvarForm());
  await page.waitForFunction(() => MB.tab === 'lista', null, { timeout: 8000 });
  assert.equal(fotoNaPlanilha(backend, id), '', 'a foto antiga continuou na planilha');
  assert.deepEqual(erros, []);
});

test('foto: editar sem mexer na foto mantém a foto existente', async () => {
  const { page, backend, id } = await abrirEdicaoComFoto();
  await page.fill('#mbf-funcao', 'Diácono');
  await page.evaluate(() => mbSalvarForm());
  await page.waitForFunction(() => MB.tab === 'lista', null, { timeout: 8000 });
  assert.equal(fotoNaPlanilha(backend, id), 'ARQUIVO_DRIVE_1');
});

test('foto: remover e depois escolher outra foto não deixa a remoção valer', async () => {
  const { page } = await abrirEdicaoComFoto();
  await page.click('[onclick*="mbRemoverFoto"]');
  assert.equal(await page.evaluate(() => MB.fotoRemovida), true);
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 720; c.height = 960; _mbAplicarFoto(c, 'nova.jpg'); });
  assert.deepEqual(await page.evaluate(() => [MB.fotoRemovida, MB.fotoNova]), [false, true]);
});
