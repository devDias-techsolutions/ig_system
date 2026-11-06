'use strict';
// Monta o index.html como o Apps Script faria (include + scriptlets), para preview e e2e.
const { read, createEnv } = require('./gas');

function montarIndex(opts = {}) {
  const env = createEnv({ scriptProperties: opts.semModulos ? { MODULOS_ATIVOS: 'nenhum' } : {} });
  env.load();
  const json = env.run('Modulos.jsonParaHtml()');
  const html = env.run('incluirModulos()');
  return read('index.html')
    .replace(/<\?!=\s*modulosJson\s*\?>/g, () => json)
    .replace(/<\?!=\s*incluirModulos\(\);?\s*\?>/g, () => html)
    .replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => read(f + '.html'))
    .replace(/<\?=\s*recovToken\s*\?>/g, '')
    .replace(/<\?=\s*view\s*\?>/g, '');
}

module.exports = { montarIndex };
