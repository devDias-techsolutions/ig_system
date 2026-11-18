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

test('dashboard desktop: aniversariantes compactos paginados em pontos (6 por página)', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  ['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fabio', 'Gil', 'Hana'].forEach((n) => membro(backend, n + ' Teste'));
  await recarregarHome(page);
  assert.equal(await page.locator('#aniv-pg button').count(), 2);
  assert.equal(await page.locator('#aniv-list .hm-aniv').count(), 6);
  await page.click('#aniv-pg button:nth-child(2)');
  assert.equal(await page.locator('#aniv-list .hm-aniv').count(), 2);
  assert.deepEqual(erros, []);
});

test('dashboard desktop: aniversariantes sem registros mostram uma linha só', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  await recarregarHome(page);
  assert.match(await page.innerText('#aniv-list'), /Nenhum aniversariante neste mês/);
  assert.equal(await page.locator('#aniv-pg button').count(), 0);
  assert.deepEqual(erros, []);
});

for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) {
  test('dashboard desktop ' + w + 'x' + h + ': atividade agrupada por dia, sem rolagem e sem registro cortado', async () => {
    const backend = criarBackend();
    const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
    // 8 alunos da EBD criados hoje (4), ontem (2) e há 10 dias (2): viram atividade recente
    const fmt = (d) => { const z = (n) => String(n).padStart(2, '0'); return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':00'; };
    [0, 0, 0, 0, 1, 1, 10, 10].forEach((dias, i) => {
      const d = new Date(Date.now() - dias * 864e5 - i * 60e3);
      backend.env.ctx.__a = { ID: 'al' + i, Nome: 'Aluno ' + i, Ativo: true, CriadoEm: fmt(d) };
      backend.env.run("Util.insertRow('Alunos', __a)");
    });
    await page.setViewportSize({ width: w, height: h });
    await recarregarHome(page);
    await page.waitForSelector('#activity-list .activity-item');
    const r = await page.evaluate(() => {
      const lista = document.getElementById('activity-list');
      const box = lista.getBoundingClientRect();
      const itens = Array.from(lista.querySelectorAll('.activity-item')).map((n) => n.getBoundingClientRect());
      const aniv = document.getElementById('aniv-list');
      return {
        rolaAtividade: lista.scrollHeight > lista.clientHeight + 1,
        rolaAniv: aniv.scrollHeight > aniv.clientHeight + 1,
        cortado: itens.some((b) => b.bottom > box.bottom + 1),
        n: itens.length,
        grupos: Array.from(lista.querySelectorAll('.hm-ativ-g')).map((g) => g.textContent),
        pontos: document.querySelectorAll('#activity-pg button').length,
      };
    });
    assert.equal(r.rolaAtividade, false, 'atividade sem rolagem');
    assert.equal(r.rolaAniv, false, 'aniversariantes sem rolagem');
    assert.equal(r.cortado, false, 'nenhum registro cortado');
    assert.ok(r.n >= 1 && r.n <= 8, 'até 8 por página, conforme a altura: ' + r.n);
    assert.equal(r.grupos[0], 'Hoje');
    assert.notEqual(r.pontos, 1, 'pontos só existem com 2 páginas ou mais (telas altas comportam tudo numa página)');
    assert.deepEqual(erros, []);
  });
}

// Galeria: 5 marcas × 2 temas com dados reais; contraste dos textos realmente desenhados e Início sem rolagem
const GALERIA = { azul: '#1D4ED8', vinho: '#7F1D3A', verde: '#15803D', laranja: '#EA580C', cinza: '#6B7280' };
test('dashboard desktop: contraste dos textos desenhados em 5 marcas × 2 temas', async () => {
  const backend = criarBackend();
  const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
  ['Ana', 'Bia', 'Caio'].forEach((n) => membro(backend, n + ' Teste'));
  const fmt = (d) => { const z = (n) => String(n).padStart(2, '0'); return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' 10:00:00'; };
  backend.env.ctx.__a = { ID: 'alx', Nome: 'Aluno Teste', Ativo: true, CriadoEm: fmt(new Date()) };
  backend.env.run("Util.insertRow('Alunos', __a)");
  const d = new Date(Date.now() + 864e5); const z = (n) => String(n).padStart(2, '0');
  backend.env.ctx.__e = { titulo: 'Culto', data: d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()), hora: '19:30', local: 'Templo' };
  backend.env.run("Agenda.salvar(__e, { perfil: 'admin', nome: 'x' })");
  const falhas = [];
  for (const [nome, cor] of Object.entries(GALERIA)) {
    for (const tema of ['dark', 'light']) {
      await page.evaluate(([c, t]) => {
        if (document.documentElement.getAttribute('data-theme') !== t) toggleTheme();
        IDENTIDADE.corPrimaria = c; aplicarIdentidade(); renderHome();
      }, [cor, tema]);
      await page.waitForFunction(() => !document.querySelector('.hm-main .is-loading') && document.querySelector('.ag-ev') && document.querySelector('.activity-item'), null, { timeout: 8000 });
      const r = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
        const fundo = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > .9)) return c; } return [255, 255, 255]; };
        const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const alvos = [['.hm-ch-t', 4.5], ['.hm-ch button', 4.5], ['.hm-fk-num', 4.5], ['.hm-fk-lab', 4.5], ['.hm-ativ-g', 4.5], ['.activity-text', 4.5], ['.activity-time', 4.5],
          ['.hm-aniv-nome', 4.5], ['.hm-aniv-dia', 4.5], ['.ag-ev-n', 4.5], ['.ag-ev-m', 4.5], ['.ag-ev-h', 3], ['.ag-ev-d span', 3], ['.ag-lt', 4.5], ['.ag-lh button', 4.5], ['.ag-mes-nome', 4.5], ['.page-title', 4.5], ['.page-sub', 4.5]];
        const out = [];
        alvos.forEach(([sel, min]) => document.querySelectorAll(sel).forEach((el) => {
          if (!el.offsetParent) return;
          const v = cr(rgb(getComputedStyle(el).color), fundo(el));
          if (v < min) out.push(sel + ' ' + v.toFixed(2) + ' < ' + min);
        }));
        return out;
      });
      r.forEach((x) => falhas.push(nome + ' ' + tema + ' ' + x));
    }
  }
  assert.deepEqual([...new Set(falhas)], []);
  assert.deepEqual(erros, []);
});

for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) {
  test('dashboard desktop ' + w + 'x' + h + ': o painel do Início não rola', async () => {
    const backend = criarBackend();
    const { page, erros } = await entrarComo(backend, 'admin@igreja.test', 'Admin#Teste1');
    ['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fabio', 'Gil'].forEach((n) => membro(backend, n + ' Teste'));
    await page.setViewportSize({ width: w, height: h });
    await recarregarHome(page);
    await page.waitForSelector('#aniv-list .hm-aniv');
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0)))); // fim da animação de entrada dos cartões
    const rolam = await page.evaluate(() => {
      const out = [];
      for (let n = document.querySelector('.hm'); n && n !== document.documentElement; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if (n.scrollHeight > n.clientHeight + 1 && (oy === 'auto' || oy === 'scroll')) out.push(n.tagName + '#' + n.id + ' ' + n.scrollHeight + '/' + n.clientHeight);
      }
      return out.concat(document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 1 ? ['página'] : []);
    });
    assert.deepEqual(rolam, []);
    assert.deepEqual(erros, []);
  });
}
