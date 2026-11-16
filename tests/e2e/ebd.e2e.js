'use strict';
// Escola Dominical — Chamada (etapa 2): admin lança chamada; professor só vê a própria turma.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, criarBackend, abrir, entrar, esperarTela, sha } = require('./harness');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

// Chamada: histórico do trimestre → turmas da aula → chamada da turma
async function abrirChamada(page, turma) {
  await page.click('.edm-atalhos .hm-mod[data-tela="chamada"]');
  await page.waitForSelector('.edm-aulabtn:has-text("Lição 7")', { timeout: 6000 });
  await page.click('.edm-aulabtn:has-text("Lição 7")');
  await page.waitForSelector(`.edm-card:has-text("${turma}")`, { timeout: 6000 });
  await page.click(`.edm-card:has-text("${turma}")`);
  await page.waitForSelector('#edm-lista .edm-row', { timeout: 6000 });
}

function semear(backend) {
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Classes', { ID: 'c1', Nome: 'Jovens', Ativo: true });
  ins('Classes', { ID: 'c2', Nome: 'Adultos', Ativo: true });
  ins('Alunos', { ID: 'al1', Nome: 'Ana Souza', ClasseID: 'c1', Ativo: true });
  ins('Alunos', { ID: 'al2', Nome: 'Bruno Lima', ClasseID: 'c1', Ativo: true });
  ins('Alunos', { ID: 'al3', Nome: 'Carla Dias', ClasseID: 'c2', Ativo: true });
  ins('Aulas', { ID: 'a1', Data: '15/11/2026', Trimestre: '4', NumLicao: '7', Titulo: '', Ano: '2026' });
}

test('EBD: modo completo — admin marca presença/bíblia, salva e a planilha recebe os pontos', async () => {
  const backend = criarBackend(); semear(backend);
  backend.env.ctx.__c = { Chave: 'EBD_MODO_CHAMADA', Valor: 'completa', Descricao: '', AtualizadoEm: '' };
  backend.env.run("Util.insertRow('Config', __c)");
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('#edm-panel .edm-bento', { timeout: 6000 }); // admin abre na Visão geral
  await abrirChamada(page, 'Jovens');
  assert.equal(await page.locator('#edm-lista .edm-row').count(), 2);
  assert.equal(await page.locator('#edm-lista .edm-row:first-child .edm-tl-dot').count(), 1, 'linha de frequência do trimestre (1 lição cadastrada)');
  assert.equal(await page.locator('#edm-lista .edm-row:first-child .edm-tl-dot.p').count(), 0);
  assert.equal(await page.locator('#edm-lista .edm-row:first-child .edm-tg').count(), 3);
  await page.evaluate(() => { edmTog(0, 'presente'); edmTog(0, 'biblia'); });
  assert.match(await page.innerText('#edm-chips'), /1\s*Presentes/);
  assert.match(await page.innerText('#edm-lista .edm-row'), /\+3 pts/);
  assert.equal(await page.locator('#edm-lista .edm-row:first-child .edm-tl-dot.p').count(), 1, 'lição atual marcada vira ✓ ao vivo');
  // oferta em padrão bancário: dígitos entram pela direita
  await page.click('#edm-oferta');
  await page.keyboard.type('1000');
  assert.equal(await page.inputValue('#edm-oferta'), '10,00');
  await page.keyboard.type('5');
  assert.equal(await page.inputValue('#edm-oferta'), '100,05');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  assert.equal(await page.inputValue('#edm-oferta'), '1,00');
  // salvar mostra loading até a resposta, depois volta à leitura
  const carregando = await page.evaluate(() => { edmSalvar(); var b = document.getElementById('edm-salvar'); return { cls: b.className, txt: b.innerText, off: b.disabled }; });
  assert.match(carregando.cls, /edm-loading/);
  assert.match(carregando.txt, /Salvando/);
  assert.equal(carregando.off, true);
  await page.waitForSelector('.edm-leit button', { timeout: 6000 }); // vira somente leitura com botão Editar
  assert.equal(await page.locator('#edm-salvar').count(), 0);
  assert.equal(Number(backend.ss.getSheetByName('ChamadasInfo')._rows[1][4]), 1);
  const linhas = backend.ss.getSheetByName('Chamadas')._rows;
  assert.equal(linhas.length, 3); // cabeçalho + 2 alunos
  const total = linhas.slice(1).map((r) => Number(r[8]));
  assert.deepEqual(total.sort(), [0, 3]);
  assert.deepEqual(erros, []);
});

