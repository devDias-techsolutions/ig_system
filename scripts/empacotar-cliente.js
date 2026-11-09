'use strict';
// Empacotador por cliente: gera tudo o que é preciso para entregar o sistema a uma igreja.
// Uso: node scripts/empacotar-cliente.js <slug | caminho/cliente.json> [pasta-de-saida]
//   slug → lê clientes/<slug>/cliente.json (modelo em clientes/exemplo/cliente.json)
// Saída (padrão dist-clientes/<slug>/):
//   codigo/            os arquivos que vão para o Apps Script (+ .clasp.json se "scriptId" estiver preenchido)
//   Implantacao.csv    valores prontos para colar na aba "Implantacao" da cópia da planilha
//   ENTREGA.md         roteiro de entrega com os dados desta igreja
//   VERSAO.txt         versão do sistema empacotada
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { preparar } = require('./preparar-deploy');

const ROOT = path.resolve(__dirname, '..');
const NOME_PADRAO = 'Minha Igreja';

// campo do cliente.json → chave da aba Implantacao (mesmas de Implantacao.js)
const CAMPOS = [
  ['adminNome', 'ADMIN_NOME'], ['adminEmail', 'ADMIN_EMAIL'], ['nome', 'NOME_IGREJA'], ['nomeCurto', 'NOME_CURTO'],
  ['lema', 'LEMA_IGREJA'], ['cor', 'COR_PRIMARIA'], ['pastor', 'PASTOR'], ['cargoPastor', 'CARGO_PASTOR'],
  ['endereco', 'ENDERECO_IGREJA'], ['cnpj', 'CNPJ_IGREJA'], ['pastaFotos', 'PASTA_FOTOS']
];
const LIMITES = { nome: 80, nomeCurto: 30, lema: 160, cor: 7, pastor: 80, cargoPastor: 60, endereco: 160, cnpj: 30, pastaFotos: 60 };

function limpar(v) { return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim(); }

// Mesmas regras do Implantacao.validar (o teste garante que continuam iguais)
function validar(c) {
  const erros = [];
  const d = {};
  CAMPOS.forEach(([k]) => { d[k] = limpar(c[k]); });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(c.slug || ''))) erros.push('slug inválido (use letras minúsculas, números e hífen).');
  if (!d.adminNome) erros.push('Informe adminNome.');
  d.adminEmail = d.adminEmail.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.adminEmail)) erros.push('adminEmail inválido.');
  if (!d.nome || d.nome === NOME_PADRAO) erros.push('Informe o nome da igreja (nome).');
  Object.keys(LIMITES).forEach((k) => { if (d[k].length > LIMITES[k]) erros.push(k + ' aceita no máximo ' + LIMITES[k] + ' caracteres.'); });
  if (d.cor && !/^#[0-9a-fA-F]{6}$/.test(d.cor)) erros.push('cor inválida: use o formato #RRGGBB.');
  const scriptId = limpar(c.scriptId);
  if (scriptId && !/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) erros.push('scriptId com formato estranho (copie em Configurações do projeto → IDs).');
  return { erros, dados: d, scriptId };
}

function csvCelula(v) { v = String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

function gerarCsv(dados) {
  const linhas = [['Chave', 'Valor', 'Descricao']];
  CAMPOS.forEach(([k, chave]) => linhas.push([chave, dados[k], '']));
  return linhas.map((l) => l.map(csvCelula).join(',')).join('\n') + '\n';
}

function versao() {
  let sha = 'sem-git';
  try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* fora de um repositório git */ }
  return sha;
}

