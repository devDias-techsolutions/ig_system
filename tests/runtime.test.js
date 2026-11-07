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

test('setup: setupSpreadsheet() não cria nenhum usuário', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  assert.equal(env.activeSS.getSheetByName('Usuarios')._rows.length, 1);
});

test('admin: criarAdministrador gera senha aleatória, exige troca e envia por e-mail', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  env.run("SetupSheets.criarAdministrador('Fulano', 'Fulano@Igreja.org')");
  const rows = env.activeSS.getSheetByName('Usuarios')._rows;
  assert.equal(rows.length, 2);
  const linha = rows[1].map(String);
  assert.ok(linha.includes('fulano@igreja.org'));
  assert.ok(linha.includes('admin'));
  assert.ok(!linha.includes(env.run("Util.sha256('Admin@1234')")));
  const email = env.calls.emails[0];
  assert.equal(email[0], 'fulano@igreja.org');
  const senha = /Senha temporária: <b>([^<]+)<\/b>/.exec(email[3].htmlBody)[1];
  assert.equal(senha.length, 12);
  assert.ok(linha.includes(env.run(`Util.sha256('${senha}')`)), 'o hash gravado não corresponde à senha enviada');
});

test('admin: criarAdministrador recusa e-mail inválido e segundo administrador', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  assert.throws(() => env.run("SetupSheets.criarAdministrador('X', 'email@exemplo')"), /e-mail/i);
  env.run("SetupSheets.criarAdministrador('A', 'a@igreja.org')");
  assert.throws(() => env.run("SetupSheets.criarAdministrador('B', 'b@igreja.org')"), /administrador/i);
});

// ═══ Identidade da igreja e Home por perfil ═════════════════
const CFG_COLS = ['Chave', 'Valor', 'Descricao', 'AtualizadoEm'];
const cfgLinhas = (obj) => [CFG_COLS, ...Object.entries(obj).map(([k, v]) => [k, v, '', ''])];
function envComConfig(cfg, abas) {
  const env = createEnv({ spreadsheet: ssComAbas({ Config: cfgLinhas(cfg), ...(abas || {}) }) });
  env.load();
  return env;
}

test('config: sem a aba Config a identidade tem valores neutros (nunca derruba a tela)', () => {
  const env = freshEnv();
  const id = JSON.parse(env.run('Config.identidadeJson()'));
  assert.deepEqual(id, {
    nome: 'Minha Igreja', nomeCurto: 'Minha Igreja', lema: '', corPrimaria: '', logoUrl: '',
    pastor: '', cargoPastor: 'Pastor Presidente', endereco: '', cnpj: '', marcaDagua: '', assinatura: '',
  });
});

test('config: lê nome, lema, cor e logo da aba Config', () => {
  const env = envComConfig({
    NOME_IGREJA: 'Igreja Vida Nova', NOME_CURTO: 'Vida Nova', LEMA_IGREJA: 'O Senhor é meu pastor',
    COR_PRIMARIA: '#0F766E', LOGO_URL: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view?usp=sharing',
  });
  const id = JSON.parse(env.run('Config.identidadeJson()'));
  assert.deepEqual({ nome: id.nome, nomeCurto: id.nomeCurto, lema: id.lema, corPrimaria: id.corPrimaria, logoUrl: id.logoUrl }, {
    nome: 'Igreja Vida Nova', nomeCurto: 'Vida Nova', lema: 'O Senhor é meu pastor', corPrimaria: '#0f766e',
    logoUrl: 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQ&sz=w256',
  });
});

