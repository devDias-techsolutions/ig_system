// Extraído de Code.js na Etapa 2 (recorte do MVP). Não é carregado pelo núcleo.
// Lê as abas Alunos e Classes (Escola Dominical) e cruza com Membros.

// ── IMPORTAR DA EBD — retorna alunos ativos não cadastrados como membros ──
// Cruzamento por nome normalizado + celular (sem pontuação).
// Alunos que já existem em Membros com mesmos dados não aparecem na lista.
function buscarAlunosParaImportar(token) {
  try {
    Auth._auth(token);

    // Lê alunos ativos da EBD
    var alunos   = Util.sheetToObjects('Alunos')
      .filter(function(a) { return a.Ativo === true || String(a.Ativo).toUpperCase() === 'TRUE'; });

    // Lê membros ativos para cruzamento
    var membros  = Util.sheetToObjects('Membros')
      .filter(function(m) { return m.ativo === true || String(m.ativo).toUpperCase() === 'TRUE'; });

    // Turmas para exibir nome da turma no modal
    var turmas   = Util.sheetToObjects('Classes');
    var turmaMap = {};
    turmas.forEach(function(t) { turmaMap[t.ID] = t.Nome; });

    // Índice de membros por nome normalizado e por celular (sem pontuação)
    var _norm = function(s) { return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); };
    var _tel  = function(s) { return String(s||'').replace(/\D/g,''); };

    var membroNomes = {};
    var membroTels  = {};
    membros.forEach(function(m) {
      membroNomes[_norm(m.nome)]    = true;
      var t = _tel(m.celular);
      if (t.length >= 8) membroTels[t] = true;
    });

    // Filtra alunos que ainda NÃO existem em Membros
    var disponiveis = alunos.filter(function(a) {
      var nomeJaExiste = membroNomes[_norm(a.Nome)];
      var telJaExiste  = false;
      var t = _tel(a.Celular);
      if (t.length >= 8) telJaExiste = membroTels[t];
      return !nomeJaExiste && !telJaExiste;
    });

    // Adiciona nome da turma e ordena por nome
    disponiveis = disponiveis.map(function(a) {
      a._turma = turmaMap[a.ClasseID] || '';
      return a;
    }).sort(function(a, b) {
      return _norm(a.Nome) < _norm(b.Nome) ? -1 : 1;
    });

    return Util.ok(disponiveis);
  } catch(e) {
    Logger.log('[buscarAlunosParaImportar] ' + e.message);
    return Util.err(e.message);
  }
}
