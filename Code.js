// ═══════════════════════════════════════════════════════════
//  Code.gs · Entry Point & Router
// ═══════════════════════════════════════════════════════════

var SESSION_TTL_SECONDS = 21600; // 6 horas (limite real do CacheService)

var SHEETS = {
  USUARIOS:      'Usuarios',
  SESSOES:       'Sessoes',
  CONFIG:        'Config'
};

var PERFIS = {
  ADMIN:      'admin',
  SECRETARIA: 'secretaria'
};
var MEMBROS_FOTO_FOLDER_ID = ''; // fallback: usa/cria pasta "Fotos Membros AD" na raiz do Drive

// ── PLANILHA ─────────────────────────────────────────────────
// Ordem de resolução (nunca há ID embutido no código):
//   1) planilha à qual o script está vinculado (o caso normal: copiou a planilha, copiou o script);
//   2) ID gravado em Propriedades do script (SPREADSHEET_ID) — para script avulso, via configurarPlanilha(id);
//   3) nenhuma das duas → erro claro.
var _SS = null;
function getSSInstance() {
  if (_SS) return _SS;
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) {
    throw new Error('Planilha não encontrada. Abra o script pela própria planilha (Extensões > Apps Script) ' +
      'ou, em script avulso, execute configurarPlanilha("ID_DA_PLANILHA") uma vez.');
  }
  _SS = ss;
  return _SS;
}

// Uso único em script avulso (não vinculado a uma planilha): grava o ID da planilha.
function configurarPlanilha(id) {
  if (!id) throw new Error('Informe o ID da planilha.');
  SpreadsheetApp.openById(id); // falha aqui se o ID estiver errado ou sem acesso
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  _SS = null;
  return 'Planilha configurada.';
}

// ── ENTRY POINT ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
//  doGet — Roteador principal do GAS Web App
//
//  Suporta dois cenários de URL:
//    1) Link de recuperação de senha:
//       ?view=recuperar-senha&token=TOKEN
//    2) Acesso normal:
//       (sem parâmetros)
//
//  O template index.html lê as variáveis <?= recovToken ?>
//  e <?= view ?> injetadas aqui.
// ═══════════════════════════════════════════════════════════
function doGet(e) {
  var params     = e && e.parameter ? e.parameter : {};
  var view       = params.view  || '';
  var recovToken = params.token || '';

  // ── Rota: manifest PWA ──────────────────────────────────────
  if (params.page === 'manifest') {
    var iconUrl = 'https://drive.google.com/thumbnail?id=1D9uYwzWawJPpdcCp2hAtr0u20RnmOpQf&sz=w512';
    var manifest = {
      name: 'AD Fonte da Salvação',
      short_name: 'AD Fonte',
      start_url: ScriptApp.getService().getUrl(),
      display: 'standalone',
      background_color: '#050B10',
      theme_color: '#050B10',
      icons: [
        { src: iconUrl, sizes: '192x192', type: 'image/png' },
        { src: iconUrl, sizes: '512x512', type: 'image/png' }
      ]
    };
    return ContentService
      .createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ───────────────────────────────────────────────────────────

  var tmpl = HtmlService.createTemplateFromFile('index');

  // Injeta no template — o JS do index.html lê com <?= recovToken ?> e <?= view ?>
  tmpl.recovToken = recovToken;
  tmpl.view       = view;
  tmpl.modulosJson = Modulos.jsonParaHtml(); // módulos ativos (registro em Modulos.js)

  return tmpl.evaluate()
    .setTitle('AD Fonte da Salvação — Gestão Ministerial')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── INCLUDE HELPER ───────────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── SETUP ────────────────────────────────────────────────────
function setupSpreadsheet() {
  SetupSheets.createAllSheets();
}

// Cria o primeiro administrador. Edite NOME e EMAIL abaixo e execute UMA VEZ.
// A senha temporária é gerada na hora e enviada para o e-mail informado.
function criarPrimeiroAdmin() {
  var NOME  = 'Nome do Administrador';
  var EMAIL = 'email@exemplo.com';
  return SetupSheets.criarAdministrador(NOME, EMAIL);
}

function runMigrate() {
  SetupSheets.migrateColumns();
}
