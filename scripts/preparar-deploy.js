'use strict';
// Monta a pasta `dist/` só com o que vai para o Apps Script:
// .js e .html da raiz + appsscript.json. Nunca inclui tests/, modulos-pendentes/, scripts/, docs/.
// Uso: node scripts/preparar-deploy.js [pasta-de-saida]   (padrão: dist)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function arquivosDoDeploy() {
  return fs.readdirSync(ROOT)
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile())
    .filter((f) => f.endsWith('.js') || f.endsWith('.html') || f === 'appsscript.json')
    .sort();
}

function preparar(saida) {
  fs.rmSync(saida, { recursive: true, force: true });
  fs.mkdirSync(saida, { recursive: true });
  const lista = arquivosDoDeploy();
  lista.forEach((f) => fs.copyFileSync(path.join(ROOT, f), path.join(saida, f)));
  return lista;
}

if (require.main === module) {
  const saida = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
  const lista = preparar(saida);
  console.log(`${lista.length} arquivos em ${saida}:\n  ` + lista.join('\n  '));
}

module.exports = { arquivosDoDeploy, preparar };
