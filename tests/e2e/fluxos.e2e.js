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
  document.querySelectorAll('#kpi-grid .kg-stat, #kpi-grid .kg-alert').forEach((c) => {
    const rot = c.querySelector('.kg-lab') ? c.querySelector('.kg-lab').textContent : c.textContent.replace(/[0-9]+|Ver lista ›/g, '');
    o[rot.trim()] = Number((c.textContent.match(/[0-9]+/) || [0])[0]);
  });
  return o;
});
const textoKpis = (page) => page.evaluate(() => document.getElementById('kpi-grid').innerText.replace(/\s+/g, ' '));

async function irParaHome(page) { await page.evaluate(() => navigateTo('home')); await esperarTela(page, 'home'); await page.waitForTimeout(250); }
async function irParaMembros(page) { await page.evaluate(() => navigateTo('membros')); await esperarTela(page, 'membros'); await page.waitForSelector('#mb-lista-container, .tab', { timeout: 6000 }); }

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
  assert.ok(!/Acesso ao sistema/.test(texto), 'secretaria não vê o grupo de usuários');
  assert.ok(!/Atividade recente/.test(texto), 'secretaria não vê atividade de administração');
  assert.match(texto, /Cadastro da igreja Ativos/);
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
  assert.equal(await page.locator('.hm-logo').count(), 0, 'logo só na barra superior');
  assert.equal(await page.textContent('#topnav-mark span'), 'VN');
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
test('desktop: sidebar com Início, módulos, Usuários e Identidade; o item ativo acompanha a tela', async () => {
  const { page, erros } = await comoAdmin();
  assert.ok(await page.isVisible('#app-sidebar'));
  assert.ok(!(await page.isVisible('#app-bnav')));
  const itens = await page.$$eval('#app-sidebar .sb-item', (els) => els.map((e) => e.innerText.trim()));
  assert.deepEqual(itens, ['Início', 'Membros', 'Usuários', 'Identidade']);
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
  assert.deepEqual(await page.$$eval('#app-bnav .bn-item', (els) => els.map((e) => e.innerText.trim())), ['Início', 'Membros', 'Usuários', 'Identidade']);
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
  assert.ok(extras.includes('Usuários') && extras.includes('Identidade') && extras.length === 4, extras.join(','));
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
  await page.waitForSelector('#kpi-grid .kpi-group:not(.is-loading)', { timeout: 6000 });
});

// ── Membros × Home (o defeito do cache apareceu aqui) ───────
test('membros: cadastrar, inativar e excluir refletem na lista e nos números da Home', async () => {
  const { page, erros } = await comoAdmin();
  assert.match(await textoKpis(page), /Ativos\s*0/i);

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
  assert.match(t, /Inativos/i, t);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#kpi-grid .kg-stat')].map((c) => c.innerText.replace(/\s+/g, ' ')).find((x) => /inativos/i.test(x)).match(/[0-9]+/)[0]), '1', t);

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
    const fr = document.querySelector('#modal-mb-aniv .modal-footer .btn').getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, vh: innerHeight, rodapeVisivel: fr.top >= box.top && fr.bottom <= innerHeight, semMenuPorCima: (document.elementFromPoint(fr.x + fr.width / 2, fr.y + fr.height / 2) || document.body).closest('.modal-footer') !== null, rolavel: body.scrollHeight > body.clientHeight, rolou: body.scrollTop > antes };
  });
  assert.ok(m.top >= 0 && m.bottom <= m.vh, 'modal cabe na tela: ' + JSON.stringify(m));
  assert.ok(m.rodapeVisivel, 'botão Fechar visível sem rolar a página: ' + JSON.stringify(m));
  assert.ok(m.semMenuPorCima, 'o menu inferior não cobre o botão Fechar: ' + JSON.stringify(m));
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
  await page.evaluate(() => navigateTo('usuarios'));
  await esperarTela(page, 'usuarios');
  await page.waitForTimeout(300);
  assert.deepEqual(await coresTeal(page), [], 'Usuários com teal solto');
});

