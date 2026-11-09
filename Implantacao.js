// ═══════════════════════════════════════════════════════════
//  Implantacao.gs · Ferramenta de quem entrega o sistema a uma igreja
//  1) implantarIgreja()      → lê a aba "Implantacao", cria tudo e o 1º administrador
//  2) verificarImplantacao() → relatório do que está pronto e do que falta
//  Nada daqui aparece para o usuário final: são funções do editor do Apps Script.
// ═══════════════════════════════════════════════════════════

var Implantacao = (function () {

  var ABA = 'Implantacao';

  // [chave, descrição, obrigatório]
  var CAMPOS = [
    ['ADMIN_NOME',      'Nome de quem vai administrar o sistema', true],
    ['ADMIN_EMAIL',     'E-mail do administrador (recebe a senha temporária)', true],
    ['NOME_IGREJA',     'Nome completo da igreja', true],
    ['NOME_CURTO',      'Nome curto (opcional)', false],
    ['LEMA_IGREJA',     'Lema ou versículo (opcional)', false],
    ['COR_PRIMARIA',    'Cor da marca no formato #RRGGBB (opcional)', false],
    ['PASTOR',          'Pastor presidente (opcional)', false],
    ['CARGO_PASTOR',    'Cargo do pastor (vazio = Pastor Presidente)', false],
    ['ENDERECO_IGREJA', 'Endereço da sede (opcional)', false],
    ['CNPJ_IGREJA',     'CNPJ (opcional)', false],
    ['PASTA_FOTOS',     'Pasta do Drive para as fotos (vazio = Fotos de Membros)', false]
  ];

  // Cria a aba de preenchimento (se não existir). Devolve true se criou agora.
  function criarModelo() {
    var SS = getSSInstance();
    if (SS.getSheetByName(ABA)) return false;
    var sheet = SS.insertSheet(ABA);
    sheet.getRange(1, 1, 1, 3).setValues([['Chave', 'Valor', 'Descricao']]);
    sheet.getRange(2, 1, CAMPOS.length, 3).setValues(CAMPOS.map(function (c) {
      return [c[0], '', c[1] + (c[2] ? ' — OBRIGATÓRIO' : '')];
    }));
    sheet.setFrozenRows(1);
    return true;
  }

  // Lê a aba de preenchimento → { CHAVE: 'valor' } ou null se a aba não existe
  function lerDados() {
    var SS = getSSInstance();
    if (!SS.getSheetByName(ABA)) return null;
    var dados = {};
    Util.sheetToObjects(ABA).forEach(function (r) {
      var k = String(r.Chave || '').trim();
      var v = (r.Valor === null || r.Valor === undefined) ? '' : String(r.Valor).trim();
      if (k) dados[k] = v;
    });
    return dados;
  }

  // Confere tudo ANTES de gravar qualquer coisa. Devolve { ok, erro } ou { ok, admin, config }.
  function validar(dados) {
    dados = dados || {};
    var nomeAdmin = String(dados.ADMIN_NOME || '').trim();
    var email = String(dados.ADMIN_EMAIL || '').toLowerCase().trim();
    if (!nomeAdmin) return { ok: false, erro: 'Informe o nome do administrador (ADMIN_NOME).' };
    if (!Util.isValidEmail(email)) return { ok: false, erro: 'E-mail do administrador inválido (ADMIN_EMAIL).' };
    var nome = String(dados.NOME_IGREJA || '').trim();
    if (!nome || nome === 'Minha Igreja') return { ok: false, erro: 'Informe o nome da igreja (NOME_IGREJA).' };

    var config = {};
    CAMPOS.forEach(function (c) {
      var k = c[0];
      if (k.indexOf('ADMIN_') === 0) return;
      var v = String(dados[k] === null || dados[k] === undefined ? '' : dados[k]).trim();
      if (v !== '') config[k] = v;     // vazio = mantém o padrão da Config
    });
    var val = Config.validar(config);
    if (!val.ok) return val;
    return { ok: true, admin: { nome: nomeAdmin, email: email }, config: val.limpos };
  }

  // Cria/atualiza tudo. Pode rodar mais de uma vez: não duplica abas, chaves nem administrador.
  function implantar(dados) {
    var v = validar(dados);
    if (!v.ok) throw new Error(v.erro);

    SetupSheets.createAllSheets();
    var gravou = Config.salvar(v.config);
    if (!gravou.ok) throw new Error(gravou.erro);

    var admins = Util.sheetToObjects('Usuarios').filter(function (u) { return u.Perfil === PERFIS.ADMIN; });
    var admin;
    if (admins.some(function (u) { return String(u.Email).toLowerCase() === v.admin.email; })) {
      admin = { status: 'ja_existia', email: v.admin.email };
    } else if (admins.length) {
      admin = { status: 'outro_admin', email: String(admins[0].Email) };   // já há um administrador: não cria outro
    } else {
      var r = SetupSheets.criarAdministrador(v.admin.nome, v.admin.email);
      admin = { status: 'criado', email: r.email, emailEnviado: r.emailEnviado };
    }
    return { admin: admin, verificacao: verificar() };
  }

  // Relatório: itens com nivel 'ok' | 'aviso' | 'erro'. pronto = nenhum erro.
  function verificar() {
    var itens = [];
    var add = function (nivel, item, detalhe) { itens.push({ nivel: nivel, item: item, detalhe: detalhe || '' }); };

    var SS = getSSInstance();
    var faltam = Object.keys(SetupSheets.schema()).filter(function (n) { return !SS.getSheetByName(n); });
    if (faltam.length) add('erro', 'Abas do sistema', 'Faltam: ' + faltam.join(', ') + '. Rode setupSpreadsheet().');
    else add('ok', 'Abas do sistema', 'Todas criadas');

    var id = Config.identidade();
    if (!id.nome || id.nome === 'Minha Igreja') add('erro', 'Nome da igreja', 'Ainda é o nome padrão.');
    else add('ok', 'Nome da igreja', id.nome);

    var admins = [];
    try { admins = Util.sheetToObjects('Usuarios').filter(function (u) { return u.Perfil === PERFIS.ADMIN && String(u.Ativo).toLowerCase() !== 'false'; }); } catch (e) {}
    if (!admins.length) add('erro', 'Administrador', 'Nenhum administrador ativo.');
    else add('ok', 'Administrador', String(admins[0].Email));

    var logo = false;
    try { logo = !!Imagens.dataUri('logo'); } catch (e) {}
    if (logo || Config.get('LOGO_URL', '')) add('ok', 'Logo', 'Definido');
    else add('aviso', 'Logo', 'Sem logo: o sistema mostra as iniciais. Envie pela tela Identidade.');

    if (id.corPrimaria) add('ok', 'Cor da marca', id.corPrimaria);
    else add('aviso', 'Cor da marca', 'Usando a cor padrão.');

    if (id.pastor) add('ok', 'Pastor (carteirinha)', id.pastor);
    else add('aviso', 'Pastor (carteirinha)', 'Vazio: a carteirinha sai sem nome do pastor.');

    try {
      var cota = MailApp.getRemainingDailyQuota();
      if (cota > 0) add('ok', 'Envio de e-mail', 'Cota diária: ' + cota);
      else add('erro', 'Envio de e-mail', 'Cota diária esgotada: senhas não serão enviadas hoje.');
    } catch (e) {
      add('aviso', 'Envio de e-mail', 'Não foi possível verificar a cota (autorize o envio de e-mails).');
    }

    return { pronto: !itens.some(function (i) { return i.nivel === 'erro'; }), itens: itens };
  }

  // Texto do relatório para o log do editor
  function texto(ver) {
    var icone = { ok: '✅', aviso: '⚠️', erro: '❌' };
    var linhas = ver.itens.map(function (i) { return icone[i.nivel] + ' ' + i.item + (i.detalhe ? ' — ' + i.detalhe : ''); });
    linhas.push(ver.pronto ? '🚀 Pronto para entregar.' : '⛔ Ainda não está pronto: corrija os itens com ❌.');
    return linhas.join('\n');
  }

  return { criarModelo: criarModelo, lerDados: lerDados, validar: validar, implantar: implantar, verificar: verificar, texto: texto, campos: CAMPOS };

})();
