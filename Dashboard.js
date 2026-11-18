// ═══════════════════════════════════════════════════════════
//  Dashboard.gs · KPIs e Atividade Recente
// ═══════════════════════════════════════════════════════════

var Dashboard = (function () {

  // ── HELPER: valor de "ativo" vindo da planilha (booleano, 1 ou 'TRUE') ──
  function _ativo(v) {
    return v === true || v === 1 || String(v).trim().toUpperCase() === 'TRUE';
  }

  // ── KPIs DA HOME ─────────────────────────────────────────
  // KPIs que cada módulo ativo declara no seu manifesto (kpiLayout: 'grade' | 'lista' | 'trio').
  function getKpisHome(token) {
    return withAuth(token, function(sess) {
      // Cada perfil vê só os indicadores dos módulos que pode abrir
      // Administração (usuários, identidade) fica só no menu: aqui entram apenas módulos com indicadores.
      return Util.ok(Modulos.kpis(sess.perfil));
    });
  }

  // ── ATIVIDADE RECENTE ─────────────────────────────────────
  function getAtividadeRecente(token) {
    return withAuth(token, function(sess) {
      var atividades = [];

      // Últimos usuários criados (movimento de administração: só o administrador vê)
      if (sess.perfil === PERFIS.ADMIN) {
        var usuarios = Util.sheetToObjects('Usuarios');
        usuarios.sort(function(a, b) { return new Date(b.CriadoEm) - new Date(a.CriadoEm); });
        usuarios.slice(0, 5).forEach(function(u) {
          atividades.push({
            icon:  'user-plus',
            texto: 'Usuário adicionado: ' + u.Nome,
            tempo: _tempoRelativo(u.CriadoEm),
            ts:    new Date(u.CriadoEm).getTime() || 0
          });
        });
      }

      // Movimento dos módulos ativos; falha de um módulo não derruba a Home
      try {
        Modulos.atividades(sess.perfil).forEach(function(a) {
          var d = _paraDate(a.data);
          atividades.push({ icon: a.icon || 'activity', texto: a.texto, tempo: _tempoRelativo(a.data), ts: d ? d.getTime() : 0 });
        });
      } catch (e) { Logger.log('[Dashboard.atividade] ' + e.message); }

      atividades.sort(function(a, b) { return b.ts - a.ts; });

      return Util.ok(atividades.slice(0, 15));
    });
  }

  // ── HELPER: data da planilha (dd/MM/yyyy HH:mm:ss, ISO ou Date) → Date | null ──
  function _paraDate(v) {
    if (!v) return null;
    var d;
    if (typeof v === 'string' && v.indexOf('/') !== -1) {
      var parts = v.split(' ');
      var dateParts = parts[0].split('/');
      var timeParts = parts[1] ? parts[1].split(':') : ['0','0','0'];
      d = new Date(
        parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]),
        parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || 0)
      );
    } else {
      d = new Date(v);
    }
    return isNaN(d) ? null : d;
  }

  // ── HELPER: tempo relativo ────────────────────────────────
  function _tempoRelativo(dateStr) {
    var d = _paraDate(dateStr);
    if (!d) return '';

    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)   return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
    if (diff < 86400)return Math.floor(diff / 3600) + 'h atrás';
    return Math.floor(diff / 86400) + 'd atrás';
  }

  return {
    getKpisHome:          getKpisHome,
    getAtividadeRecente:  getAtividadeRecente
  };

})();

// ── FUNÇÕES PÚBLICAS ──────────────────────────────────────
function getKpisHome(token)         { return _safeCall(function(){ return Dashboard.getKpisHome(token); }); }
function getAtividadeRecente(token) { return _safeCall(function(){ return Dashboard.getAtividadeRecente(token); }); }