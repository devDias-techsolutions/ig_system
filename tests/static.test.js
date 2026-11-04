'use strict';
// Testes estáticos: protegem a estrutura do projeto e a "neutralidade" para revenda.
// Cada teste guarda um defeito encontrado — se voltar, a suíte quebra.

const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, listFiles, read } = require('./helpers/gas');

const JS = listFiles('.js');
const HTML = listFiles('.html');
const SOURCES = [...JS, ...HTML];

// ── Utilidades ──────────────────────────────────────────────
function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(m[1])) continue;
    // Remove scriptlets do Apps Script (<?= x ?>, <?!= x ?>, <? code ?>)
    const body = m[2].replace(/<\?!?=([\s\S]*?)\?>/g, 'null').replace(/<\?[\s\S]*?\?>/g, '');
    const line = html.slice(0, m.index).split('\n').length;
    out.push({ body, line });
  }
  return out;
}

function findings(regex, files = SOURCES) {
  const hits = [];
  files.forEach((f) => {
    read(f).split('\n').forEach((ln, i) => {
      if (regex.test(ln)) hits.push(`${f}:${i + 1}  ${ln.trim().slice(0, 90)}`);
    });
  });
  return hits;
}

// ═══ 1. ESTRUTURA E SINTAXE ═════════════════════════════════
test('estrutura: todos os .js compilam', () => {
  JS.forEach((f) => assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f));
});

test('estrutura: scripts inline de cada .html compilam', () => {
  HTML.forEach((f) => {
    inlineScripts(read(f)).forEach(({ body, line }) => {
      assert.doesNotThrow(() => new vm.Script(body, { filename: `${f}@linha${line}` }), `${f} (script na linha ${line})`);
    });
  });
});

test('estrutura: nenhuma função global duplicada entre arquivos .js (a última carregada sobrescreve a outra)', () => {
  const seen = {};
  const dup = [];
  JS.forEach((f) => {
    read(f).split('\n').forEach((ln, i) => {
      const m = /^function\s+([A-Za-z0-9_$]+)\s*\(/.exec(ln);
      if (!m) return;
      if (seen[m[1]]) dup.push(`${m[1]}  →  ${seen[m[1]]} e ${f}:${i + 1}`);
      else seen[m[1]] = `${f}:${i + 1}`;
    });
  });
  assert.deepEqual(dup, [], 'Funções globais definidas duas vezes:\n' + dup.join('\n'));
});

test('estrutura: todo HTML referenciado pelo backend e por include() existe', () => {
  const refs = new Set();
  SOURCES.forEach((f) => {
    const src = read(f);
    for (const m of src.matchAll(/(?:createTemplateFromFile|createHtmlOutputFromFile)\(\s*['"]([^'"]+)['"]/g)) refs.add(m[1]);
    for (const m of src.matchAll(/include\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.add(m[1]);
  });
  const missing = [...refs].filter((r) => !fs.existsSync(path.join(ROOT, r + '.html')));
  assert.deepEqual(missing, [], 'Arquivos HTML ausentes: ' + missing.join(', '));
});

test('estrutura: appsscript.json existe com escopos e fuso horário', () => {
  const p = path.join(ROOT, 'appsscript.json');
  assert.ok(fs.existsSync(p), 'appsscript.json ausente');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(cfg.timeZone, 'timeZone ausente');
  assert.equal(cfg.runtimeVersion, 'V8');
  assert.ok(cfg.webapp && cfg.webapp.access, 'bloco webapp ausente');
});

// ═══ 2. NEUTRALIDADE PARA REVENDA (sem dados da igreja original) ═══
const LEGACY = [
  ['nome da igreja original', /Fonte da Salva|AD Fonte|Assembleia de Deus Fonte/i],
  ['e-mail/domínio da igreja original', /adfontesalvacao/i],
  ['prefixo ADFS_', /ADFS_/],
  ['pasta "Fotos Membros AD"', /Fotos Membros AD/],
  ['CNPJ da igreja original', /49\.482\.621/],
  ['endereço da igreja original', /Manoel Avelar/i],
  ['pastor da igreja original', /Sebasti[aã]o Marcos/i],
  ['imagens da carteirinha no imgur do autor', /i\.imgur\.com\/(PVBVFQF|wF4mKRr)/],
  ['ícone do PWA no Drive do autor', /1D9uYwzWawJPpdcCp2hAtr0u20RnmOpQf/],
  ['ID fixo da planilha original', /16Es1ybDiTm90HL75c6rRgqQv98AcZ7W33WMrfhksxkg/],
];
LEGACY.forEach(([label, re]) => {
  test(`neutralidade: sem ${label} no código`, () => {
    const hits = findings(re);
    assert.deepEqual(hits, [], `Encontrado(s):\n${hits.join('\n')}`);
  });
});

test('neutralidade: sem senha ou e-mail de administrador padrão', () => {
  assert.deepEqual(findings(/Admin@1234/), []);
});

test('neutralidade: sem openById com ID literal', () => {
  assert.deepEqual(findings(/openById\(\s*['"][A-Za-z0-9_-]{20,}['"]/), []);
});

test('segurança: sem backdoor de login embutido no código', () => {
  const hits = findings(/BACKDOOR_HASH|_loginBackdoor/);
  assert.deepEqual(hits, [], 'Backdoor ainda presente:\n' + hits.join('\n'));
});

// ═══ 3. TEMA ════════════════════════════════════════════════
test('tema: :root de cores definido só no shell (index.html), sem redeclaração nos módulos', () => {
  const colorRoot = /:root\s*\{[^}]*--(?:teal|gold|bg|text)\b/;
  const offenders = HTML.filter((f) => f !== 'index.html' && colorRoot.test(read(f)));
  assert.deepEqual(offenders, [], 'Módulos que redeclaram a paleta: ' + offenders.join(', '));
});

test('tema: sem rgba/hex do teal original solto fora da definição de variáveis', () => {
  const raw = /rgba\(\s*0\s*,\s*(?:217|196|169)\s*,\s*(?:198|181|156)|#00D9C6|#00A99C|#00C4B5|#00FFF0/i;
  const hits = findings(raw, HTML.filter((f) => f !== 'index.html'));
  assert.deepEqual(hits.slice(0, 15), [], `Cores soltas (${hits.length} no total, mostrando até 15):\n` + hits.slice(0, 15).join('\n'));
});