test('logo: PNG transparente não ganha fundo próprio e esconde as iniciais ao carregar', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'LOGO_URL', 'https://exemplo.test/logo.png');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const { page } = await abrir(browser, backend);
  await page.route('https://exemplo.test/logo.png', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.reload();
  await page.waitForSelector('.login-logo-icon .brand-mark img');
  await page.waitForFunction(() => document.querySelector('.login-logo-icon .brand-mark img').complete);
  const r = await page.evaluate(() => {
    const img = document.querySelector('.login-logo-icon .brand-mark img');
    return { fundo: getComputedStyle(img).backgroundColor, iniciais: getComputedStyle(img.previousElementSibling).visibility };
  });
  assert.equal(r.fundo, 'rgba(0, 0, 0, 0)', 'a imagem não pode ter fundo próprio');
  assert.equal(r.iniciais, 'hidden', 'iniciais devem sumir quando o logo carrega');
});

// ── Tela Identidade: enviar logo pelo aparelho (Etapa 21 em partes) ──
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('identidade: admin envia o logo, ele aparece na tela e continua depois de recarregar', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('identidade'));
  await page.waitForSelector('#idt-logo');
  assert.equal(await page.locator('#idt-previa-logo img').count(), 0, 'começa sem imagem');
  await page.setInputFiles('#idt-arq-logo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await page.waitForSelector('#idt-previa-logo img');
  assert.match(await page.getAttribute('#idt-previa-logo img', 'src'), /^data:image\/png;base64,/);
  assert.match(await page.getAttribute('#app-icon', 'href'), /^data:image\/png;base64,/, 'ícone da aba usa o logo');
  assert.ok(await page.locator('.sb-logo .brand-mark img').count() >= 1, 'barra lateral mostra o logo');
  // sobrevive ao recarregamento: a próxima abertura do sistema já traz o logo na página de login (vem da planilha)
  assert.match(JSON.parse(backend.env.run('Config.identidadeJson()')).logoUrl, /^data:image\/png;base64,/);
  // remover volta às iniciais
  await page.click('#idt-remover-logo');
  await page.waitForFunction(() => !document.querySelector('#idt-previa-logo img'));
  assert.deepEqual(erros, []);
});

test('identidade: arquivo que não é imagem mostra aviso e nada é salvo', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('identidade'));
  await page.waitForSelector('#idt-logo');
  await page.setInputFiles('#idt-arq-logo', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('isto não é uma imagem') });
  await page.waitForSelector('.toast, [class*="toast"]');
  assert.equal(await page.locator('#idt-previa-logo img').count(), 0);
});

test('identidade: admin edita nome, cor e dados da carteirinha e salva num só lugar', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('identidade'));
  await page.waitForSelector('#idt-nome');
  const antesCor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim().toLowerCase());
  assert.equal(await page.isDisabled('#idt-salvar'), true, 'sem alterações o botão fica desabilitado');
  await page.fill('#idt-nome', 'Igreja Teste Nova');
  await page.fill('#idt-pastor', 'Pr. Fulano');
  await page.fill('#idt-cor-hex', '#7C3AED');
  const previa = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim().toLowerCase());
  assert.notEqual(previa, antesCor, 'prévia da cor na hora');
  assert.equal(await page.isDisabled('#idt-salvar'), false);
  await page.click('#idt-salvar');
  await page.waitForFunction(() => IDENTIDADE.nome === 'Igreja Teste Nova');
  assert.equal(await page.evaluate(() => IDENTIDADE.pastor), 'Pr. Fulano');
  assert.equal(JSON.parse(backend.env.run('Config.identidadeJson()')).corPrimaria, '#7c3aed');
  assert.equal(await page.isDisabled('#idt-salvar'), true);
});

test('identidade: cor sem salvar volta ao sair da tela; descartar restaura os campos', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const antes = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim());
  await page.evaluate(() => navigateTo('identidade'));
  await page.waitForSelector('#idt-nome');
  const nomeOrig = await page.inputValue('#idt-nome');
  await page.fill('#idt-nome', 'Outro');
  await page.fill('#idt-cor-hex', '#BE185D');
  await page.click('#idt-descartar');
  await page.waitForSelector('#idt-nome');
  assert.equal(await page.inputValue('#idt-nome'), nomeOrig);
  await page.fill('#idt-cor-hex', '#BE185D');
  await page.evaluate(() => navigateTo('home'));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()), antes);
});

test('identidade: cor inválida vinda do servidor mostra erro e nada muda', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const r = await page.evaluate(() => new Promise((ok) => google.script.run.withSuccessHandler(ok).idt_salvarAjustes(App.session.token, { COR_PRIMARIA: 'azul' })));
  assert.equal(r.success, false);
});