test('config: dados da carteirinha (pastor, cargo, endereço, CNPJ, marca d\'água, assinatura) vêm da Config', () => {
  const env = envComConfig({
    PASTOR: 'Pr. João Silva', CARGO_PASTOR: 'Presidente', ENDERECO_IGREJA: 'Rua A, 10 - Centro', CNPJ_IGREJA: '00.000.000/0001-00',
    MARCA_DAGUA_URL: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view', ASSINATURA_URL: 'javascript:alert(1)',
  });
  const id = JSON.parse(env.run('Config.identidadeJson()'));
  assert.equal(id.pastor, 'Pr. João Silva');
  assert.equal(id.cargoPastor, 'Presidente');
  assert.equal(id.endereco, 'Rua A, 10 - Centro');
  assert.equal(id.cnpj, '00.000.000/0001-00');
  assert.equal(id.marcaDagua, 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQ&sz=w1024');
  assert.equal(id.assinatura, '', 'assinatura insegura passou');
});

test('config: cor inválida e logo fora de https são ignorados', () => {
  ['javascript:alert(1)', 'http://x.com/a.png', 'data:image/png;base64,AAAA', 'ftp://x'].forEach((logo) => {
    const env = envComConfig({ COR_PRIMARIA: 'vermelho', LOGO_URL: logo });
    const id = JSON.parse(env.run('Config.identidadeJson()'));
    assert.equal(id.corPrimaria, '', 'cor inválida passou');
    assert.equal(id.logoUrl, '', 'logo inseguro passou: ' + logo);
  });
});

test('config: o JSON da identidade é seguro dentro de <script> (nome com </script>)', () => {
  const env = envComConfig({ NOME_IGREJA: 'Igreja </script><b>x' });
  const json = env.run('Config.identidadeJson()');
  assert.ok(!json.includes('<'), json);
  assert.equal(JSON.parse(json).nome, 'Igreja </script><b>x');
});

test('config: setupSpreadsheet() cria as chaves, não repete e não apaga o que já foi preenchido', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  env.run("Util.updateRow('Config', Util.findRow('Config', 'Chave', 'NOME_IGREJA')._rowIndex, { Chave: 'NOME_IGREJA', Valor: 'Minha Congregação', Descricao: '', AtualizadoEm: '' })");
  env.run('setupSpreadsheet()');
  const chaves = env.activeSS.getSheetByName('Config')._rows.slice(1).map((r) => r[0]);
  ['NOME_IGREJA', 'NOME_CURTO', 'LEMA_IGREJA', 'COR_PRIMARIA', 'LOGO_URL', 'MODULOS_ATIVOS'].forEach((k) => assert.equal(chaves.filter((c) => c === k).length, 1, k));
  assert.equal(JSON.parse(env.run('Config.identidadeJson()')).nome, 'Minha Congregação');
});

test('config: doGet injeta a identidade e usa o nome da igreja no título', () => {
  const env = envComConfig({ NOME_IGREJA: 'Igreja Vida Nova' });
  const out = env.run('doGet({parameter:{}})');
  assert.equal(JSON.parse(out._tpl.identidadeJson).nome, 'Igreja Vida Nova');
  assert.match(out._title, /^Igreja Vida Nova/);
});

test('módulos: MODULOS_ATIVOS da aba Config escolhe os módulos (vazio = todos; outro id = nenhum)', () => {
  assert.deepEqual(ESQ(envComConfig({ MODULOS_ATIVOS: '' })), ['membros']);
  assert.deepEqual(ESQ(envComConfig({ MODULOS_ATIVOS: ' membros , financeiro' })), ['membros']);
  assert.deepEqual(ESQ(envComConfig({ MODULOS_ATIVOS: 'financeiro' })), []);
});

function envComPerfil(perfil, abas) {
  const env = createEnv({ spreadsheet: ssComAbas(abas) });
  env.load();
  env.scriptCache.put('sess_tok', JSON.stringify({
    token: 'tok', id: 'u9', nome: 'Pessoa', email: 'p@igreja.test', perfil,
    expiraEm: new Date(Date.now() + 3600e3).toISOString(), primeiroAcesso: false,
  }), 3600);
  return env;
}
const ABAS_HOME = () => ({
  Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
  Membros: [['id', 'nome', 'foto', 'ativo'], ['1', 'A', 'x.png', true], ['2', 'B', '', false]],
});

test('home por perfil: secretaria vê os indicadores dos seus módulos, sem o de usuários', () => {
  const res = envComPerfil('secretaria', ABAS_HOME()).run("getKpisHome('tok')");
  assert.equal(res.success, true, JSON.stringify(res));
  assert.deepEqual(res.data.map((k) => k.curto), ['Ativos', 'Inativos', 'Sem foto']);
});

test('home por perfil: administrador vê também o indicador de usuários', () => {
  const res = envComPerfil('admin', ABAS_HOME()).run("getKpisHome('tok')");
  assert.deepEqual(res.data.map((k) => k.curto), ['Ativos', 'Inativos', 'Sem foto', 'Usuários']);
});

test('home por perfil: movimento de administração (usuários criados) só aparece para o administrador', () => {
  assert.equal(envComPerfil('admin', ABAS_HOME()).run("getAtividadeRecente('tok')").data.length, 1);
  assert.deepEqual(envComPerfil('secretaria', ABAS_HOME()).run("getAtividadeRecente('tok')").data, []);
});

