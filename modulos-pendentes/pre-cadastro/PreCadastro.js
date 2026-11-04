// Extraído de Code.js na Etapa 2 (recorte do MVP). Não é carregado pelo núcleo.
// Depende de: Membros (salvarMembro), Util, Auth, getSSInstance.

// ── PRÉ-CADASTRO — retorna URL pública do app (para gerar link WhatsApp) ──
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}


// ═══════════════════════════════════════════════════════════
//  PRÉ-CADASTRO DE MEMBROS — funções públicas (sem auth)
// ═══════════════════════════════════════════════════════════

var SHEET_SOLICITACOES = 'Solicitacoes';

var HEADERS_SOLICITACOES = [
  'id', 'status', 'dataSolicitacao',
  'nome', 'sexo', 'nascimento', 'nomeMae', 'nomePai', 'estadoCivil',
  'batismo', 'Igreja', 'funcao',
  'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep',
  'celular', 'email', 'rg', 'cpf', 'foto', 'observacoes'
];

// ── Garante que a aba Solicitacoes existe ─────────────────
function _ensureSheetSolicitacoes() {
  var ss = getSSInstance();
  var sh = ss.getSheetByName(SHEET_SOLICITACOES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_SOLICITACOES);
    sh.appendRow(HEADERS_SOLICITACOES);
    sh.getRange(1, 1, 1, HEADERS_SOLICITACOES.length)
      .setFontWeight('bold')
      .setBackground('#1C353A')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ── Salvar pré-cadastro (chamado pelo form público) ───────
function salvarSolicitacao(dados) {
  try {
    if (!dados || !dados.nome || !dados.celular) {
      return Util.err('Dados obrigatórios ausentes.');
    }

    _ensureSheetSolicitacoes();

    var id        = Utilities.getUuid();
    var dataHora  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

    var row = HEADERS_SOLICITACOES.map(function(h) {
      if (h === 'id')              return id;
      if (h === 'status')          return 'pendente';
      if (h === 'dataSolicitacao') return dataHora;
      return dados[h] !== undefined ? dados[h] : '';
    });

    Util.getSheet(SHEET_SOLICITACOES).appendRow(row);

    // Notifica admins por email
    _notificarAdminsSolicitacao(dados, id, dataHora);

    return Util.ok({ id: id });
  } catch(e) {
    Logger.log('[salvarSolicitacao] ' + e.message);
    return Util.err('Erro ao salvar solicitação: ' + e.message);
  }
}

// ── Notifica administradores sobre nova solicitação ───────
function _notificarAdminsSolicitacao(dados, id, dataHora) {
  try {
    // Busca emails de todos os usuários com perfil admin
    var usuarios = Util.sheetToObjects('Usuarios');
    var admins   = usuarios.filter(function(u) {
      return u.Perfil === 'admin' && u.Email && u.Ativo;
    });
    if (!admins.length) return;

    var assunto = '[AD Fonte da Salvação] Nova solicitação de pré-cadastro';
    var appUrl  = ScriptApp.getService().getUrl();

    var plain = 'Nova solicitação de pré-cadastro recebida!\n\n' +
      'Nome: ' + dados.nome + '\n' +
      'Celular: ' + dados.celular + '\n' +
      'Data/Hora: ' + dataHora + '\n\n' +
      'Acesse o painel para aprovar ou rejeitar:\n' + appUrl;

    var html = '<meta charset="UTF-8">' +
      '<div style="font-family:sans-serif;max-width:480px;margin:auto">' +
      '<h2 style="color:#1C353A">Nova Solicitação de Pré-cadastro</h2>' +
      '<p>Uma nova solicitação foi recebida:</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
      '<tr><td style="padding:6px 8px;font-weight:bold">Nome</td><td style="padding:6px 8px">' + dados.nome + '</td></tr>' +
      '<tr style="background:#f5f5f5"><td style="padding:6px 8px;font-weight:bold">Celular</td><td style="padding:6px 8px">' + dados.celular + '</td></tr>' +
      '<tr><td style="padding:6px 8px;font-weight:bold">Data/Hora</td><td style="padding:6px 8px">' + dataHora + '</td></tr>' +
      '</table>' +
      '<p style="margin-top:24px">' +
        '<a href="' + appUrl + '" style="display:inline-block;background:#00A99C;color:#fff;' +
        'padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">' +
        'Acessar o painel</a>' +
      '</p>' +
      '<p style="color:#aaa;font-size:11px">AD Fonte da Salvação — Gestão Ministerial</p>' +
      '</div>';

    admins.forEach(function(admin) {
      GmailApp.sendEmail(admin.Email, assunto, plain, { htmlBody: html });
    });
  } catch(e) {
    Logger.log('[_notificarAdminsSolicitacao] ' + e.message);
  }
}

// ── Listar solicitações pendentes (painel admin) ──────────
function listarSolicitacoes(token) {
  try {
    Auth._auth(token);
    _ensureSheetSolicitacoes();
    var rows = Util.sheetToObjects(SHEET_SOLICITACOES);
    // Serializar via JSON para converter objetos Date em string
    // (google.script.run não serializa Date nativamente)
    var safe = JSON.parse(JSON.stringify(rows));
    return Util.ok(safe);
  } catch(e) {
    Logger.log('[listarSolicitacoes] ' + e.message);
    return Util.err(e.message);
  }
}

// ── Atualizar status de uma solicitação ───────────────────
function atualizarStatusSolicitacao(token, id, novoStatus) {
  try {
    Auth._auth(token);
    _ensureSheetSolicitacoes();

    var sh    = Util.getSheet(SHEET_SOLICITACOES);
    var dados = sh.getDataRange().getValues();
    var colId     = HEADERS_SOLICITACOES.indexOf('id');
    var colStatus = HEADERS_SOLICITACOES.indexOf('status');

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][colId]) === String(id)) {
        sh.getRange(i + 1, colStatus + 1).setValue(novoStatus);
        return JSON.parse(JSON.stringify(Util.ok(true)));
      }
    }
    return Util.err('Solicitação não encontrada.');
  } catch(e) {
    Logger.log('[atualizarStatusSolicitacao] ' + e.message);
    return Util.err(e.message);
  }
}

