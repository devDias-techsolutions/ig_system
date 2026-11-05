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

function envSetup() {
  const ss = makeSpreadsheet();
  const env = createEnv({ spreadsheet: ss });
  env.load();
  return { env, ss };
}

test('setup: setupSpreadsheet() cria todas as abas numa planilha vazia', () => {
  const { env, ss } = envSetup();
  assert.doesNotThrow(() => env.run('setupSpreadsheet()'));
  ['Usuarios', 'Sessoes', 'Config', 'Membros'].forEach((n) => assert.ok(ss.getSheetByName(n), `aba ${n} ausente`));
  const cab = ss.getSheetByName('Membros')._rows[0];
  assert.equal(cab[0], 'id');
  assert.ok(cab.includes('ativo'));
});

test('setup: rodar setupSpreadsheet() duas vezes não duplica abas nem usuários', () => {
  const { env, ss } = envSetup();
  env.run('setupSpreadsheet()');
  env.run('setupSpreadsheet()');
  const users = ss.getSheetByName('Usuarios')._rows.length - 1;
  assert.ok(users <= 1, `usuários após 2 execuções: ${users}`);
});

test('setup: runMigrate() adiciona colunas ausentes sem apagar dados', () => {
  const { env, ss } = envSetup();
  env.run('setupSpreadsheet()');
  const m = ss.getSheetByName('Membros');
  m.appendRow(['m1', '0001', 'Maria']);
  assert.doesNotThrow(() => env.run('runMigrate()'));
  assert.equal(ss.getSheetByName('Membros')._rows[1][2], 'Maria');
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
  assert.deepEqual(env.calls.openById, []);
  assert.equal(env.run('getSSInstance()'), env.activeSS);
});

test('planilha: sem planilha ativa e sem configuração, falha com mensagem clara (nunca abre a do autor)', () => {
  const env = freshEnv({ noActiveSpreadsheet: true });
  assert.throws(() => env.run('getSSInstance()'), /planilha/i);
  assert.ok(!env.calls.openById.includes(LEGACY_ID));
});

test('planilha: configurarPlanilha(id) grava o ID e o getSSInstance passa a usá-lo', () => {
  const env = freshEnv({ noActiveSpreadsheet: true });
  env.run("configurarPlanilha('OUTRA_PLANILHA')");
  assert.equal(env.scriptProps.getProperty('SPREADSHEET_ID'), 'OUTRA_PLANILHA');
  env.run('getSSInstance()');
  assert.ok(env.calls.openById.includes('OUTRA_PLANILHA'));
});