test('home por perfil: módulo que o perfil não pode abrir não entra nos indicadores dele', () => {
  const env = envComPerfil('secretaria', ABAS_HOME());
  env.run("__MANIFESTOS__.push({ id: 'tesouraria', nome: 'Tesouraria', rota: 'tesouraria', render: 'renderT', perfis: ['admin'], ordem: 50, kpis: function () { return [{ icone: 'x', cor: 'kc-teal', valor: 9, rotulo: 'Dízimos', curto: 'Dízimos' }]; } })");
  assert.ok(!env.run("getKpisHome('tok')").data.some((k) => k.curto === 'Dízimos'));
  const adm = envComPerfil('admin', ABAS_HOME());
  adm.run("__MANIFESTOS__.push({ id: 'tesouraria', nome: 'Tesouraria', rota: 'tesouraria', render: 'renderT', perfis: ['admin'], ordem: 50, kpis: function () { return [{ icone: 'x', cor: 'kc-teal', valor: 9, rotulo: 'Dízimos', curto: 'Dízimos' }]; } })");
  assert.ok(adm.run("getKpisHome('tok')").data.some((k) => k.curto === 'Dízimos'));
});

// ═══ Pasta de fotos dos membros (Etapa 8) ═══════════════════
function envUploadFoto(cfg) {
  const env = envComConfig(cfg, {
    Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
    Membros: [['id', 'nome', 'foto', 'ativo'], ['1', 'A', '', true]],
  });
  env.scriptCache.put('sess_tok', JSON.stringify({
    token: 'tok', id: 'u1', nome: 'Ana', email: 'ana@igreja.test', perfil: 'admin',
    expiraEm: new Date(Date.now() + 3600e3).toISOString(), primeiroAcesso: false,
  }), 3600);
  env.run(`
    var __pastas = [];
    var __arquivo = { getId: function () { return 'FILE1'; }, setSharing: function () {} };
    var __pasta = { getFilesByName: function () { return { hasNext: function () { return false; } }; }, createFile: function () { return __arquivo; } };
    DriveApp.getFoldersByName = function (n) { __pastas.push('busca:' + n); return { hasNext: function () { return false; } }; };
    DriveApp.createFolder = function (n) { __pastas.push('cria:' + n); return __pasta; };
    DriveApp.getFileById = function () { return { getBlob: function () { return { getBytes: function () { return [1, 2, 3]; } }; } }; };
  `);
  return env;
}
const pastasUsadas = (env) => JSON.parse(env.run('JSON.stringify(__pastas)'));

test('fotos: sem configuração a pasta criada tem nome neutro (sem o nome da igreja original)', () => {
  const env = envUploadFoto({});
  const res = env.run("mb_salvarFotoMembro('tok', '1', 'AQID', 'image/png', 'f.png')");
  assert.equal(res.success, true, JSON.stringify(res));
  assert.deepEqual(pastasUsadas(env), ['busca:Fotos de Membros', 'cria:Fotos de Membros']);
});

test('fotos: PASTA_FOTOS da aba Config define o nome da pasta (permite manter uma pasta antiga)', () => {
  const env = envUploadFoto({ PASTA_FOTOS: 'Fotos Membros AD' });
  assert.equal(env.run("mb_salvarFotoMembro('tok', '1', 'AQID', 'image/png', 'f.png')").success, true);
  assert.deepEqual(pastasUsadas(env), ['busca:Fotos Membros AD', 'cria:Fotos Membros AD']);
});

