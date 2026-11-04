'use strict';
// Testes de etapas futuras ficam "todo": aparecem no relatório, mas não quebram a suíte.
// A etapa que os libera é definida em tests/roadmap.json.

const nodeTest = require('node:test');
const cfg = require('../roadmap.json');

const registered = [];

function stageFor(name) {
  const key = Object.keys(cfg.pendentes).find((k) => name.startsWith(k));
  return key ? cfg.pendentes[key] : null;
}

function test(name, fn) {
  registered.push(name);
  const stage = stageFor(name);
  if (stage === null || stage <= cfg.etapaAtual) return nodeTest(name, fn);
  return nodeTest(name, { todo: `Etapa ${stage}` }, async (t) => {
    await fn(t);
    t.diagnostic(`já passa antes da Etapa ${stage}: libere em tests/roadmap.json`);
  });
}

module.exports = { test, cfg, registered, stageFor };
