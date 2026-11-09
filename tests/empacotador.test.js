'use strict';
// Empacotador por cliente (Etapa 17): o pacote precisa ser completo, seguro e coerente com a implantação.
const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { empacotar, validar, CAMPOS } = require('../scripts/empacotar-cliente');
const { ROOT, createEnv } = require('./helpers/gas');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-')); }
function clienteEm(dir, extra) {
  const c = Object.assign(JSON.parse(fs.readFileSync(path.join(ROOT, 'clientes/exemplo/cliente.json'), 'utf8')), extra || {});
  const f = path.join(dir, 'cliente.json');
  fs.writeFileSync(f, JSON.stringify(c));
  return f;
}

test('empacotador: o modelo clientes/exemplo gera código, CSV, roteiro e versão', () => {
  const out = path.join(tmp(), 'saida');
  const r = empacotar('exemplo', out);
  ['codigo/Code.js', 'codigo/index.html', 'codigo/appsscript.json', 'Implantacao.csv', 'ENTREGA.md', 'VERSAO.txt'].forEach((f) => assert.ok(fs.existsSync(path.join(out, f)), 'faltando ' + f));
  assert.ok(!fs.existsSync(path.join(out, 'codigo/.clasp.json')), 'sem scriptId não gera .clasp.json');
  assert.ok(r.arquivos > 10);
  const md = fs.readFileSync(path.join(out, 'ENTREGA.md'), 'utf8');
  assert.match(md, /Igreja Exemplo Vida Nova/);
  assert.match(md, /implantarIgreja/);
  assert.match(md, /verificarImplantacao/);
});

test('empacotador: com scriptId gera .clasp.json (e nada de credenciais)', () => {
  const dir = tmp();
  const out = path.join(dir, 'saida');
  empacotar(clienteEm(dir, { scriptId: 'A'.repeat(30) }), out);
  const clasp = JSON.parse(fs.readFileSync(path.join(out, 'codigo/.clasp.json'), 'utf8'));
  assert.equal(clasp.scriptId, 'A'.repeat(30));
  const tudo = fs.readdirSync(out, { recursive: true }).map(String);
  assert.ok(!tudo.some((f) => /clasprc/.test(f)), 'credencial no pacote');
});

test('empacotador: dados inválidos são recusados e nada é gerado', () => {
  for (const ruim of [{ adminEmail: 'sem-arroba' }, { adminNome: '' }, { nome: '' }, { nome: 'Minha Igreja' }, { cor: 'roxo' }, { pastor: 'x'.repeat(200) }, { slug: 'Com Espaço' }, { scriptId: 'curto' }]) {
    const dir = tmp();
    const out = path.join(dir, 'saida');
    assert.throws(() => empacotar(clienteEm(dir, ruim), out), /problemas/, JSON.stringify(ruim));
    assert.ok(!fs.existsSync(out), 'nada deve ser gerado: ' + JSON.stringify(ruim));
  }
});

test('empacotador: valores com vírgula e aspas saem corretos no CSV', () => {
  const dir = tmp();
  const out = path.join(dir, 'saida');
  empacotar(clienteEm(dir, { endereco: 'Rua A, 10 "fundos"' }), out);
  assert.ok(fs.readFileSync(path.join(out, 'Implantacao.csv'), 'utf8').includes('"Rua A, 10 ""fundos"""'));
});

test('empacotador: as chaves do CSV são exatamente as que a implantação lê', () => {
  const env = createEnv(); env.load();
  const chavesImplantacao = Array.from(env.run('Implantacao.campos')).map((c) => c[0]).sort();
  assert.deepEqual(CAMPOS.map((c) => c[1]).sort(), chavesImplantacao);
});

test('empacotador: o CSV gerado é aceito pela implantação e produz a identidade do cliente', () => {
  const dir = tmp();
  const out = path.join(dir, 'saida');
  empacotar('exemplo', out);
  const linhas = fs.readFileSync(path.join(out, 'Implantacao.csv'), 'utf8').trim().split('\n').slice(1);
  const dados = {};
  linhas.forEach((l) => { const m = /^([A-Z_]+),(.*),$/.exec(l); dados[m[1]] = m[2].replace(/^"|"$/g, '').replace(/""/g, '"'); });
  const env = createEnv(); env.load();
  const r = env.run(`Implantacao.implantar(${JSON.stringify(dados)})`);
  assert.equal(r.admin.status, 'criado');
  const id = env.run('Config.identidade()');
  assert.equal(id.nome, 'Igreja Exemplo Vida Nova');
  assert.equal(id.corPrimaria, '#7c3aed');
  assert.equal(id.pastor, 'Pr. João da Silva');
});

test('empacotador: as regras de validação batem com as da implantação', () => {
  const env = createEnv(); env.load();
  const base = { ADMIN_NOME: 'A', ADMIN_EMAIL: 'a@b.org', NOME_IGREJA: 'Igreja X' };
  const casos = [
    [{ }, true], [{ ADMIN_EMAIL: 'x' }, false], [{ NOME_IGREJA: 'Minha Igreja' }, false], [{ COR_PRIMARIA: '#12' }, false],
    [{ COR_PRIMARIA: '#ABCDEF' }, true], [{ PASTOR: 'x'.repeat(81) }, false], [{ NOME_CURTO: 'y'.repeat(31) }, false], [{ ADMIN_NOME: '' }, false]
  ];
  casos.forEach(([extra, ok]) => {
    const gas = env.run(`Implantacao.validar(${JSON.stringify(Object.assign({}, base, extra))})`).ok;
    const c = { slug: 'x', adminNome: 'A', adminEmail: 'a@b.org', nome: 'Igreja X' };
    const mapa = { ADMIN_NOME: 'adminNome', ADMIN_EMAIL: 'adminEmail', NOME_IGREJA: 'nome', COR_PRIMARIA: 'cor', PASTOR: 'pastor', NOME_CURTO: 'nomeCurto' };
    Object.keys(extra).forEach((k) => { c[mapa[k]] = extra[k]; });
    const js = validar(c).erros.length === 0;
    assert.equal(gas, ok, 'implantação: ' + JSON.stringify(extra));
    assert.equal(js, ok, 'empacotador: ' + JSON.stringify(extra));
  });
});

test('empacotador: dados de clientes reais nunca entram no repositório (só o modelo)', () => {
  const ig = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ig, /^clientes\/\*$/m);
  assert.match(ig, /^!clientes\/exemplo\/$/m);
  assert.match(ig, /^dist-clientes\/$/m);
});