test('EBD: professor entra direto na Escola Dominical e só vê a turma vinculada', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  env.ctx.__u = { ID: 'u9', Nome: 'Paulo Prof', Email: 'prof@igreja.test', SenhaHash: sha(env, 'Prof#Teste1'), Perfil: 'professor', PrimeiroAcesso: false, Ativo: true, TokenRecupSenha: '', ExpirToken: '', CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '' };
  env.run("Util.insertRow('Usuarios', __u)");
  env.ctx.__p = { ID: 'p1', Nome: 'Paulo Prof', UsuarioID: 'u9', ClasseID: 'c2', Ativo: true };
  env.run("Util.insertRow('Professores', __p)");
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'prof@igreja.test', 'Prof#Teste1', 'escola-dominical');
  await page.waitForSelector('.edm-aulabtn:has-text("Lição 7")', { timeout: 6000 });
  assert.equal(await page.locator('.edm-nova').count(), 0, 'professor não cadastra aula');
  await page.click('.edm-aulabtn:has-text("Lição 7")');
  await page.waitForSelector('.edm-card:has-text("Adultos")', { timeout: 6000 });
  assert.equal(await page.locator('.edm-card:has-text("Jovens")').count(), 0);
  assert.deepEqual(await page.$$eval('.edm-atalhos .hm-mod', (b) => b.map((x) => x.getAttribute('data-tela'))), ['visao', 'chamada', 'alunos', 'relatorios', 'ranking']);
  assert.deepEqual(erros, []);
});

test('EBD: secretaria cria turma e aluno pela tela e a busca filtra a lista', async () => {
  const backend = criarBackend();
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos .hm-mod[data-tela="turmas"]');
  await page.click('.edm-atalhos .hm-mod[data-tela="turmas"]');
  await page.waitForSelector('.edm-fab');
  await page.evaluate(() => edmFormTurma());
  await page.fill('#edm-t-nome', 'Jovens');
  await page.fill('#edm-t-faixa', '15 a 25 anos');
  await page.evaluate(() => edmSalvarTurma());
  await page.waitForSelector('.edm-card:has-text("Jovens")', { timeout: 6000 });
  assert.equal(backend.ss.getSheetByName('Classes')._rows.length, 2);

  await page.click('.edm-atalhos .hm-mod[data-tela="alunos"]');
  await page.waitForSelector('#edm-busca');
  await page.evaluate(() => edmFormAluno());
  await page.fill('#edm-a-nome', 'Ana Souza');
  await page.fill('#edm-a-nasc', '2005-03-12');
  await page.evaluate(() => edmSalvarAluno());
  await page.waitForSelector('.edm-card:has-text("Ana Souza")', { timeout: 6000 });
  const linha = backend.ss.getSheetByName('Alunos')._rows[1];
  assert.equal(linha[1], 'Ana Souza');
  assert.equal(linha[2], '12/03/2005');
  await page.fill('#edm-busca', 'zzz');
  assert.match(await page.innerText('#edm-alunos-lista'), /Nenhum aluno encontrado/);
  assert.deepEqual(erros, []);
});

