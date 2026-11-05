'use strict';
// Protege a ferramenta de envio ao Apps Script: o que vai (e o que nunca vai) para o projeto.
const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { arquivosDoDeploy, preparar } = require('../scripts/preparar-deploy');
const { ROOT, listFiles } = require('./helpers/gas');

test('deploy: envia todos os .js/.html da raiz e o appsscript.json', () => {
  const lista = arquivosDoDeploy();
  [...listFiles('.js'), ...listFiles('.html'), 'appsscript.json'].forEach((f) => assert.ok(lista.includes(f), 'faltando ' + f));
});

test('deploy: nunca envia testes, módulos pendentes, scripts, docs ou package.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  const lista = preparar(dir);
  assert.deepEqual(fs.readdirSync(dir).sort(), lista);
  lista.forEach((f) => assert.ok(/\.(js|html)$|^appsscript\.json$/.test(f), 'arquivo indevido: ' + f));
  ['tests', 'modulos-pendentes', 'scripts', 'docs', 'package.json', '.github'].forEach((n) => assert.ok(!fs.existsSync(path.join(dir, n)), n + ' não pode ir'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('deploy: workflow não tem segredo embutido e só envia depois dos testes', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  assert.ok(y.indexOf('npm test') > 0 && y.indexOf('npm test') < y.indexOf('clasp'), 'testes devem rodar antes do clasp');
  assert.ok(/secrets\.CLASPRC_JSON/.test(y) && /secrets\.SCRIPT_ID/.test(y));
  assert.ok(!/"refresh_token"|"access_token"/.test(y));
});

test('deploy: arquivos de credencial são ignorados pelo git', () => {
  const g = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  ['.clasprc.json', '.clasp.json', 'dist/'].forEach((n) => assert.ok(g.includes(n), n + ' ausente do .gitignore'));
});
