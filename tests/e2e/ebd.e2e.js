'use strict';
// Escola Dominical — Chamada (etapa 2): admin lança chamada; professor só vê a própria turma.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela, sha } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

function semear(backend) {
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Classes', { ID: 'c1', Nome: 'Jovens', Ativo: true });
  ins('Classes', { ID: 'c2', Nome: 'Adultos', Ativo: true });
  ins('Alunos', { ID: 'al1', Nome: 'Ana Souza', ClasseID: 'c1', Ativo: true });
  ins('Alunos', { ID: 'al2', Nome: 'Bruno Lima', ClasseID: 'c1', Ativo: true });
  ins('Alunos', { ID: 'al3', Nome: 'Carla Dias', ClasseID: 'c2', Ativo: true });
  ins('Aulas', { ID: 'a1', Data: '15/11/2026', Trimestre: '4', NumLicao: '7', Titulo: '', Ano: '2026' });
}

test('EBD: admin abre a Chamada, marca presença/bíblia, salva e a planilha recebe os pontos', async () => {
  const backend = criarBackend(); semear(backend);
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-row', { timeout: 6000 });
  assert.equal(await page.locator('.edm-row').count(), 2);
  await page.evaluate(() => { edmTog(0, 'presente'); edmTog(0, 'biblia'); });
  assert.match(await page.innerText('#edm-chips'), /1\s*Presentes/);
  assert.match(await page.innerText('.edm-row'), /\+3 pts/);
  await page.evaluate(() => edmSalvar());
  await page.waitForFunction(() => document.getElementById('edm-salvar').innerText.includes('Atualizar'), null, { timeout: 6000 });
  const linhas = backend.ss.getSheetByName('Chamadas')._rows;
  assert.equal(linhas.length, 3); // cabeçalho + 2 alunos
  const total = linhas.slice(1).map((r) => Number(r[8]));
  assert.deepEqual(total.sort(), [0, 3]);
  assert.deepEqual(erros, []);
});

test('EBD: professor entra direto na Escola Dominical e só vê a turma vinculada', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  env.ctx.__u = { ID: 'u9', Nome: 'Paulo Prof', Email: 'prof@igreja.test', SenhaHash: sha(env, 'Prof#Teste1'), Perfil: 'professor', PrimeiroAcesso: false, Ativo: true, TokenRecupSenha: '', ExpirToken: '', CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '' };
  env.run("Util.insertRow('Usuarios', __u)");
  env.ctx.__p = { ID: 'p1', Nome: 'Paulo Prof', UsuarioID: 'u9', ClasseID: 'c2', Ativo: true };
  env.run("Util.insertRow('Professores', __p)");
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'prof@igreja.test', 'Prof#Teste1', 'escola-dominical');
  await page.waitForSelector('#edm-sel-turma', { timeout: 6000 });
  const turmas = await page.$$eval('#edm-sel-turma option', (o) => o.map((x) => x.textContent.trim()));
  assert.deepEqual(turmas, ['Adultos']);
  assert.equal(await page.locator('button[aria-label="Nova aula"]').count(), 0);
  assert.deepEqual(erros, []);
});
