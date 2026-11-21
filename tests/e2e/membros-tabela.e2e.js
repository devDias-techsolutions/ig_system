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
  assert.match(await page.textContent('#mb-side'), /Selecione um membro/, 'gaveta vazia no início');

  await page.click('.mb-th:has-text("Nome")');
  assert.equal(await page.getAttribute('th:has(.mb-th.on)', 'aria-sort'), 'descending');
  const primeiro = await page.textContent('.mb-tr .mb-td-nome');
  assert.match(primeiro, /Hugo/, 'ordem decrescente por nome');

  await page.selectOption('#mb-filtro-funcao', 'Diácono');
  assert.ok(await page.locator('.mb-tr').count() <= 4, 'filtro por função');
  await page.click('.mb-tr >> nth=0');
  await page.waitForSelector('#mb-side .mb-side-nome');
  assert.equal(await page.locator('#mb-side .flip-face').count(), 2, 'carteirinha com frente e verso na gaveta');
  assert.equal(await page.locator('#mb-side .mb-side-c').count(), 0, 'a gaveta mostra só a carteirinha, sem dados cadastrais');
  assert.ok((await page.locator('#mb-side .flip-stage').boundingBox()).x > 800, 'gaveta na coluna da direita');
  // Frente/Verso: o seletor gira o cartão e só um lado aparece por vez
  assert.equal(await page.getAttribute('#mb-side-flip', 'class'), 'flip-in');
  await page.click('#mb-side .seg button[data-lado=verso]');
  assert.match(await page.getAttribute('#mb-side-flip', 'class'), /virado/);
  assert.equal(await page.getAttribute('#mb-side .seg button[data-lado=verso]', 'aria-pressed'), 'true');
  await page.click('#mb-side .seg button[data-lado=frente]');
  assert.doesNotMatch(await page.getAttribute('#mb-side-flip', 'class'), /virado/);
  // olho antes da canetinha: abre a ficha cadastral
  const acoes = await page.$$eval('.mb-tr:first-child .mb-acoes button', (b) => b.map((x) => x.getAttribute('title')));
  assert.deepEqual(acoes, ['Ver ficha cadastral', 'Editar']);
  await page.click('.mb-tr:first-child .mb-acoes button >> nth=0');
  await page.waitForSelector('.mb-detail-name');
  await page.evaluate(() => mbSetTab('lista'));
  await page.waitForSelector('table.mb-tbl');
  await page.click('.mb-tr >> nth=0');
  await page.waitForSelector('#mb-side .mb-side-nome');
  await page.click('#mb-side >> text=Editar');
  await page.waitForSelector('#mb-live');
});

// Cabeçalho compacto no desktop, sem rolagem do painel, e Frente/Verso (carteirinha) e Carta/Capa girando
async function comMembros(w, h, n) {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend, { viewport: { width: w, height: h } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  for (let i = 0; i < n; i++) {
    await page.evaluate((d) => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_salvarMembro(App.session.token, d)),
      { nome: 'Membro ' + String(i + 1).padStart(2, '0'), ativo: true, funcao: 'Membro', celular: '(31) 99999-00' + (10 + i) });
  }
  await page.evaluate(() => navigateTo('membros'));
  await page.waitForSelector('table.mb-tbl');
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))));
  return page;
}

for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) {
  test('membros desktop ' + w + 'x' + h + ': abas e barra compactas, lista sem rolagem do painel', async () => {
    const page = await comMembros(w, h, 30);
    const r = await page.evaluate(() => {
      const abas = document.querySelector('.mb-atalhos').getBoundingClientRect();
      const barra = document.querySelector('.mb-bar').getBoundingClientRect();
      const tabela = document.querySelector('.mb-tbl-card').getBoundingClientRect();
      const rolam = [];
      for (let n = document.querySelector('.mb-tbl'); n && n !== document.documentElement; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if (n.scrollHeight > n.clientHeight + 1 && (oy === 'auto' || oy === 'scroll')) rolam.push(n.tagName + '#' + n.id + ' ' + n.scrollHeight + '/' + n.clientHeight);
      }
      return { abasAltura: abas.height, barraAltura: barra.height, tabelaTopo: tabela.top, tabelaFundo: tabela.bottom, vh: innerHeight, rolam,
        iconeRedondo: getComputedStyle(document.querySelector('.mb-atalhos .hm-mod-icon')).borderRadius, linhas: document.querySelectorAll('.mb-tr').length };
    });
    assert.ok(r.abasAltura <= 44, 'abas compactas: ' + r.abasAltura);
    assert.ok(r.barraAltura <= 44, 'busca e filtros numa barra só: ' + r.barraAltura);
    assert.ok(r.tabelaFundo <= r.vh, 'tabela inteira na tela: ' + r.tabelaFundo + ' > ' + r.vh);
    assert.deepEqual(r.rolam, []);
    assert.ok(r.linhas >= 5);
  });
}

test('membros desktop: Frente/Verso da carteirinha gira em vez de empilhar', async () => {
  const page = await comMembros(1280, 720, 3);
  await page.evaluate(() => mbSetTab('carteirinha'));
  await page.waitForSelector('#mb-prev-flip');
  assert.equal(await page.locator('.mb-card-preview-label').count(), 0, 'sem rótulos empilhados');
  const antes = await page.evaluate(() => { const f = document.getElementById('mb-prev-flip'); return f.querySelector('.flip-face:not(.verso)').getBoundingClientRect().top === f.querySelector('.flip-face.verso').getBoundingClientRect().top; });
  assert.equal(antes, true, 'os dois lados ocupam o mesmo lugar');
  await page.click('.mb-card-prev .seg button[data-lado=verso]');
  assert.match(await page.getAttribute('#mb-prev-flip', 'class'), /virado/);
  const rolagem = await page.evaluate(() => document.querySelector('.mb-card-prev').scrollWidth <= document.querySelector('.mb-card-prev').clientWidth + 1);
  assert.equal(rolagem, true);
});

test('membros desktop: Carta/Capa gira no mesmo lugar e a prévia cabe na altura da tela', async () => {
  const page = await comMembros(1280, 720, 3);
  await page.evaluate(() => mbSetTab('cartas'));
  await page.waitForSelector('#cr-pre .cr-page');
  assert.equal(await page.locator('.cr-pre-rot').count(), 0);
  const r = await page.evaluate(() => { const b = document.getElementById('cr-pre').getBoundingClientRect(); return { w: b.width, h: b.height, fundo: b.bottom, vh: innerHeight }; });
  assert.ok(r.fundo <= r.vh, 'prévia inteira na tela: ' + r.fundo);
  assert.ok(Math.abs(r.h / r.w - 1123 / 794) < 0.02, 'proporção da folha');
  await page.click('.cr-prev .seg button[data-lado=verso]');
  assert.match(await page.getAttribute('#cr-flip', 'class'), /virado/);
});