test('config: se a chave aparece mais de uma vez, a última linha vale', () => {
  const env = envComConfig({ NOME_IGREJA: 'Primeiro' });
  env.run("Util.insertRow('Config', {Chave:'NOME_IGREJA', Valor:'Segundo', Descricao:'', AtualizadoEm:''})");
  assert.equal(JSON.parse(env.run('Config.identidadeJson()')).nome, 'Segundo');
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

function definirConfigUnit(env, chave, valor) {
  env.ctx.__c = { Chave: chave, Valor: valor, Descricao: '', AtualizadoEm: '' };
  const linha = env.run(`Util.findRow('Config', 'Chave', ${JSON.stringify(chave)})`);
  env.run(linha ? `Util.updateRow('Config', ${linha._rowIndex}, __c)` : "Util.insertRow('Config', __c)");
}

test('ícone: sem logo usa um SVG com as iniciais na cor da marca; com logo usa o logo grande', () => {
  const env = freshEnv();
  env.run('setupSpreadsheet()');
  definirConfigUnit(env, 'NOME_IGREJA', 'Igreja Vida Nova');
  definirConfigUnit(env, 'COR_PRIMARIA', '#1a237e');
  const url = env.run('Config.iconeUrl()');
  const svg = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
  assert.match(url, /^data:image\/svg\+xml;base64,/);
  assert.match(svg, />VN</);
  assert.match(svg, /#1a237e/);
  const m = JSON.parse(env.run("doGet({parameter:{page:'manifest'}})").getContent());
  assert.equal(m.name, 'Igreja Vida Nova');
  assert.equal(m.theme_color, '#1a237e');
  assert.equal(m.icons[0].type, 'image/svg+xml');
  definirConfigUnit(env, 'LOGO_URL', 'https://drive.google.com/file/d/ABCDEFGHIJKLMNOP/view');
  assert.equal(env.run('Config.iconeUrl()'), 'https://drive.google.com/thumbnail?id=ABCDEFGHIJKLMNOP&sz=w512');
});

test('e-mail de boas-vindas usa o nome da igreja da Config', () => {
  const env = envComSessao({
    Usuarios: [COLS_USUARIOS, ['u1', 'Ana', 'ana@igreja.test', 'h', 'admin', false, true, '', '', '01/11/2026 10:00:00', '']],
    Config: [['Chave', 'Valor', 'Descricao', 'AtualizadoEm'], ['NOME_IGREJA', 'Igreja Vida Nova', '', '']],
  });
  env.ctx.__dados = { Nome: 'Bia', Email: 'bia@igreja.test', Perfil: 'secretaria' };
  const res = env.run("usr_criar('tok', __dados)");
  assert.equal(res.success, true, JSON.stringify(res));
  const [para, assunto, , opts] = env.calls.emails[0];
  assert.equal(para, 'bia@igreja.test');
  assert.match(assunto, /Igreja Vida Nova/);
  assert.match(opts.htmlBody, /Igreja Vida Nova/);
  assert.doesNotMatch(assunto + opts.htmlBody, /Fonte da Salva/);
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

// ═══ Consistência de leitura após escrita (bug real: lista/KPIs velhos após inativar/excluir) ═══
function envMembros() {
  const ss = makeSpreadsheet();
  const env = createEnv({ spreadsheet: ss });
  env.load();
  env.run('setupSpreadsheet()');
  env.scriptCache.put('sess_tok', JSON.stringify({ token: 'tok', id: 'u1', nome: 'Ana', email: 'a@i.test', perfil: 'admin', expiraEm: new Date(Date.now() + 3600e3).toISOString(), primeiroAcesso: false }), 3600);
  return { env, ss };
}
const kpis = (env) => Object.fromEntries(env.run("getKpisHome('tok')").data.map((k) => [k.curto, k.valor]));

test('membros: cadastrar, inativar e excluir refletem na hora na lista e nos KPIs da Home', () => {
  const { env } = envMembros();
  env.ctx.__m = { nome: 'Evaldo', ativo: true };
  const id = env.run("mb_salvarMembro('tok', __m)").data.id;
  assert.deepEqual([kpis(env).Ativos, kpis(env).Inativos], [1, 0]);

  env.ctx.__m = { id, nome: 'Evaldo', ativo: false };
  assert.equal(env.run("mb_salvarMembro('tok', __m)").success, true);
  assert.deepEqual([kpis(env).Ativos, kpis(env).Inativos], [0, 1], 'KPIs não refletiram a inativação');
  assert.equal(env.run("mb_listarMembros('tok')").data[0].ativo, false);

  env.ctx.__id = id;
  assert.equal(env.run("mb_deletarMembro('tok', __id)").success, true);
  assert.equal(env.run("mb_listarMembros('tok')").data.length, 0, 'excluído continua na lista');
  assert.deepEqual([kpis(env).Ativos, kpis(env).Inativos], [0, 0], 'KPIs não refletiram a exclusão');
  assert.equal(env.run("mb_deletarMembro('tok', __id)").success, false);
});

test('membros: leitura não usa cache entre execuções (escrita feita por outra execução aparece)', () => {
  const { env, ss } = envMembros();
  env.ctx.__m = { nome: 'Ana Lima', ativo: true };
  env.run("mb_salvarMembro('tok', __m)");
  env.run("mb_listarMembros('tok')"); // "enche" qualquer cache
  // outra execução altera a planilha sem passar pela invalidação (corrida real no Apps Script)
  const sh = ss.getSheetByName('Membros');
  const ativoCol = sh._rows[0].indexOf('ativo');
  sh._rows[1][ativoCol] = false;
  env.run('Util.novaExecucao()'); // nova chamada do cliente = nova execução
  assert.equal(env.run("mb_listarMembros('tok')").data[0].ativo, false, 'leu cache velho');
});

test('membros: dados de cadastro nunca são guardados no cache entre execuções', () => {
  const { env } = envMembros();
  env.ctx.__m = { nome: 'Ana Lima', ativo: true };
  env.run("mb_salvarMembro('tok', __m)");
  env.run("mb_listarMembros('tok')");
  assert.ok(!env.scriptCache.get('sheet_Membros'), 'Membros foi parar no CacheService');
  assert.ok(!env.scriptCache.get('sheet_Usuarios'), 'Usuarios foi parar no CacheService');
});
