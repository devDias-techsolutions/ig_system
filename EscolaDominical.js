// ═══════════════════════════════════════════════════════════
//  EscolaDominical.gs · Módulo Escola Dominical
//  Classes · Alunos · Professores · Aulas · Chamadas
//  v1.0 · 2025
// ═══════════════════════════════════════════════════════════

var EscolaDominical = (function () {

  // Colunas das abas do módulo (mesmas da versão original: dados antigos continuam válidos)
  var HEADERS = {
    Classes:      ['ID', 'Nome', 'FaixaEtaria', 'LicaoCPAD', 'Ativo', 'CriadoEm'],
    Alunos:       ['ID', 'Nome', 'DataNasc', 'ClasseID', 'Telefone', 'Endereco', 'Email', 'TotalPontos', 'Ativo', 'CriadoEm'],
    Professores:  ['ID', 'AlunoOrigemID', 'UsuarioID', 'Nome', 'ClasseID', 'Telefone', 'DataNasc', 'Endereco', 'Email', 'Cursos', 'Ativo', 'CriadoEm'],
    Aulas:        ['ID', 'Data', 'Trimestre', 'NumLicao', 'Titulo', 'Ano', 'CriadoPor', 'CriadoEm'],
    Chamadas:     ['ID', 'AulaID', 'ClasseID', 'AlunoID', 'Presente', 'Biblia', 'Revista', 'PontosExtrasJSON', 'TotalPontos', 'TotalOfertas', 'LancadoPor', 'CriadoEm'],
    ChamadasInfo: ['ID', 'AulaID', 'ClasseID', 'NumVisitantes', 'TotalOferta', 'Observacoes', 'LancadoPor', 'CriadoEm', 'Matriculados', 'RetratoJSON'],
    PontosExtras: ['ID', 'Nome', 'Pontos', 'Ativo']
  };

  // ══════════════════════════════════════════
  //  HELPERS DEFENSIVOS
  // ══════════════════════════════════════════

  // Sheet segura — retorna [] se aba não existir
  function _safeSheetObjects(name) {
    try { return Util.sheetToObjects(name); }
    catch (e) { return []; }
  }

  // Remover campo interno _rowIndex antes de enviar ao cliente
  function _strip(rows) {
    return rows.map(function(r) {
      var obj = {};
      Object.keys(r).forEach(function(k) { if (k !== '_rowIndex') obj[k] = r[k]; });
      return obj;
    });
  }

  // Checar Ativo de forma robusta — aceita boolean true, string 'TRUE', 'true', 1, etc.
  function _isAtivo(val) {
    if (val === true)   return true;
    if (val === false)  return false;
    if (val === 1)      return true;
    if (val === 0)      return false;
    var s = String(val).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'SIM';
  }

  // ── Helper: ClasseIDs permitidas para o professor logado ─────────────────
  // Lê Professores onde UsuarioID === sess.id e Ativo === true.
  // Retorna { "classeId": true } para lookup O(1).
  // Retorna null para admin/secretaria → sem restrição.
  function _classesDoProfessor(sess) {
    if (!sess || sess.perfil !== 'professor') return null;
    var set = {};
    _safeSheetObjects('Professores').forEach(function(r) {
      if (_isAtivo(r.Ativo) &&
          String(r.UsuarioID).trim() === String(sess.id).trim() &&
          r.ClasseID) {
        set[String(r.ClasseID)] = true;
      }
    });
    return set;
  }

  // ══════════════════════════════════════════
  //  CLASSES
  // ══════════════════════════════════════════

  function listarClasses(token) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var rows = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      return Util.ok(_strip(rows));
    });
  }

  function listarClassesTodas(token) {
    return withAuth(token, function(sess) {
      return Util.ok(_strip(_safeSheetObjects('Classes')));
    });
  }

  function criarClasse(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome da classe é obrigatório.');

      var existente = _safeSheetObjects('Classes').filter(function (r) {
        return r.Nome.toLowerCase() === dados.Nome.trim().toLowerCase() && (_isAtivo(r.Ativo));
      });
      if (existente.length) return Util.err('Já existe uma classe com este nome.');

      var id = Util.uuid();
      Util.insertRow('Classes', {
        ID:          id,
        Nome:        dados.Nome.trim(),
        FaixaEtaria: dados.FaixaEtaria || '',
        LicaoCPAD:   dados.LicaoCPAD  || '',
        Ativo:       true,
        CriadoEm:   Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Classe criada com sucesso.' });
    });
  }

  function editarClasse(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Classes', id);
      if (!row) return Util.err('Classe não encontrada.');

      if (dados.Nome) {
        var dup = _safeSheetObjects('Classes').filter(function (r) {
          return r.Nome.toLowerCase() === dados.Nome.trim().toLowerCase() &&
                 r.ID !== id && (_isAtivo(r.Ativo));
        });
        if (dup.length) return Util.err('Já existe uma classe com este nome.');
      }

      var atualizado = {
        ID:          row.ID,
        Nome:        dados.Nome        !== undefined ? dados.Nome.trim()       : row.Nome,
        FaixaEtaria: dados.FaixaEtaria !== undefined ? dados.FaixaEtaria       : row.FaixaEtaria,
        LicaoCPAD:   dados.LicaoCPAD  !== undefined ? dados.LicaoCPAD         : row.LicaoCPAD,
        Ativo:       row.Ativo,
        CriadoEm:   row.CriadoEm
      };
      Util.updateRow('Classes', row._rowIndex, atualizado);
      return Util.ok({ mensagem: 'Classe atualizada com sucesso.' });
    });
  }

  function excluirClasse(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Classes', id);
      if (!row) return Util.err('Classe não encontrada.');

      // Verificar se há alunos ativos nesta classe
      var alunos = _safeSheetObjects('Alunos').filter(function (r) {
        return r.ClasseID === id && (_isAtivo(r.Ativo));
      });
      if (alunos.length) return Util.err('Não é possível excluir: há ' + alunos.length + ' aluno(s) nesta classe.');

      var atualizado = {
        ID: row.ID, Nome: row.Nome, FaixaEtaria: row.FaixaEtaria,
        LicaoCPAD: row.LicaoCPAD, Ativo: false, CriadoEm: row.CriadoEm
      };
      Util.updateRow('Classes', row._rowIndex, atualizado);
      return Util.ok({ mensagem: 'Classe desativada com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  ALUNOS
  // ══════════════════════════════════════════

  function listarAlunos(token, classeId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var rows = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (classeId && r.ClasseID !== classeId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      return Util.ok(_strip(rows));
    });
  }

  function criarAluno(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome do aluno é obrigatório.');
      if (!dados.ClasseID) return Util.err('Classe é obrigatória.');

      var classe = Util.findById('Classes', dados.ClasseID);
      if (!classe) return Util.err('Classe não encontrada.');

      var id = Util.uuid();
      Util.insertRow('Alunos', {
        ID:          id,
        Nome:        dados.Nome.trim(),
        DataNasc:    dados.DataNasc   || '',
        ClasseID:    dados.ClasseID,
        Telefone:    dados.Telefone   || '',
        Endereco:    dados.Endereco   || '',
        Email:       dados.Email      || '',
        TotalPontos: 0,
        Ativo:       true,
        CriadoEm:   Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Aluno cadastrado com sucesso.' });
    });
  }

  function editarAluno(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Alunos', id);
      if (!row) return Util.err('Aluno não encontrado.');

      if (dados.ClasseID) {
        var classe = Util.findById('Classes', dados.ClasseID);
        if (!classe) return Util.err('Classe não encontrada.');
        // Trava: durante o trimestre em curso o aluno não troca de turma (preserva o histórico e os percentuais).
        if (dados.ClasseID !== row.ClasseID) {
          var emCurso = _trimestreEmCurso();
          if (emCurso) return Util.err('Transferência de turma travada durante o trimestre em curso (' + emCurso.trimestre + 'º trimestre ' + emCurso.ano + '). Faça a mudança na virada do trimestre.');
        }
      }

      Util.updateRow('Alunos', row._rowIndex, {
        ID:          row.ID,
        Nome:        dados.Nome      !== undefined ? dados.Nome.trim()  : row.Nome,
        DataNasc:    dados.DataNasc  !== undefined ? dados.DataNasc     : row.DataNasc,
        ClasseID:    dados.ClasseID  !== undefined ? dados.ClasseID     : row.ClasseID,
        Telefone:    dados.Telefone  !== undefined ? dados.Telefone     : row.Telefone,
        Endereco:    dados.Endereco  !== undefined ? dados.Endereco     : row.Endereco,
        Email:       dados.Email     !== undefined ? dados.Email        : row.Email,
        TotalPontos: row.TotalPontos,
        Ativo:       row.Ativo,
        CriadoEm:   row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aluno atualizado com sucesso.' });
    });
  }

  function excluirAluno(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Alunos', id);
      if (!row) return Util.err('Aluno não encontrado.');

      Util.updateRow('Alunos', row._rowIndex, {
        ID: row.ID, Nome: row.Nome, DataNasc: row.DataNasc, ClasseID: row.ClasseID,
        Telefone: row.Telefone, Endereco: row.Endereco, Email: row.Email,
        TotalPontos: row.TotalPontos, Ativo: false, CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aluno desativado com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  PROFESSORES
  // ══════════════════════════════════════════

  function listarProfessores(token) {
    return withAuth(token, function(sess) {
      var rows = _safeSheetObjects('Professores').filter(function (r) {
        return _isAtivo(r.Ativo);
      });
      return Util.ok(_strip(rows));
    });
  }

  function criarProfessor(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome é obrigatório.');

      var id = Util.uuid();
      Util.insertRow('Professores', {
        ID:            id,
        AlunoOrigemID: dados.AlunoOrigemID || '',
        UsuarioID:     dados.UsuarioID     || '',
        Nome:          dados.Nome.trim(),
        ClasseID:      dados.ClasseID      || '',
        Telefone:      dados.Telefone      || '',
        DataNasc:      dados.DataNasc      || '',
        Endereco:      dados.Endereco      || '',
        Email:         dados.Email         || '',
        Cursos:        dados.Cursos        || '',
        NumeroWA:      dados.NumeroWA      || '',
        Ativo:         true,
        CriadoEm:     Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Professor cadastrado com sucesso.' });
    });
  }

  function editarProfessor(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Professores', id);
      if (!row) return Util.err('Professor não encontrado.');

      Util.updateRow('Professores', row._rowIndex, {
        ID:            row.ID,
        AlunoOrigemID: dados.AlunoOrigemID !== undefined ? dados.AlunoOrigemID : row.AlunoOrigemID,
        UsuarioID:     dados.UsuarioID     !== undefined ? dados.UsuarioID     : row.UsuarioID,
        Nome:          dados.Nome          !== undefined ? dados.Nome.trim()   : row.Nome,
        ClasseID:      dados.ClasseID      !== undefined ? dados.ClasseID      : row.ClasseID,
        Telefone:      dados.Telefone      !== undefined ? dados.Telefone      : row.Telefone,
        DataNasc:      dados.DataNasc      !== undefined ? dados.DataNasc      : row.DataNasc,
        Endereco:      dados.Endereco      !== undefined ? dados.Endereco      : row.Endereco,
        Email:         dados.Email         !== undefined ? dados.Email         : row.Email,
        Cursos:        dados.Cursos        !== undefined ? dados.Cursos        : row.Cursos,
        NumeroWA:      dados.NumeroWA      !== undefined ? dados.NumeroWA      : row.NumeroWA,
        Ativo:         row.Ativo,
        CriadoEm:     row.CriadoEm
      });
      return Util.ok({ mensagem: 'Professor atualizado com sucesso.' });
    });
  }

  function excluirProfessor(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Professores', id);
      if (!row) return Util.err('Professor não encontrado.');

      Util.updateRow('Professores', row._rowIndex, {
        ID: row.ID, AlunoOrigemID: row.AlunoOrigemID, UsuarioID: row.UsuarioID,
        Nome: row.Nome, ClasseID: row.ClasseID, Telefone: row.Telefone,
        DataNasc: row.DataNasc, Endereco: row.Endereco, Email: row.Email,
        Cursos: row.Cursos, NumeroWA: row.NumeroWA, Ativo: false, CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Professor desativado com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  AULAS
  // ══════════════════════════════════════════

  function listarAulas(token, filtros) {
    return withAuth(token, function(sess) {
      filtros = filtros || {};
      var rows = _safeSheetObjects('Aulas');
      if (filtros.ano)       rows = rows.filter(function(r) { return String(r.Ano) === String(filtros.ano); });
      if (filtros.trimestre) rows = rows.filter(function(r) { return String(r.Trimestre) === String(filtros.trimestre); });
      rows.sort(function(a, b) {
        var da = _parseDateBR(a.CriadoEm), db = _parseDateBR(b.CriadoEm);
        return db - da;
      });
      return Util.ok(rows);
    });
  }

  function criarAula(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Professores não podem cadastrar aulas.');
      if (!dados.Trimestre || !dados.NumLicao) {
        return Util.err('Trimestre e número da lição são obrigatórios.');
      }
      // Trava de duplicata: mesmo Trimestre + NumLicao + Ano
      var anoNovo = String(dados.Ano || new Date().getFullYear());
      var duplicata = _safeSheetObjects('Aulas').filter(function(a) {
        return String(a.Trimestre) === String(dados.Trimestre) &&
               String(a.NumLicao)  === String(dados.NumLicao)  &&
               String(a.Ano)       === anoNovo;
      });
      if (duplicata.length > 0) {
        return Util.err('Já existe uma aula cadastrada para ' + dados.Trimestre + ' — Lição ' + dados.NumLicao + ' (' + anoNovo + ').');
      }
      var id = Util.uuid();
      Util.insertRow('Aulas', {
        ID:        id,
        Data:      dados.Data      || Util.now().split(' ')[0],
        Trimestre: dados.Trimestre,
        NumLicao:  dados.NumLicao,
        Titulo:    dados.Titulo.trim(),
        Ano:       anoNovo,
        CriadoPor: sess.email,
        CriadoEm: Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Aula registrada com sucesso.' });
    });
  }

  function editarAula(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Professores não podem editar aulas.');
      var row = Util.findById('Aulas', id);
      if (!row) return Util.err('Aula não encontrada.');
      Util.updateRow('Aulas', row._rowIndex, {
        ID:        row.ID,
        Data:      dados.Data      !== undefined ? dados.Data      : row.Data,
        Trimestre: dados.Trimestre !== undefined ? dados.Trimestre : row.Trimestre,
        NumLicao:  dados.NumLicao  !== undefined ? dados.NumLicao  : row.NumLicao,
        Titulo:    dados.Titulo    !== undefined ? dados.Titulo.trim() : row.Titulo,
        Ano:       dados.Ano       !== undefined ? dados.Ano       : row.Ano,
        CriadoPor: row.CriadoPor,
        CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aula atualizada com sucesso.' });
    });
  }

  function excluirAula(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      var sheet = Util.getSheet('Aulas');
      var rows  = _safeSheetObjects('Aulas');
      var row   = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].ID === id) { row = rows[i]; break; }
      }
      if (!row) return Util.err('Aula não encontrada.');
      sheet.deleteRow(row._rowIndex);
      return Util.ok({ mensagem: 'Aula excluída com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  RETRATO DA AULA, TRAVAS E DATAS
  // ══════════════════════════════════════════

  function _hojeBR() { return _parseDateBR(Util.now()); }
  function _mesmoDia(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // Planilhas antigas não têm as colunas do retrato: acrescenta ao final do cabeçalho, sem mexer nos dados.
  function _garantirColunas(nome, colunas) {
    var sheet = Util.getSheet(nome);
    var lc = sheet.getLastColumn();
    var atuais = lc > 0 ? sheet.getRange(1, 1, 1, lc).getValues()[0] : [];
    colunas.forEach(function (c) {
      if (atuais.indexOf(c) === -1) {
        sheet.getRange(1, atuais.length + 1).setValue(c);
        atuais.push(c);
      }
    });
  }

  // Quem estava matriculado na turma agora (alunos + professores ativos), para congelar na aula.
  function _retratoAtual(classeId) {
    var lista = [];
    _safeSheetObjects('Professores').forEach(function (p) {
      if (p.ClasseID === classeId && _isAtivo(p.Ativo)) lista.push({ i: p.ID, n: p.Nome, p: 1 });
    });
    _safeSheetObjects('Alunos').forEach(function (a) {
      if (a.ClasseID === classeId && _isAtivo(a.Ativo)) lista.push({ i: a.ID, n: a.Nome, p: 0 });
    });
    return lista;
  }

  function _lerRetrato(info) {
    if (!info || !info.RetratoJSON) return null;
    try { var r = JSON.parse(info.RetratoJSON); return r && r.length !== undefined ? r : null; }
    catch (e) { return null; }
  }

  // Professor só lança/edita a chamada no dia da aula; secretaria e admin a qualquer momento.
  function _podeEditarChamada(sess, aula) {
    if (sess.perfil !== 'professor') return true;
    return _mesmoDia(_dataAula(aula), _hojeBR());
  }

  // Trimestre em curso = o da aula mais recente, enquanto ela for futura ou tiver até 28 dias.
  function _trimestreEmCurso() {
    var aulas = _safeSheetObjects('Aulas');
    if (!aulas.length) return null;
    aulas.forEach(function (a) { a._t = _dataAula(a).getTime(); });
    aulas.sort(function (a, b) { return b._t - a._t; });
    var ult = aulas[0];
    var idade = (_hojeBR().getTime() - ult._t) / 86400000;
    if (idade > 28) return null;
    return { trimestre: String(ult.Trimestre), ano: String(ult.Ano || _dataAula(ult).getFullYear()) };
  }

  // ══════════════════════════════════════════
  //  CHAMADAS
  // ══════════════════════════════════════════

  function getChamada(token, aulaId, classeId) {
    return withAuth(token, function(sess) {
      if (!aulaId || !classeId) return Util.err('aulaId e classeId são obrigatórios.');
      var ok = _classesDoProfessor(sess);
      if (ok !== null && !ok[String(classeId)]) return Util.err('Sem permissão para acessar esta turma.');

      // Alunos da classe
      var alunos = _safeSheetObjects('Alunos').filter(function (r) {
        return r.ClasseID === classeId && (_isAtivo(r.Ativo));
      });

      // Professores desta turma — aparecem no topo da chamada
      var profsDaTurma = _safeSheetObjects('Professores').filter(function(r) {
        return r.ClasseID === classeId && _isAtivo(r.Ativo);
      });

      // Chamadas já lançadas para esta aula+classe
      var chamadas = _safeSheetObjects('Chamadas').filter(function (r) {
        return r.AulaID === aulaId && r.ClasseID === classeId;
      });

      // Pontos extras disponíveis
      var extras = _safeSheetObjects('PontosExtras').filter(function (r) {
        return _isAtivo(r.Ativo);
      });

      var chamadaMap = {};
      chamadas.forEach(function (c) { chamadaMap[c.AlunoID] = c; });

      var resultado = alunos.map(function (a) {
        var c = chamadaMap[a.ID] || {};
        var extrasJson = [];
        try { extrasJson = c.PontosExtrasJSON ? JSON.parse(c.PontosExtrasJSON) : []; } catch(e) { extrasJson = []; }
        return {
          alunoId:        a.ID,
          nome:           a.Nome,
          isProfessor:    false,
          presente:       c.Presente  === true  || c.Presente  === 'TRUE',
          biblia:         c.Biblia    === true  || c.Biblia    === 'TRUE',
          revista:        c.Revista   === true  || c.Revista   === 'TRUE',
          pontosExtras:   extrasJson,
          totalPontos:    c.TotalPontos  || 0,
          totalOfertas:   c.TotalOfertas || 0,
          chamadaId:      c.ID || null
        };
      });

      // Construir entradas dos professores (com flag isProfessor: true) e colocá-los no topo
      var profEntradas = profsDaTurma.map(function(p) {
        var cp = chamadaMap[p.ID] || {};
        var extrasJsonP = [];
        try { extrasJsonP = cp.PontosExtrasJSON ? JSON.parse(cp.PontosExtrasJSON) : []; } catch(e) { extrasJsonP = []; }
        return {
          alunoId:      p.ID,
          nome:         p.Nome,
          isProfessor:  true,
          presente:     cp.Presente === true || cp.Presente === 'TRUE',
          biblia:       cp.Biblia   === true || cp.Biblia   === 'TRUE',
          revista:      cp.Revista  === true || cp.Revista  === 'TRUE',
          pontosExtras: extrasJsonP,
          totalPontos:  cp.TotalPontos  || 0,
          totalOfertas: cp.TotalOfertas || 0,
          chamadaId:    cp.ID || null
        };
      });
      resultado = profEntradas.concat(resultado);

      // Dados da turma nesta aula (visitantes, oferta, observações)
      var infoRows = _safeSheetObjects('ChamadasInfo').filter(function(r) {
        return r.AulaID === aulaId && r.ClasseID === classeId;
      });
      var info = infoRows.length ? infoRows[0] : {};
      // Aula já lançada: a lista é o retrato do dia (quem estava na turma), não a turma de hoje.
      var retrato = _lerRetrato(info);
      if (retrato) {
        resultado = retrato.map(function (x) {
          var cr = chamadaMap[x.i] || {};
          var ex = [];
          try { ex = cr.PontosExtrasJSON ? JSON.parse(cr.PontosExtrasJSON) : []; } catch (e) { ex = []; }
          return {
            alunoId: x.i, nome: x.n, isProfessor: x.p === 1,
            presente: cr.Presente === true || cr.Presente === 'TRUE',
            biblia:   cr.Biblia   === true || cr.Biblia   === 'TRUE',
            revista:  cr.Revista  === true || cr.Revista  === 'TRUE',
            pontosExtras: ex, totalPontos: cr.TotalPontos || 0, totalOfertas: cr.TotalOfertas || 0, chamadaId: cr.ID || null
          };
        });
      }
      var turmaInfo = {
        numVisitantes: Number(info.NumVisitantes) || 0,
        totalOferta:   Number(info.TotalOferta)   || 0,
        observacoes:   info.Observacoes || ''
      };

      // ── Histórico de presença do trimestre para a timeline ──
      var todasAulas    = _safeSheetObjects('Aulas');
      var aulaAtual     = todasAulas.filter(function(a){ return a.ID === aulaId; })[0] || {};
      var trimAtual     = aulaAtual.Trimestre || '';
      var anoAtual      = aulaAtual.Ano       || '';
      var aulasTrimestre = todasAulas.filter(function(a){
        return String(a.Trimestre) === String(trimAtual) && String(a.Ano) === String(anoAtual);
      }).sort(function(a,b){ return (Number(a.NumLicao)||0) - (Number(b.NumLicao)||0); });
      var aulaIdsTrim = {};
      aulasTrimestre.forEach(function(a){ aulaIdsTrim[a.ID] = Number(a.NumLicao) || 0; });
      var todasChamadas = _safeSheetObjects('Chamadas').filter(function(c){
        return c.ClasseID === classeId && aulaIdsTrim[c.AulaID] !== undefined;
      });
      var histMap = {};
      todasChamadas.forEach(function(c){
        var aid = String(c.AlunoID);
        if (!histMap[aid]) histMap[aid] = {};
        histMap[aid][aulaIdsTrim[c.AulaID]] = c.Presente === true || c.Presente === 'TRUE';
      });

      var cfgPts = _getConfig();
      var pontos = { presenca: Number(cfgPts.PONTOS_PRESENCA) || 1, biblia: Number(cfgPts.PONTOS_BIBLIA) || 2, revista: Number(cfgPts.PONTOS_REVISTA) || 2 };
      var classeRow = Util.findById('Classes', classeId) || {};
      return Util.ok({
        modo: _modoChamada(cfgPts), alunos: resultado, extras: extras, pontos: pontos, jaLancada: chamadas.length > 0,
        turmaInfo: turmaInfo, historicoPresenca: histMap, totalLicoes: aulasTrimestre.length, trimestre: trimAtual,
        licoes: aulasTrimestre.map(function (a) { return Number(a.NumLicao) || 0; }),
        podeEditar: _podeEditarChamada(sess, aulaAtual), retratoFixo: !!retrato,
        aula: { id: aulaId, numLicao: aulaAtual.NumLicao, titulo: aulaAtual.Titulo, data: aulaAtual.Data, trimestre: trimAtual },
        turmaNome: classeRow.Nome || ''
      });
    });
  }

  function salvarChamada(token, aulaId, classeId, registros, turmaInfo) {
    return withAuth(token, function(sess) {
      if (!aulaId || !classeId || !registros) return Util.err('Dados incompletos.');
      var ok = _classesDoProfessor(sess);
      if (ok !== null && !ok[String(classeId)]) return Util.err('Sem permissão para registrar chamada nesta turma.');
      var aulaRow = Util.findById('Aulas', aulaId);
      if (!aulaRow) return Util.err('Aula não encontrada.');
      if (!_podeEditarChamada(sess, aulaRow)) return Util.err('O professor só pode lançar ou editar a chamada no dia da aula. Peça à secretaria.');

      // Retrato: a primeira gravação congela quem estava na turma; edições seguintes usam o mesmo grupo.
      _garantirColunas('ChamadasInfo', ['Matriculados', 'RetratoJSON']);
      var infoPrev = null;
      _safeSheetObjects('ChamadasInfo').forEach(function (r) { if (r.AulaID === aulaId && r.ClasseID === classeId) infoPrev = r; });
      var retratoSalvo = _lerRetrato(infoPrev);
      var retratoNovo  = retratoSalvo || _retratoAtual(classeId);
      var retratoIds = {};
      retratoNovo.forEach(function (x) { retratoIds[x.i] = true; });
      if (retratoSalvo) {
        registros = registros.filter(function (r) { return retratoIds[r.alunoId]; });
      } else {
        // Primeira gravação: quem foi marcado mas não está mais ativo entra no retrato com o nome do cadastro.
        registros.forEach(function (r) {
          if (retratoIds[r.alunoId]) return;
          var a = Util.findById('Alunos', r.alunoId) || Util.findById('Professores', r.alunoId);
          if (a) { retratoNovo.push({ i: a.ID, n: a.Nome, p: a.AlunoOrigemID !== undefined ? 1 : 0 }); retratoIds[a.ID] = true; }
        });
      }

      var config     = _getConfig();
      var ptPresenca = Number(config.PONTOS_PRESENCA) || 1;
      var ptBiblia   = Number(config.PONTOS_BIBLIA)   || 2;
      var ptRevista  = Number(config.PONTOS_REVISTA)  || 2;

      // Carregar chamadas existentes para saber o que atualizar ou inserir
      var chamadas = _safeSheetObjects('Chamadas');
      var chamadaMap = {};
      chamadas.forEach(function (c) {
        if (c.AulaID === aulaId && c.ClasseID === classeId) {
          chamadaMap[c.AlunoID] = c;
        }
      });

      var modoSimples = _modoChamada(config) === 'presenca';

      registros.forEach(function (reg) {
        var presente = reg.presente === true;
        var biblia   = presente && (reg.biblia   === true);
        var revista  = presente && (reg.revista  === true);
        var extras   = presente ? (reg.pontosExtras || []) : [];
        if (modoSimples) {
          // Modo "somente presença": não mexe em bíblia/revista/extras já lançados antes (modo completo).
          var antes = chamadaMap[reg.alunoId];
          biblia  = !!(presente && antes && (antes.Biblia  === true || antes.Biblia  === 'TRUE'));
          revista = !!(presente && antes && (antes.Revista === true || antes.Revista === 'TRUE'));
          extras  = [];
          if (presente && antes && antes.PontosExtrasJSON) { try { extras = JSON.parse(antes.PontosExtrasJSON) || []; } catch (e) { extras = []; } }
        }
        var ptExtras = 0;
        extras.forEach(function (e) { ptExtras += Number(e.pontos) || 0; });
        var total = (presente ? ptPresenca : 0) + (biblia ? ptBiblia : 0) + (revista ? ptRevista : 0) + ptExtras;

        var obj = {
          AulaID:          aulaId,
          ClasseID:        classeId,
          AlunoID:         reg.alunoId,
          Presente:        presente,
          Biblia:          biblia,
          Revista:         revista,
          PontosExtrasJSON: JSON.stringify(extras),
          TotalPontos:     total,
          TotalOfertas:    reg.totalOfertas || 0,
          LancadoPor:      sess.email,
          CriadoEm:       Util.now()
        };

        var existente = chamadaMap[reg.alunoId];
        if (existente) {
          obj.ID = existente.ID;
          Util.updateRow('Chamadas', existente._rowIndex, obj);
        } else {
          obj.ID = Util.uuid();
          Util.insertRow('Chamadas', obj);
        }

        // Recalcular TotalPontos do aluno
        _recalcularPontosAluno(reg.alunoId);
      });

      // Salvar / atualizar ChamadasInfo (visitantes, oferta, observações da turma)
      if (turmaInfo || !retratoSalvo) {
        var existInfo = null;
        _safeSheetObjects('ChamadasInfo').forEach(function(r) {
          if (r.AulaID === aulaId && r.ClasseID === classeId) existInfo = r;
        });
        var ti = turmaInfo || (existInfo ? { numVisitantes: existInfo.NumVisitantes, totalOferta: existInfo.TotalOferta, observacoes: existInfo.Observacoes } : {});
        var infoObj = {
          AulaID:        aulaId,
          ClasseID:      classeId,
          NumVisitantes: Number(ti.numVisitantes) || 0,
          TotalOferta:   Number(ti.totalOferta)   || 0,
          Observacoes:   String(ti.observacoes    || '').trim(),
          LancadoPor:    sess.email,
          CriadoEm:      Util.now(),
          Matriculados:  retratoNovo.length,
          RetratoJSON:   JSON.stringify(retratoNovo)
        };
        if (existInfo) {
          infoObj.ID = existInfo.ID;
          Util.updateRow('ChamadasInfo', existInfo._rowIndex, infoObj);
        } else {
          infoObj.ID = Util.uuid();
          Util.insertRow('ChamadasInfo', infoObj);
        }
      }

      return Util.ok({ mensagem: 'Chamada salva com sucesso.' });
    });
  }

  // Histórico do trimestre em curso: cada aula com quantas turmas já lançaram a chamada.
  // status: 'ok' (todas lançadas) | 'pendente' (falta alguma). Professor só conta as próprias turmas.
  function getHistoricoChamadas(token, filtros) {
    return withAuth(token, function (sess) {
      filtros = filtros || {};
      var ok = _classesDoProfessor(sess);
      var aulas = _safeSheetObjects('Aulas');
      aulas.forEach(function (a) { a._t = _dataAula(a).getTime(); });
      aulas.sort(function (x, y) { return y._t - x._t; });
      var tri = null;
      if (filtros.trimestre && filtros.ano) tri = { trimestre: String(filtros.trimestre), ano: String(filtros.ano) };
      else if (aulas.length) tri = { trimestre: String(aulas[0].Trimestre), ano: String(aulas[0].Ano || _dataAula(aulas[0]).getFullYear()) };
      var classes = _safeSheetObjects('Classes').filter(function (c) { return _isAtivo(c.Ativo) && (ok === null || ok[String(c.ID)]); });
      var feitas = {};
      _safeSheetObjects('Chamadas').forEach(function (c) { (feitas[c.AulaID] = feitas[c.AulaID] || {})[c.ClasseID] = true; });
      var hoje = _hojeBR();
      var lista = aulas.filter(function (a) {
        return tri && String(a.Trimestre) === tri.trimestre && String(a.Ano || _dataAula(a).getFullYear()) === tri.ano;
      }).map(function (a) {
        var f = feitas[a.ID] || {};
        var lan = classes.filter(function (c) { return f[c.ID]; }).length;
        var d = _dataAula(a);
        return {
          id: a.ID, numLicao: a.NumLicao, titulo: a.Titulo || '', data: a.Data, trimestre: a.Trimestre,
          turmas: classes.length, lancadas: lan,
          status: classes.length && lan >= classes.length ? 'ok' : 'pendente',
          hoje: _mesmoDia(d, hoje), futura: d.getTime() > hoje.getTime() && !_mesmoDia(d, hoje)
        };
      });
      return Util.ok({
        trimestre: tri ? tri.trimestre : '', ano: tri ? tri.ano : '', aulas: lista,
        pendentes: lista.filter(function (x) { return x.status === 'pendente' && !x.futura; }).length,
        podeCriarAula: sess.perfil !== 'professor'
      });
    });
  }

  // ══════════════════════════════════════════
  //  EXPORTAR / IMPORTAR DADOS DA EBD
  //  (independente do módulo Membros)
  // ══════════════════════════════════════════

  function _nomeChave(n) { return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // Tudo da EBD num único pacote (backup JSON). Inclui inativos.
  function exportarDadosEbd(token) {
    return withAuth(token, function (sess) {
      if (sess.perfil !== 'admin' && sess.perfil !== 'secretaria') return Util.err('Sem permissão.');
      function todas(aba) { return _strip(_safeSheetObjects(aba)); }
      return Util.ok({
        sistema: 'gestao-ministerial', modulo: 'escola-dominical', versao: 1, geradoEm: Util.now(),
        classes: todas('Classes'), alunos: todas('Alunos'), professores: todas('Professores'),
        aulas: todas('Aulas'), chamadas: todas('Chamadas'), chamadasInfo: todas('ChamadasInfo'), pontosExtras: todas('PontosExtras')
      });
    });
  }

  // Importa alunos e professores em lote (até 200 por chamada).
  // linhas: [{ tipo:'aluno'|'professor', nome, turma, telefone, email, dataNasc, endereco, ativo, criadoEm }]
  // mapa:   { 'nome da turma na planilha': classeId | '__new__' | '' }
  function importarPessoasEbd(token, linhas, mapa) {
    return withAuth(token, function (sess) {
      if (sess.perfil !== 'admin' && sess.perfil !== 'secretaria') return Util.err('Sem permissão.');
      if (!linhas || !linhas.length) return Util.err('Nenhum registro para importar.');
      if (linhas.length > 200) return Util.err('Envie no máximo 200 registros por vez.');
      mapa = mapa || {};

      var classes = _safeSheetObjects('Classes');
      var porNome = {};
      classes.forEach(function (c) { if (_isAtivo(c.Ativo)) porNome[_nomeChave(c.Nome)] = c.ID; });
      var vistos = { aluno: {}, professor: {} };
      _safeSheetObjects('Alunos').forEach(function (a) { vistos.aluno[_nomeChave(a.Nome)] = true; });
      _safeSheetObjects('Professores').forEach(function (p) { vistos.professor[_nomeChave(p.Nome)] = true; });

      var res = { alunos: 0, professores: 0, turmasCriadas: 0, duplicados: 0, erros: 0, mensagens: [] };

      function resolverTurma(nome) {
        var alvo = mapa[nome];
        if (alvo && alvo !== '__new__') return Util.findById('Classes', alvo) ? alvo : '';
        var k = _nomeChave(nome);
        if (!k) return '';
        if (alvo === undefined && porNome[k]) return porNome[k];
        if (alvo === '__new__' && porNome[k]) return porNome[k];
        if (alvo === '__new__') {
          var id = Util.uuid();
          Util.insertRow('Classes', { ID: id, Nome: String(nome).trim(), FaixaEtaria: '', LicaoCPAD: '', Ativo: true, CriadoEm: Util.now() });
          porNome[k] = id; res.turmasCriadas++;
          return id;
        }
        return '';
      }

      linhas.forEach(function (l) {
        var tipo = l.tipo === 'professor' ? 'professor' : 'aluno';
        var nome = String(l.nome || '').trim();
        if (!nome) { res.erros++; return; }
        var k = _nomeChave(nome);
        if (vistos[tipo][k]) { res.duplicados++; return; }
        var classeId = resolverTurma(String(l.turma || '').trim());
        if (tipo === 'aluno' && !classeId) { res.erros++; res.mensagens.push(nome + ': sem turma'); return; }
        var ativo = l.ativo === false || l.ativo === 'false' ? false : true;
        var base = {
          ID: Util.uuid(), Nome: nome, DataNasc: String(l.dataNasc || ''), ClasseID: classeId,
          Telefone: String(l.telefone || ''), Endereco: String(l.endereco || ''), Email: String(l.email || ''),
          Ativo: ativo, CriadoEm: l.criadoEm || Util.now()
        };
        try {
          if (tipo === 'aluno') { base.TotalPontos = 0; Util.insertRow('Alunos', base); res.alunos++; }
          else { base.AlunoOrigemID = ''; base.UsuarioID = ''; base.Cursos = ''; Util.insertRow('Professores', base); res.professores++; }
          vistos[tipo][k] = true;
        } catch (e) { res.erros++; res.mensagens.push(nome + ': ' + e.message); }
      });
      return Util.ok(res);
    });
  }

  // Alunos e professores ativos que ainda não são membros (por nome) — para "Importar da EBD" no cadastro de membro.
  function pessoasParaMembros(token) {
    return withAuth(token, function (sess) {
      if (sess.perfil !== 'admin' && sess.perfil !== 'secretaria') return Util.err('Sem permissão.');
      var membros = {};
      try { Util.sheetToObjects('Membros').forEach(function (m) { membros[_nomeChave(m.nome)] = true; }); } catch (e) {}
      var classes = {};
      _safeSheetObjects('Classes').forEach(function (c) { classes[c.ID] = c.Nome; });
      var out = [];
      function add(tipo, r) {
        if (!_isAtivo(r.Ativo) || membros[_nomeChave(r.Nome)]) return;
        out.push({ id: r.ID, tipo: tipo, nome: r.Nome, turma: classes[r.ClasseID] || '', dataNasc: r.DataNasc, telefone: r.Telefone, email: r.Email, endereco: r.Endereco });
      }
      _safeSheetObjects('Alunos').forEach(function (r) { add('aluno', r); });
      _safeSheetObjects('Professores').forEach(function (r) { add('professor', r); });
      out.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
      return Util.ok(out);
    });
  }

  // Frequência de todos os alunos no trimestre em curso (para a linha de frequência da tela Alunos).
  function getFrequenciaTrimestre(token) {
    return withAuth(token, function (sess) {
      var ok = _classesDoProfessor(sess);
      var aulas = _safeSheetObjects('Aulas');
      aulas.forEach(function (a) { a._t = _dataAula(a).getTime(); });
      aulas.sort(function (x, y) { return y._t - x._t; });
      if (!aulas.length) return Util.ok({ trimestre: '', ano: '', licoes: [], hist: {} });
      var tri = String(aulas[0].Trimestre), ano = String(aulas[0].Ano || _dataAula(aulas[0]).getFullYear());
      var porId = {}, licoes = [];
      aulas.forEach(function (a) {
        if (String(a.Trimestre) !== tri || String(a.Ano || _dataAula(a).getFullYear()) !== ano) return;
        var n = Number(a.NumLicao) || 0; porId[a.ID] = n; licoes.push(n);
      });
      licoes.sort(function (x, y) { return x - y; });
      var hist = {};
      _safeSheetObjects('Chamadas').forEach(function (c) {
        if (porId[c.AulaID] === undefined) return;
        if (ok !== null && !ok[String(c.ClasseID)]) return;
        (hist[c.AlunoID] = hist[c.AlunoID] || {})[porId[c.AulaID]] = _presente(c);
      });
      return Util.ok({ trimestre: tri, ano: ano, licoes: licoes, hist: hist });
    });
  }

  function listarChamadasPorAula(token, aulaId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var chamadas = _safeSheetObjects('Chamadas').filter(function(r) {
        if (r.AulaID !== aulaId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      var infoTurmas = _safeSheetObjects('ChamadasInfo').filter(function(r) {
        if (r.AulaID !== aulaId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      return Util.ok({ chamadas: chamadas, infoTurmas: infoTurmas });
    });
  }

  function getRankingAlunos(token, classeId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var filtro = classeId || null;
      var alunos = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (filtro && r.ClasseID !== filtro) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      alunos.sort(function(a, b) {
        return (Number(b.TotalPontos) || 0) - (Number(a.TotalPontos) || 0);
      });
      return Util.ok(alunos);
    });
  }

  // NOTA: NÃO migrada para withAuth de propósito — aceita token ausente
  // ou 'dummy-token' (sess fica null, sem filtro de turma aplicado).
  // Nenhum chamador atual envia isso, mas o contrato é preservado.
  function getEstatisticasGerais(token) {
    try {
      var sess = (token && token !== 'dummy-token') ? Auth._auth(token) : null;
      var ok = sess ? _classesDoProfessor(sess) : null;
      var alunos = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      var classes = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      var professores = _safeSheetObjects('Professores').filter(function(r) { return _isAtivo(r.Ativo); });
      var aulas    = _safeSheetObjects('Aulas');
      var chamadas = _safeSheetObjects('Chamadas');
      if (ok !== null) {
        chamadas = chamadas.filter(function(c) { return ok[String(c.ClasseID)]; });
        var _ids = {};
        chamadas.forEach(function(c) { if (c.AulaID) _ids[String(c.AulaID)] = true; });
        aulas = aulas.filter(function(a) { return _ids[String(a.ID)]; });
      }
      var totalPresentes = chamadas.filter(function(c) { return c.Presente === true || c.Presente === 'TRUE'; }).length;
      var mediaPres = chamadas.length ? Math.round((totalPresentes / chamadas.length) * 100) : 0;
      var hoje = new Date();
      var aulasHoje = aulas.filter(function(a) {
        var d = _parseDateBR(a.CriadoEm);
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      });
      return Util.ok({
        totalAlunos:      alunos.length,
        totalClasses:     classes.length,
        totalProfessores: professores.length,
        totalAulas:       aulas.length,
        aulasMes:         aulasHoje.length,
        presencaMedia:    mediaPres
      });
    } catch (e) { return Util.err(e.message); }
  }

  function getPontosExtras(token) {
    return withAuth(token, function(sess) {
      var EXCLUIR_EXATOS = ['questionário', 'questionario'];
      var rows = _safeSheetObjects('PontosExtras').filter(function (r) {
        if (!_isAtivo(r.Ativo)) return false;
        var nome = String(r.Nome || '').trim().toLowerCase();
        return EXCLUIR_EXATOS.indexOf(nome) === -1;
      });
      return Util.ok(rows);
    });
  }


  // ══════════════════════════════════════════
  //  CONFIGURAÇÃO DO MÓDULO (modos de chamada e ranking)
  // ══════════════════════════════════════════

  // EBD_MODO_CHAMADA: 'presenca' (padrão) | 'completa' (bíblia, revista e pontos extras por aluno)
  // EBD_MODO_RANKING: 'presenca' (padrão) | 'pontos'   (soma de presença + bíblia + revista + extras)
  function _modoChamada(cfg) { return String((cfg || _getConfig()).EBD_MODO_CHAMADA || '').trim().toLowerCase() === 'completa' ? 'completa' : 'presenca'; }
  function _modoRanking(cfg) { return String((cfg || _getConfig()).EBD_MODO_RANKING || '').trim().toLowerCase() === 'pontos' ? 'pontos' : 'presenca'; }

  function _setConfig(chave, valor) {
    var ultima = null;
    _safeSheetObjects('Config').forEach(function (r) { if (String(r.Chave).trim() === chave) ultima = r; });
    if (ultima) {
      Util.updateRow('Config', ultima._rowIndex, { Chave: ultima.Chave, Valor: valor, Descricao: ultima.Descricao, AtualizadoEm: Util.now() });
    } else {
      Util.insertRow('Config', { Chave: chave, Valor: valor, Descricao: '', AtualizadoEm: Util.now() });
    }
  }

  function getConfigEbd(token) {
    return withAuth(token, function (sess) {
      var c = _getConfig();
      return Util.ok({
        modoChamada: _modoChamada(c),
        modoRanking: _modoRanking(c),
        pontos: { presenca: Number(c.PONTOS_PRESENCA) || 1, biblia: Number(c.PONTOS_BIBLIA) || 2, revista: Number(c.PONTOS_REVISTA) || 2 }
      });
    });
  }

  function salvarConfigEbd(token, dados) {
    return withAuth(token, function (sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      dados = dados || {};
      if (dados.modoChamada !== undefined) {
        if (['presenca', 'completa'].indexOf(dados.modoChamada) === -1) return Util.err('Modo de chamada inválido.');
        _setConfig('EBD_MODO_CHAMADA', dados.modoChamada);
      }
      if (dados.modoRanking !== undefined) {
        if (['presenca', 'pontos'].indexOf(dados.modoRanking) === -1) return Util.err('Modo de ranking inválido.');
        _setConfig('EBD_MODO_RANKING', dados.modoRanking);
      }
      if (dados.pontos) {
        var mapa = { presenca: 'PONTOS_PRESENCA', biblia: 'PONTOS_BIBLIA', revista: 'PONTOS_REVISTA' };
        for (var k in mapa) {
          if (dados.pontos[k] === undefined) continue;
          var n = Number(dados.pontos[k]);
          if (isNaN(n) || n < 0 || n > 100) return Util.err('Pontuação inválida (use de 0 a 100).');
          _setConfig(mapa[k], n);
        }
      }
      return Util.ok({ mensagem: 'Configurações salvas.' });
    });
  }

  // ══════════════════════════════════════════
  //  RANKING E VISÃO GERAL
  // ══════════════════════════════════════════

  function _dataAula(a) {
    var d = _parseDateBR(a.Data);
    if (!d || isNaN(d.getTime()) || d.getTime() === 0) d = _parseDateBR(a.CriadoEm);
    return d;
  }
  // Últimos movimentos da EBD (até 5 de cada tipo; a Início mistura e corta).
  function atividadeRecente() {
    var out = [];
    var classes = {}, aulas = {};
    _safeSheetObjects('Classes').forEach(function (c) { classes[c.ID] = c.Nome; });
    _safeSheetObjects('Aulas').forEach(function (a) { aulas[a.ID] = a; });
    function ult(lista) {
      return lista.filter(function (r) { return r.CriadoEm; })
        .map(function (r) { var d = _parseDateBR(r.CriadoEm); r._t = d ? d.getTime() : 0; return r; })
        .sort(function (a, b) { return b._t - a._t; }).slice(0, 5);
    }
    ult(_safeSheetObjects('ChamadasInfo')).forEach(function (i) {
      var a = aulas[i.AulaID] || {};
      out.push({ icon: 'clipboard-check', texto: 'Chamada lançada: ' + (classes[i.ClasseID] || 'turma') + (a.NumLicao ? ' · Lição ' + a.NumLicao : ''), data: i.CriadoEm });
    });
    ult(_safeSheetObjects('Aulas')).forEach(function (a) {
      out.push({ icon: 'calendar-plus', texto: 'Aula cadastrada: Lição ' + a.NumLicao, data: a.CriadoEm });
    });
    ult(_safeSheetObjects('Alunos').filter(function (a) { return _isAtivo(a.Ativo); })).forEach(function (a) {
      out.push({ icon: 'user-plus', texto: 'Aluno adicionado à EBD: ' + a.Nome, data: a.CriadoEm });
    });
    return out;
  }
  // Turmas ativas que ainda não lançaram a chamada de uma aula de hoje (para o indicador da Início).
  function chamadasPendentesHoje() {
    var hoje = _hojeBR(), total = 0;
    var aulas = _safeSheetObjects('Aulas').filter(function (a) { return _mesmoDia(_dataAula(a), hoje); });
    if (!aulas.length) return 0;
    var classes = _safeSheetObjects('Classes').filter(function (c) { return _isAtivo(c.Ativo); });
    var chamadas = _safeSheetObjects('Chamadas');
    aulas.forEach(function (a) {
      var feitas = {};
      chamadas.forEach(function (c) { if (c.AulaID === a.ID) feitas[c.ClasseID] = true; });
      classes.forEach(function (c) { if (!feitas[c.ID]) total++; });
    });
    return total;
  }
  function _presente(c) { return c.Presente === true || c.Presente === 'TRUE' || c.Presente === 1; }

  // filtros: { classeId, trimestre, ano, modo }  → alunos ordenados com presenças, % e pontos
  function _calcularRanking(sess, filtros) {
    filtros = filtros || {};
    var cfg  = _getConfig();
    var modo = filtros.modo === 'pontos' || filtros.modo === 'presenca' ? filtros.modo : _modoRanking(cfg);
    var ok   = _classesDoProfessor(sess);
    var ano  = String(filtros.ano || new Date().getFullYear());

    var aulasOk = {};
    _safeSheetObjects('Aulas').forEach(function (a) {
      if (String(a.Ano || _dataAula(a).getFullYear()) !== ano) return;
      if (filtros.trimestre && String(a.Trimestre) !== String(filtros.trimestre)) return;
      aulasOk[a.ID] = true;
    });

    var alunos = _safeSheetObjects('Alunos').filter(function (r) {
      if (!_isAtivo(r.Ativo)) return false;
      if (filtros.classeId && r.ClasseID !== filtros.classeId) return false;
      if (ok !== null && !ok[String(r.ClasseID)]) return false;
      return true;
    });
    var porAluno = {}, aulasDaTurma = {};
    _safeSheetObjects('Chamadas').forEach(function (c) {
      if (!aulasOk[c.AulaID]) return;
      (aulasDaTurma[c.ClasseID] = aulasDaTurma[c.ClasseID] || {})[c.AulaID] = true;
      var x = porAluno[c.AlunoID] = porAluno[c.AlunoID] || { presencas: 0, pontos: 0 };
      if (_presente(c)) x.presencas++;
      x.pontos += Number(c.TotalPontos) || 0;
    });
    var nomesTurma = {};
    _safeSheetObjects('Classes').forEach(function (c) { nomesTurma[c.ID] = c.Nome; });
    var lista = alunos.map(function (a) {
      var x = porAluno[a.ID] || { presencas: 0, pontos: 0 };
      var totalAulas = Object.keys(aulasDaTurma[a.ClasseID] || {}).length;
      return {
        alunoId: a.ID, nome: a.Nome, classeId: a.ClasseID, classeNome: nomesTurma[a.ClasseID] || '',
        presencas: x.presencas, totalAulas: totalAulas,
        percentual: totalAulas ? Math.round((x.presencas / totalAulas) * 100) : 0,
        pontos: x.pontos
      };
    });
    lista.sort(function (a, b) {
      var d = modo === 'pontos'
        ? (b.pontos - a.pontos) || (b.presencas - a.presencas)
        : (b.presencas - a.presencas) || (b.percentual - a.percentual) || (b.pontos - a.pontos);
      return d || String(a.nome).localeCompare(String(b.nome));
    });
    return { modo: modo, ano: ano, lista: lista };
  }

  function getRanking(token, filtros) {
    return withAuth(token, function (sess) {
      return Util.ok(_calcularRanking(sess, filtros));
    });
  }


  // Relatório da aula: um bloco por turma + consolidado geral (igual ao relatório original).
  // Matriculados = alunos + professores ativos da turma (mesmo universo da chamada).
  function getRelatorioAula(token, aulaId) {
    return withAuth(token, function (sess) {
      if (!aulaId) return Util.err('Aula não informada.');
      var aula = Util.findById('Aulas', aulaId);
      if (!aula) return Util.err('Aula não encontrada.');
      var ok = _classesDoProfessor(sess);
      var chamadas = _safeSheetObjects('Chamadas').filter(function (c) { return c.AulaID === aulaId; });
      var infos = {};
      _safeSheetObjects('ChamadasInfo').forEach(function (i) { if (i.AulaID === aulaId) infos[i.ClasseID] = i; });
      var lancadas = {};
      chamadas.forEach(function (c) { lancadas[c.ClasseID] = true; });
      Object.keys(infos).forEach(function (k) { lancadas[k] = true; });
      // Turma já lançada entra sempre (mesmo se hoje estiver inativa); as demais só se ativas.
      var classes = _safeSheetObjects('Classes').filter(function (c) {
        return (lancadas[c.ID] || _isAtivo(c.Ativo)) && (ok === null || ok[String(c.ID)]);
      });
      var alunos  = _safeSheetObjects('Alunos').filter(function (a) { return _isAtivo(a.Ativo); });
      var profs   = _safeSheetObjects('Professores').filter(function (p) { return _isAtivo(p.Ativo); });

      var geral = { matriculados: 0, presentes: 0, ausentes: 0, visitantes: 0, biblias: 0, revistas: 0, oferta: 0, turmasLancadas: 0 };
      var turmas = classes.map(function (c) {
        // Aula lançada: matriculados = retrato gravado no lançamento (não muda com exclusão/inclusão/transferência).
        var infoC = infos[c.ID] || null;
        var retr  = _lerRetrato(infoC);
        var mat = retr ? retr.length
          : alunos.filter(function (a) { return a.ClasseID === c.ID; }).length + profs.filter(function (p) { return p.ClasseID === c.ID; }).length;
        var regs = chamadas.filter(function (x) { return x.ClasseID === c.ID; });
        var pres = 0, bib = 0, rev = 0;
        regs.forEach(function (x) {
          if (_presente(x)) pres++;
          if (x.Biblia === true || x.Biblia === 'TRUE') bib++;
          if (x.Revista === true || x.Revista === 'TRUE') rev++;
        });
        var info = infos[c.ID] || {};
        var visit = Number(info.NumVisitantes) || 0, oferta = Number(info.TotalOferta) || 0;
        var t = {
          classeId: c.ID, nome: c.Nome, faixa: c.FaixaEtaria || '', lancada: regs.length > 0,
          matriculados: mat, presentes: pres, ausentes: Math.max(0, mat - pres), visitantes: visit,
          total: pres + visit, biblias: bib, revistas: rev, oferta: oferta,
          percentual: mat ? Math.round((pres / mat) * 100) : 0
        };
        geral.matriculados += mat; geral.presentes += pres; geral.ausentes += t.ausentes; geral.visitantes += visit;
        geral.biblias += bib; geral.revistas += rev; geral.oferta += oferta;
        if (t.lancada) geral.turmasLancadas++;
        return t;
      });
      geral.total = geral.presentes + geral.visitantes;
      geral.percentual = geral.matriculados ? Math.round((geral.presentes / geral.matriculados) * 100) : 0;
      geral.oferta = Math.round(geral.oferta * 100) / 100;
      return Util.ok({
        modo: _modoChamada(),
        aula: { id: aula.ID, numLicao: aula.NumLicao, trimestre: aula.Trimestre, data: aula.Data, titulo: aula.Titulo },
        turmas: turmas, geral: geral, totalTurmas: turmas.length
      });
    });
  }

  function getVisaoGeral(token) {
    return withAuth(token, function (sess) {
      var ok = _classesDoProfessor(sess);
      var classes = _safeSheetObjects('Classes').filter(function (r) { return _isAtivo(r.Ativo) && (ok === null || ok[String(r.ID)]); });
      var alunos  = _safeSheetObjects('Alunos').filter(function (r) { return _isAtivo(r.Ativo) && (ok === null || ok[String(r.ClasseID)]); });
      var profs   = _safeSheetObjects('Professores').filter(function (r) { return _isAtivo(r.Ativo); });
      var aulas   = _safeSheetObjects('Aulas');
      aulas.forEach(function (a) { a._t = _dataAula(a).getTime(); });
      aulas.sort(function (x, y) { return y._t - x._t; });

      var chamadas = _safeSheetObjects('Chamadas').filter(function (c) { return ok === null || ok[String(c.ClasseID)]; });
      var porAula = {};
      chamadas.forEach(function (c) {
        var x = porAula[c.AulaID] = porAula[c.AulaID] || { total: 0, pres: 0, turmas: {} };
        x.total++; if (_presente(c)) x.pres++; x.turmas[c.ClasseID] = true;
      });
      // últimas 8 aulas que já tiveram chamada, da mais antiga para a mais recente
      var recentes = aulas.filter(function (a) { return porAula[a.ID]; }).slice(0, 8).reverse().map(function (a) {
        var x = porAula[a.ID];
        return { aulaId: a.ID, numLicao: a.NumLicao, data: a.Data, percentual: x.total ? Math.round((x.pres / x.total) * 100) : 0 };
      });
      var media = recentes.length ? Math.round(recentes.reduce(function (s2, x) { return s2 + x.percentual; }, 0) / recentes.length) : 0;

      // aula mais recente (até hoje) e turmas que ainda não lançaram chamada nela
      var hoje = new Date().getTime() + 86400000;
      var ultima = null;
      for (var i = 0; i < aulas.length; i++) { if (aulas[i]._t <= hoje) { ultima = aulas[i]; break; } }
      var semChamada = [];
      if (ultima) {
        var feitas = (porAula[ultima.ID] && porAula[ultima.ID].turmas) || {};
        semChamada = classes.filter(function (c) { return !feitas[c.ID]; }).map(function (c) { return { id: c.ID, nome: c.Nome }; });
      }

      // presença por turma (últimas 8 aulas com chamada)
      var idsRecentes = {}; recentes.forEach(function (x) { idsRecentes[x.aulaId] = true; });
      var porTurma = {};
      chamadas.forEach(function (c) {
        if (!idsRecentes[c.AulaID]) return;
        var t = porTurma[c.ClasseID] = porTurma[c.ClasseID] || { total: 0, pres: 0 };
        t.total++; if (_presente(c)) t.pres++;
      });
      var turmas = classes.map(function (c) {
        var t = porTurma[c.ID] || { total: 0, pres: 0 };
        return { id: c.ID, nome: c.Nome, percentual: t.total ? Math.round((t.pres / t.total) * 100) : 0, alunos: alunos.filter(function (a) { return a.ClasseID === c.ID; }).length };
      });

      var rk = _calcularRanking(sess, {});
      return Util.ok({
        totais: { alunos: alunos.length, turmas: classes.length, professores: profs.length },
        ultimaAula: ultima ? { id: ultima.ID, numLicao: ultima.NumLicao, data: ultima.Data } : null,
        semChamada: semChamada,
        presenca: { media: media, recentes: recentes },
        turmas: turmas,
        ranking: { modo: rk.modo, top: rk.lista.slice(0, 3) }
      });
    });
  }

  // ══════════════════════════════════════════
  //  RESUMOS / AGREGAÇÕES
  // ══════════════════════════════════════════

  // Resumo por classe: total de alunos, presença média, última aula
  function getResumoClasses(token) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var classes = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      var alunos = _safeSheetObjects('Alunos').filter(function(r) { return _isAtivo(r.Ativo); });
      var aulas       = _safeSheetObjects('Aulas');
      var chamadas    = _safeSheetObjects('Chamadas');

      var alunosPorClasse = {};
      alunos.forEach(function(a) {
        if (!alunosPorClasse[a.ClasseID]) alunosPorClasse[a.ClasseID] = 0;
        alunosPorClasse[a.ClasseID]++;
      });

      var presentesPorClasse = {};
      var totalPorClasse     = {};
      chamadas.forEach(function(c) {
        var cid = c.ClasseID;
        if (!cid) return;
        if (!totalPorClasse[cid])     totalPorClasse[cid]     = 0;
        if (!presentesPorClasse[cid]) presentesPorClasse[cid] = 0;
        totalPorClasse[cid]++;
        if (c.Presente === true || c.Presente === 'TRUE') presentesPorClasse[cid]++;
      });

      var ultimaAulaPorClasse = {};
      chamadas.forEach(function(c) {
        var cid = c.ClasseID;
        if (!cid || !c.AulaID) return;
        var aula = null;
        for (var i = 0; i < aulas.length; i++) {
          if (aulas[i].ID === c.AulaID) { aula = aulas[i]; break; }
        }
        if (!aula) return;
        var d = _parseDateBR(aula.CriadoEm);
        if (!ultimaAulaPorClasse[cid] || d > ultimaAulaPorClasse[cid].data) {
          ultimaAulaPorClasse[cid] = { data: d, titulo: aula.Titulo, aulaId: aula.ID };
        }
      });

      var resumo = classes.map(function(cl) {
        var total     = totalPorClasse[cl.ID]     || 0;
        var presentes = presentesPorClasse[cl.ID] || 0;
        var ultima    = ultimaAulaPorClasse[cl.ID] || null;
        return {
          classeId:      cl.ID,
          nome:          cl.Nome,
          faixaEtaria:   cl.FaixaEtaria || '',
          totalAlunos:   alunosPorClasse[cl.ID] || 0,
          presencaMedia: total ? Math.round((presentes / total) * 100) : 0,
          ultimaAula:    ultima ? {
            titulo: ultima.titulo,
            aulaId: ultima.aulaId,
            data:   Utilities.formatDate(ultima.data, Session.getScriptTimeZone(), 'dd/MM/yyyy')
          } : null
        };
      });

      return Util.ok(resumo);
    });
  }

  // Resumo por aula: presença geral, ofertas totais, classes participantes
  function getResumoAulas(token) {
    return withAuth(token, function(sess) {
      var aulas    = _safeSheetObjects('Aulas');
      var chamadas = _safeSheetObjects('Chamadas');
      var classes  = _safeSheetObjects('Classes');

      var classeMap = {};
      classes.forEach(function(c) { classeMap[c.ID] = c.Nome; });

      var por = {};
      chamadas.forEach(function(c) {
        var aid = c.AulaID;
        if (!aid) return;
        if (!por[aid]) por[aid] = { presentes: 0, total: 0, ofertas: 0, classes: {} };
        por[aid].total++;
        por[aid].ofertas += Number(c.TotalOfertas) || 0;
        if (c.Presente === true || c.Presente === 'TRUE') por[aid].presentes++;
        if (c.ClasseID) por[aid].classes[c.ClasseID] = classeMap[c.ClasseID] || c.ClasseID;
      });

      aulas.sort(function(a, b) {
        return _parseDateBR(b.CriadoEm) - _parseDateBR(a.CriadoEm);
      });

      var resumo = aulas.map(function(a) {
        var ag = por[a.ID] || { presentes: 0, total: 0, ofertas: 0, classes: {} };
        return {
          aulaId:        a.ID,
          titulo:        a.Titulo,
          data:          a.Data      || '',
          trimestre:     a.Trimestre || '',
          numLicao:      a.NumLicao  || '',
          ano:           a.Ano       || '',
          totalAlunos:   ag.total,
          presentes:     ag.presentes,
          presencaMedia: ag.total ? Math.round((ag.presentes / ag.total) * 100) : 0,
          totalOfertas:  ag.ofertas,
          classesCom:    Object.keys(ag.classes).map(function(k) { return ag.classes[k]; })
        };
      });

      return Util.ok(resumo);
    });
  }

  // Carga inicial em uma única chamada — elimina cascatas no frontend
  function getDadosIniciais(token, tabs) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      tabs = tabs || [];
      var result = {};

      result.classes = _strip(_safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      }));

      if (tabs.indexOf('alunos') !== -1) {
        result.alunos = _strip(_safeSheetObjects('Alunos').filter(function(r) {
          if (!_isAtivo(r.Ativo)) return false;
          if (ok !== null && !ok[String(r.ClasseID)]) return false;
          return true;
        }));
      }
      if (tabs.indexOf('professores') !== -1) {
        result.professores = _strip(_safeSheetObjects('Professores').filter(function(r) { return _isAtivo(r.Ativo); }));
      }
      if (tabs.indexOf('aulas') !== -1) {
        var aulas = _safeSheetObjects('Aulas');
        aulas.sort(function(a,b) { return _parseDateBR(b.CriadoEm) - _parseDateBR(a.CriadoEm); });
        result.aulas = aulas;
      }
      if (tabs.indexOf('stats') !== -1) {
        var rs = getEstatisticasGerais(token);
        result.stats = rs.success ? rs.data : null;
      }
      if (tabs.indexOf('resumoClasses') !== -1) {
        var rc = getResumoClasses(token);
        result.resumoClasses = rc.success ? rc.data : [];
      }
      if (tabs.indexOf('resumoAulas') !== -1) {
        var ra = getResumoAulas(token);
        result.resumoAulas = ra.success ? ra.data : [];
      }
      if (tabs.indexOf('extras') !== -1) {
        var _EXCLUIR = ['questionário', 'questionario'];
        result.extras = _safeSheetObjects('PontosExtras').filter(function(r) {
          if (!_isAtivo(r.Ativo)) return false;
          var _n = String(r.Nome || '').trim().toLowerCase();
          return _EXCLUIR.indexOf(_n) === -1;
        });
      }

      if (tabs.indexOf('historicoTrimestre') !== -1) {
        var _mes = new Date().getMonth() + 1;
        var _trimNum   = _mes <= 3 ? '1' : _mes <= 6 ? '2' : _mes <= 9 ? '3' : '4';
        var _trimAtual = _trimNum + 'T'; // label de exibicao: '1T','2T','3T','4T'
        var _anoAtual  = String(new Date().getFullYear());

        var _aulasTrim = _safeSheetObjects('Aulas').filter(function(a){
          // Trimestre salvo como '1','2','3','4' — compara sem sufixo 'T'
          return String(a.Trimestre) === _trimNum && String(a.Ano) === _anoAtual;
        }).sort(function(a,b){ return (Number(a.NumLicao)||0) - (Number(b.NumLicao)||0); });

        var _aulaIdsTrim = {};
        _aulasTrim.forEach(function(a){ _aulaIdsTrim[a.ID] = Number(a.NumLicao) || 0; });

        var _alunoIds = {};
        _safeSheetObjects('Alunos').forEach(function(a){
          if (!_isAtivo(a.Ativo)) return;
          if (ok !== null && !ok[String(a.ClasseID)]) return;
          _alunoIds[String(a.ID)] = true;
        });

        var _chamTrim = _safeSheetObjects('Chamadas').filter(function(c){
          return _alunoIds[String(c.AlunoID)] && _aulaIdsTrim[c.AulaID] !== undefined;
        });

        var _hist = {};
        _chamTrim.forEach(function(c){
          var aid = String(c.AlunoID);
          if (!_hist[aid]) _hist[aid] = {};
          _hist[aid][_aulaIdsTrim[c.AulaID]] = c.Presente === true || c.Presente === 'TRUE';
        });

        result.historicoTrimestre     = _hist;
        result.totalLicoesTrimestre   = _aulasTrim.length;
        result.trimestreAtual         = _trimAtual;
      }

      return Util.ok(result);
    });
  }

  // ══════════════════════════════════════════
  //  HELPERS INTERNOS
  // ══════════════════════════════════════════

  function _recalcularPontosAluno(alunoId) {
    var chamadas = _safeSheetObjects('Chamadas').filter(function (c) {
      return c.AlunoID === alunoId;
    });
    var total = 0;
    chamadas.forEach(function (c) { total += Number(c.TotalPontos) || 0; });

    var aluno = Util.findById('Alunos', alunoId);
    if (aluno) {
      Util.updateRow('Alunos', aluno._rowIndex, {
        ID: aluno.ID, Nome: aluno.Nome, DataNasc: aluno.DataNasc,
        ClasseID: aluno.ClasseID, Telefone: aluno.Telefone,
        Endereco: aluno.Endereco, Email: aluno.Email,
        TotalPontos: total, Ativo: aluno.Ativo, CriadoEm: aluno.CriadoEm
      });
    }
  }

  function _getConfig() {
    var rows = _safeSheetObjects('Config');
    var map  = {};
    rows.forEach(function (r) { map[r.Chave] = r.Valor; });
    return map;
  }

  function _parseDateBR(str) {
    if (!str) return new Date(0);
    if (typeof str === 'string' && str.indexOf('/') !== -1) {
      var p = str.split(' ');
      var d = p[0].split('/');
      var t = p[1] ? p[1].split(':') : ['0','0','0'];
      return new Date(+d[2], +d[1]-1, +d[0], +t[0], +t[1], +(t[2]||0));
    }
    return new Date(str);
  }

  // ══════════════════════════════════════════
  //  EXPORTAÇÃO
  // ══════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  //  ANIVERSÁRIOS & ALERTAS WHATSAPP
  // ═══════════════════════════════════════════════════════════

  function _parseDataNasc(val) {
    if (!val) return null;
    try {
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      var s = String(val).trim();
      var d;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        d = new Date(s.substring(0, 10));
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        var p = s.split('/'); d = new Date(p[2] + '-' + p[1] + '-' + p[0]);
      } else { d = new Date(s); }
      return isNaN(d.getTime()) ? null : d;
    } catch(e) { return null; }
  }

  function _isBirthdayOn(dateVal, refDate) {
    var d = _parseDataNasc(dateVal);
    if (!d) return false;
    var ref = refDate || new Date();
    return d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth();
  }

  function _anivSemana(dateVal) {
    var d = _parseDataNasc(dateVal);
    if (!d) return null;
    var today = new Date();
    var dow = today.getDay();
    for (var i = 0; i < 7; i++) {
      var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
      if (d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth()) {
        var days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        return { diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2), diaIndex: i, isHoje: (i === dow) };
      }
    }
    return null;
  }

  function _nomeIgreja() {
    try { return String(Config.identidade().nome || 'Igreja'); } catch (e) { return 'Igreja'; }
  }
  function _htmlEsc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Chave unificada ALERTAS_CONFIG — compartilhada com módulo Membros.
  // Migração automática: se existir a chave antiga ED_ALERTAS_CONFIG, importa e apaga.
  function _getConfigAlertas() {
    try {
      var props = PropertiesService.getScriptProperties();
      var raw = props.getProperty('ALERTAS_CONFIG');
      if (!raw) {
        // Migração one-shot da chave antiga
        var old = props.getProperty('ED_ALERTAS_CONFIG');
        if (old) {
          props.setProperty('ALERTAS_CONFIG', old);
          props.deleteProperty('ED_ALERTAS_CONFIG');
          return JSON.parse(old);
        }
        return {};
      }
      return JSON.parse(raw);
    } catch(e) { return {}; }
  }

  function _setConfigAlertas(config) {
    try { PropertiesService.getScriptProperties().setProperty('ALERTAS_CONFIG', JSON.stringify(config)); } catch(e) {}
  }

  // (WhatsApp removido — alertas agora via GmailApp)

  function _enviarEmail(emailDest, assunto, corpo) {
    // corpo deve ser plaintext puro sem emojis fora do BMP (U+FFFF+)
    // htmlBody gerado aqui via escape seguro
    if (!emailDest || !/\S+@\S+\.\S+/.test(emailDest)) return { ok: false, erro: 'Email invalido: ' + emailDest };
    try {
      var htmlBody = '<meta charset="UTF-8">' +
        corpo
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
          .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
      GmailApp.sendEmail(emailDest, assunto, corpo, { htmlBody: htmlBody });
      return { ok: true };
    } catch(e) { return { ok: false, erro: e.message }; }
  }

  function _enviarEmailHtml(emailDest, assunto, corpoPlain, htmlBody) {
    // Use este quando quiser emojis: passe-os apenas no htmlBody como entidades &#x...
    // corpoPlain deve ser ASCII puro (fallback para clientes sem HTML)
    if (!emailDest || !/\S+@\S+\.\S+/.test(emailDest)) return { ok: false, erro: 'Email invalido: ' + emailDest };
    try {
      GmailApp.sendEmail(emailDest, assunto, corpoPlain, { htmlBody: htmlBody });
      return { ok: true };
    } catch(e) { return { ok: false, erro: e.message }; }
  }

  // ── Helper: normaliza campo nascimento do módulo Membros (dd/mm/aaaa → Date) ──
  function _parseMembrosNasc(val) {
    if (!val) return null;
    var s = String(val).trim();
    // dd/mm/aaaa
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
    // fallback ao parser padrão da ED
    return _parseDataNasc(val);
  }

  // ── Helper: monta bloco HTML + plain de aniversariantes por seção ──
  function _blocoAniv(titulo, lista, campoNome) {
    if (!lista.length) return { plain: '', html: '' };
    var cn = campoNome || 'Nome';
    var plain = '\n\n--- ' + titulo.toUpperCase() + ' ---\n' +
      lista.map(function(p){ return '* ' + p[cn] + ' *'; }).join('\n');
    var html = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">' +
      '<p style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">' + titulo + '</p><ul>' +
      lista.map(function(p){ return '<li><strong>' + p[cn] + '</strong> &#x1F973;</li>'; }).join('') +
      '</ul>';
    return { plain: plain, html: html };
  }

  function _alertaDiarioFn() {
    var cfg = _getConfigAlertas();
    if (!cfg.email_ativo) return { enviados: 0, motivo: 'email_inativo' };
    var today = new Date();

    // ── EBD: alunos e professores aniversariantes ──
    var alunos  = _safeSheetObjects('Alunos').filter(function(a){ return _isAtivo(a.Ativo) && _isBirthdayOn(a.DataNasc, today); });
    var profs   = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo) && _isBirthdayOn(p.DataNasc, today); });
    var classes = _safeSheetObjects('Classes');

    // ── Membros: aniversariantes (nascimento em dd/mm/aaaa, ativo=true) ──
    var membrosAniv = [];
    if (cfg.alerta_membros !== false) { // ativo por default
      try {
        membrosAniv = Util.sheetToObjects('Membros').filter(function(m) {
          return _isAtivo(m.ativo) && _isBirthdayOn(_parseMembrosNasc(m.nascimento), today);
        });
      } catch(e) { Logger.log('[AlertaDiario] Erro ao ler Membros: ' + e); }
    }

    if (!alunos.length && !profs.length && !membrosAniv.length) {
      return { enviados: 0, motivo: 'sem_aniversariantes' };
    }

    var assunto = _nomeIgreja() + ' - Aniversario(s) Hoje!';
    var enviados = 0;

    // ── Avisar professor da turma sobre alunos aniversariantes (ED) ──
    if (cfg.alerta_dia) {
      var todosProfs = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo) && p.Email; });
      todosProfs.forEach(function(prof) {
        var anivTurma = alunos.filter(function(a){ return a.ClasseID === prof.ClasseID; });
        if (!anivTurma.length) return;
        var cl = (classes.filter(function(c){ return c.ID === prof.ClasseID; })[0] || {}).Nome || 'sua turma';
        var plain = 'Escola Dominical - Aniversario Hoje!\n\n' +
          'Ola, ' + prof.Nome.split(' ')[0] + '! Hoje e aniversario de:\n\n' +
          anivTurma.map(function(a){ return '* ' + a.Nome + ' *'; }).join('\n') +
          '\n\nNao esqueca de parabenizar!';
        var html = '<meta charset="UTF-8">' +
          '<p><strong>&#x1F382; Escola Dominical &#x2013; Anivers&#xe1;rio Hoje!</strong></p>' +
          '<p>Ol&#xe1;, ' + prof.Nome.split(' ')[0] + '! Hoje &#xe9; anivers&#xe1;rio de:</p><ul>' +
          anivTurma.map(function(a){ return '<li><strong>' + a.Nome + '</strong> &#x1F973;</li>'; }).join('') +
          '</ul><p>N&#xe3;o esque&#xe7;a de parabenizar! &#x2764;&#xfe0f;</p>';
        var r = _enviarEmailHtml(prof.Email, assunto, plain, html);
        if (r.ok) enviados++;
      });
    }

    // ── Destinatários globais: email unificado EBD + Membros ──
    var dest = cfg.destinatarios || [];
    dest.forEach(function(r) {
      if (!r.email || !r.alertaDia) return;

      var todosEBD = alunos.concat(profs);
      var blocoED  = _blocoAniv('Escola Dominical', todosEBD, 'Nome');
      var blocoMb  = _blocoAniv('Membros', membrosAniv, 'nome');

      var plain2 = _nomeIgreja() + ' - Aniversario(s) Hoje!' +
        blocoED.plain + blocoMb.plain;
      var html2 = '<meta charset="UTF-8">' +
        '<p><strong>&#x1F382; ' + _htmlEsc(_nomeIgreja()) + ' &#x2013; Anivers&#xe1;rio(s) Hoje!</strong></p>' +
        blocoED.html + blocoMb.html;

      var res = _enviarEmailHtml(r.email, assunto, plain2, html2);
      if (res.ok) enviados++;
    });

    return { enviados: enviados };
  }

  // ── Helper: monta lista semanal de aniversariantes com diaLabel ──
  function _listaAnivSemana(pessoas, campoNasc, campoNome, today, dow, days) {
    var lista = [];
    for (var i = 0; i < 7; i++) {
      var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
      pessoas.forEach(function(p) {
        var nasc = campoNasc === 'nascimento' ? _parseMembrosNasc(p[campoNasc]) : p[campoNasc];
        if (_isBirthdayOn(nasc, ref))
          lista.push({ nome: p[campoNome], diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2) });
      });
    }
    return lista;
  }

  function _alertaSegundaFeiraFn() {
    var cfg = _getConfigAlertas();
    if (!cfg.email_ativo || !cfg.alerta_semana) return;
    var today = new Date();
    var dow = today.getDay();
    var classes    = _safeSheetObjects('Classes');
    var alunos     = _safeSheetObjects('Alunos').filter(function(a){ return _isAtivo(a.Ativo); });
    var todosProfs = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo); });
    var days = ['Dom','Seg','Ter','Qua','Qui','Sex','S\xe1b'];
    var assunto = _nomeIgreja() + ' - Aniversariantes da Semana';

    // ── Membros ativos ──
    var todosMembros = [];
    if (cfg.alerta_membros !== false) {
      try { todosMembros = Util.sheetToObjects('Membros').filter(function(m){ return _isAtivo(m.ativo); }); }
      catch(e) { Logger.log('[AlertaSemana] Erro ao ler Membros: ' + e); }
    }

    // ── Por professor: envia lista da turma (apenas EBD, sem alteração) ──
    todosProfs.forEach(function(prof) {
      if (!prof.Email) return;
      var anivTurma = [];
      for (var i = 0; i < 7; i++) {
        var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
        alunos.filter(function(a){ return a.ClasseID === prof.ClasseID; }).forEach(function(a){
          if (_isBirthdayOn(a.DataNasc, ref))
            anivTurma.push({ nome: a.Nome, diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2) });
        });
      }
      if (!anivTurma.length) return;
      var cl = (classes.filter(function(c){ return c.ID === prof.ClasseID; })[0] || {}).Nome || 'sua turma';

      var semNascTurma = cfg.alerta_sem_nasc
        ? alunos.filter(function(a){ return a.ClasseID === prof.ClasseID && !a.DataNasc; })
        : [];
      var plainSemNasc = semNascTurma.length
        ? '\n\n--- ATENCAO: ' + semNascTurma.length + ' aluno(s) sem data de nascimento cadastrada ---\n' +
          semNascTurma.map(function(a){ return '* ' + a.Nome; }).join('\n') +
          '\nCadastre as datas para receber os alertas de aniversario.'
        : '';
      var htmlSemNasc = semNascTurma.length
        ? '<hr><p style="color:#B45309"><strong>&#x26A0;&#xfe0f; ' + semNascTurma.length +
          ' aluno(s) sem data de nascimento cadastrada em ' + cl + ':</strong></p><ul>' +
          semNascTurma.map(function(a){ return '<li>' + a.Nome + '</li>'; }).join('') +
          '</ul><p style="font-size:12px;color:#666">Cadastre as datas no m&#xf3;dulo Escola Dominical para que os alertas de anivers&#xe1;rio funcionem corretamente.</p>'
        : '';

      var plain1 = 'Escola Dominical - Aniversariantes da Semana\n\n' +
        'Ola, ' + prof.Nome.split(' ')[0] + '! Esta semana temos aniversariantes em ' + cl + ':\n\n' +
        anivTurma.map(function(a){ return a.nome + ' - ' + a.diaLabel; }).join('\n') +
        '\n\nNao esqueca de desejar parabens!' + plainSemNasc;
      var html1 = '<meta charset="UTF-8">' +
        '<p><strong>&#x1F382; Escola Dominical &#x2013; Aniversariantes da Semana</strong></p>' +
        '<p>Ol&#xe1;, ' + prof.Nome.split(' ')[0] + '! Esta semana temos aniversariantes em <strong>' + cl + '</strong>:</p><ul>' +
        anivTurma.map(function(a){ return '<li><strong>' + a.nome + '</strong> &#x2013; ' + a.diaLabel + ' &#x1F973;</li>'; }).join('') +
        '</ul><p>N&#xe3;o esque&#xe7;a de desejar parab&#xe9;ns!</p>' + htmlSemNasc;
      _enviarEmailHtml(prof.Email, assunto, plain1, html1);
    });

    // ── Destinatários globais: email unificado EBD + Membros ──
    var dest = cfg.destinatarios || [];

    // Listas EBD da semana
    var todosEBD = _listaAnivSemana(alunos.concat(todosProfs), 'DataNasc', 'Nome', today, dow, days);

    // Alunos EBD sem DataNasc
    var semNascGlobal = cfg.alerta_sem_nasc
      ? alunos.filter(function(a){ return !a.DataNasc; })
      : [];
    var plainSemNascGlobal = semNascGlobal.length
      ? '\n\n--- ATENCAO: ' + semNascGlobal.length + ' aluno(s) EBD sem data de nascimento ---\n' +
        semNascGlobal.map(function(a){
          var cl = (classes.filter(function(c){ return c.ID === a.ClasseID; })[0] || {}).Nome || 'Sem turma';
          return '* ' + a.Nome + ' (' + cl + ')';
        }).join('\n') + '\nCadastre as datas para receber os alertas de aniversario.'
      : '';
    var htmlSemNascGlobal = semNascGlobal.length
      ? '<hr><p style="color:#B45309"><strong>&#x26A0;&#xfe0f; ' + semNascGlobal.length +
        ' aluno(s) EBD sem data de nascimento cadastrada:</strong></p><ul>' +
        semNascGlobal.map(function(a){
          var cl = (classes.filter(function(c){ return c.ID === a.ClasseID; })[0] || {}).Nome || 'Sem turma';
          return '<li><strong>' + a.Nome + '</strong> &#x2013; ' + cl + '</li>';
        }).join('') +
        '</ul><p style="font-size:12px;color:#666">Cadastre as datas no m&#xf3;dulo Escola Dominical.</p>'
      : '';

    // Membros sem nascimento
    var semNascMembros = cfg.alerta_sem_nasc
      ? todosMembros.filter(function(m){ return !m.nascimento; })
      : [];
    var plainSemNascMembros = semNascMembros.length
      ? '\n\n--- ATENCAO: ' + semNascMembros.length + ' membro(s) sem data de nascimento ---\n' +
        semNascMembros.map(function(m){ return '* ' + m.nome; }).join('\n') +
        '\nCadastre as datas no modulo Membros.'
      : '';
    var htmlSemNascMembros = semNascMembros.length
      ? '<hr><p style="color:#B45309"><strong>&#x26A0;&#xfe0f; ' + semNascMembros.length +
        ' membro(s) sem data de nascimento cadastrada:</strong></p><ul>' +
        semNascMembros.map(function(m){ return '<li><strong>' + m.nome + '</strong></li>'; }).join('') +
        '</ul><p style="font-size:12px;color:#666">Cadastre as datas no m&#xf3;dulo Membros.</p>'
      : '';

    // Membros da semana
    var todosMembrosAniv = _listaAnivSemana(todosMembros, 'nascimento', 'nome', today, dow, days);

    // Monta blocos de seção para o email unificado
    var sepStyle = 'border:none;border-top:1px solid #e5e7eb;margin:16px 0';
    var secTitleStyle = 'font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px';

    dest.forEach(function(r) {
      if (!r.email || !r.alertaSemana) return;

      // plain text
      var plain2 = _nomeIgreja() + ' - Aniversariantes da Semana';
      if (todosEBD.length)
        plain2 += '\n\n--- ESCOLA DOMINICAL ---\n' + todosEBD.map(function(p){ return p.nome + ' - ' + p.diaLabel; }).join('\n');
      else
        plain2 += '\n\n--- ESCOLA DOMINICAL ---\nNenhum aniversariante esta semana.';
      if (todosMembrosAniv.length)
        plain2 += '\n\n--- MEMBROS ---\n' + todosMembrosAniv.map(function(p){ return p.nome + ' - ' + p.diaLabel; }).join('\n');
      else
        plain2 += '\n\n--- MEMBROS ---\nNenhum aniversariante esta semana.';
      plain2 += plainSemNascGlobal + plainSemNascMembros;

      // html
      var html2 = '<meta charset="UTF-8">' +
        '<p><strong>&#x1F382; ' + _htmlEsc(_nomeIgreja()) + ' &#x2013; Aniversariantes da Semana</strong></p>' +
        '<hr style="' + sepStyle + '">' +
        '<p style="' + secTitleStyle + '">Escola Dominical</p>' +
        (todosEBD.length
          ? '<ul>' + todosEBD.map(function(p){ return '<li><strong>' + p.nome + '</strong> &#x2013; ' + p.diaLabel + ' &#x1F973;</li>'; }).join('') + '</ul>'
          : '<p style="color:#6b7280;font-size:13px">Nenhum aniversariante esta semana. &#x1F60A;</p>') +
        '<hr style="' + sepStyle + '">' +
        '<p style="' + secTitleStyle + '">Membros</p>' +
        (todosMembrosAniv.length
          ? '<ul>' + todosMembrosAniv.map(function(p){ return '<li><strong>' + p.nome + '</strong> &#x2013; ' + p.diaLabel + ' &#x1F973;</li>'; }).join('') + '</ul>'
          : '<p style="color:#6b7280;font-size:13px">Nenhum aniversariante esta semana. &#x1F60A;</p>') +
        htmlSemNascGlobal + htmlSemNascMembros;

      _enviarEmailHtml(r.email, assunto, plain2, html2);
    });
  }

  function getConfigAlertas(token) {
    return withAuth(token, function(sess) { return Util.ok(_getConfigAlertas()); });
  }

  function salvarConfigAlertas(token, config) {
    return withAuth(token, function(sess) { _setConfigAlertas(config); return Util.ok(true); });
  }

  function dispararAlertaManual(token, tipo) {
    return withAuth(token, function(sess) {
      var cfg = _getConfigAlertas();
      if (!cfg.email_ativo) return Util.err('Email não ativo. Configure e ative primeiro.');

      if (tipo === 'teste') {
        // Envia email de confirmação para todos os destinatários globais com email válido,
        // independente de haver aniversariantes. Serve apenas para validar a configuração.
        var dest = (cfg.destinatarios || []).filter(function(d){ return d.email && /\S+@\S+\.\S+/.test(d.email); });
        if (!dest.length) return Util.err('Nenhum destinatário global com email válido encontrado. Adicione e salve antes de testar.');
        var assunto = '[Teste] Alertas Escola Dominical (' + _nomeIgreja() + ')';
        var enviados = 0;
        dest.forEach(function(d) {
          // plaintext: sem emojis fora do BMP para evitar encoding corrompido
          var corpo = 'Teste de Email - Escola Dominical\n\n' +
            'Ola, ' + (d.nome || 'destinatario') + '!\n\n' +
            'Este e um email de teste do sistema de alertas de aniversarios.\n' +
            'Se voce recebeu esta mensagem, a configuracao esta funcionando corretamente.\n\n' +
            '-- Sistema ' + _nomeIgreja();
          // htmlBody: emojis como entidades hexadecimais (sem risco de encoding)
          var html = '<meta charset="UTF-8">' +
            '<p><strong>&#x2705; Teste de Email &#x2013; Escola Dominical</strong></p>' +
            '<p>Ol&#xe1;, ' + (d.nome || 'destinat&#xe1;rio') + '!</p>' +
            '<p>Este &#xe9; um email de teste do sistema de alertas de anivers&#xe1;rios.<br>' +
            'Se voc&#xea; recebeu esta mensagem, a configura&#xe7;&#xe3;o est&#xe1; funcionando corretamente. &#x2705;</p>' +
            '<p>&#x2014; Sistema ' + _htmlEsc(_nomeIgreja()) + '</p>';
          var r = _enviarEmailHtml(d.email, assunto, corpo, html);
          if (r.ok) enviados++;
        });
        if (!enviados) return Util.err('Falha ao enviar para os destinatários. Verifique se o script tem a permissão gmail.send autorizada.');
        return Util.ok({ enviados: enviados });
      }

      if (tipo === 'dia') {
        var res = _alertaDiarioFn();
        if (res && res.motivo === 'sem_aniversariantes')
          return Util.ok({ enviados: 0, aviso: 'Nenhum aniversariante hoje — nenhum email enviado.' });
        return Util.ok(res || true);
      } else if (tipo === 'semana') {
        _alertaSegundaFeiraFn();
        return Util.ok(true);
      }
      return Util.ok(true);
    });
  }

  function alertaDiario()      { _alertaDiarioFn(); }
  function alertaSegundaFeira(){ _alertaSegundaFeiraFn(); }


  // ══════════════════════════════════════════
  //  DADOS DE DEMONSTRAÇÃO (somente admin)
  //  popularDemo: 5 turmas, 4–15 alunos cada, professores, 12 domingos já lançados
  //  + a aula de hoje aberta para chamada. limparBase: zera as abas da EBD.
  // ══════════════════════════════════════════

  var DEMO_ABAS = ['Chamadas', 'ChamadasInfo', 'Aulas', 'Professores', 'Alunos', 'Classes'];

  var DEMO_NOMES = ['Ana', 'Beatriz', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Joana', 'Karina', 'Larissa', 'Marina', 'Natália', 'Olívia', 'Priscila', 'Rebeca', 'Sara', 'Tatiane', 'Valéria',
    'André', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Felipe', 'Gabriel', 'Henrique', 'Igor', 'João', 'Lucas', 'Mateus', 'Nicolas', 'Otávio', 'Paulo', 'Rafael', 'Samuel', 'Tiago', 'Vitor', 'Davi'];
  var DEMO_SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Barros', 'Dias', 'Teixeira', 'Moreira', 'Cardoso'];
  var DEMO_TURMAS = [
    { nome: 'Maternal',     faixa: '0 a 3 anos',   idade: [1, 3],   licao: 'Lições Bíblicas Maternal',     profs: 2 },
    { nome: 'Juniores',     faixa: '7 a 11 anos',  idade: [7, 11],  licao: 'Lições Bíblicas Juniores',     profs: 1 },
    { nome: 'Adolescentes', faixa: '12 a 17 anos', idade: [12, 17], licao: 'Lições Bíblicas Adolescentes', profs: 2 },
    { nome: 'Jovens',       faixa: '18 a 29 anos', idade: [18, 29], licao: 'Lições Bíblicas Jovens',       profs: 1 },
    { nome: 'Adultos',      faixa: 'Acima de 30',  idade: [30, 70], licao: 'Lições Bíblicas Adultos',      profs: 2 }
  ];
  var DEMO_LICOES = ['A Criação e a Queda', 'O Chamado de Abraão', 'A Fé de Isaque', 'Jacó e a Bênção', 'José no Egito', 'O Livramento do Êxodo', 'A Lei no Sinai', 'A Travessia do Jordão', 'Gideão e a Obediência', 'Rute, Fidelidade e Graça', 'Davi e Golias', 'A Sabedoria de Salomão', 'Elias no Carmelo', 'O Retorno do Exílio'];

  function _demoRnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function _demoPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _demoData(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }

  // Anexa linhas de uma vez só (rápido), respeitando a ordem de colunas real da aba
  function _demoInserir(nome, objetos) {
    if (!objetos.length) return;
    var sheet = Util.getSheet(nome);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var linhas = objetos.map(function (o) { return headers.map(function (h) { return o[h] !== undefined ? o[h] : ''; }); });
    sheet.getRange(sheet.getLastRow() + 1, 1, linhas.length, headers.length).setValues(linhas);
    Util.invalidarCache(nome);
  }

  function popularDemo(token) {
    return withAuth(token, function (sess) {
      if (sess.perfil !== 'admin') return Util.err('Somente o administrador pode popular dados de teste.');
      if (_safeSheetObjects('Classes').length || _safeSheetObjects('Alunos').length) {
        return Util.err('A base da Escola Dominical já tem dados. Limpe a base antes de popular.');
      }
      var cfg = _getConfig();
      var ptP = Number(cfg.PONTOS_PRESENCA) || 1, ptB = Number(cfg.PONTOS_BIBLIA) || 2, ptR = Number(cfg.PONTOS_REVISTA) || 2;
      var extrasCad = _safeSheetObjects('PontosExtras').filter(function (r) { return _isAtivo(r.Ativo); });
      var hoje = new Date(); hoje.setHours(12, 0, 0, 0);
      var ano = String(hoje.getFullYear());
      var agora = Util.now();

      // Aulas: 12 domingos anteriores (lançados) + hoje (aberta para chamada)
      var domingo = new Date(hoje); domingo.setDate(domingo.getDate() - domingo.getDay());
      if (_demoData(domingo) === _demoData(hoje)) domingo.setDate(domingo.getDate() - 7);
      var datas = [];
      for (var k = 11; k >= 0; k--) { var d = new Date(domingo); d.setDate(d.getDate() - 7 * k); datas.push(d); }
      var contaTri = {};
      var aulas = datas.concat([hoje]).map(function (d, i) {
        var tri = String(Math.floor(d.getMonth() / 3) + 1);
        var chaveTri = d.getFullYear() + '-' + tri;
        contaTri[chaveTri] = (contaTri[chaveTri] || 0) + 1;
        var num = contaTri[chaveTri];
        return { ID: Util.uuid(), Data: _demoData(d), Trimestre: tri, NumLicao: num, Titulo: DEMO_LICOES[(num - 1) % DEMO_LICOES.length], Ano: String(d.getFullYear()), CriadoPor: sess.email, CriadoEm: agora, _lancada: i < datas.length };
      });

      var classes = [], alunos = [], professores = [], chamadas = [], infos = [], usados = {};
      DEMO_TURMAS.forEach(function (t) {
        var classeId = Util.uuid();
        classes.push({ ID: classeId, Nome: t.nome, FaixaEtaria: t.faixa, LicaoCPAD: t.licao, Ativo: true, CriadoEm: agora });
        var nomeUnico = function () {
          for (var n = 0; n < 50; n++) { var nm = _demoPick(DEMO_NOMES) + ' ' + _demoPick(DEMO_SOBRENOMES); if (!usados[nm]) { usados[nm] = true; return nm; } }
          return _demoPick(DEMO_NOMES) + ' ' + _demoPick(DEMO_SOBRENOMES) + ' ' + _demoRnd(2, 9);
        };
        var nasc = function (faixa) { var a = _demoRnd(faixa[0], faixa[1]); return _demoData(new Date(hoje.getFullYear() - a, _demoRnd(0, 11), _demoRnd(1, 28))); };
        var mesAlunos = [];
        for (var i = 0, qtd = _demoRnd(4, 15); i < qtd; i++) {
          var al = { ID: Util.uuid(), Nome: nomeUnico(), DataNasc: nasc(t.idade), ClasseID: classeId, Telefone: '(31) 9' + _demoRnd(8000, 9999) + '-' + _demoRnd(1000, 9999), Endereco: '', Email: '', TotalPontos: 0, Ativo: true, CriadoEm: agora, _freq: 0.55 + Math.random() * 0.4 };
          mesAlunos.push(al); alunos.push(al);
        }
        for (var p = 0; p < t.profs; p++) {
          professores.push({ ID: Util.uuid(), AlunoOrigemID: '', UsuarioID: '', Nome: nomeUnico(), ClasseID: classeId, Telefone: '(31) 9' + _demoRnd(8000, 9999) + '-' + _demoRnd(1000, 9999), DataNasc: nasc([28, 60]), Endereco: '', Email: '', Cursos: p === 0 ? 'Teologia básica' : '', Ativo: true, CriadoEm: agora });
        }
        aulas.forEach(function (a) {
          if (!a._lancada) return;
          var visitantes = 0, oferta = 0;
          mesAlunos.forEach(function (al) {
            var presente = Math.random() < al._freq;
            var biblia = presente && Math.random() < 0.7, revista = presente && Math.random() < 0.6;
            var extras = [];
            if (presente && extrasCad.length && Math.random() < 0.15) { var ex = _demoPick(extrasCad); extras.push({ nome: ex.Nome, pontos: Number(ex.Pontos) || 0 }); }
            var total = (presente ? ptP : 0) + (biblia ? ptB : 0) + (revista ? ptR : 0) + extras.reduce(function (s, e) { return s + e.pontos; }, 0);
            var ofe = presente && Math.random() < 0.5 ? _demoRnd(1, 10) : 0;
            oferta += ofe; al.TotalPontos += total;
            chamadas.push({ ID: Util.uuid(), AulaID: a.ID, ClasseID: classeId, AlunoID: al.ID, Presente: presente, Biblia: biblia, Revista: revista, PontosExtrasJSON: JSON.stringify(extras), TotalPontos: total, TotalOfertas: ofe, LancadoPor: sess.email, CriadoEm: agora });
          });
          visitantes = _demoRnd(0, 3);
          infos.push({ ID: Util.uuid(), AulaID: a.ID, ClasseID: classeId, NumVisitantes: visitantes, TotalOferta: oferta, Observacoes: '', LancadoPor: sess.email, CriadoEm: agora });
        });
      });

      _demoInserir('Classes', classes);
      _demoInserir('Alunos', alunos);
      _demoInserir('Professores', professores);
      _demoInserir('Aulas', aulas);
      _demoInserir('Chamadas', chamadas);
      _demoInserir('ChamadasInfo', infos);
      return Util.ok({ mensagem: 'Dados de teste criados: ' + classes.length + ' turmas, ' + alunos.length + ' alunos, ' + professores.length + ' professores, ' + aulas.length + ' aulas (a de hoje aberta para chamada).', turmas: classes.length, alunos: alunos.length, professores: professores.length, aulas: aulas.length, chamadas: chamadas.length });
    });
  }

  // Zera as abas da EBD (mantém cabeçalho e a lista de Pontos Extras)
  function limparBase(token) {
    return withAuth(token, function (sess) {
      if (sess.perfil !== 'admin') return Util.err('Somente o administrador pode limpar a base da Escola Dominical.');
      DEMO_ABAS.forEach(function (nome) {
        var sheet = Util.getSheet(nome);
        var n = sheet.getLastRow() - 1;
        if (n > 0) sheet.deleteRows(2, n);
        Util.invalidarCache(nome);
      });
      return Util.ok({ mensagem: 'Base da Escola Dominical zerada.' });
    });
  }

  return {
    listarClasses:          listarClasses,
    listarClassesTodas:     listarClassesTodas,
    criarClasse:            criarClasse,
    editarClasse:           editarClasse,
    excluirClasse:          excluirClasse,

    listarAlunos:           listarAlunos,
    criarAluno:             criarAluno,
    editarAluno:            editarAluno,
    excluirAluno:           excluirAluno,

    listarProfessores:      listarProfessores,
    criarProfessor:         criarProfessor,
    editarProfessor:        editarProfessor,
    excluirProfessor:       excluirProfessor,

    listarAulas:            listarAulas,
    criarAula:              criarAula,
    editarAula:             editarAula,
    excluirAula:            excluirAula,

    getChamada:             getChamada,
    salvarChamada:          salvarChamada,
    listarChamadasPorAula:  listarChamadasPorAula,
    getHistoricoChamadas:   getHistoricoChamadas,
    atividadeRecente:       atividadeRecente,
    chamadasPendentesHoje:  chamadasPendentesHoje,
    getFrequenciaTrimestre: getFrequenciaTrimestre,
    exportarDadosEbd:       exportarDadosEbd,
    importarPessoasEbd:     importarPessoasEbd,
    pessoasParaMembros:     pessoasParaMembros,
    getRankingAlunos:       getRankingAlunos,
    getRanking:             getRanking,
    getVisaoGeral:          getVisaoGeral,
    getRelatorioAula:       getRelatorioAula,
    getConfigEbd:           getConfigEbd,
    salvarConfigEbd:        salvarConfigEbd,
    getEstatisticasGerais:  getEstatisticasGerais,
    getPontosExtras:        getPontosExtras,
    getResumoClasses:       getResumoClasses,
    getResumoAulas:         getResumoAulas,
    getDadosIniciais:       getDadosIniciais,
    ed_diagnostico:         ed_diagnostico,
    popularDemo:            popularDemo,
    limparBase:             limparBase,

    getConfigAlertas:       getConfigAlertas,
    salvarConfigAlertas:    salvarConfigAlertas,
    dispararAlertaManual:   dispararAlertaManual,
    alertaDiario:           alertaDiario,
    alertaSegundaFeira:     alertaSegundaFeira,
    HEADERS:                HEADERS
  };

})();


