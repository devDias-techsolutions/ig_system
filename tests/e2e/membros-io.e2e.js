'use strict';
// Membros: importar/exportar planilha (CSV/Excel) e "fonte de membros" oferecida por outros módulos.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function irParaMembros(backend) {
  const s = await abrir(browser, backend);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await s.page.evaluate(() => navigateTo('membros'));
  await esperarTela(s.page, 'membros');
  await s.page.waitForSelector('.mb-atalhos');
  return s;
}

test('membros: importa CSV em 4 passos (ignora quem já existe) e exporta CSV com acentos e aspas', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const token = await page.evaluate(() => App.session.token);
  backend.env.ctx.__t = token;
  backend.env.ctx.__m = { nome: 'Existente Silva', nascimento: '01/01/1990', cpf: '111.111.111-11', ativo: true };
  backend.env.run('mb_salvarMembro(__t, __m)');
  await page.evaluate(() => navigateTo('membros'));
  await esperarTela(page, 'membros');
  await page.waitForSelector('.mb-atalhos');

  await page.evaluate(() => mbIoAbrir());
  await page.waitForSelector('#modal-mb-io.open .mb-io-drop');
  const csv = 'Nome;Nascimento;Celular;CPF;Ativo\n"João ""Zeca"" Lima";1999-04-05;(31) 98888-7777;;sim\nAna Maria;10/10/2001;;;não\nExistente Silva;01/01/1990;;;sim\n';
  await page.setInputFiles('#modal-mb-io input[type=file]', { name: 'membros.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForFunction(() => !document.getElementById('mb-io-prox').disabled);
  await page.click('#mb-io-prox');
  const analise = await page.innerText('#mb-io-corpo');
  assert.match(analise, /2 novos/);
  assert.match(analise, /1 já cadastrados/);
  await page.click('#modal-mb-io button:has-text("Importar 2")');
  await page.waitForSelector('#mb-io-corpo:has-text("membros importados")', { timeout: 8000 });
  assert.match(await page.innerText('#mb-io-corpo'), /2 membros importados/);
  await page.click('#modal-mb-io button:has-text("Concluir")');
  await page.waitForFunction(() => MB.membros.length === 3, null, { timeout: 8000 });
  const nomes = await page.evaluate(() => MB.membros.map((m) => m.nome + '|' + m.nascimento + '|' + m.ativo).sort());
  assert.deepEqual(nomes, ['Ana Maria|10/10/2001|false', 'Existente Silva|01/01/1990|true', 'João "Zeca" Lima|05/04/1999|true']);

  // exportar
  await page.evaluate(() => mbIoAbrir());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#modal-mb-io button:has-text("Exportar CSV")')]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(out, /^﻿ROL;Nome;Sexo;Nascimento/);
  assert.match(out, /"João ""Zeca"" Lima";?/);
  assert.match(out, /Ana Maria;;10\/10\/2001|;Ana Maria;/);
  assert.equal(out.trim().split('\r\n').length, 4);
  assert.deepEqual(erros, []);
});

test('membros: "Importar da EBD" aparece no novo membro (módulo instalado) e preenche o formulário', async () => {
  const backend = criarBackend();
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Classes', { ID: 'c1', Nome: 'Jovens', Ativo: true });
  ins('Alunos', { ID: 'al1', Nome: 'Aluno Da Escola', DataNasc: '2008-03-15', ClasseID: 'c1', Telefone: '(31) 97777-0000', Email: 'aluno@x.com', Ativo: true });
  const { page, erros } = await irParaMembros(backend);
  await page.evaluate(() => mbNovoMembro());
  await page.waitForSelector('#mbf-nome');
  await page.click('button:has-text("Importar da EBD")');
  await page.waitForSelector('#modal-mb-fonte.open .mb-fonte-item', { timeout: 6000 });
  await page.click('.mb-fonte-item:has-text("Aluno Da Escola")');
  assert.equal(await page.inputValue('#mbf-nome'), 'Aluno Da Escola');
  assert.equal(await page.inputValue('#mbf-nascimento'), '15/03/2008');
  assert.equal(await page.inputValue('#mbf-celular'), '(31) 97777-0000');
  assert.equal(await page.inputValue('#mbf-email'), 'aluno@x.com');
  assert.deepEqual(erros, []);
});