function gerarEntrega(dados, scriptId, ver) {
  const linha = (rot, v) => '- ' + rot + ': ' + (v || '_(padrão)_');
  return [
    '# Entrega — ' + dados.nome,
    '',
    'Sistema versão `' + ver + '`. Gerado por `npm run empacotar`.',
    '',
    '## Dados desta igreja',
    linha('Administrador', dados.adminNome + ' <' + dados.adminEmail + '>'),
    linha('Nome curto', dados.nomeCurto), linha('Lema', dados.lema), linha('Cor da marca', dados.cor),
    linha('Pastor', dados.pastor), linha('Cargo', dados.cargoPastor), linha('Endereço', dados.endereco),
    linha('CNPJ', dados.cnpj), linha('Pasta das fotos', dados.pastaFotos),
    '',
    '## Roteiro',
    '1. Faça uma cópia da planilha modelo (Arquivo → Fazer uma cópia). O script vai junto.',
    scriptId
      ? '2. O código desta versão está na pasta `codigo/`. Para atualizar a cópia: `cd codigo && npx @google/clasp@2 push --force` (o `.clasp.json` já aponta para o script desta igreja).'
      : '2. O código desta versão está na pasta `codigo/`. A cópia da planilha já leva o script; para atualizar depois, preencha `scriptId` em cliente.json e empacote de novo.',
    '3. No editor do Apps Script da cópia, execute `implantarIgreja` (cria a aba **Implantacao**).',
    '4. Abra `Implantacao.csv` e cole os valores na coluna **Valor** da aba (ou preencha à mão com os dados acima).',
    '5. Execute `implantarIgreja` de novo: cria as abas, a identidade e o administrador (a senha temporária vai por e-mail).',
    '6. Implante a aplicação web (executar como você; acesso: qualquer pessoa).',
    '7. Entre como administrador e envie o **logo** (PNG transparente, versão clara) na tela Identidade.',
    '8. Execute `verificarImplantacao`: entregue quando não houver ❌.',
    ''
  ].join('\n');
}

function carregar(alvo) {
  const arquivo = fs.existsSync(alvo) ? path.resolve(alvo) : path.join(ROOT, 'clientes', alvo, 'cliente.json');
  if (!fs.existsSync(arquivo)) throw new Error('Não achei ' + arquivo + '. Crie a partir de clientes/exemplo/cliente.json.');
  let c;
  try { c = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch (e) { throw new Error('cliente.json inválido (JSON): ' + e.message); }
  if (!c.slug) c.slug = path.basename(path.dirname(arquivo));
  return c;
}

function empacotar(alvo, saidaBase) {
  const cliente = carregar(alvo);
  const { erros, dados, scriptId } = validar(cliente);
  if (erros.length) throw new Error('cliente.json com problemas:\n - ' + erros.join('\n - '));   // nada é gerado

  const saida = path.resolve(saidaBase || path.join(ROOT, 'dist-clientes', cliente.slug));
  fs.rmSync(saida, { recursive: true, force: true });
  fs.mkdirSync(saida, { recursive: true });

  const arquivos = preparar(path.join(saida, 'codigo'));
  if (scriptId) fs.writeFileSync(path.join(saida, 'codigo', '.clasp.json'), JSON.stringify({ scriptId, rootDir: '.' }, null, 2) + '\n');
  const ver = versao();
  fs.writeFileSync(path.join(saida, 'Implantacao.csv'), gerarCsv(dados));
  fs.writeFileSync(path.join(saida, 'ENTREGA.md'), gerarEntrega(dados, scriptId, ver));
  fs.writeFileSync(path.join(saida, 'VERSAO.txt'), 'versao: ' + ver + '\narquivos: ' + arquivos.length + '\ncliente: ' + cliente.slug + '\n');
  return { saida, arquivos: arquivos.length, versao: ver };
}

if (require.main === module) {
  const alvo = process.argv[2];
  if (!alvo) { console.error('Uso: node scripts/empacotar-cliente.js <slug | caminho/cliente.json> [pasta-de-saida]'); process.exit(1); }
  try {
    const r = empacotar(alvo, process.argv[3]);
    console.log('Pacote pronto em ' + r.saida + ' (' + r.arquivos + ' arquivos, versão ' + r.versao + ').\nSiga o roteiro em ENTREGA.md.');
  } catch (e) { console.error('Erro: ' + e.message); process.exit(1); }
}

module.exports = { validar, gerarCsv, empacotar, CAMPOS };
