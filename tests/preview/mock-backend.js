'use strict';
// Respostas simuladas do backend para o preview. Mesmo formato do Util.ok / Util.err.

const ok = (data) => ({ success: true, data });

// Aniversários fora do mês atual, para o pop-up de aniversariantes não cobrir a lista no preview.
function dia(d, deslocamentoMeses) {
  const mes = ((new Date().getMonth() + deslocamentoMeses) % 12) + 1;
  return String(d).padStart(2, '0') + '/' + String(mes).padStart(2, '0') + '/';
}

function membros() {
  const base = [
    ['Maria Aparecida Souza', 'F', dia(12, 3) + '1978', 'Membro', '(31) 98877-1001', true],
    ['João Carlos Pereira', 'M', dia(5, 4) + '1965', 'Presbítero', '(31) 98877-1002', true],
    ['Ana Beatriz Lima', 'F', dia(23, 5) + '1992', 'Cooperadora', '(31) 98877-1003', true],
    ['Pedro Henrique Alves', 'M', dia(30, 6) + '2001', 'Membro', '(31) 98877-1004', true],
    ['Lúcia Helena Costa', 'F', dia(17, 7) + '1958', 'Diaconisa', '(31) 98877-1005', false],
    ['Marcos Vinícius Rocha', 'M', dia(8, 8) + '1985', 'Diácono', '(31) 98877-1006', true],
  ];
  return base.map((m, i) => ({
    id: 'm' + (i + 1), rol: String(i + 1).padStart(4, '0'), nome: m[0], sexo: m[1], nascimento: m[2],
    funcao: m[3], celular: m[4], ativo: m[5], foto: '', Igreja: 'Igreja Exemplo', estadoCivil: 'Casado(a)',
    cidade: 'Belo Horizonte', estado: 'MG', batismo: '06/2005', email: 'membro' + (i + 1) + '@exemplo.test',
  }));
}

function usuarios() {
  return [
    { ID: 'u1', Nome: 'Ana Souza', Email: 'ana@igreja.test', Perfil: 'admin', Ativo: true, PrimeiroAcesso: false, CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '03/11/2026 08:12:00' },
    { ID: 'u2', Nome: 'Carlos Lima', Email: 'carlos@igreja.test', Perfil: 'secretaria', Ativo: true, PrimeiroAcesso: false, CriadoEm: '02/11/2026 09:30:00', UltimoLogin: '' },
    { ID: 'u3', Nome: 'Rita Gomes', Email: 'rita@igreja.test', Perfil: 'secretaria', Ativo: false, PrimeiroAcesso: false, CriadoEm: '28/10/2026 14:00:00', UltimoLogin: '' },
  ];
}