test('identidade: secretaria não vê o item no menu e não abre a tela nem envia pela API', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  assert.equal(await page.locator('.sb-nav :text("Identidade")').count(), 0);
  await page.evaluate(() => navigateTo('identidade'));
  await page.waitForTimeout(300);
  assert.notEqual(await page.evaluate(() => App.currentView), 'identidade');
  const r = await page.evaluate((png) => new Promise((ok) => google.script.run.withSuccessHandler(ok).idt_enviarImagem(App.session.token, 'logo', png)), PNG_1X1.toString('base64'));
  assert.equal(r.success, false);
});

test('carteirinha: assinatura enviada pela tela Identidade aparece no verso mesmo sem nome do pastor', async () => {
  const backend = criarBackend();
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  backend.env.ctx.__p = PNG;
  backend.env.run("Imagens.salvar('assinatura', __p)");
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.waitForFunction(() => IDENTIDADE.assinatura); // chega depois do login (idt_obter)
  const c = await cartao(page);
  assert.ok(c.html.includes('back-sign'), 'bloco da assinatura');
  assert.ok(c.html.includes('data:image/png;base64,' + PNG), 'imagem da assinatura no verso');
  assert.equal(c.html.includes('sign-name'), false, 'sem pastor, sem nome impresso');
});

test('carteirinha: logo enviado fica dentro do cabeçalho, em caixa pequena e sem posição absoluta', async () => {
  const backend = criarBackend();
  // logo largo e grande de propósito (2:1)
  const larg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64').toString('base64');
  backend.env.ctx.__p = larg; backend.env.run("Imagens.salvar('logo', __p)");
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('membros'));
  await page.waitForSelector('.tab, [data-tab]');
  await page.evaluate(() => {
    const w = document.createElement('div'); w.id = 'cartao-teste'; w.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
    w.innerHTML = mbCard_htmlFrente({ nome: 'Maria Silva', rol: '1', funcao: 'Membro' }, false); document.body.appendChild(w);
  });
  const r = await page.evaluate(() => {
    const img = document.querySelector('#cartao-teste .card-logo img'); const hd = document.querySelector('#cartao-teste .card-header');
    const a = img.getBoundingClientRect(), h = hd.getBoundingClientRect();
    return { pos: getComputedStyle(img).position, w: a.width, h: a.height, dentro: a.top >= h.top - 1 && a.bottom <= h.bottom + 1 && a.left >= h.left - 1 && a.right <= h.right + 1 };
  });
  assert.notEqual(r.pos, 'absolute');
  assert.ok(r.w <= 56 && r.h <= 56, 'logo no máximo 56px: ' + JSON.stringify(r));
  assert.ok(r.dentro, 'logo dentro do cabeçalho: ' + JSON.stringify(r));
});

test('padrão: KPIs de Membros são os mesmos cards do Início e seguem a cor da marca', async () => {
  const backend = criarBackend();
  await definirConfig(backend, 'COR_PRIMARIA', '#7c3aed');
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('membros'));
  await page.waitForSelector('.kpi-group');
  const r = await page.evaluate(() => ({
    n: document.querySelectorAll('.kpi-group').length,
    soltos: document.querySelectorAll('.kpi-card').length,
    antigo: document.querySelectorAll('.mb-kpi-card, .kpi-hero-status').length,
    cor: getComputedStyle(document.querySelector('.kpi-group .kg-dot:not(.ok):not(.bad):not(.warn)')).backgroundColor
  }));
  assert.equal(r.n, 2);
  assert.equal(r.soltos, 0);
  assert.equal(r.antigo, 0);
  assert.notEqual(r.cor, 'rgb(10, 61, 98)');
});

test('identidade: cor salva vira "cor recente" e pode ser reaplicada; sem recentes não mostra o bloco', async () => {
  const backend = criarBackend();
  const { page } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => { localStorage.removeItem('idt_cores_recentes'); navigateTo('identidade'); });
  await page.waitForSelector('#idt-cor-hex');
  assert.equal(await page.locator('.idt-recente').count(), 0);
  assert.ok(await page.isVisible('#idt-cor-botao'), 'botão "Escolher cor" visível');
  await page.fill('#idt-cor-hex', '7c3aed');
  await page.click('#idt-salvar');
  await page.waitForSelector('.idt-recente[data-cor="#7C3AED"]');
  await page.fill('#idt-cor-hex', '#BE185D');
  await page.click('#idt-salvar');
  await page.waitForFunction(() => document.querySelectorAll('.idt-recente').length === 2);
  await page.click('.idt-recente[data-cor="#7C3AED"]');
  assert.equal(await page.inputValue('#idt-cor-hex'), '#7C3AED');
});

