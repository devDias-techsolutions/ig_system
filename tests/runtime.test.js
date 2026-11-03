'use strict';
// Testes de execução: carregam o backend real num contexto com mocks do Google.

const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const { createEnv, makeSpreadsheet } = require('./helpers/gas');

const LEGACY_ID = '16Es1ybDiTm90HL75c6rRgqQv98AcZ7W33WMrfhksxkg';

function freshEnv(opts) {
  const env = createEnv(opts);
  env.load();
  return env;
}

// ═══ Carga e setup ══════════════════════════════════════════
test('carga: todos os arquivos .js carregam sem erro', () => {
  assert.doesNotThrow(() => freshEnv());
});

test('setup: setupSpreadsheet() cria todas as abas numa planilha vazia', () => {
  const env = freshEnv();
  assert.doesNotThrow(() => env.run('setupSpreadsheet()'));
  ['Usuarios', 'Sessoes', 'Classes', 'Alunos', 'Professores', 'Aulas', 'Chamadas', 'PontosExtras', 'Config', 'Membros']
    .forEach((n) => assert.ok(env.activeSS.getSheetByName(n), `aba ${n} ausente`));
});

test('setup: rodar setupSpreadsheet() duas vezes não duplica abas nem usuários', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  env.run('setupSpreadsheet()');
  const users = env.activeSS.getSheetByName('Usuarios')._rows.length - 1;
  assert.ok(users <= 1, `usuários após 2 execuções: ${users}`);
});

test('setup: nenhum usuário nasce com a senha padrão antiga', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  const oldHash = env.run("Util.sha256('Admin@1234')");
  const rows = env.activeSS.getSheetByName('Usuarios')._rows.slice(1);
  rows.forEach((r) => assert.ok(!r.includes(oldHash), 'admin com a senha padrão Admin@1234'));
});

// ═══ Planilha: nunca apontar para a planilha do autor ═══════
test('planilha: usa a planilha ativa (script vinculado) em vez de ID fixo', () => {
  const env = freshEnv();
  env.run('getSSInstance()');
  assert.ok(!env.calls.openById.includes(LEGACY_ID), 'abriu a planilha da igreja original');
});

test('planilha: sem planilha ativa e sem configuração, falha com mensagem clara (nunca abre a do autor)', () => {
  const env = freshEnv({ noActiveSpreadsheet: true });
  assert.throws(() => env.run('getSSInstance()'), /planilha/i);
  assert.ok(!env.calls.openById.includes(LEGACY_ID));
});

test('planilha: sem planilha ativa, usa SPREADSHEET_ID gravado em ScriptProperties', () => {
  const env = freshEnv({ noActiveSpreadsheet: true, scriptProperties: { SPREADSHEET_ID: 'MINHA_PLANILHA' } });
  env.run('getSSInstance()');
  assert.deepEqual(env.calls.openById, ['MINHA_PLANILHA']);
});

// ═══ Rotas web ══════════════════════════════════════════════
test('rota: página principal renderiza com o nome da igreja configurada', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  env.run("Util.insertRow('Config', {Chave:'NOME_IGREJA', Valor:'Igreja Teste Esperança', Descricao:'', AtualizadoEm:''})");
  const out = env.run('doGet({parameter:{}})');
  assert.match(out._title, /Igreja Teste Esperança/);
  assert.doesNotMatch(out._title, /Fonte da Salva/i);
});

test('rota: manifest PWA usa nome da igreja configurada e ícone configurável', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  env.run("Util.insertRow('Config', {Chave:'NOME_IGREJA', Valor:'Igreja Teste Esperança', Descricao:'', AtualizadoEm:''})");
  env.run("Util.insertRow('Config', {Chave:'NOME_CURTO', Valor:'Esperança', Descricao:'', AtualizadoEm:''})");
  const out = env.run("doGet({parameter:{page:'manifest'}})");
  const m = JSON.parse(out.getContent());
  assert.equal(m.name, 'Igreja Teste Esperança');
  assert.equal(m.short_name, 'Esperança');
  assert.ok(!JSON.stringify(m).includes('1D9uYwzWawJPpdcCp2hAtr0u20RnmOpQf'), 'ícone do Drive do autor');
});

test('rota: pré-cadastro público renderiza (_precadastro.html existe e é servido)', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  const out = env.run("doGet({parameter:{view:'precadastro'}})");
  assert.equal(out._file, '_precadastro');
});

// ═══ Regressão de autenticação ══════════════════════════════
test('auth: login com credenciais válidas retorna sessão e senha errada é recusada', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  const hash = env.run("Util.sha256('Senha@Teste1')");
  env.ctx.__hash = hash;
  env.run(`Util.insertRow('Usuarios', {ID:'u1', Nome:'Tester', Email:'t@igreja.test', SenhaHash:__hash, Perfil:'admin', PrimeiroAcesso:false, Ativo:true, TokenRecupSenha:'', ExpirToken:'', CriadoEm:'', UltimoLogin:''})`);
  const ok = env.run("login('t@igreja.test', __hash)");
  assert.equal(ok.success, true, JSON.stringify(ok));
  const bad = env.run("login('t@igreja.test', Util.sha256('errada'))");
  assert.equal(bad.success, false);
});
