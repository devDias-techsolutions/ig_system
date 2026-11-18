'use strict';
// Início no desktop: faixa de indicadores, rosca, ações rápidas no cabeçalho (ações dos módulos), sino e paginação.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const mm = String(new Date().getMonth() + 1).padStart(2, '0');
function membro(backend, nome, extra) {
  backend.env.ctx.__m = Object.assign({ nome, nascimento: '10/' + mm + '/1990', ativo: true }, extra || {});
  backend.env.run('mb_salvarMembro(__t, __m)');
}
async function entrarComo(backend, email, senha) {
  const s = await abrir(browser, backend);
  await entrar(s.page, email, senha, 'home');
  backend.env.ctx.__t = await s.page.evaluate(() => App.session.token);
  return s;
}
async function recarregarHome(page) {
  await page.evaluate(() => renderHome());
  await page.waitForFunction(() => !document.querySelector('.hm-main .is-loading'), null, { timeout: 8000 });
}

test('dashboard desktop: faixa de indicadores e rosca de membros com dados reais', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  membro(backend, 'Ativo Um'); membro(backend, 'Ativo Dois'); membro(backend, 'Inativo Tres', { ativo: false });
  backend.env.ctx.__o = { ID: 'c1', Nome: 'Jovens', Ativo: true }; backend.env.run("Util.insertRow('Classes', __o)");
  await recarregarHome(page);
  const faixa = await page.$$eval('#hm-faixa .hm-fk', (n) => n.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(faixa, ['2 Membros ativos', '0 Alunos da EBD', '1 Turmas', '0 Professores']);
  const rosca = await page.innerText('#hm-rosca');
  assert.match(rosca.replace(/\s+/g, ' '), /3 cadastrados.*Ativos 2.*Inativos 1/);
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight), true, 'sem rolagem da página');
  assert.deepEqual(erros, []);
});

test('dashboard desktop: acesso rápido abre as ações dos módulos', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  membro(backend, 'Maria Silva');
  await recarregarHome(page);
  assert.deepEqual(await page.$$eval('.hm-ac span', (n) => n.map((x) => x.textContent)), ['Novo membro', 'Emitir carta', 'Nova aula']);
  await page.click('.hm-ac:has-text("Novo membro")');
  await page.waitForSelector('#mbf-nome', { timeout: 6000 });
  await page.evaluate(() => navigateTo('home')); await esperarTela(page, 'home');
  await page.click('.hm-ac:has-text("Nova aula")');
  await page.waitForSelector('#modal-edm-form.open', { timeout: 6000 });
  assert.match(await page.innerText('#edm-form-titulo'), /Nova aula/);
  await page.evaluate(() => { edmFecharModal && edmFecharModal('modal-edm-form'); navigateTo('home'); }); await esperarTela(page, 'home');
  await page.click('.hm-ac:has-text("Emitir carta")');
  await page.waitForSelector('#cr-membro', { timeout: 6000 });
  assert.equal(await page.isChecked('input[name="cr-tipo"][value="recomendacao"]'), true);
  assert.deepEqual(erros, []);
});

test('dashboard desktop: secretaria vê Novo membro e Emitir carta; professor não tem acesso rápido', async () => {
  const backend = criarBackend();
  const { page } = await entrarComo(backend, 'sec@igreja.test', 'Sec#Teste1');
  await recarregarHome(page);
  const nomes = await page.$$eval('.hm-ac span', (n) => n.map((x) => x.textContent));
  assert.ok(nomes.includes('Novo membro') && nomes.includes('Emitir carta'));
});

test('topo desktop: sino mostra as pendências dos módulos e o botão de tema alterna', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  await recarregarHome(page);
  assert.equal(await page.locator('#sino-n').isHidden(), true, 'sem pendências, sem número');
  membro(backend, 'Sem Foto Silva'); // membro ativo sem foto = pendência
  await recarregarHome(page);
  await page.waitForFunction(() => document.getElementById('sino-n') && !document.getElementById('sino-n').hidden);
  assert.equal(await page.innerText('#sino-n'), '1');
  await page.click('#sino-btn');
  await page.waitForSelector('#sino-dd.open .sino-it');
  assert.match(await page.innerText('#sino-dd'), /1 membro sem foto/i);
  await page.click('#sino-dd .sino-it button');
  await esperarTela(page, 'membros');
  const antes = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#topnav-theme-btn');
  assert.notEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), antes);
  assert.deepEqual(erros, []);
});

test('dashboard desktop: aniversariantes paginados em pontos', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  ['Ana', 'Bia', 'Caio', 'Davi', 'Eva'].forEach((n) => membro(backend, n + ' Teste'));
  await recarregarHome(page);
  assert.equal(await page.locator('#aniv-pg button').count(), 2);
  assert.equal(await page.locator('#aniv-list .hm-aniv').count(), 3);
  await page.click('#aniv-pg button:nth-child(2)');
  assert.equal(await page.locator('#aniv-list .hm-aniv').count(), 2);
  assert.deepEqual(erros, []);
});
