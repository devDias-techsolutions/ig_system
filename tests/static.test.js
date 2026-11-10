'use strict';
// Testes estáticos: protegem a estrutura do projeto e a "neutralidade" para revenda.
// Cada teste guarda um defeito encontrado — se voltar, a suíte quebra.

const { test } = require('./helpers/roadmap');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, listFiles, read, createEnv } = require('./helpers/gas');

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

test('tema: shell e login sem o teal original solto (só nas variáveis --teal*)', () => {
  const raw = /rgba\(\s*0\s*,\s*(?:217|196|169|137)\s*,\s*(?:198|181|156|123)|#00D9C6|#00A99C|#00C4B5|#00FFF0|#00897E|#00BFA5|#00b8ad|#007d78/i;
  const hits = findings(raw, ['index.html', '_login.html']).filter((h) => !/--teal[\w-]*\s*:/.test(h));
  assert.deepEqual(hits, [], 'Cores soltas no shell/login:\n' + hits.join('\n'));
});

const TELAS_BASE = ['_home.html', '_membros.html', '_usuarios.html', '_login.html', '_primeiro-acesso.html', '_recuperar-senha.html', '_identidade.html'];
test('tema: Home, Usuários, login e telas de acesso sem teal solto nem :root próprio', () => {
  const raw = /rgba\(\s*0\s*,\s*(?:217|196|169|137)\s*,\s*(?:198|181|156|123)|#00D9C6|#00A99C|#00C4B5|#00FFF0|#00897E|#00BFA5|#00b8ad|#007d78|#009A93|#005248|#007064/i;
  const hits = findings(raw, TELAS_BASE);
  assert.deepEqual(hits, [], 'Cores soltas nas telas base:\n' + hits.join('\n'));
  const proprios = findings(/^\s*(?::root|\[data-theme=["']light["']\])\s*\{/, TELAS_BASE);
  assert.deepEqual(proprios, [], 'Tokens de cor só no shell (index.html):\n' + proprios.join('\n'));
});

test('tema: sem rgba/hex do teal original solto fora da definição de variáveis', () => {
  const raw = /rgba\(\s*0\s*,\s*(?:217|196|169)\s*,\s*(?:198|181|156)|#00D9C6|#00A99C|#00C4B5|#00FFF0/i;
  const hits = findings(raw, HTML.filter((f) => f !== 'index.html'));
  assert.deepEqual(hits.slice(0, 15), [], `Cores soltas (${hits.length} no total, mostrando até 15):\n` + hits.slice(0, 15).join('\n'));
});

// ═══ 4. RECORTE DO MVP (Etapa 2) ════════════════════════════
test('recorte: núcleo não referencia Escola Dominical nem Pré-cadastro', () => {
  const re = /EscolaDominical|escola-dominical|Escola Dominical|\bed_[a-z]|precadastro|pré-cadastro|Solicitac|'(?:Alunos|Classes|Professores|Aulas|Chamadas|PontosExtras)'|\bEBD\b|CPAD/i;
  const hits = findings(re).filter((h) => !/data:image/.test(h));
  assert.deepEqual(hits, [], 'Referências a módulos fora do MVP:\n' + hits.join('\n'));
});

test('recorte: módulos pendentes ficam em modulos-pendentes/, fora da raiz de deploy', () => {
  const esperados = [
    'escola-dominical/EscolaDominical.js',
    'escola-dominical/_escola-dominical.html',
    'escola-dominical/ImportarAlunosParaMembros.js',
    'escola-dominical/membros-importar-ebd.js',
    'pre-cadastro/_precadastro.html',
    'pre-cadastro/PreCadastro.js',
    'pre-cadastro/membros-painel-solicitacoes.js',
  ];
  esperados.forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, 'modulos-pendentes', f)), 'faltando modulos-pendentes/' + f));
  ['EscolaDominical.js', '_escola-dominical.html', '_precadastro.html', 'PreCadastro.js'].forEach((f) =>
    assert.ok(!fs.existsSync(path.join(ROOT, f)), f + ' não pode estar na raiz'));
});

// Rotas agora vêm do registro de módulos (Modulos.js). O trecho de roteamento do index.html
// é executado com os módulos reais carregados no backend.
function roteamento(modulos) {
  const idx = read('index.html');
  const ini = idx.indexOf('// ── ROTEAMENTO');
  const fim = idx.indexOf('function navigateTo(');
  assert.ok(ini > 0 && fim > ini, 'bloco de roteamento não encontrado no index.html');
  const ctx = vm.createContext({ MODULOS: modulos });
  vm.runInContext(idx.slice(ini, fim), ctx);
  return ctx;
}
function modulosReais() {
  const env = createEnv();
  env.load();
  return JSON.parse(env.run('JSON.stringify(Modulos.paraCliente())'));
}

test('rotas: toda rota (núcleo e módulos) tem função de renderização definida', () => {
  const { VIEWS } = roteamento(modulosReais());
  const todosHtml = HTML.map(read).join('\n');
  const faltando = Object.entries(VIEWS).filter(([, fn]) => !new RegExp('function\\s+' + fn + '\\s*\\(').test(todosHtml)).map(([r, fn]) => `${r} → ${fn}`);
  assert.deepEqual(faltando, [], 'Rotas sem função de renderização:\n' + faltando.join('\n'));
});

test('rotas: permissões e autenticação só citam rotas que existem', () => {
  const c = roteamento(modulosReais());
  const orfas = [...Object.keys(c.ROUTE_PERMISSIONS), ...c.authRequired].filter((r) => !(r in c.VIEWS));
  assert.deepEqual(orfas, [], 'Rotas citadas mas inexistentes: ' + orfas.join(', '));
});

test('rotas: cada perfil cai numa tela que ele pode acessar (com e sem módulos)', () => {
  [modulosReais(), []].forEach((mods) => {
    const c = roteamento(mods);
    ['admin', 'secretaria'].forEach((perfil) => {
      const destino = vm.runInContext('_homeViewForPerfil(' + JSON.stringify(perfil) + ')', c);
      assert.ok(c.ROUTE_PERMISSIONS[destino], `destino "${destino}" de ${perfil} sem permissão declarada`);
      assert.ok(c.ROUTE_PERMISSIONS[destino].includes(perfil), `${perfil} não pode acessar o próprio destino "${destino}"`);
    });
  });
});

test('rotas: o núcleo não cita módulo pelo nome (nada de rota "membros" fixa no index/home/usuários)', () => {
  const hits = findings(/navigateTo\(\\?'membros\\?'\)|renderMembros|_membros'/, ['index.html', '_home.html', '_usuarios.html']);
  assert.deepEqual(hits, [], 'Acoplamento do núcleo com o módulo Membros:\n' + hits.join('\n'));
});

test('recorte: núcleo sem perfil professor e sem funcionalidades "Em breve"', () => {
  const hits = [
    ...findings(/professor/i),
    ...findings(/Em breve|notif-dot/),
  ].filter((h) => !/data:image/.test(h));
  assert.deepEqual(hits, [], 'Itens fora do MVP encontrados:\n' + hits.join('\n'));
});

// ═══ 5. LAYOUT SYSTEM (Etapa 15) ════════════════════════════
test('layout: o shell define os blocos .page, .page-head, .panel, .form-grid e .action-bar', () => {
  const idx = read('index.html');
  ['\\.page', '\\.page-head', '\\.page-title', '\\.panel', '\\.panel-title', '\\.form-grid', '\\.action-bar', '\\.action-bar-btns'].forEach((c) =>
    assert.match(idx, new RegExp('^' + c + '\\s*\\{', 'm'), 'faltando ' + c.replace('\\', '') + ' no Layout System'));
});

test('layout: módulos só preenchem os blocos, nunca os redefinem', () => {
  const redefine = /^\s*\.(?:page|page-head|page-title|page-sub|panel|panel-title|panel-text|form-grid|action-bar|action-bar-btns|action-bar-status)\s*[,{]/;
  const hits = findings(redefine, HTML.filter((f) => f !== 'index.html'));
  assert.deepEqual(hits, [], 'Telas redefinindo o Layout System:\n' + hits.join('\n'));
});

test('layout: telas migradas usam .page como raiz e barra de ações padrão', () => {
  ['_home.html', '_membros.html', '_identidade.html'].forEach((f) => assert.match(read(f), /class="page[ "]/, f + ' sem raiz .page'));
  const idt = read('_identidade.html');
  assert.match(idt, /class="action-bar"/);
  assert.ok(/Descartar[\s\S]{0,400}Salvar alterações/.test(idt), 'ordem fixa: secundário (Descartar) antes do primário (Salvar)');
});

// ═══ 6. PADRONIZAÇÃO DOS MÓDULOS (Etapa 15b) ═════════════════
test('padrão: Membros, Usuários e Identidade usam a barra de módulo do shell (sem versão própria)', () => {
  ['_membros.html', '_usuarios.html', '_identidade.html'].forEach((f) => assert.match(read(f), /moduleBarHtml\(/, f + ' sem moduleBarHtml'));
  ['_membros.html', '_usuarios.html'].forEach((f) => assert.match(read(f), /tabsHtml\(/, f + ' sem tabsHtml'));
  const proprio = findings(/\.(?:mb-topnav-(?:module|crumb)|mb-tabs?|usr-tabs?)\b/, ['_membros.html', '_usuarios.html']);
  assert.deepEqual(proprio, [], 'cabeçalho/abas próprios:\n' + proprio.join('\n'));
});

test('padrão: todo modal de módulo tem cabeçalho, corpo e rodapé padrão', () => {
  ['_membros.html', '_usuarios.html'].forEach((f) => {
    const t = read(f);
    const n = (re) => (t.match(re) || []).length;
    const caixas = n(/class="modal-box"/g);
    assert.ok(caixas > 0, f + ' deveria ter modais');
    assert.equal(n(/class="modal-header"/g), caixas, f + ': modal sem modal-header');
    assert.equal(n(/class="modal-body/g), caixas, f + ': modal sem modal-body');
    assert.equal(n(/class="modal-footer"/g), caixas, f + ': modal sem modal-footer');
  });
});

test('padrão: tamanho de ícone e asterisco de obrigatório usam classes do shell, não style inline', () => {
  const ic = findings(/<i data-lucide="[a-z0-9-]+" style="width:(?:13|14|15|16|17|18|20)px;height:\d+px">/, HTML);
  assert.deepEqual(ic, [], 'use class="ic-N":\n' + ic.join('\n'));
  const req = findings(/<span style="color:var\(--danger\)">\*<\/span>/, HTML);
  assert.deepEqual(req, [], 'use class="req":\n' + req.join('\n'));
});

test('padrão: Membros não tem CSS morto herdado (.ed-stat*) nem cores de status soltas fora da carteirinha', () => {
  const t = read('_membros.html');
  assert.ok(!/\.ed-stats|\.ed-stat-card/.test(t), 'sobrou CSS morto .ed-stats/.ed-stat-card');
  assert.ok(!/#(?:4ade80|36d399|ff5e7a|d7b15b|9b7cff|fbbf24)/i.test(t), 'cores de status devem vir das variáveis do shell');
});

// ═══ 7. SETORIZAÇÃO (Etapa 15c) ══════════════════════════════
test('setor: Home, Membros, Usuários e Identidade agrupam o conteúdo em .panel (sem container de vidro próprio)', () => {
  ['_home.html', '_membros.html', '_usuarios.html', '_identidade.html'].forEach((f) => assert.match(read(f), /class="panel[ "]/, f + ' sem .panel'));
  const proprio = findings(/^\s*\.(?:kpi-group|kpi-groups|kpi-group-label|hm-sec|hm-sec-title|usr-content|idt-sec)\s*[,{]/, HTML);
  assert.deepEqual(proprio, [], 'containers/títulos de setor próprios:\n' + proprio.join('\n'));
});

test('padrão: KPI de Membros usa o mesmo card do Início (sem estilo próprio, sem hero, sem pulso)', () => {
  const m = read('_membros.html');
  assert.match(m, /_kpiCard\(/);
  assert.doesNotMatch(m, /mb-kpi|kpi-hero|kpiPulse|kpi-group/);
  assert.doesNotMatch(read('_home.html'), /^\.kpi-card\s*\{/m);
  assert.match(read('index.html'), /^\.kpi-card\s*\{/m);
  assert.match(read('_identidade.html'), /\.idt-marca \.brand-mark\s*\{[^}]*background:/);
  assert.match(read('index.html'), /color:\s*var\(--on-teal/);
});