// ── FUNÇÕES PÚBLICAS ────────────────────────────────────────
// Wrapper seguro: garante que NUNCA retorna null/undefined
function _safe_ed(fn, args) {
  try {
    var r = fn.apply(null, args);
    if (r === null || r === undefined) return { success: false, error: 'Resposta vazia do servidor.' };
    
    // Força a conversão de Dates e Objetos complexos para texto puro
    return JSON.parse(JSON.stringify(r)); 
    
  } catch(e) {
    return { success: false, error: e.message || 'Erro interno.' };
  }
}

function ed_diagnostico(token)                         { return _safe_ed(function(){ return EscolaDominical.ed_diagnostico(token); }, []); }
function ed_popularDemo(token)                         { return _safe_ed(function(){ return EscolaDominical.popularDemo(token); }, []); }
function ed_limparBase(token)                          { return _safe_ed(function(){ return EscolaDominical.limparBase(token); }, []); }
function ed_listarClasses(token)                       { return _safe_ed(function(){ return EscolaDominical.listarClasses(token); }, []); }
function ed_listarClassesTodas(token)                  { return _safe_ed(function(){ return EscolaDominical.listarClassesTodas(token); }, []); }
function ed_criarClasse(token, dados)                  { return _safe_ed(function(){ return EscolaDominical.criarClasse(token, dados); }, []); }
function ed_editarClasse(token, id, dados)             { return _safe_ed(function(){ return EscolaDominical.editarClasse(token, id, dados); }, []); }
function ed_excluirClasse(token, id)                   { return _safe_ed(function(){ return EscolaDominical.excluirClasse(token, id); }, []); }
function ed_listarAlunos(token, classeId)              { return _safe_ed(function(){ return EscolaDominical.listarAlunos(token, classeId); }, []); }
function ed_criarAluno(token, dados)                   { return _safe_ed(function(){ return EscolaDominical.criarAluno(token, dados); }, []); }
function ed_editarAluno(token, id, dados)              { return _safe_ed(function(){ return EscolaDominical.editarAluno(token, id, dados); }, []); }
function ed_excluirAluno(token, id)                    { return _safe_ed(function(){ return EscolaDominical.excluirAluno(token, id); }, []); }
function ed_listarProfessores(token)                   { return _safe_ed(function(){ return EscolaDominical.listarProfessores(token); }, []); }
function ed_criarProfessor(token, dados)               { return _safe_ed(function(){ return EscolaDominical.criarProfessor(token, dados); }, []); }
function ed_editarProfessor(token, id, dados)          { return _safe_ed(function(){ return EscolaDominical.editarProfessor(token, id, dados); }, []); }
function ed_excluirProfessor(token, id)                { return _safe_ed(function(){ return EscolaDominical.excluirProfessor(token, id); }, []); }
function ed_listarAulas(token, filtros)                { return _safe_ed(function(){ return EscolaDominical.listarAulas(token, filtros); }, []); }
function ed_criarAula(token, dados)                    { return _safe_ed(function(){ return EscolaDominical.criarAula(token, dados); }, []); }
function ed_editarAula(token, id, dados)               { return _safe_ed(function(){ return EscolaDominical.editarAula(token, id, dados); }, []); }
function ed_excluirAula(token, id)                     { return _safe_ed(function(){ return EscolaDominical.excluirAula(token, id); }, []); }
function ed_getChamada(token, aulaId, classeId)        { return _safe_ed(function(){ return EscolaDominical.getChamada(token, aulaId, classeId); }, []); }
function ed_salvarChamada(token, aulaId, classeId, r, ti) { return _safe_ed(function(){ return EscolaDominical.salvarChamada(token, aulaId, classeId, r, ti); }, []); }
function ed_exportarDadosEbd(token)                    { return _safe_ed(function(){ return EscolaDominical.exportarDadosEbd(token); }, []); }
function ed_importarPessoasEbd(token, linhas, mapa)    { return _safe_ed(function(){ return EscolaDominical.importarPessoasEbd(token, linhas, mapa); }, []); }
function ed_pessoasParaMembros(token)                  { return _safe_ed(function(){ return EscolaDominical.pessoasParaMembros(token); }, []); }
function ed_getFrequenciaTrimestre(token)             { return _safe_ed(function(){ return EscolaDominical.getFrequenciaTrimestre(token); }, []); }
function ed_getHistoricoChamadas(token, filtros)       { return _safe_ed(function(){ return EscolaDominical.getHistoricoChamadas(token, filtros); }, []); }
function ed_listarChamadasPorAula(token, aulaId)       { return _safe_ed(function(){ return EscolaDominical.listarChamadasPorAula(token, aulaId); }, []); }
function ed_getRankingAlunos(token, classeId)          { return _safe_ed(function(){ return EscolaDominical.getRankingAlunos(token, classeId); }, []); }
function ed_getRanking(token, filtros)                  { return _safe_ed(function(){ return EscolaDominical.getRanking(token, filtros); }, []); }
function ed_getVisaoGeral(token)                        { return _safe_ed(function(){ return EscolaDominical.getVisaoGeral(token); }, []); }
function ed_getRelatorioAula(token, aulaId)           { return _safe_ed(function(){ return EscolaDominical.getRelatorioAula(token, aulaId); }, []); }
function ed_getConfigEbd(token)                         { return _safe_ed(function(){ return EscolaDominical.getConfigEbd(token); }, []); }
function ed_salvarConfigEbd(token, dados)               { return _safe_ed(function(){ return EscolaDominical.salvarConfigEbd(token, dados); }, []); }
function ed_getEstatisticasGerais(token)               { return _safe_ed(function(){ return EscolaDominical.getEstatisticasGerais(token); }, []); }
function ed_getPontosExtras(token)                     { return _safe_ed(function(){ return EscolaDominical.getPontosExtras(token); }, []); }
function ed_getResumoClasses(token)                    { return _safe_ed(function(){ return EscolaDominical.getResumoClasses(token); }, []); }
function ed_getResumoAulas(token)                      { return _safe_ed(function(){ return EscolaDominical.getResumoAulas(token); }, []); }
function ed_getDadosIniciais(token, tabs)               { return _safe_ed(function(){ return EscolaDominical.getDadosIniciais(token, tabs); }, []); }
// ─── ALERTAS / ANIVERSÁRIOS — wrappers públicos ────────────
function ed_getConfigAlertas(token)                 { return _safe_ed(function(){ return EscolaDominical.getConfigAlertas(token); }, {}); }
function ed_salvarConfigAlertas(token, config)      { return _safe_ed(function(){ return EscolaDominical.salvarConfigAlertas(token, config); }, {}); }
function ed_dispararAlertaManual(token, tipo)       { return _safe_ed(function(){ return EscolaDominical.dispararAlertaManual(token, tipo); }, {}); }

