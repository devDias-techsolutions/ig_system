// ═══════════════════════════════════════════════════════════
//  SetupSheets.gs · Criação das abas do Google Sheets
//  Para entregar uma igreja nova use implantarIgreja() (Code.js / Implantacao.js),
//  que chama createAllSheets() e cria o administrador. setupSpreadsheet() continua
//  disponível para recriar abas/chaves que faltarem (pode rodar quantas vezes quiser).
// ═══════════════════════════════════════════════════════════

var SetupSheets = (function () {

  var CORE_SCHEMA = {

    Usuarios: [
      'ID', 'Nome', 'Email', 'SenhaHash', 'Perfil',
      'PrimeiroAcesso', 'Ativo',
      'TokenRecupSenha', 'ExpirToken',
      'CriadoEm', 'UltimoLogin'
    ],

    Sessoes: [
      'Token', 'UsuarioID', 'Email', 'Perfil', 'Nome',
      'CriadoEm', 'ExpiraEm', 'Ativo'
    ],

    // Imagens da igreja enviadas pela tela Identidade (logo, marca d'água, assinatura): ficam na própria
    // planilha, então copiar a planilha leva as imagens junto. Cada imagem é dividida em partes
    // porque uma célula aceita no máximo 50.000 caracteres.
    Imagens: ['Tipo', 'Mime', 'Dados1', 'Dados2', 'Dados3', 'AtualizadoEm'],

    Config: [
      'Chave', 'Valor', 'Descricao', 'AtualizadoEm'
    ]
  };

  // Cores de cabeçalho por aba
  var CORE_COLORS = {
    Usuarios:      '#1C353A',
    Sessoes:       '#0f2a2f',
    Imagens:       '#3a3a3a',
    Config:        '#2a2a2a'
  };

  // Esquema = abas do núcleo + abas declaradas pelos módulos ativos (calculado a cada uso,
  // pois a ordem de carga dos arquivos não é garantida).
  function _schema() {
    var s = {}; Object.keys(CORE_SCHEMA).forEach(function (k) { s[k] = CORE_SCHEMA[k]; });
    Modulos.abas().forEach(function (a) { s[a.nome] = a.colunas; });
    return s;
  }
  function _colors() {
    var c = {}; Object.keys(CORE_COLORS).forEach(function (k) { c[k] = CORE_COLORS[k]; });
    Modulos.abas().forEach(function (a) { if (a.cor) c[a.nome] = a.cor; });
    return c;
  }

  // ─────────────────────────────────────────────────────────────
  //  Migração segura: adiciona colunas ausentes em abas existentes
  //  NÃO apaga dados. Execute após atualizar o SCHEMA acima.
  // ─────────────────────────────────────────────────────────────
  function migrateColumns() {
    var SS = getSSInstance();
    var report = [];
    Object.keys(_schema()).forEach(function(name) {
      var sheet = SS.getSheetByName(name);
      if (!sheet) {
        report.push('⏭️  "' + name + '" não existe — rode createAllSheets() primeiro.');
        return;
      }
      var expected = _schema()[name];
      var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      var toAdd = expected.filter(function(col) { return existing.indexOf(col) === -1; });
      if (!toAdd.length) {
        report.push('✅ "' + name + '" — sem colunas novas.');
        return;
      }
      toAdd.forEach(function(col) {
        var nextCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextCol).setValue(col)
          .setBackground(_colors()[name] || '#1C353A')
          .setFontColor('#00A99C')
          .setFontWeight('bold')
          .setFontSize(11)
          .setFontFamily('Courier New');
        report.push('➕ "' + name + '" — coluna adicionada: ' + col);
      });
      sheet.autoResizeColumns(1, sheet.getLastColumn());
    });
    SpreadsheetApp.flush();
    Logger.log(report.join('\n'));
    return report;
  }

  function createAllSheets() {
    var SS = getSSInstance();
    var created = [];
    var skipped = [];

    Object.keys(_schema()).forEach(function (name) {
      var existing = SS.getSheetByName(name);
      if (existing) {
        skipped.push(name);
        return;
      }

      var sheet = SS.insertSheet(name);
      var headers = _schema()[name];

      // Escrever cabeçalhos
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Estilo do cabeçalho
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange
        .setBackground(_colors()[name] || '#1C353A')
        .setFontColor('#00A99C')
        .setFontWeight('bold')
        .setFontSize(11)
        .setFontFamily('Courier New');

      // Congelar linha de cabeçalho
      sheet.setFrozenRows(1);

      // Auto-resize colunas
      sheet.autoResizeColumns(1, headers.length);

      created.push(name);
    });

    // Seed: Config padrão
    _seedConfig();

    // Remover a aba "Plan1" padrão se existir
    var defaultSheet = SS.getSheetByName('Plan1') || SS.getSheetByName('Sheet1');
    if (defaultSheet && SS.getSheets().length > 1) {
      SS.deleteSheet(defaultSheet);
    }

    Logger.log('✅ Abas criadas: ' + created.join(', '));
    Logger.log('⏭️  Abas já existentes: ' + skipped.join(', '));
    Logger.log('🌱 Dados iniciais aplicados. Próximo passo: execute criarPrimeiroAdmin().');

    return { created: created, skipped: skipped };
  }

  // ── Primeiro administrador ─────────────────────────────────
  // Nenhum usuário nasce pronto: a senha é gerada na hora, aleatória,
  // enviada por e-mail e o administrador é obrigado a trocá-la no 1º acesso.
  // Use pela função criarPrimeiroAdmin() (Code.js).
  function _gerarSenhaTemporaria() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var hex   = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    var s = '';
    for (var i = 0; i < 12; i++) {
      s += chars.charAt(parseInt(hex.substr(i * 2, 2), 16) % chars.length);
    }
    return s;
  }

  function criarAdministrador(nome, email) {
    nome  = String(nome  || '').trim();
    email = String(email || '').toLowerCase().trim();
    if (!nome || !Util.isValidEmail(email)) {
      throw new Error('Informe um nome e um e-mail válido para o administrador.');
    }

    var SS    = getSSInstance();
    var sheet = SS.getSheetByName('Usuarios');
    if (!sheet) throw new Error('Aba "Usuarios" não encontrada. Execute setupSpreadsheet() primeiro.');

    if (Util.findRow('Usuarios', 'Email', email)) {
      throw new Error('Já existe um usuário com este e-mail.');
    }
    var existeAdmin = Util.sheetToObjects('Usuarios').some(function (u) {
      return u.Perfil === PERFIS.ADMIN;
    });
    if (existeAdmin) {
      throw new Error('Já existe um administrador. Crie novos usuários pela tela Usuários.');
    }

    var senha = _gerarSenhaTemporaria();
    Util.insertRow('Usuarios', {
      ID:               Util.uuid(),
      Nome:             nome,
      Email:            email,
      SenhaHash:        Util.sha256(senha),
      Perfil:           PERFIS.ADMIN,
      PrimeiroAcesso:   true,
      Ativo:            true,
      TokenRecupSenha:  '',
      ExpirToken:       '',
      CriadoEm:         Util.now(),
      UltimoLogin:      ''
    });

    var enviado = false;
    try {
      var appUrl = ScriptApp.getService().getUrl();
      GmailApp.sendEmail(email, '[' + Config.remetente() + '] Seu acesso de administrador', '', {
        name: Config.remetente(),
        htmlBody: '<p>Olá, ' + nome + '!</p>' +
                  '<p>Seu acesso de administrador foi criado.</p>' +
                  '<p>E-mail: <b>' + email + '</b><br>Senha temporária: <b>' + senha + '</b></p>' +
                  '<p>Você precisará criar uma nova senha no primeiro acesso.</p>' +
                  (appUrl ? '<p><a href="' + appUrl + '">Abrir o sistema</a></p>' : '')
      });
      enviado = true;
    } catch (e) {
      Logger.log('⚠️ Não foi possível enviar o e-mail: ' + e.message);
    }

    if (enviado) {
      Logger.log('🌱 Administrador criado: ' + email + '. A senha temporária foi enviada por e-mail.');
    } else {
      // Plano B: sem o e-mail a pessoa ficaria sem acesso. A senha aparece só neste log do editor.
      Logger.log('🌱 Administrador criado: ' + email + ' · Senha temporária: ' + senha);
    }
    return { email: email, emailEnviado: enviado };
  }

  // Config da igreja: cria só as chaves que faltam (não altera o que já foi preenchido)
  function _seedConfig() {
    Config.garantirChaves();
  }

  return {
    createAllSheets: createAllSheets,
    migrateColumns:  migrateColumns,
    criarAdministrador: criarAdministrador,
    schema:          _schema
  };

})();