// ── Aprovar: migra solicitação para aba Membros ───────────
function aprovarSolicitacao(token, id) {
  try {
    var sessao = Auth._auth(token);

    _ensureSheetSolicitacoes();
    var sh    = Util.getSheet(SHEET_SOLICITACOES);
    var dados = sh.getDataRange().getValues();
    var headers = dados[0];
    var colId   = headers.indexOf('id');

    var solRow = null;
    var solObj = {};
    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][colId]) === String(id)) {
        solRow = i + 1;
        headers.forEach(function(h, idx) { solObj[h] = dados[i][idx]; });
        break;
      }
    }
    if (!solRow) return Util.err('Solicitação não encontrada.');

    // Salva como membro usando o módulo Membros
    var membro = {
      id:          Utilities.getUuid(),
      rol:         '',
      nome:        solObj.nome        || '',
      sexo:        solObj.sexo        || '',
      nascimento:  solObj.nascimento  || '',
      nomeMae:     solObj.nomeMae     || '',
      nomePai:     solObj.nomePai     || '',
      estadoCivil: solObj.estadoCivil || '',
      batismo:     solObj.batismo     || '',
      Igreja:      solObj.Igreja      || '',
      funcao:      solObj.funcao      || '',
      rua:         solObj.rua         || '',
      numero:      solObj.numero      || '',
      bairro:      solObj.bairro      || '',
      cidade:      solObj.cidade      || '',
      estado:      solObj.estado      || '',
      cep:         solObj.cep         || '',
      celular:     solObj.celular     || '',
      email:       solObj.email       || '',
      rg:          solObj.rg          || '',
      cpf:         solObj.cpf         || '',
      foto:        solObj.foto        || '',
      fotoZoom:    1,
      fotoX:       0,
      fotoY:       0,
      ativo:       true
    };

    var resultado = Membros.salvarMembro(token, membro);
    if (!resultado.success) return Util.err('Erro ao salvar membro: ' + (resultado.error || ''));

    // Marca a solicitação como aprovada
    var colStatus = headers.indexOf('status');
    sh.getRange(solRow, colStatus + 1).setValue('aprovado');

    return JSON.parse(JSON.stringify(Util.ok({ membroId: membro.id })));
  } catch(e) {
    Logger.log('[aprovarSolicitacao] ' + e.message);
    return Util.err(e.message);
  }
}