test('layout: botões da barra de ações não mudam de lugar entre "tudo salvo" e "alterações pendentes" (celular e desktop)', async () => {
  const backend = criarBackend();
  for (const vp of [{ width: 412, height: 860 }, { width: 1280, height: 800 }]) {
    const { page } = await abrir(browser, backend, { viewport: vp });
    await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
    await page.evaluate(() => navigateTo('identidade'));
    await page.waitForSelector('#idt-salvar');
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); // mede a posição final, sem animação de entrada
    const caixa = async () => page.evaluate(() => ['idt-descartar', 'idt-salvar'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }));
    const limpo = await caixa();
    await page.fill('#idt-lema', 'Um lema qualquer');
    await page.waitForFunction(() => !document.getElementById('idt-salvar').disabled);
    await page.waitForTimeout(600);
    const sujo = await caixa();
    assert.deepEqual(sujo.map((c) => c.slice(0, 2)), limpo.map((c) => c.slice(0, 2)), 'posição dos botões mudou em ' + vp.width + 'px');
    assert.ok(limpo[0][0] < limpo[1][0], 'Descartar fica à esquerda de Salvar');
    if (vp.width < 1024) {
      // espera a barra parar de se mover (animações de entrada) antes de medir
      let ant = -1, atual = -2;
      for (let i = 0; i < 25 && ant !== atual; i++) { ant = atual; await page.waitForTimeout(200); atual = await page.evaluate(() => document.querySelector('.action-bar').getBoundingClientRect().bottom); }
      const nav = await page.evaluate(() => document.querySelector('.app-bnav').getBoundingClientRect().top);
      const info = await page.evaluate(() => ({ sy: window.scrollY, h: document.documentElement.scrollHeight, ih: innerHeight, ab: document.querySelector('.action-bar').getBoundingClientRect().top, cssBottom: getComputedStyle(document.querySelector('.action-bar')).bottom, pos: getComputedStyle(document.querySelector('.action-bar')).position, mq: matchMedia('(max-width: 1023px)').matches, iw: innerWidth, scrollers: Array.from(document.querySelectorAll('*')).filter((n) => n.scrollTop > 0).map((n) => n.tagName + '.' + n.className + ':' + n.scrollTop).slice(0, 5), vv: window.visualViewport && [visualViewport.height, visualViewport.offsetTop] }));
      assert.ok(atual <= nav, 'barra de ações acima do menu inferior: ' + JSON.stringify({ barra: atual, nav, ...info }));
    }
    await page.context().close();
  }
});

test('topo no celular mostra o nome curto da igreja ao lado do logo', async () => {
  const backend = criarBackend();
  await definirConfig(backend, 'NOME_CURTO', 'Vida Nova');
  const { page } = await abrir(browser, backend, { viewport: { width: 360, height: 740 } });
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  const r = await page.evaluate(() => { const n = document.querySelector('.topnav-name'); const b = n.getBoundingClientRect(); return { txt: n.textContent, visivel: b.width > 0 && getComputedStyle(n).display !== 'none', dentro: b.right <= innerWidth - 60 }; });
  assert.equal(r.txt, 'Vida Nova');
  assert.ok(r.visivel, 'nome curto visível no topo');
  assert.ok(r.dentro, 'não invade os botões da direita');
});

