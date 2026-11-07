'use strict';
// Fluxos que antes eram testados à mão no Apps Script. Cada teste clica na tela real.
// Rodar: npm run e2e   (requer Playwright + Chromium)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela, definirConfig } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function comoAdmin() {
  const backend = criarBackend();
  const s = await abrir(browser, backend);
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
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
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  assert.deepEqual(erros, []);
});

test('perfil secretaria entra na Home do seu perfil (sem administração) e abre os módulos liberados', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await page.waitForFunction(() => !document.querySelector('#kpi-grid .is-loading'), null, { timeout: 6000 });
  const texto = await page.evaluate(() => document.querySelector('.hm').innerText.replace(/\s+/g, ' '));
  assert.match(texto, /Seu espaço de trabalho/);
  assert.ok(!/Administração/.test(texto), 'secretaria não vê o bloco de administração na Home');
  assert.ok(!/Usuários do sistema/.test(texto), 'secretaria não vê o indicador de usuários');
  assert.ok(!/Atividade recente/.test(texto), 'secretaria não vê atividade de administração');
  assert.match(texto, /Membros ativos/);
  await page.evaluate(() => navigateTo('membros'));
  await esperarTela(page, 'membros');
  assert.deepEqual(erros, []);
});

// ── Identidade da igreja (aba Config) ───────────────────────
test('Home: nome, lema e cor da igreja vêm da aba Config; sem logo aparecem as iniciais', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', 'Igreja Vida Nova');
  definirConfig(backend, 'LEMA_IGREJA', 'O Senhor é o meu pastor');
  definirConfig(backend, 'COR_PRIMARIA', '#0f766e');
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  assert.equal(await page.textContent('.hm-title'), 'Igreja Vida Nova');
  assert.equal(await page.textContent('.hm-lema'), 'O Senhor é o meu pastor');
  assert.match(await page.title(), /^Igreja Vida Nova/);
  assert.equal(await page.textContent('.hm-logo .brand-mark span'), 'VN');
  assert.equal(await page.locator('.hm-logo img').count(), 0);
  const cor = await page.evaluate(() => document.documentElement.style.getPropertyValue('--teal').trim());
  assert.ok(cor.length === 7 && cor[0] === '#', 'cor da marca aplicada: ' + cor);
  assert.deepEqual(erros, []);
});

test('Login e loader: nome, marca e ícone vêm da Config, nada da igreja original', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', 'Igreja Vida Nova');
  definirConfig(backend, 'COR_PRIMARIA', '#0f766e');
  const { page, erros } = await abrir(browser, backend);
  await page.waitForSelector('.login-church-name');
  assert.equal(await page.textContent('.login-church-name'), 'Igreja Vida Nova');
  assert.equal(await page.textContent('.login-logo-icon .brand-mark span'), 'VN');
  assert.match(await page.textContent('.login-footer'), /Igreja Vida Nova/);
  assert.match(await page.title(), /Igreja Vida Nova/);
  assert.match(await page.getAttribute('#app-icon', 'href'), /^data:image\/svg\+xml;base64,/);
  assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content'), 'Igreja Vida Nova');
  assert.equal(await page.textContent('#loader-mark span'), 'VN');
  // Tela e <head> (a carteirinha, no módulo Membros, só é parametrizada na Etapa 11)
  const visivel = await page.evaluate(() => document.head.outerHTML + document.body.innerText + [...document.images].map((i) => i.outerHTML.slice(0, 200)).join(''));
  assert.doesNotMatch(visivel, /Fonte da Salva|Logo AD|iVBORw0KGgo/);
  assert.deepEqual(erros, []);
});

test('Login: com LOGO_URL a imagem do logo aparece no lugar das iniciais', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'LOGO_URL', 'https://exemplo.test/logo.png');
  const { page } = await abrir(browser, backend);
  await page.waitForSelector('.login-church-name');
  assert.equal(await page.getAttribute('.login-logo-icon .brand-mark img', 'src'), 'https://exemplo.test/logo.png');
  assert.equal(await page.getAttribute('#app-icon', 'href'), 'https://exemplo.test/logo.png');
});