test('planilha: configurarPlanilha() sem ID falha', () => {
  const env = freshEnv({ noActiveSpreadsheet: true });
  assert.throws(() => env.run('configurarPlanilha("")'), /Informe/);
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

// ═══ Núcleo + Membros sem módulos pendentes (Etapa 2) ═══════
function ssComAbas(abas) {
  const ss = makeSpreadsheet();
  Object.entries(abas).forEach(([nome, linhas]) => {
    const s = ss.insertSheet(nome);
    linhas.forEach((l) => s.appendRow(l));
  });
  return ss;
}
const COLS_USUARIOS = ['ID', 'Nome', 'Email', 'SenhaHash', 'Perfil', 'PrimeiroAcesso', 'Ativo', 'TokenRecupSenha', 'ExpirToken', 'CriadoEm', 'UltimoLogin'];

function envComSessao(abas) {
  const env = createEnv({ spreadsheet: ssComAbas(abas) });
  env.load();
  env.scriptCache.put('sess_tok', JSON.stringify({
    token: 'tok', id: 'u1', nome: 'Ana', email: 'ana@igreja.test', perfil: 'admin',
    expiraEm: new Date(Date.now() + 3600e3).toISOString(), primeiroAcesso: false,
  }), 3600);
  return env;
}

test('núcleo: perfis do MVP são apenas admin e secretaria', () => {
  const env = freshEnv();
  assert.deepEqual(Object.keys(JSON.parse(env.run('JSON.stringify(PERFIS)'))).sort(), ['ADMIN', 'SECRETARIA']);
});

test('núcleo: KPIs da home funcionam sem nenhuma aba da Escola Dominical', () => {
  const env = envComSessao({
    Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
    Membros: [['id', 'nome', 'foto', 'ativo'], ['1', 'A', 'x.png', true], ['2', 'B', '', true], ['3', 'C', 'y.png', false]],
  });
  const res = env.run("getKpisHome('tok')");
  assert.equal(res.success, true, JSON.stringify(res));
  const v = Object.fromEntries(res.data.map((k) => [k.curto, k.valor]));
  assert.deepEqual(v, { Ativos: 2, Inativos: 1, 'Sem foto': 1, 'Usuários': 1 });
});

test('núcleo: atividade recente funciona sem nenhuma aba da Escola Dominical', () => {
  const env = envComSessao({
    Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
    Membros: [['id', 'nome', 'foto', 'ativo']],
  });
  const res = env.run("getAtividadeRecente('tok')");
  assert.equal(res.success, true, JSON.stringify(res));
  assert.equal(res.data.length, 1);
  assert.match(res.data[0].texto, /Ana/);
});

test('núcleo: perfil professor não pode mais ser criado', () => {
  const env = envComSessao({
    Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
    Membros: [['id', 'nome', 'foto', 'ativo']],
  });
  env.ctx.__dados = { Nome: 'Prof', Email: 'prof@igreja.test', Perfil: 'professor' };
  const res = env.run("usr_criar('tok', __dados)");
  assert.equal(res.success, false, JSON.stringify(res));
  assert.match(res.error, /Perfil inválido/);
});

// ═══ Registro de módulos (Etapa 3) ══════════════════════════
const ESQ = (env) => JSON.parse(env.run('JSON.stringify(Modulos.ativos().map(function(m){return m.id}))'));

test('módulos: Membros se registra e aparece como módulo ativo com rota, perfis e ícone', () => {
  const env = freshEnv();
  const mods = JSON.parse(env.run('JSON.stringify(Modulos.paraCliente())'));
  assert.equal(mods.length, 1);
  assert.deepEqual([mods[0].id, mods[0].rota, mods[0].render], ['membros', 'membros', 'renderMembros']);
  assert.deepEqual(mods[0].perfis, ['admin', 'secretaria']);
  assert.ok(mods[0].permissoes && mods[0].permissoes.acoes.length);
});

test('módulos: o registro não depende da ordem de carga dos arquivos', () => {
  const { listFiles } = require('./helpers/gas');
  const env = createEnv();
  env.load(listFiles('.js').reverse());
  assert.deepEqual(ESQ(env), ['membros']);
});

test('módulos: manifesto é serializável (sem funções) e o JSON do HTML é seguro', () => {
  const env = freshEnv();
  const js = env.run('Modulos.jsonParaHtml()');
  assert.doesNotThrow(() => JSON.parse(js));
  assert.ok(!js.includes('<'));
});

test('módulos: o esquema da planilha inclui as abas do núcleo e as declaradas pelos módulos ativos', () => {
  const env = freshEnv();
  const esq = JSON.parse(env.run('JSON.stringify(SetupSheets.schema())'));
  assert.deepEqual(Object.keys(esq).sort(), ['Config', 'Membros', 'Sessoes', 'Usuarios']);
  assert.equal(esq.Membros[0], 'id');
  assert.ok(esq.Membros.includes('ativo'));
});

test('módulos: módulo desativado some do registro, das abas, dos KPIs e do HTML', () => {
  const env = createEnv({ scriptProperties: { MODULOS_ATIVOS: 'outro' } });
  env.load();
  assert.deepEqual(ESQ(env), []);
  assert.equal(env.run('Modulos.abas().length'), 0);
  assert.equal(env.run('Modulos.kpis().length'), 0);
  assert.equal(env.run('incluirModulos()'), '');
  const esq = JSON.parse(env.run('JSON.stringify(SetupSheets.schema())'));
  assert.deepEqual(Object.keys(esq).sort(), ['Config', 'Sessoes', 'Usuarios']);
});

test('módulos: núcleo sem nenhum módulo — KPIs mostram só usuários', () => {
  const env = createEnv({ spreadsheet: ssComAbas({ Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'a@i.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']] }), scriptProperties: { MODULOS_ATIVOS: 'nenhum' } });
  env.load();
  env.scriptCache.put('sess_tok', JSON.stringify({ token: 'tok', id: 'u1', nome: 'Ana', email: 'a@i.test', perfil: 'admin', expiraEm: new Date(Date.now() + 3600e3).toISOString(), primeiroAcesso: false }), 3600);
  const res = env.run("getKpisHome('tok')");
  assert.equal(res.success, true, JSON.stringify(res));
  assert.deepEqual(res.data.map((k) => k.curto), ['Usuários']);
});

test('módulos: doGet injeta a lista de módulos no template', () => {
  const env = freshEnv();
  const out = env.run('doGet({parameter:{}})');
  const mods = JSON.parse(out._tpl.modulosJson);
  assert.deepEqual(mods.map((m) => m.id), ['membros']);
});

test('módulos: getModulos exige sessão', () => {
  const env = freshEnv();
  assert.equal(env.run("getModulos('')").success, false);
});

test('módulos: o HTML do módulo ativo é incluído no shell', () => {
  const env = freshEnv();
  assert.match(env.run('incluirModulos()'), /function renderMembros\s*\(/);
});
