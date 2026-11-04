'use strict';
// Harness: carrega os .js do Apps Script num contexto vm com mocks dos serviços do Google.
// Sem dependências externas — roda com `node --test`.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

function listFiles(ext) {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(ext)).sort();
}
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── Planilha em memória ─────────────────────────────────────
function makeRange(sheet, r, c, nr, nc) {
  const api = {
    getValues: () => {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const row = [];
        for (let j = 0; j < nc; j++) row.push((sheet._rows[r - 1 + i] || [])[c - 1 + j] ?? '');
        out.push(row);
      }
      return out;
    },
    getValue: () => api.getValues()[0][0],
    setValues: (vals) => {
      vals.forEach((row, i) => {
        sheet._rows[r - 1 + i] = sheet._rows[r - 1 + i] || [];
        row.forEach((v, j) => { sheet._rows[r - 1 + i][c - 1 + j] = v; });
      });
      return api;
    },
    setValue: (v) => api.setValues([[v]]),
  };
  ['setBackground', 'setFontColor', 'setFontWeight', 'setFontSize', 'setFontFamily', 'setNumberFormat', 'setWrap']
    .forEach((m) => { api[m] = () => api; });
  return api;
}

function makeSheet(name) {
  const sheet = {
    _name: name,
    _rows: [],
    getName: () => name,
    getLastRow: () => sheet._rows.length,
    getLastColumn: () => sheet._rows.reduce((m, r) => Math.max(m, r.length), 0),
    getDataRange: () => makeRange(sheet, 1, 1, Math.max(sheet._rows.length, 1), Math.max(sheet.getLastColumn(), 1)),
    getRange: (r, c, nr = 1, nc = 1) => makeRange(sheet, r, c, nr, nc),
    appendRow: (row) => { sheet._rows.push(row.slice()); },
    deleteRow: (i) => { sheet._rows.splice(i - 1, 1); },
    setFrozenRows: () => {},
    autoResizeColumns: () => {},
    clear: () => { sheet._rows = []; },
  };
  return sheet;
}

function makeSpreadsheet(id = 'TEST_SS') {
  const sheets = [makeSheet('Plan1')];
  const ss = {
    _id: id,
    getId: () => id,
    getSheets: () => sheets.slice(),
    getSheetByName: (n) => sheets.find((s) => s._name === n) || null,
    insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; },
    deleteSheet: (s) => { const i = sheets.indexOf(s); if (i >= 0) sheets.splice(i, 1); },
  };
  return ss;
}

// ── Contexto GAS ────────────────────────────────────────────
function makeStore() {
  const m = new Map();
  return {
    get: (k) => (m.has(k) ? m.get(k) : null),
    put: (k, v) => { m.set(k, String(v)); },
    remove: (k) => { m.delete(k); },
    getProperty: (k) => (m.has(k) ? m.get(k) : null),
    setProperty: (k, v) => { m.set(k, String(v)); },
    deleteProperty: (k) => { m.delete(k); },
    getProperties: () => Object.fromEntries(m),
    _map: m,
  };
}

function createEnv(opts = {}) {
  const calls = { emails: [], logs: [], htmlFiles: [], openById: [] };
  const activeSS = opts.noActiveSpreadsheet ? null : (opts.spreadsheet || makeSpreadsheet());
  const scriptProps = makeStore();
  const scriptCache = makeStore();
  if (opts.scriptProperties) Object.entries(opts.scriptProperties).forEach(([k, v]) => scriptProps.setProperty(k, v));

  const sandbox = {
    console,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    Logger: { log: (...a) => { calls.logs.push(a.join(' ')); } },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo', getActiveUser: () => ({ getEmail: () => 'dono@igreja.test' }) },
    CacheService: { getScriptCache: () => scriptCache, getUserCache: () => makeStore() },
    PropertiesService: { getScriptProperties: () => scriptProps, getUserProperties: () => makeStore() },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d) => {
        const p = (n) => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      },
      computeDigest: (_alg, str) => Array.from(crypto.createHash('sha256').update(String(str), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (s) => Buffer.from(s).toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
      newBlob: (...a) => ({ args: a, setName() { return this; } }),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    SpreadsheetApp: {
      flush: () => {},
      getActiveSpreadsheet: () => activeSS,
      openById: (id) => { calls.openById.push(id); return opts.openByIdResult || makeSpreadsheet(id); },
    },
    GmailApp: { sendEmail: (...a) => { calls.emails.push(a); } },
    MailApp: { sendEmail: (...a) => { calls.emails.push(a); } },
    DriveApp: {
      getRootFolder: () => ({}),
      getFoldersByName: () => ({ hasNext: () => false }),
      createFolder: () => ({ getId: () => 'FOLDER', createFile: () => ({ getId: () => 'FILE', setSharing() {} }) }),
      getFolderById: () => ({}),
      getFileById: () => ({}),
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }),
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: () => ({ timeBased() { return this; }, everyDays() { return this; }, atHour() { return this; }, everyWeeks() { return this; }, onWeekDay() { return this; }, create() { return {}; } }),
      WeekDay: { MONDAY: 'MONDAY' },
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (t) => ({ _text: t, setMimeType(m) { this._mime = m; return this; }, getContent() { return this._text; } }),
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createTemplateFromFile: (f) => {
        calls.htmlFiles.push(f);
        const t = { _file: f, evaluate() { return { _file: f, _title: '', _tpl: t, setTitle(x) { this._title = x; return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; }, getContent: () => read(f + '.html') }; } };
        return t;
      },
      createHtmlOutputFromFile: (f) => ({ getContent: () => read(f + '.html') }),
    },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  function load(files) {
    (files || listFiles('.js')).forEach((f) => {
      vm.runInContext(read(f), ctx, { filename: f });
    });
    return ctx;
  }
  return { ctx, load, calls, activeSS, scriptProps, scriptCache, run: (code) => vm.runInContext(code, ctx) };
}

module.exports = { ROOT, listFiles, read, createEnv, makeSpreadsheet };