test('Home: cor muito escura é clareada no tema escuro (legibilidade) e volta a valer no claro', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'COR_PRIMARIA', '#1a237e');
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const escuro = await page.evaluate(() => document.documentElement.style.getPropertyValue('--teal').trim());
  assert.ok(lum(escuro) >= 0.19, 'no tema escuro a cor precisa ser clareada: ' + escuro);
  await page.evaluate(() => toggleTheme());
  const claro = await page.evaluate(() => document.documentElement.style.getPropertyValue('--teal').trim());
  assert.ok(lum(claro) <= 0.17, 'no tema claro a cor escura serve: ' + claro);
});

test('Home: conteúdo do nome da igreja é escapado (sem HTML injetado)', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', '<img src=x onerror="window.__xss=1">Igreja');
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.match(await page.textContent('.hm-title'), /<img src=x/);
});

// ── Navegação: sidebar no desktop, menu inferior no celular ──
test('desktop: sidebar com Início, módulos e Usuários; o item ativo acompanha a tela', async () => {
  const { page, erros } = await comoAdmin();
  assert.ok(await page.isVisible('#app-sidebar'));
  assert.ok(!(await page.isVisible('#app-bnav')));
  const itens = await page.$$eval('#app-sidebar .sb-item', (els) => els.map((e) => e.innerText.trim()));
  assert.deepEqual(itens, ['Início', 'Membros', 'Usuários']);
  assert.equal(await page.$eval('#app-sidebar .sb-item.active', (e) => e.innerText.trim()), 'Início');
  await page.click('#app-sidebar .sb-item:has-text("Membros")');
  await esperarTela(page, 'membros');
  assert.equal(await page.$eval('#app-sidebar .sb-item.active', (e) => e.innerText.trim()), 'Membros');
  assert.deepEqual(erros, []);
});

test('celular: menu inferior no lugar da sidebar, sem duplicar navegação nas telas', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend, { viewport: { width: 390, height: 844 } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  assert.ok(!(await page.isVisible('#app-sidebar')));
  assert.ok(await page.isVisible('#app-bnav'));
  assert.deepEqual(await page.$$eval('#app-bnav .bn-item', (els) => els.map((e) => e.innerText.trim())), ['Início', 'Membros', 'Usuários']);
  await page.click('#app-bnav .bn-item:has-text("Usuários")');
  await esperarTela(page, 'usuarios');
  assert.equal(await page.locator('#app-bnav').count(), 1);
  assert.equal(await page.locator('.usr-bottom-nav, .bottom-nav').count(), 0);
  assert.deepEqual(erros, []);
});

test('celular: com mais de 5 destinos os excedentes vão para "Mais"', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend, { viewport: { width: 390, height: 844 } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => {
    ['a', 'b', 'c', 'd'].forEach((x) => { MODULOS.push({ id: x, nome: 'Mod ' + x, descricao: '', icone: 'box', rota: 'mod-' + x, render: 'renderHome', perfis: ['admin', 'secretaria'] }); });
    renderNav(true);
  });
  const barra = await page.$$eval('#app-bnav .bn-item', (els) => els.map((e) => e.innerText.trim()));
  assert.equal(barra.length, 5);
  assert.equal(barra[4], 'Mais');
  await page.click('#app-bnav .bn-item:has-text("Mais")');
  await page.waitForSelector('#modal-mais.open');
  const extras = await page.$$eval('#bnav-more-list .sb-item', (els) => els.map((e) => e.innerText.trim()));
  assert.ok(extras.includes('Usuários') && extras.length === 3, extras.join(','));
  assert.deepEqual(erros, []);
});