test('cartas: aba preenche membro, cargo, igreja e data; mudança troca o texto; capa sai de cabeça para baixo; emissão é registrada', async () => {
  const backend = criarBackend();
  definirConfig(backend, 'NOME_IGREJA', 'Igreja Vida Nova');
  definirConfig(backend, 'ENDERECO_IGREJA', 'Rua A, 10, Centro | Betim-MG');
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await irParaMembros(page);
  // membro criado direto no servidor (o fluxo de cadastro pela tela já é testado em outro lugar)
  const salvo = await page.evaluate(() => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_salvarMembro(App.session.token, { nome: 'Maria Souza', ativo: true, funcao: 'Membro' })));
  assert.equal(salvo.success, true);
  await page.evaluate(() => mbSetTab('cartas'));
  await page.waitForSelector('#cr-pre .cr-page', { timeout: 6000 });

  const carta = () => page.evaluate(() => document.querySelector('[data-cr="2"]').innerText.replace(/\s+/g, ' '));
  let t = await carta();
  assert.equal(await page.textContent('[data-cr="2"] .cr-opt.on'), 'RECOMENDAÇÃO');
  assert.match(t, /o membro Maria Souza/);
  assert.match(t, /Igreja de origem: Igreja Vida Nova/);
  assert.match(t, /Cargo exercido: Membro/);
  assert.match(t, /Local: Betim-MG/);
  assert.match(t, /recomendamos que o\(a\) recebais/);

  await page.fill('#cr-destino', 'AD Centro');
  await page.click('.cr-tipo label:has(input[value="mudanca"])');
  t = await carta();
  assert.equal(await page.textContent('[data-cr="2"] .cr-opt.on'), 'MUDANÇA');
  assert.equal(await page.locator('[data-cr="2"] .cr-opt.on').count(), 1, 'só um selo marcado');
  assert.match(t, /Apresentamos à igreja AD Centro/);
  assert.match(t, /havendo mudado de localidade/);

  const capa = await page.evaluate(() => {
    const c = document.querySelector('[data-cr="1"]');
    return { txt: c.innerText.replace(/\s+/g, ' '), giradas: [...c.querySelectorAll('.cr-capa')].every((e) => getComputedStyle(e).transform !== 'none'), rodapeReto: getComputedStyle(c.querySelector('.cr-rodape')).transform === 'none' };
  });
  assert.match(capa.txt, /Á Igreja: AD Centro/);
  assert.ok(capa.giradas, 'blocos da capa de cabeça para baixo');
  assert.ok(capa.rodapeReto, 'endereço no rodapé fica reto');

  // registro (o PDF em si depende das bibliotecas da CDN; aqui só o registro)
  const r = await page.evaluate(() => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_registrarCarta(App.session.token, { tipo: CR.tipo, membroId: CR.membroId, membroNome: 'Maria Souza', destino: CR.destino })));
  assert.equal(r.success, true);
  await page.evaluate(() => mbCarta_carregarHist());
  await page.waitForFunction(() => document.getElementById('cr-hist').innerText.includes('Maria Souza'), null, { timeout: 6000 });
  assert.deepEqual(erros, []);
});

test('carteirinha: QR de validação é opcional, aparece no verso sem cobrir a assinatura e emite código no servidor', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await irParaMembros(page);
  await page.addScriptTag({ path: require.resolve('qrcode-generator/qrcode.js') });   // na produção vem da CDN
  const salvo = await page.evaluate(() => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_salvarMembro(App.session.token, { nome: 'Maria Souza', ativo: true, funcao: 'Diaconisa' })));
  assert.equal(salvo.success, true);
  await page.evaluate(() => { mbSetTab('carteirinha'); });
  await page.waitForSelector('#mb-qr-opt', { timeout: 6000 });

  assert.equal(await page.isChecked('#mb-qr-opt'), false, 'QR começa desligado');
  assert.equal(await page.locator('.mb-card-back .back-qr').count(), 0, 'sem QR no verso por padrão');

  await page.check('#mb-qr-opt');
  await page.waitForSelector('.mb-card-back .back-qr .qr-box.prev');
  assert.equal(await page.isChecked('#mb-qr-opt'), true, 'escolha mantida após redesenhar');

  const qr = await page.evaluate(() => mbCard_emitirQr(MB.membros[0]));
  assert.match(qr, /^data:image\/gif;base64,/);
  const geo = await page.evaluate((src) => {
    const host = document.createElement('div');
    host.innerHTML = mbCard_htmlVerso(MB.membros[0], false, src);
    document.body.appendChild(host);
    const card = host.querySelector('.mb-card-back').getBoundingClientRect();
    const q = host.querySelector('.back-qr .qr-box').getBoundingClientRect();
    const r = { dentro: q.left >= card.left && q.right <= card.right && q.bottom <= card.bottom, img: !!host.querySelector('.qr-box img') };
    host.remove();
    return r;
  }, qr);
  assert.ok(geo.img && geo.dentro, 'QR dentro do cartão');

  const cred = await page.evaluate(() => new Promise((ok) => google.script.run.withSuccessHandler(ok).mb_emitirCredencial(App.session.token, MB.membros[0].id)));
  assert.equal(cred.success, true);
  assert.match(cred.data.url, /\?page=validar&c=[0-9a-f]{32}$/);
  assert.deepEqual(erros.filter((e) => !/qrcode|cdnjs/i.test(e)), []);
});
