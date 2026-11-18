// ═══════════════════════════════════════════════════════════
//  Modulos.gs · Registro de módulos
//
//  Cada módulo (Membros e os que vierem depois) declara um "manifesto"
//  no fim do seu próprio arquivo .js:
//
//    var __MANIFESTOS__ = (typeof __MANIFESTOS__ === 'undefined') ? [] : __MANIFESTOS__;
//    __MANIFESTOS__.push({ id, nome, descricao, icone, rota, render, html,
//                          perfis, ordem, abas:[{nome,colunas,cor}], kpis:function(){...}, atividade:function(perfil){...},
//                          acoes:[{ rotulo, icone, rota, fn, perfis }] (opcional: ações do "Acesso rápido" da Início; fn é chamada após abrir a rota),
//                          fonteMembros:{ rotulo, titulo, icone, fn } }); (opcional: oferece pessoas para o cadastro de membros)
//
//  O padrão acima NÃO depende da ordem de carga dos arquivos (o Apps Script
//  não garante ordem). O núcleo nunca cita um módulo pelo nome: ele só lê
//  este registro. Para "instalar" um módulo basta colar seus arquivos;
//  para remover, apagá-los.
// ═══════════════════════════════════════════════════════════

var __MANIFESTOS__ = (typeof __MANIFESTOS__ === 'undefined') ? [] : __MANIFESTOS__;

var Modulos = (function () {

  // Módulos ativos = todos os registrados, a menos que MODULOS_ATIVOS (ids separados por vírgula)
  // restrinja. Fonte: aba Config (chave MODULOS_ATIVOS); se vazia, a propriedade de script de mesmo nome.
  function _idsPermitidos() {
    try {
      var daConfig = Config.get('MODULOS_ATIVOS');
      if (daConfig) return daConfig.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } catch (e) {}
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

  // Todos os módulos instalados (ativos ou não), para a tela Identidade ligar e desligar
  function todos() {
    var on = {};
    ativos().forEach(function (m) { on[m.id] = true; });
    var vistos = {};
    return __MANIFESTOS__.filter(function (m) {
      if (!m || !m.id || vistos[m.id]) return false;
      vistos[m.id] = true; return true;
    }).sort(function (a, b) { return (a.ordem || 100) - (b.ordem || 100); })
      .map(function (m) { return { id: m.id, nome: m.nome, descricao: m.descricao || '', ativo: !!on[m.id] }; });
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
        rota: m.rota || m.id, render: m.render, perfis: m.perfis || ['admin'], permissoes: m.permissoes || null,
        fonteMembros: m.fonteMembros || null,
        acoes: m.acoes || []
      };
    });
  }

  // JSON seguro para embutir dentro de <script>
  function jsonParaHtml() {
    return JSON.stringify(paraCliente()).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  }

  // Concatena o HTML de cada módulo ativo (usado por <?!= incluirModulos() ?> no index.html)
  function incluirHtml() {
    return ativos().map(function (m) {
      return [].concat(m.html || []).map(function (f) { return include(f); }).join('\n');
    }).join('\n');
  }

  // KPIs dos módulos ativos (cada módulo calcula os seus; falha de um não derruba a home)
  // Com `perfil`, só entram os módulos que esse perfil pode abrir.
  function kpis(perfil) {
    var out = [];
    ativos().forEach(function (m) {
      if (typeof m.kpis !== 'function') return;
      if (perfil && (m.perfis || ['admin']).indexOf(perfil) === -1) return;
      try {
        // Cada indicador carrega o módulo de origem: a Home agrupa por módulo para ficar claro de onde vem.
        (m.kpis() || []).forEach(function (k) { k.modulo = m.id; k.moduloNome = m.nome; k.moduloIcone = m.icone || 'box'; k.moduloRota = m.rota; k.layout = m.kpiLayout || 'trio'; out.push(k); });
      }
      catch (e) { Logger.log('[Modulos.kpis ' + m.id + '] ' + e.message); }
    });
    return out;
  }

  // Atividade recente dos módulos ativos: cada um devolve [{ icon, texto, data }] (data no formato da planilha).
  function atividades(perfil) {
    var out = [];
    ativos().forEach(function (m) {
      if (typeof m.atividade !== 'function') return;
      if (perfil && (m.perfis || ['admin']).indexOf(perfil) === -1) return;
      try { (m.atividade(perfil) || []).forEach(function (a) { a.modulo = m.id; out.push(a); }); }
      catch (e) { Logger.log('[Modulos.atividades ' + m.id + '] ' + e.message); }
    });
    return out;
  }

  return { ativos: ativos, todos: todos, abas: abas, paraCliente: paraCliente, jsonParaHtml: jsonParaHtml, incluirHtml: incluirHtml, kpis: kpis, atividades: atividades };
})();

function incluirModulos() { return Modulos.incluirHtml(); }
function getModulos(token) {
  return _safeCall(function () { return withAuth(token, function () { return Util.ok(Modulos.paraCliente()); }); });
}
