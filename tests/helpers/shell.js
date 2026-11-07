'use strict';
// Monta o index.html como o Apps Script faria (include + scriptlets), para preview e e2e.
const { read, createEnv } = require('./gas');

function montarIndex(opts = {}) {
  const env = createEnv({ scriptProperties: opts.semModulos ? { MODULOS_ATIVOS: 'nenhum' } : {} });
  env.load();
  const json = env.run('Modulos.jsonParaHtml()');
  const identidade = opts.identidadeJson || env.run('Config.identidadeJson()');
  const html = env.run('incluirModulos()');
  const cfg = opts.cfgEnv || env; // ambiente cuja aba Config define nome/ícone (o backend do teste)
  return read('index.html')
    .replace(/<\?!=\s*modulosJson\s*\?>/g, () => json)
    .replace(/<\?!=\s*identidadeJson\s*\?>/g, () => identidade)
    .replace(/<\?!=\s*incluirModulos\(\);?\s*\?>/g, () => html)
    .replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => read(f + '.html'))
    .replace(/<\?=\s*nomeIgreja\s*\?>/g, () => cfg.run('Config.identidade().nome'))
    .replace(/<\?=\s*nomeCurtoIgreja\s*\?>/g, () => cfg.run('Config.identidade().nomeCurto'))
    .replace(/<\?=\s*iconeIgreja\s*\?>/g, () => cfg.run('Config.iconeUrl()'))
    .replace(/<\?=\s*recovToken\s*\?>/g, '')
    .replace(/<\?=\s*view\s*\?>/g, '');
}

module.exports = { montarIndex };
