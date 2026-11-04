// ═══════════════════════════════════════════════════════════
//  Modulos.gs · Registro de módulos
//
//  Cada módulo (Membros e os que vierem depois) declara um "manifesto"
//  no fim do seu próprio arquivo .js:
//
//    var __MANIFESTOS__ = (typeof __MANIFESTOS__ === 'undefined') ? [] : __MANIFESTOS__;
//    __MANIFESTOS__.push({ id, nome, descricao, icone, rota, render, html,
//                          perfis, ordem, abas:[{nome,colunas,cor}], kpis:function(){...} });
//
//  O padrão acima NÃO depende da ordem de carga dos arquivos (o Apps Script
//  não garante ordem). O núcleo nunca cita um módulo pelo nome: ele só lê
//  este registro. Para "instalar" um módulo basta colar seus arquivos;
//  para remover, apagá-los.
// ═══════════════════════════════════════════════════════════

var __MANIFESTOS__ = (typeof __MANIFESTOS__ === 'undefined') ? [] : __MANIFESTOS__;

var Modulos = (function () {

  // Módulos ativos = todos os registrados, a menos que a propriedade de script
  // MODULOS_ATIVOS (ids separados por vírgula) restrinja (usado no setup guiado, etapa 16).
  function _idsPermitidos() {
    try {
      var v = PropertiesService.getScriptProperties().getProperty('MODULOS_ATIVOS');
      if (v && String(v).trim()) return String(v).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } catch (e) {}
    return null;
  }

  function ativos() {
    var permitidos = _idsPermitidos();
    var vistos = {};
    return __MANIFESTOS__
      .filter(function (m) {
        if (!m || !m.id || vistos[m.id]) return false;
        vistos[m.id] = true;
        return !permitidos || permitidos.indexOf(m.id) !== -1;
      })
      .sort(function (a, b) { return (a.ordem || 100) - (b.ordem || 100); });
  }

  // Abas exigidas pelos módulos ativos: [{nome, colunas, cor}]
  function abas() {
    var out = [];
    ativos().forEach(function (m) { (m.abas || []).forEach(function (a) { out.push(a); }); });
    return out;
  }

  // Versão serializável para o navegador (sem funções)
  function paraCliente() {
    return ativos().map(function (m) {
      return {
        id: m.id, nome: m.nome, descricao: m.descricao || '', icone: m.icone || 'box',
        rota: m.rota || m.id, render: m.render, perfis: m.perfis || ['admin'], permissoes: m.permissoes || null
      };
    });
  }

  // JSON seguro para embutir dentro de <script>
  function jsonParaHtml() {
    return JSON.stringify(paraCliente()).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  }

  // Concatena o HTML de cada módulo ativo (usado por <?!= incluirModulos() ?> no index.html)
  function incluirHtml() {
    return ativos().map(function (m) { return m.html ? include(m.html) : ''; }).join('\n');
  }

  // KPIs dos módulos ativos (cada módulo calcula os seus; falha de um não derruba a home)
  function kpis() {
    var out = [];
    ativos().forEach(function (m) {
      if (typeof m.kpis !== 'function') return;
      try { (m.kpis() || []).forEach(function (k) { out.push(k); }); }
      catch (e) { Logger.log('[Modulos.kpis ' + m.id + '] ' + e.message); }
    });
    return out;
  }

  return { ativos: ativos, abas: abas, paraCliente: paraCliente, jsonParaHtml: jsonParaHtml, incluirHtml: incluirHtml, kpis: kpis };
})();

function incluirModulos() { return Modulos.incluirHtml(); }
function getModulos(token) {
  return _safeCall(function () { return withAuth(token, function () { return Util.ok(Modulos.paraCliente()); }); });
}