test('EBD: secretaria cadastra aula e professor vinculado a usuário e turma', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  env.ctx.__u = { ID: 'u9', Nome: 'Paulo Prof', Email: 'prof@igreja.test', SenhaHash: sha(env, 'Prof#Teste1'), Perfil: 'professor', PrimeiroAcesso: false, Ativo: true, TokenRecupSenha: '', ExpirToken: '', CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '' };
  env.run("Util.insertRow('Usuarios', __u)");
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  await page.click('.edm-atalhos .hm-mod[data-tela="chamada"]');
  await page.waitForSelector('.edm-nova', { timeout: 6000 });
  assert.equal(await page.locator('.edm-atalhos .hm-mod[data-tela="aulas"]').count(), 0, 'Aulas e Chamada são uma aba só');
  await page.click('.edm-nova');
  await page.fill('#edm-u-num', '8');
  await page.fill('#edm-u-data', '2026-11-22');
  await page.evaluate(() => edmSalvarAula2());
  await page.waitForSelector('.edm-aulabtn:has-text("Lição 8")', { timeout: 6000 });
  assert.equal(backend.ss.getSheetByName('Aulas')._rows.length, 3);
  // menu ⋮: editar e excluir a aula
  await page.click('.edm-aulacard:has-text("Lição 8") .edm-kebab');
  await page.click('#modal-edm-form button:has-text("Editar aula")');
  await page.fill('#edm-u-titulo', 'Fé em ação');
  await page.evaluate(() => edmSalvarAula2());
  await page.waitForSelector('.edm-aulabtn:has-text("Fé em ação")', { timeout: 6000 });

  await page.click('.edm-atalhos .hm-mod[data-tela="professores"]');
  await page.waitForSelector('.edm-fab');
  await page.evaluate(() => edmFormProfessor());
  await page.fill('#edm-p-nome', 'Paulo Prof');
  await page.selectOption('#edm-p-turma', 'c2');
  await page.selectOption('#edm-p-usuario', 'u9');
  await page.evaluate(() => edmSalvarProfessor());
  await page.waitForSelector('.edm-card:has-text("Paulo Prof")', { timeout: 6000 });
  assert.match(await page.innerText('.edm-card'), /Adultos · Com acesso/);
  const p = backend.ss.getSheetByName('Professores')._rows[1];
  assert.ok(p.includes('u9') && p.includes('c2'));
  assert.deepEqual(erros, []);
});

test('EBD: padrão é só presença (1 toggle, chip de %) e o ranking começa por presença; ajustes trocam os modos', async () => {
  const backend = criarBackend(); semear(backend);
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  await abrirChamada(page, 'Jovens');
  assert.equal(await page.locator('#edm-lista .edm-row:first-child .edm-tg').count(), 1);
  assert.match(await page.innerText('#edm-chips'), /Presença/);
  await page.evaluate(() => edmTog(0, 'presente'));
  await page.evaluate(() => edmSalvar());
  await page.waitForSelector('.edm-leit button', { timeout: 6000 });
  const totais = backend.ss.getSheetByName('Chamadas')._rows.slice(1).map((r) => Number(r[8])).sort();
  assert.deepEqual(totais, [0, 1]);
  // após salvar abre o relatório individual da turma
  await page.waitForSelector('#modal-edm-form.open .edm-rel-grid', { timeout: 6000 });
  assert.match(await page.innerText('#edm-form-titulo'), /Chamada salva · Jovens/);
  assert.match(await page.innerText('#edm-form-corpo'), /Matriculados\s*2/);
  await page.evaluate(() => edmFecharModal('modal-edm-form'));

  await page.click('.edm-atalhos .hm-mod[data-tela="ranking"]');
  await page.waitForSelector('.edm-seg button.on');
  assert.equal(await page.innerText('.edm-seg button.on'), 'Presença');
  assert.match(await page.innerText('.edm-row'), /1 presença/);
  await page.evaluate(() => edmAjustes());
  await page.waitForSelector('#edm-cfg-chamada');
  await page.selectOption('#edm-cfg-chamada', 'completa');
  await page.selectOption('#edm-cfg-ranking', 'pontos');
  await page.evaluate(() => edmSalvarAjustes());
  await page.waitForFunction(() => document.querySelector('.edm-seg button.on') && document.querySelector('.edm-seg button.on').innerText === 'Pontos totais', null, { timeout: 6000 });
  assert.match(await page.innerText('.edm-row'), /1 pts/);
  assert.deepEqual(erros, []);
});

