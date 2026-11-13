'use strict';
// Escalas e orçamento de efeitos (docs/UI-GUIDELINES.md). O limite por tela só diminui.

const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const U = require('./helpers/ui-escalas');

function tokens(css) {
  const t = {};
  const re = /(--(?:fs|r|dur)(?:-[\w-]+)?)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) if (!(m[1] in t)) t[m[1]] = m[2].trim();
  return t;
}

test('ui: o shell define as escalas de tipografia, raio e movimento como tokens', () => {
  const t = tokens(fs.readFileSync(path.join(U.ROOT, 'index.html'), 'utf8'));
  const px = (k) => parseFloat(t[k]);
  assert.deepEqual(['--fs-xs', '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl'].map(px), U.ESCALAS.fonte);
  assert.deepEqual(['--r-1', '--r-2', '--r-3', '--r-4'].map(px), U.ESCALAS.raio.filter((v) => v > 0));
  assert.match(t['--r-pill'] || '', /^999px$/);
  assert.deepEqual(['--dur-fast', '--dur', '--dur-slow'].map((k) => parseFloat(t[k])), U.ESCALAS.duracao);
});

test('ui: nenhuma tela ganha valor fora da escala (fonte, raio, transição) nem animação contínua nova', () => {
  const base = U.lerBaseline();
  const erros = [];
  U.telas().forEach((f) => {
    const a = U.auditar(fs.readFileSync(path.join(U.ROOT, f), 'utf8'));
    const b = base[f] || { fonte: 0, raio: 0, duracao: 0, infinitas: 0 };
    [['fonte', 'font-size (use var(--fs-*): 12/14/16/20/28/32)'],
     ['raio', 'border-radius (use var(--r-1..4) ou var(--r-pill))'],
     ['duracao', 'transition (use var(--dur-fast|--dur|--dur-slow))']].forEach(([k, rotulo]) => {
      if (a[k].length > b[k]) erros.push(`${f}: ${a[k].length} valores de ${rotulo}, limite ${b[k]}. Valores achados: ${a[k].join(', ')}`);
    });
    if (a.infinitas > b.infinitas) erros.push(`${f}: ${a.infinitas} animações contínuas (limite ${b.infinitas}). Máximo de uma por tela.`);
  });
  assert.deepEqual(erros, [], '\n' + erros.join('\n'));
});

test('ui: o limite de ui-baseline.json não ficou acima do que as telas realmente têm', (t) => {
  const base = U.lerBaseline(), atual = U.situacao();
  const folgas = [];
  Object.keys(base).forEach((f) => {
    Object.keys(base[f]).forEach((k) => {
      if (!atual[f] || atual[f][k] < base[f][k]) folgas.push(`${f}.${k}: limite ${base[f][k]}, atual ${atual[f] ? atual[f][k] : 'tela removida'}`);
    });
  });
  if (folgas.length) t.diagnostic('Corrigido! Rode `npm run ui:baseline` para travar o ganho:\n' + folgas.join('\n'));
});