// Devolve o código JS (string) com as funções simuladas, para ser injetado na página.
function serializar(perfil) {
  const sessao = { token: 'tok', id: 'u1', nome: 'Ana Souza', email: 'ana@igreja.test', perfil, primeiroAcesso: false };
  const kpis = (process.env.SEM_MODULOS ? [] : [
    { icone: 'users', cor: 'kc-teal', valor: 128, rotulo: 'Membros ativos', curto: 'Ativos', destino: 'membros' },
    { icone: 'user-x', cor: 'kc-gold', valor: 14, rotulo: 'Membros inativos', curto: 'Inativos', destino: 'membros' },
    { icone: 'camera', cor: 'kc-blue', valor: 37, rotulo: 'Membros sem foto', curto: 'Sem foto', dica: 'Complete os cadastros', destino: 'membros', alerta: true },
  ]).concat([{ icone: 'shield-check', cor: 'kc-green', valor: 3, rotulo: 'Usuários do sistema', curto: 'Usuários' }]);
  const fns = {
    getSession: () => ok(SESSAO),
    login: () => ok(SESSAO),
    logout: () => ok(true),
    getKpisHome: () => ok(KPIS),
    getAtividadeRecente: () => ok(ATIVIDADE),
    mb_listarMembros: () => ok(MEMBROS),
    mb_getProximoRol: () => ok('0129'),
    mb_getFotoMembro: () => ({ success: false, error: 'sem foto' }),
    usr_listar: () => ok(USUARIOS),
    usr_listarPermissoes: () => ({ success: false, error: 'sem matriz salva' }),
    ed_getDadosIniciais: () => ok({
      classes: [{ ID: 'c1', Nome: 'Jovens', FaixaEtaria: '15 a 25 anos' }, { ID: 'c2', Nome: 'Adultos', FaixaEtaria: 'Acima de 26' }],
      alunos: [
        { ID: 'al1', Nome: 'Ana Beatriz Souza', ClasseID: 'c1', DataNasc: '12/03/2005', TotalPontos: 312 },
        { ID: 'al2', Nome: 'Bruno Henrique Lima', ClasseID: 'c1', DataNasc: '02/09/2006', TotalPontos: 281 },
        { ID: 'al3', Nome: 'Carla Dias', ClasseID: 'c2', DataNasc: '25/01/1985', TotalPontos: 190 },
      ],
      professores: [{ ID: 'p1', Nome: 'Paulo Prof', ClasseID: 'c1', UsuarioID: 'u9' }],
      aulas: [{ ID: 'a7', Data: '15/11/2026', Trimestre: '4', NumLicao: '7', Titulo: '' }, { ID: 'a6', Data: '08/11/2026', Trimestre: '4', NumLicao: '6', Titulo: '' }],
    }),
    ed_getChamada: () => ok({ modo: 'completa',
      alunos: [
        ['Ana Beatriz Souza', 1, 1, 1], ['Bruno Henrique Lima', 1, 1, 0], ['Camila Ferreira', 1, 0, 0], ['Davi Nogueira', 0, 0, 0],
        ['Eduarda Martins', 1, 1, 1], ['Felipe Araújo', 1, 0, 1], ['Gabriela Rocha', 1, 1, 0],
      ].map(function (x, i) { return { alunoId: 'al' + i, nome: x[0], isProfessor: false, presente: !!x[1], biblia: !!x[2], revista: !!x[3], pontosExtras: [] }; }),
      extras: [{ ID: 'e1', Nome: 'Memorizou o versículo', Pontos: 3 }], pontos: { presenca: 1, biblia: 2, revista: 2 },
      jaLancada: true, podeEditar: true, turmaNome: 'Jovens', aula: { numLicao: '7', data: '15/11/2026' }, turmaInfo: { numVisitantes: 3, totalOferta: 45, observacoes: '' },
    }),
    ed_getHistoricoChamadas: () => ok({ trimestre: '4', ano: '2026', pendentes: 2, podeCriarAula: true, aulas: [
      { id: 'a7', numLicao: '7', data: '15/11/2026', turmas: 5, lancadas: 3, status: 'pendente', hoje: true, futura: false },
      { id: 'a6', numLicao: '6', data: '08/11/2026', turmas: 5, lancadas: 5, status: 'ok', hoje: false, futura: false },
      { id: 'a5', numLicao: '5', data: '01/11/2026', turmas: 5, lancadas: 4, status: 'pendente', hoje: false, futura: false },
      { id: 'a4', numLicao: '4', data: '25/10/2026', turmas: 5, lancadas: 5, status: 'ok', hoje: false, futura: false },
    ] }),
    ed_salvarChamada: () => ok({ mensagem: 'Chamada salva com sucesso.' }),
    ed_getRelatorioAula: () => ok({
      modo: 'completa', aula: { id: 'a7', numLicao: '7', trimestre: '4', data: '15/11/2026', titulo: '' }, totalTurmas: 2,
      turmas: [
        { classeId: 'c1', nome: 'Jovens', faixa: '15 a 25 anos', lancada: true, matriculados: 18, presentes: 15, ausentes: 3, visitantes: 2, total: 17, biblias: 11, revistas: 12, oferta: 45, percentual: 83 },
        { classeId: 'c2', nome: 'Adultos', faixa: '', lancada: false, matriculados: 30, presentes: 0, ausentes: 30, visitantes: 0, total: 0, biblias: 0, revistas: 0, oferta: 0, percentual: 0 },
      ],
      geral: { matriculados: 48, presentes: 15, ausentes: 33, visitantes: 2, total: 17, biblias: 11, revistas: 12, oferta: 45, percentual: 31, turmasLancadas: 1 },
    }),
    ed_getConfigEbd: () => ok({ modoChamada: 'completa', modoRanking: 'presenca', pontos: { presenca: 1, biblia: 2, revista: 2 } }),
    ed_salvarConfigEbd: () => ok({ mensagem: 'ok' }),
    ed_getRanking: () => ok({ modo: 'presenca', ano: '2026', lista: [
      { alunoId: 'al1', nome: 'Ana Beatriz Souza', classeId: 'c1', classeNome: 'Jovens', presencas: 14, totalAulas: 16, percentual: 88, pontos: 312 },
      { alunoId: 'al2', nome: 'Bruno Henrique Lima', classeId: 'c1', classeNome: 'Jovens', presencas: 13, totalAulas: 16, percentual: 81, pontos: 281 },
      { alunoId: 'al3', nome: 'Carla Dias', classeId: 'c2', classeNome: 'Adultos', presencas: 11, totalAulas: 16, percentual: 69, pontos: 190 },
    ] }),
    ed_getVisaoGeral: () => ok({
      totais: { alunos: 86, turmas: 6, professores: 9 }, ultimaAula: { id: 'a7', numLicao: '7', data: '15/11/2026' },
      semChamada: [{ id: 'c3', nome: 'Adolescentes' }, { id: 'c4', nome: 'Crianças' }],
      presenca: { media: 82, recentes: [60, 72, 66, 80, 74, 88, 70, 82].map((p, i) => ({ aulaId: 'a' + i, numLicao: String(i + 1), data: '', percentual: p })) },
      turmas: [{ id: 'c1', nome: 'Jovens', percentual: 86, alunos: 18 }, { id: 'c2', nome: 'Adultos', percentual: 74, alunos: 30 }, { id: 'c3', nome: 'Adolescentes', percentual: 68, alunos: 14 }],
      ranking: { modo: 'presenca', top: [
        { alunoId: 'al1', nome: 'Ana Beatriz Souza', classeId: 'c1', classeNome: 'Jovens', presencas: 14, percentual: 88, pontos: 312 },
        { alunoId: 'al2', nome: 'Bruno Henrique Lima', classeId: 'c1', classeNome: 'Jovens', presencas: 13, percentual: 81, pontos: 281 },
        { alunoId: 'al3', nome: 'Carla Dias', classeId: 'c2', classeNome: 'Adultos', presencas: 11, percentual: 69, pontos: 190 }] },
    }),
    ed_criarAula: () => ok({ id: 'a8' }),
  };
  const atividade = [
    { icon: 'user-plus', texto: 'Usuário adicionado: Carlos Lima', tempo: '1d atrás', ts: 2 },
    { icon: 'user-plus', texto: 'Usuário adicionado: Rita Gomes', tempo: '6d atrás', ts: 1 },
  ];
  const corpo = Object.entries(fns).map(([k, f]) => `${JSON.stringify(k)}: ${f.toString()}`).join(',\n');
  return `(function(){ var SESSAO=${JSON.stringify(sessao)}, ATIVIDADE=${JSON.stringify(atividade)}, KPIS=${JSON.stringify(kpis)}, MEMBROS=${JSON.stringify(membros())}, USUARIOS=${JSON.stringify(usuarios())};
    function ok(d){ return {success:true,data:d}; }
    return {\n${corpo}\n}; })()`;
}

module.exports = { serializar };