test('EBD: relatórios da aula — cartão por turma e consolidado geral somando as turmas', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Chamadas', { ID: 'x1', AulaID: 'a1', ClasseID: 'c1', AlunoID: 'al1', Presente: true, Biblia: true, Revista: false, PontosExtrasJSON: '[]', TotalPontos: 3 });
  ins('Chamadas', { ID: 'x2', AulaID: 'a1', ClasseID: 'c2', AlunoID: 'al3', Presente: true, Biblia: false, Revista: false, PontosExtrasJSON: '[]', TotalPontos: 1 });
  ins('ChamadasInfo', { ID: 'i1', AulaID: 'a1', ClasseID: 'c1', NumVisitantes: 1, TotalOferta: 20 });
  ins('ChamadasInfo', { ID: 'i2', AulaID: 'a1', ClasseID: 'c2', NumVisitantes: 2, TotalOferta: 15.5 });
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  await page.click('.edm-atalhos .hm-mod[data-tela="relatorios"]');
  await page.waitForSelector('.edm-rel-geral', { timeout: 6000 });
  assert.equal(await page.locator('.edm-rel:not(.edm-rel-geral)').count(), 2);
  const geral = await page.innerText('.edm-rel-geral');
  assert.match(geral, /2 de 2 turmas/);
  assert.match(geral, /Matriculados\s*3/);
  assert.match(geral, /Visitantes\s*3/);
  assert.match(geral, /R\$ 35,50/);
  assert.deepEqual(erros, []);
});

test('EBD: histórico do trimestre mostra OK/! por aula; aula lista turmas; lançada abre em leitura e secretaria edita', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Aulas', { ID: 'a0', Data: '08/11/2026', Trimestre: '4', NumLicao: '6', Titulo: '', Ano: '2026' });
  ins('Chamadas', { ID: 'x1', AulaID: 'a1', ClasseID: 'c1', AlunoID: 'al1', Presente: true, PontosExtrasJSON: '[]', TotalPontos: 1 });
  ins('Chamadas', { ID: 'x2', AulaID: 'a1', ClasseID: 'c2', AlunoID: 'al3', Presente: true, PontosExtrasJSON: '[]', TotalPontos: 1 });
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  await page.click('.edm-atalhos .hm-mod[data-tela="chamada"]');
  await page.waitForSelector('.edm-nova', { timeout: 6000 }); // cadastro de aula no topo
  assert.match(await page.innerText('.edm-aulacard:has-text("Lição 7")'), /OK/);
  assert.match(await page.innerText('.edm-aulacard:has-text("Lição 6")'), /!/);
  await page.click('.edm-aulabtn:has-text("Lição 7")');
  await page.waitForSelector('.edm-card:has-text("Adultos")', { timeout: 6000 });
  assert.equal(await page.locator('.edm-st-ok').count(), 2);
  await page.click('.edm-card:has-text("Jovens")');
  await page.waitForSelector('.edm-leit button', { timeout: 6000 });
  assert.equal(await page.locator('#edm-salvar').count(), 0, 'lançada abre só leitura');
  assert.equal(await page.locator('.edm-tg:not([disabled])').count(), 0);
  await page.click('.edm-leit button');
  await page.waitForSelector('#edm-salvar');
  assert.equal(await page.locator('.edm-tg:not([disabled])').count() > 0, true);
  assert.deepEqual(erros, []);
});

test('EBD: aba Alunos mostra a linha de frequência do trimestre de cada aluno', async () => {
  const backend = criarBackend(); semear(backend);
  const { env } = backend;
  const ins = (aba, obj) => { env.ctx.__o = obj; env.run(`Util.insertRow(${JSON.stringify(aba)}, __o)`); };
  ins('Chamadas', { ID: 'x1', AulaID: 'a1', ClasseID: 'c1', AlunoID: 'al1', Presente: true, PontosExtrasJSON: '[]', TotalPontos: 1 });
  ins('Chamadas', { ID: 'x2', AulaID: 'a1', ClasseID: 'c1', AlunoID: 'al2', Presente: false, PontosExtrasJSON: '[]', TotalPontos: 0 });
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'sec@igreja.test', 'Sec#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  await page.click('.edm-atalhos .hm-mod[data-tela="alunos"]');
  await page.waitForSelector('.edm-tl', { timeout: 6000 });
  const ana = await page.innerText('.edm-card:has-text("Ana Souza")');
  assert.match(ana, /1\/1\s*·\s*100%/);
  assert.equal(await page.locator('.edm-card:has-text("Ana Souza") .edm-tl-dot.p').count(), 1);
  assert.equal(await page.locator('.edm-card:has-text("Bruno Lima") .edm-tl-dot.a').count(), 1);
  assert.equal(await page.locator('.edm-card:has-text("Carla Dias") .edm-tl-dot.p, .edm-card:has-text("Carla Dias") .edm-tl-dot.a').count(), 0, 'sem registro = bolinha tracejada');
  assert.deepEqual(erros, []);
});