// Handlers dos triggers GAS (não recebem parâmetros)
function ed_alertaDiario()      { EscolaDominical.alertaDiario(); }
function ed_alertaSegundaFeira(){ EscolaDominical.alertaSegundaFeira(); }

// Configurar triggers GAS — chamado manualmente pelo admin via frontend
function ed_setupAlertaTriggers(token) {
  return withAuth(token, function(sess) {
    if (sess.perfil === 'professor') return { success: false, error: 'Sem permissão.' };
    // Remove triggers existentes de alertas ED
    ScriptApp.getProjectTriggers().forEach(function(t) {
      var fn = t.getHandlerFunction();
      if (fn === 'ed_alertaDiario' || fn === 'ed_alertaSegundaFeira') ScriptApp.deleteTrigger(t);
    });
    // Trigger semanal: toda segunda-feira às 07h00
    ScriptApp.newTrigger('ed_alertaSegundaFeira')
      .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
    // Trigger diário: todo dia às 08h00
    ScriptApp.newTrigger('ed_alertaDiario')
      .timeBased().everyDays(1).atHour(8).create();
    return { success: true, data: { triggers: 2 } };
  });
}

// ── MANIFESTO DO MÓDULO ──
// Registrado na etapa 2 (tela Chamada). Telas seguintes entram em _escola-dominical.html.
var __MANIFESTOS__ = (typeof __MANIFESTOS__ === 'undefined') ? [] : __MANIFESTOS__;
var EscolaDominicalManifesto = {
  id: 'escola-dominical',
  nome: 'Escola Dominical',
  descricao: 'Turmas, alunos, chamada e ranking',
  icone: 'book-open',
  rota: 'escola-dominical',
  render: 'renderEscolaDominical',
  html: ['_escola-dominical'],
  perfis: ['admin', 'secretaria', 'professor'],
  ordem: 20,
  permissoes: {
    iconBg: 'rgba(255,184,77,.15)', iconColor: 'var(--gold,#ffb84d)',
    acoes: [
      { id: 'ed_ver',       label: 'Ver turmas, alunos e aulas',  admin: true, secretaria: true,  professor: true  },
      { id: 'ed_chamada',   label: 'Lançar chamada',              admin: true, secretaria: true,  professor: true  },
      { id: 'ed_cadastros', label: 'Gerir turmas, alunos e professores', admin: true, secretaria: true, professor: false },
      { id: 'ed_aulas',     label: 'Criar e editar aulas',        admin: true, secretaria: true,  professor: false },
      { id: 'ed_excluir',   label: 'Excluir registros',           admin: true, secretaria: false, professor: false }
    ]
  },
  abas: [
    { nome: 'Classes',      colunas: EscolaDominical.HEADERS.Classes,      cor: '#1a3a2a' },
    { nome: 'Alunos',       colunas: EscolaDominical.HEADERS.Alunos,       cor: '#1a2a3a' },
    { nome: 'Professores',  colunas: EscolaDominical.HEADERS.Professores,  cor: '#2a1a3a' },
    { nome: 'Aulas',        colunas: EscolaDominical.HEADERS.Aulas,        cor: '#2a2a1a' },
    { nome: 'Chamadas',     colunas: EscolaDominical.HEADERS.Chamadas,     cor: '#2a1a1a' },
    { nome: 'ChamadasInfo', colunas: EscolaDominical.HEADERS.ChamadasInfo, cor: '#1a2a3a' },
    { nome: 'PontosExtras', colunas: EscolaDominical.HEADERS.PontosExtras, cor: '#1a2a2a' }
  ],
  kpiLayout: 'lista',
  // Oferece alunos e professores ao cadastro de membros (o Membros só lê este gancho; não conhece a EBD).
  fonteMembros: { rotulo: 'Importar da EBD', titulo: 'Importar da EBD', icone: 'graduation-cap', fn: 'ed_pessoasParaMembros' },
  // Movimento recente da EBD para a Início: chamadas lançadas, aulas criadas e alunos novos.
  atividade: function (perfil) {
    if (perfil === 'professor') return [];
    return EscolaDominical.atividadeRecente();
  },
  kpis: function () {
    function ativo(v) { return v === true || v === 1 || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim() === '1'; }
    var alunos = Util.sheetToObjects('Alunos').filter(function (a) { return ativo(a.Ativo); }).length;
    var turmas = Util.sheetToObjects('Classes').filter(function (c) { return ativo(c.Ativo); }).length;
    var profs  = Util.sheetToObjects('Professores').filter(function (p) { return ativo(p.Ativo); }).length;
    var pend = EscolaDominical.chamadasPendentesHoje();
    return [
      { id: 'ed_alunos', rotulo: 'Alunos da EBD', curto: 'Alunos', valor: alunos, icone: 'graduation-cap', cor: 'kc-gold', destino: 'escola-dominical' },
      { id: 'ed_turmas', rotulo: 'Turmas', curto: 'Turmas', valor: turmas, icone: 'users-round', cor: 'kc-blue', destino: 'escola-dominical' },
      { id: 'ed_profs',  rotulo: 'Professores', curto: 'Professores', valor: profs, icone: 'book-user', cor: 'kc-green', destino: 'escola-dominical' },
      { id: 'ed_pend', rotulo: 'chamadas pendentes hoje', curto: 'Chamadas', valor: pend, icone: 'clipboard-list', cor: 'kc-gold', dica: 'Lance a chamada das turmas', acao: 'Lançar', destino: 'escola-dominical', alerta: true }
    ];
  }
};
__MANIFESTOS__.push(EscolaDominicalManifesto);
