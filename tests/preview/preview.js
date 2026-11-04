'use strict';
// Preview das telas SEM Apps Script: monta o index.html (resolve os include) e simula google.script.run.
// Uso:  node tests/preview/preview.js <pasta-de-saida> [perfil]
// Requer: playwright (chromium) instalado e, para os ícones, LUCIDE_JS=/caminho/lucide.min.js
// Limites: dados simulados; fontes do Google e libs de PDF não são carregadas. Serve para conferir
// estrutura, navegação e visual — não substitui o teste real no Apps Script.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { ROOT, read, createEnv } = require('../helpers/gas');
const mock = require('./mock-backend');

const OUT = path.resolve(process.argv[2] || 'preview-out');
const PERFIL = process.argv[3] || 'admin';
const ORIGIN = 'http://preview.local/';

// SEM_MODULOS=1 simula uma planilha sem nenhum módulo instalado (só o núcleo).
function modulosAtivos() {
  const env = createEnv({ scriptProperties: process.env.SEM_MODULOS ? { MODULOS_ATIVOS: 'nenhum' } : {} });
  env.load();
  return { json: env.run('Modulos.jsonParaHtml()'), html: env.run('incluirModulos()') };
}

function montarIndex() {
  const mods = modulosAtivos();
  return read('index.html')
    .replace(/<\?!=\s*modulosJson\s*\?>/g, () => mods.json)
    .replace(/<\?!=\s*incluirModulos\(\);?\s*\?>/g, () => mods.html)
    .replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => read(f + '.html'))
    .replace(/<\?=\s*recovToken\s*\?>/g, '')
    .replace(/<\?=\s*view\s*\?>/g, '');
}

const SIMULACAO = `
  window.__MOCK = ${mock.serializar(PERFIL)};
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (fn) { return runner(fn, fail); };
      if (name === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
      return function () {
        var args = arguments;
        setTimeout(function () {
          try {
            var f = window.__MOCK[name];
            var r = f ? f.apply(null, args) : { success: false, error: 'sem simulação para ' + name };
            if (ok) ok(r);
          } catch (e) { if (fail) fail(e); }
        }, 30);
      };
    }});
  }
  window.google = { script: { run: runner(null, null) } };
`;

async function nova(browser, viewport, comSessao) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e.message || e)));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === ORIGIN) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: montarIndex() });
    if (/lucide/.test(url) && process.env.LUCIDE_JS) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.LUCIDE_JS, 'utf8') });
    if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.startsWith('http')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.continue();
  });
  await page.addInitScript(SIMULACAO);
  if (comSessao) await page.addInitScript(() => { try { sessionStorage.setItem('ad_sess_token', 'tok'); } catch (e) {} });
  return { ctx, page, erros };
}

// Espera a inicialização assentar (o shell ainda navega para a home logo após o "ready"),
// navega e CONFERE em qual tela realmente está — um preview que mostra a tela errada não prova nada.
async function irPara(page, rota, esperada) {
  await page.waitForSelector('#app.ready', { timeout: 8000 });
  await page.waitForTimeout(700);
  if (rota) await page.evaluate((r) => navigateTo(r), rota);
  await page.waitForTimeout(900);
  const atual = await page.evaluate(() => App.currentView);
  if (atual !== esperada) throw new Error(`preview na tela errada: esperava "${esperada}", está em "${atual}"`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const telas = [
    { nome: 'login', rota: null, sessao: false },
    { nome: 'home', rota: 'home', sessao: true },
    ...(process.env.SEM_MODULOS ? [] : [{ nome: 'membros', rota: 'membros', sessao: true }]),
    { nome: 'usuarios', rota: 'usuarios', sessao: true },
  ];
  const tamanhos = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
  const relatorio = [];
  for (const [tam, vp] of Object.entries(tamanhos)) {
    for (const t of telas) {
      const { ctx, page, erros } = await nova(browser, vp, t.sessao);
      await page.goto(ORIGIN);
      await irPara(page, t.sessao ? t.rota : null, t.nome === 'login' ? 'login' : t.rota);
      const arq = path.join(OUT, `${t.nome}-${tam}.png`);
      await page.screenshot({ path: arq });
      relatorio.push({ tela: t.nome, tam, erros });
      if (t.nome === 'usuarios') {
        await page.evaluate(() => { if (typeof usrRenderPermissoes === 'function') usrRenderPermissoes(); });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, `matriz-${tam}.png`) });
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'erros.json'), JSON.stringify(relatorio, null, 2));
  const comErro = relatorio.filter((r) => r.erros.length);
  console.log(`telas: ${relatorio.length} | com erro de JS: ${comErro.length}`);
  comErro.forEach((r) => console.log(`  ${r.tela}/${r.tam}: ${r.erros.slice(0, 3).join(' | ')}`));
})().catch((e) => { console.error(e); process.exit(1); });