test('EBD: exporta CSV e JSON; importador de 5 passos cria turma, alunos e professor a partir de CSV', async () => {
  const backend = criarBackend(); semear(backend);
  const { page, erros } = await abrir(browser, backend);
  await entrar(page, 'admin@igreja.test', 'Admin#Teste1', 'home');
  await page.evaluate(() => navigateTo('escola-dominical'));
  await esperarTela(page, 'escola-dominical');
  await page.waitForSelector('.edm-atalhos');
  // exportação
  await page.click('#edm-gear');
  await page.waitForSelector('#modal-edm-form.open .edm-dados');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.edm-dados button:has-text("Exportar CSV")')]);
  const csv = require('node:fs').readFileSync(await dl.path(), 'utf8');
  assert.match(csv, /^﻿Tipo;Nome;Turma;Telefone;Email;DataNasc;Endereco;Ativo;CriadoEm/);
  assert.match(csv, /aluno;Ana Souza;Jovens;/);
  const [dj] = await Promise.all([page.waitForEvent('download'), page.click('.edm-dados button:has-text("Backup JSON")')]);
  const bk = JSON.parse(require('node:fs').readFileSync(await dj.path(), 'utf8'));
  assert.equal(bk.modulo, 'escola-dominical'); assert.equal(bk.alunos.length, 3);
  // importação (planilha com cabeçalhos do sistema antigo)
  await page.click('.edm-dados button:has-text("Importar")');
  await page.waitForSelector('#modal-edm-imp.open .edm-drop');
  const arq = 'name,classroom,position,phone,birthday,status\n"Davi Nogueira",Crianças,student,(31) 90000-0000,2012-05-03,active\n"Eva Prado",Crianças,student,,,inactive\n"Ana Souza",Jovens,student,,,active\n"Prof Zeca",Jovens,teacher,,,active\n';
  await page.setInputFiles('#modal-edm-imp input[type=file]', { name: 'antigo.csv', mimeType: 'text/csv', buffer: Buffer.from(arq) });
  await page.waitForFunction(() => !document.getElementById('edm-imp-prox').disabled);
  await page.click('#edm-imp-prox');
  assert.match(await page.innerText('#edm-imp-corpo'), /3 alunos/);
  assert.match(await page.innerText('#edm-imp-corpo'), /1 professores/);
  await page.click('button:has-text("Mapear turmas")');
  await page.waitForSelector('.edm-imp-map');
  assert.equal(await page.locator('.edm-imp-map').count(), 2);
  assert.equal(await page.locator('.edm-imp-map:has(span:text-is("Jovens")) select').inputValue(), 'c1', 'casa turma existente por nome');
  await page.click('#modal-edm-imp button:has-text("Importar")');
  await page.waitForSelector('#modal-edm-imp .edm-imp-pills:has-text("turmas criadas")', { timeout: 8000 });
  const res = await page.innerText('#edm-imp-corpo');
  assert.match(res, /3 registros importados/);
  assert.match(res, /1 já existiam/);
  assert.match(res, /1 turmas criadas/);
  const nomes = (aba) => backend.ss.getSheetByName(aba)._rows.slice(1).map((r) => r[1] || r[3]);
  assert.ok(nomes('Classes').includes('Crianças'));
  assert.ok(nomes('Alunos').includes('Davi Nogueira') && nomes('Alunos').includes('Eva Prado'));
  assert.ok(backend.ss.getSheetByName('Professores')._rows.slice(1).some((r) => r[3] === 'Prof Zeca'));
  assert.deepEqual(erros, []);
});
