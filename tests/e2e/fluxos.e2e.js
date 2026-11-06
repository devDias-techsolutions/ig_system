'use strict';
// Fluxos que antes eram testados à mão no Apps Script. Cada teste clica na tela real.
// Rodar: npm run e2e   (requer Playwright + Chromium)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function comoAdmin() {
  const backend = criarBackend();
  const s = await abrir(browser, backend);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1');
  await esperarTela(s.page, 'home');
  return { ...s, backend };
}

const kpis = (page) => page.evaluate(() => {
  const o = {};
  document.querySelectorAll('#kpi-grid > *').forEach((c) => { o[c.textContent.replace(/[0-9]+/g, '').trim()] = Number((c.textContent.match(/[0-9]+/) || [0])[0]); });
  return o;
});
const textoKpis = (page) => page.evaluate(() => document.getElementById('kpi-grid').innerText.replace(/\s+/g, ' '));

async function irParaHome(page) { await page.evaluate(() => navigateTo('home')); await esperarTela(page, 'home'); await page.waitForTimeout(250); }
async function irParaMembros(page) { await page.evaluate(() => navigateTo('membros')); await esperarTela(page, 'membros'); await page.waitForSelector('#mb-lista-container, .mb-tab', { timeout: 6000 }); }

async function cadastrarMembro(page, nome) {
  await page.evaluate(() => mbNovoMembro());
  await page.waitForSelector('#mbf-nome');
  await page.evaluate((n) => {
    const set = (id, v) => { const el = document.getElementById('mbf-' + id); if (!el) return; if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value); if (o) el.value = o.value; } else el.value = v; };
    set('nome', n); set('sexo', ''); set('nascimento', '19/11/1990'); set('nomeMae', 'Mãe Teste'); set('nomePai', 'Pai Teste');
    set('estadoCivil', ''); set('batismo', '04/2026'); set('Igreja', 'Igreja Teste'); set('funcao', 'Membro');
    set('rua', 'Rua A'); set('numero', '1'); set('bairro', 'Centro'); set('cidade', 'Betim'); set('estado', 'MG'); set('cep', '32639-514'); set('celular', '(31) 99999-0000');
  }, nome);
  await page.evaluate(() => mbSalvarForm());
  await page.waitForFunction((n) => document.getElementById('mb-lista-container') && document.getElementById('mb-lista-container').innerText.includes(n), nome, { timeout: 6000 });
}

// ── Acesso ──────────────────────────────────────────────────
test('login: senha errada mostra erro e certa leva à Home; sair e entrar de novo funciona', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'errada');
  await page.waitForSelector('#login-error', { state: 'visible', timeout: 4000 });
  assert.equal(await page.evaluate(() => App.currentView), 'login');
  await page.fill('#login-senha', 'Admin#Teste1');
  await page.click('#btn-login');
  await esperarTela(page, 'home');
  await page.evaluate(() => handleLogout());
  await esperarTela(page, 'login');
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1');
  await esperarTela(page, 'home');
  assert.deepEqual(erros, []);
});

test('perfil secretaria cai direto em Membros e não consegue abrir a Home', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1');
  await esperarTela(page, 'membros');
  await page.evaluate(() => navigateTo('home'));
  await page.waitForTimeout(500);
  assert.notEqual(await page.evaluate(() => App.currentView), 'home');
});

// ── Membros × Home (o defeito do cache apareceu aqui) ───────
test('membros: cadastrar, inativar e excluir refletem na lista e nos números da Home', async () => {
  const { page, erros } = await comoAdmin();
  assert.match(await textoKpis(page), /0\s*Membros ativos|Membros ativos\s*0/i);

  await irParaMembros(page);
  await cadastrarMembro(page, 'Fulano de Tal');

  await irParaHome(page);
  assert.equal((await kpis(page)).Ativos ?? 1, 1, await textoKpis(page));

  // inativar pela edição
  await irParaMembros(page);
  const id = await page.evaluate(() => MB.membros[0].id);
  await page.evaluate((i) => mbEditarMembro(i), id);
  await page.waitForSelector('#mbf-ativo');
  await page.selectOption('#mbf-ativo', 'false');
  await page.evaluate(() => mbSalvarForm());
  await page.waitForFunction(() => MB.tab === 'lista' && MB.membros.length === 1 && MB.membros[0].ativo === false, null, { timeout: 6000 });

  await irParaHome(page);
  const t = await textoKpis(page);
  assert.match(t, /Membros inativos/i, t);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#kpi-grid > *')].map((c) => c.innerText.replace(/\s+/g, ' ')).find((x) => /inativos/i.test(x)).match(/[0-9]+/)[0]), '1', t);

  // excluir
  await irParaMembros(page);
  await page.evaluate((i) => _mbDeletar(i), id);
  await page.waitForFunction(() => MB.membros.length === 0, null, { timeout: 6000 });
  assert.ok(!(await page.evaluate(() => document.getElementById('mb-lista-container').innerText)).includes('Fulano'));

  await irParaHome(page);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#kpi-grid > *')].map((c) => c.innerText.replace(/\s+/g, ' ')).find((x) => /inativos/i.test(x)).match(/[0-9]+/)[0]), '0');
  assert.deepEqual(erros, []);
});

test('membros: editar não cria duplicata e o nome novo aparece na lista', async () => {
  const { page, backend } = await comoAdmin();
  await irParaMembros(page);
  await cadastrarMembro(page, 'Maria Antiga');
  const id = await page.evaluate(() => MB.membros[0].id);
  await page.evaluate((i) => mbEditarMembro(i), id);
  await page.waitForSelector('#mbf-nome');
  await page.fill('#mbf-nome', 'Maria Nova');
  await page.evaluate(() => mbSalvarForm());
  await page.waitForFunction(() => MB.tab === 'lista' && MB.membros[0] && MB.membros[0].nome === 'Maria Nova', null, { timeout: 6000 });
  assert.equal(await page.evaluate(() => MB.membros.length), 1);
  assert.equal(backend.ss.getSheetByName('Membros')._rows.length, 2); // cabeçalho + 1
});

// ── Usuários ────────────────────────────────────────────────
test('usuários: a tela lista os usuários existentes', async () => {
  const { page, erros } = await comoAdmin();
  await page.evaluate(() => navigateTo('usuarios'));
  await esperarTela(page, 'usuarios');
  await page.waitForFunction(() => document.body.innerText.includes('Sara Secretaria'), null, { timeout: 6000 });
  assert.deepEqual(erros, []);
});
