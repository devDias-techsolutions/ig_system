'use strict';
// Ponto de entrada do `npm test`: carrega tudo no mesmo processo e valida o roadmap.

require('./static.test.js');
require('./runtime.test.js');
require('./deploy.test.js');

const assert = require('node:assert/strict');
const { test, cfg, registered } = require('./helpers/roadmap');

test('roadmap: toda entrada de roadmap.json corresponde a um teste existente', () => {
  const orfas = Object.keys(cfg.pendentes).filter((k) => !registered.some((n) => n.startsWith(k)));
  assert.deepEqual(orfas, [], 'Entradas sem teste correspondente (erro de digitação?):\n' + orfas.join('\n'));
});

test('roadmap: etapas válidas (inteiros de 1 a 21) e etapaAtual coerente', () => {
  Object.entries(cfg.pendentes).forEach(([k, v]) => {
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 21, `etapa inválida para "${k}": ${v}`);
  });
  assert.ok(Number.isInteger(cfg.etapaAtual) && cfg.etapaAtual >= 1 && cfg.etapaAtual <= 21);
});