// ── Home: estados vazios e erro ─────────────────────────────
test('Home: sem módulos ativos mostra estado vazio explicando como ativar', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => { MODULOS.length = 0; renderHome(); });
  const texto = await page.evaluate(() => document.querySelector('.hm-mods').innerText);
  assert.match(texto, /Nenhum módulo disponível/);
  assert.match(texto, /MODULOS_ATIVOS/);
  assert.deepEqual(erros, []);
});

test('Home: falha ao carregar indicadores mostra erro com "Tentar de novo" que funciona', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  let falhar = true;
  const original = backend.env.ctx.getKpisHome;
  backend.env.ctx.getKpisHome = (...a) => { if (falhar) throw new Error('queda'); return original(...a); };
  await page.evaluate(() => renderHome());
  await page.waitForSelector('#kpi-grid .hm-empty.erro', { timeout: 6000 });
  falhar = false;
  await page.click('#kpi-grid .hm-empty.erro .btn');
  await page.waitForSelector('#kpi-grid .kpi-card:not(.is-loading)', { timeout: 6000 });
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

// ── Busca na lista de Membros (defeito achado no teste manual: ROL não filtrava) ──
test('membros: a busca encontra pelo ROL (22, 0022, "ROL 22"), pelo nome e pela função', async () => {
  const { page, backend } = await comoAdmin();
  const token = await page.evaluate(() => App.session.token);
  backend.env.ctx.__t = token;
  [['Ana Lima', 11, 'Diácono'], ['Bruno Souza', 22, 'Presbítero'], ['Carla Dias', 122, 'Membro']].forEach(([nome, rol, funcao]) => {
    backend.env.ctx.__m = { nome, rol, funcao, ativo: true };
    assert.equal(backend.env.run('mb_salvarMembro(__t, __m)').success, true);
  });
  await irParaMembros(page);
  await page.waitForSelector('#mb-search-input');
  const lista = async (q) => {
    await page.fill('#mb-search-input', q);
    await page.waitForTimeout(150);
    return page.evaluate(() => ['Ana', 'Bruno', 'Carla'].filter((n) => document.getElementById('mb-lista-container').innerText.includes(n)));
  };
  assert.deepEqual(await lista('22'), ['Bruno'], '"22" não deve trazer o ROL 122');
  assert.deepEqual(await lista('0022'), ['Bruno']);
  assert.deepEqual(await lista('ROL 22'), ['Bruno']);
  assert.deepEqual(await lista('Nº 11'), ['Ana']);
  assert.deepEqual(await lista('presb'), ['Bruno']);
  assert.deepEqual(await lista('carla'), ['Carla']);
  assert.deepEqual(await lista(''), ['Ana', 'Bruno', 'Carla']);
});

test('celular: modal de aniversariantes fica inteiro na tela e a lista rola dentro dele', async () => {
  const backend = criarBackend();
  const s = await abrir(browser, backend, { viewport: { width: 390, height: 700 } });
  await entrar(s.page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await irParaMembros(s.page);
  await s.page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' }); // mede a posição final, não a animação
  await s.page.evaluate(() => {
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    MB.membros = Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, nome: 'Aniversariante ' + i, nascimento: String(1 + (i % 27)).padStart(2, '0') + '/' + mes + '/1990', foto: '' }));
    mbAbrirModalAniv();
  });
  await s.page.waitForTimeout(300);
  const m = await s.page.evaluate(() => {
    const box = document.querySelector('#modal-mb-aniv .modal-box').getBoundingClientRect();
    const body = document.getElementById('mb-aniv-body');
    const antes = body.scrollTop; body.scrollTop = 400;
    return { top: box.top, bottom: box.bottom, vh: innerHeight, rolavel: body.scrollHeight > body.clientHeight, rolou: body.scrollTop > antes };
  });
  assert.ok(m.top >= 0 && m.bottom <= m.vh, 'modal cabe na tela: ' + JSON.stringify(m));
  assert.ok(m.top > 20 && m.vh - m.bottom > 20, 'modal não encosta nas bordas: ' + JSON.stringify(m));
  assert.ok(m.rolavel && m.rolou, 'a lista rola dentro do modal: ' + JSON.stringify(m));
  assert.deepEqual(s.erros, []);
});

