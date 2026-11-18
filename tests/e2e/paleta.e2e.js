'use strict';
// Paleta dinâmica: para qualquer cor de marca, os tokens semânticos mantêm contraste legível nos dois temas.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

// azul, vinho, verde, laranja, cinza, amarelo e roxo: casos difíceis para texto sobre fundo e sobre o destaque
const MARCAS = ['#1D4ED8', '#7F1D3A', '#15803D', '#EA580C', '#6B7280', '#FACC15', '#7C3AED', '#0F766E', '#111111', '#FFFFFF'];

test('paleta: contraste de texto, destaque e texto-sobre-destaque em 10 marcas × 2 temas', async () => {
  const { page } = await abrir(browser, criarBackend());
  const falhas = await page.evaluate((marcas) => {
    const cr = (a, b) => { const x = _lum(_hexRgb(a)), y = _lum(_hexRgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const out = [];
    marcas.forEach((m) => ['dark', 'light'].forEach((t) => {
      const P = gerarPaleta(m, '', t);
      const chk = (nome, a, b, min) => { const v = cr(a, b); if (v < min) out.push(m + ' ' + t + ' ' + nome + ' ' + v.toFixed(2) + ' < ' + min); };
      ['surface-1', 'surface-2'].forEach((s) => {
        chk('text-1/' + s, P['text-1'], P[s], 7);
        chk('text-2/' + s, P['text-2'], P[s], 7);
        chk('text-3/' + s, P['text-3'], P[s], 4.5);
        chk('text-4/' + s, P['text-4'], P[s], 4.5);
        chk('accent/' + s, P['accent'], P[s], 3);
      });
      chk('text-3/surface-0', P['text-3'], P['surface-0'], 4.5);
      chk('accent-fg/accent', P['accent-fg'], P['accent'], 4.5);
      if (!/^#[0-9a-f]{6}$/i.test(P['accent-2'])) out.push(m + ' accent-2 inválido');
    }));
    return out;
  }, MARCAS);
  assert.deepEqual(falhas, []);
});

test('paleta: aplicar a identidade troca os tokens semânticos e os apelidos antigos seguem; sem cor, volta ao padrão', async () => {
  const { page } = await abrir(browser, criarBackend());
  const lerCss = () => page.evaluate(() => { const c = getComputedStyle(document.documentElement); return { accent: c.getPropertyValue('--accent').trim(), teal: c.getPropertyValue('--teal').trim(), bg2: c.getPropertyValue('--bg2').trim(), s1: c.getPropertyValue('--surface-1').trim() }; });
  const padrao = await lerCss();
  assert.equal(padrao.teal, padrao.accent, 'apelido --teal segue --accent');
  assert.equal(padrao.bg2, padrao.s1, 'apelido --bg2 segue --surface-1');
  await page.evaluate(() => { IDENTIDADE.corPrimaria = '#7F1D3A'; aplicarIdentidade(); });
  const vinho = await lerCss();
  assert.notEqual(vinho.accent, padrao.accent);
  assert.equal(vinho.teal, vinho.accent);
  assert.equal(vinho.bg2, vinho.s1);
  await page.evaluate(() => { IDENTIDADE.corPrimaria = ''; aplicarIdentidade(); });
  assert.deepEqual(await lerCss(), padrao);
});
