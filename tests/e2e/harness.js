'use strict';
// E2E: abre a tela REAL (index.html + módulos) num Chromium e liga o google.script.run
// ao backend REAL (os .js do projeto rodando no contexto simulado do Apps Script).
// Nada é simulado entre a tela e o backend — só a plataforma do Google.
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createEnv, makeSpreadsheet } = require('../helpers/gas');
const { montarIndex } = require('../helpers/shell');

const ORIGIN = 'https://app.local/'; // https: o login usa crypto.subtle (só existe em contexto seguro)

const PONTE = `
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (fn) { return runner(fn, fail); };
      if (name === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        window.__gas(name, args).then(function (r) { if (ok) ok(r); },
                                      function (e) { if (fail) fail(new Error(String(e && e.message || e))); });
      };
    }});
  }
  window.google = { script: { run: runner(null, null) } };
`;

function sha(env, s) { return env.run(`Util.sha256(${JSON.stringify(s)})`); }

// Planilha nova com admin e secretaria já criados (senhas conhecidas, independentes do seed de produção).
function criarBackend() {
  const ss = makeSpreadsheet();
  const env = createEnv({ spreadsheet: ss });
  env.load();
  env.run('SetupSheets.createAllSheets()');
  const novo = (id, nome, email, senha, perfil) => {
    env.ctx.__u = { ID: id, Nome: nome, Email: email, SenhaHash: sha(env, senha), Perfil: perfil, PrimeiroAcesso: false, Ativo: true, TokenRecupSenha: '', ExpirToken: '', CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '' };
    env.run("Util.insertRow('Usuarios', __u)");
  };
  // O admin semeado pelo setup sai da planilha: o teste não depende da senha padrão.
  ss.getSheetByName('Usuarios')._rows.splice(1);
  env.run("Util.invalidarCache('Usuarios')");
  novo('u1', 'Ana Admin', 'admin@igreja.test', 'Admin#Teste1', 'admin');
  novo('u2', 'Sara Secretaria', 'sec@igreja.test', 'Sec#Teste1', 'secretaria');
  return { env, ss };
}

async function abrir(browser, backend, { viewport = { width: 1280, height: 800 }, permissions = [] } = {}) {
  const ctx = await browser.newContext({ viewport, permissions });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e.message || e)));
  await page.exposeFunction('__gas', async (name, args) => {
    const fn = backend.env.ctx[name];
    if (typeof fn !== 'function') throw new Error('função inexistente no backend: ' + name);
    return JSON.parse(JSON.stringify(fn.apply(null, args) ?? null));
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === ORIGIN) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: montarIndex({ identidadeJson: backend.env.run('Config.identidadeJson()') }) });
    if (/lucide/.test(url) && process.env.LUCIDE_JS) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.LUCIDE_JS, 'utf8') });
    if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.startsWith('http')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.continue();
  });
  await page.addInitScript(PONTE);
  await page.goto(ORIGIN);
  await page.waitForSelector('#app.ready', { timeout: 8000 });
  return { ctx, page, erros };
}

// A tela de login pode ser redesenhada logo após o "ready" (a inicialização ainda navega), e em
// máquinas lentas (CI) isso cai entre o preenchimento e o clique. Por isso: preenche, confere,
// clica e, se informado `destino`, só considera feito quando a tela mudou; senão repete tudo.
async function entrar(page, email, senha, destino) {
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('#login-email');
    await page.fill('#login-email', email);
    await page.fill('#login-senha', senha);
    await page.waitForTimeout(250);
    const mantido = await page.evaluate(([e, p]) => {
      const a = document.getElementById('login-email'), b = document.getElementById('login-senha');
      return !!a && !!b && a.value === e && b.value === p;
    }, [email, senha]);
    if (!mantido) continue;
    await page.click('#btn-login').catch(() => {});
    if (!destino) return;
    const chegou = await page.waitForFunction((d) => App.currentView === d, destino, { timeout: 2500 }).then(() => true, () => false);
    if (chegou) return;
  }
  throw new Error(destino ? `login não levou à tela "${destino}"` : 'não consegui preencher o login (a tela continua sendo redesenhada)');
}

// Preenche uma chave da aba Config (como a pessoa faria na planilha) antes de abrir a tela
function definirConfig(backend, chave, valor) {
  backend.env.ctx.__c = { Chave: chave, Valor: valor, Descricao: '', AtualizadoEm: '' };
  const linha = backend.env.run(`Util.findRow('Config', 'Chave', ${JSON.stringify(chave)})`);
  backend.env.run(linha ? `Util.updateRow('Config', ${linha._rowIndex}, __c)` : "Util.insertRow('Config', __c)");
}

const tela = (page) => page.evaluate(() => App.currentView);
async function esperarTela(page, nome, ms = 6000) {
  await page.waitForFunction((n) => App.currentView === n, nome, { timeout: ms }).catch(async () => {
    throw new Error(`esperava a tela "${nome}", mas está em "${await tela(page)}"`);
  });
}

module.exports = { chromium, criarBackend, abrir, entrar, esperarTela, tela, sha, definirConfig };
