// ═══════════════════════════════════════════════════════════
//  Code.gs · Entry Point & Router
// ═══════════════════════════════════════════════════════════

var SPREADSHEET_ID     = '16Es1ybDiTm90HL75c6rRgqQv98AcZ7W33WMrfhksxkg';
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

// ── SS: inicialização LAZY (evita crash global) ──────────────
var _SS = null;
function getSSInstance() {
  if (!_SS) {
    _SS = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _SS;
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

function runMigrate() {
  SetupSheets.migrateColumns();
}