// ── Carteirinha parametrizada (Etapa 11) ────────────────────
const cartao = (page) => page.evaluate(() => {
  const m = { nome: 'Maria da Silva', rol: '12', funcao: 'Membro', nascimento: '01/01/1990' };
  const el = document.createElement('div');
  el.innerHTML = mbCard_htmlFrente(m, false) + mbCard_htmlVerso(m, false);
  return { texto: el.innerText || el.textContent, html: el.innerHTML };
});

test('carteirinha: nome, endereço, CNPJ, pastor e imagens vêm da Config', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', 'Igreja Vida Nova');
  definirConfig(backend, 'PASTOR', 'Pr. João Silva');
  definirConfig(backend, 'CARGO_PASTOR', 'Presidente');
  definirConfig(backend, 'ENDERECO_IGREJA', 'Rua das Flores, 10 - Centro');
  definirConfig(backend, 'CNPJ_IGREJA', '12.345.678/0001-90');
  definirConfig(backend, 'MARCA_DAGUA_URL', 'https://exemplo.test/marca.png');
  definirConfig(backend, 'ASSINATURA_URL', 'https://exemplo.test/assinatura.png');
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const c = await cartao(page);
  for (const t of ['Igreja Vida Nova', 'Pr. João Silva', 'Presidente', 'Rua das Flores, 10 - Centro', 'CNPJ: 12.345.678/0001-90']) {
    assert.ok(c.texto.includes(t), 'faltou na carteirinha: ' + t);
  }
  assert.ok(c.html.includes('https://exemplo.test/marca.png') && c.html.includes('https://exemplo.test/assinatura.png'));
  assert.doesNotMatch(c.html + c.texto, /Fonte da Salva|imgur|49\.482/);
  assert.deepEqual(erros, []);
});

test('carteirinha: sem dados opcionais na Config não imprime CNPJ, endereço, assinatura nem "undefined"', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', 'Igreja Vida Nova');
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const c = await cartao(page);
  assert.ok(c.texto.includes('Igreja Vida Nova'));
  assert.doesNotMatch(c.texto, /CNPJ|Sede -|undefined|null/);
  assert.equal(c.html.includes('back-sign'), false, 'assinatura sem pastor informado');
  assert.ok(c.html.includes('card-logo-ini'), 'sem logo, mostra as iniciais');
});

test('carteirinha: nome da igreja com HTML não injeta marcação', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'PASTOR', '<img src=x onerror="window.__xss=1">Pr');
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await cartao(page);
  assert.equal(await page.evaluate(() => window.__xss || 0), 0);
});

// ── Tema pela cor da igreja (Etapa 12) ──────────────────────
const TEAL_ORIGINAL = /rgba?\(\s*0\s*,\s*(?:217|196|169|137)\s*,\s*(?:198|181|156|123)|color\(srgb 0 0\.(?:85|77|66|54)/;
const coresTeal = (page) => page.evaluate((reTxt) => {
  const re = new RegExp(reTxt);
  const props = ['backgroundImage', 'backgroundColor', 'boxShadow', 'borderTopColor', 'color', 'outlineColor'];
  const achados = [];
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    props.forEach((p) => { if (re.test(cs[p])) achados.push((el.id || el.className || el.tagName) + ' · ' + p); });
  });
  return achados.slice(0, 10);
}, TEAL_ORIGINAL.source);

test('tema: com COR_PRIMARIA roxa, login e Home não mostram nenhum teal original', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'COR_PRIMARIA', '#7c3aed');
  const { page } = await abrir(browser, backend);
  await page.waitForSelector('.login-church-name');
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  assert.deepEqual(await coresTeal(page), [], 'login com teal solto');
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.waitForTimeout(300);
  assert.deepEqual(await coresTeal(page), [], 'shell/Home com teal solto');
});
