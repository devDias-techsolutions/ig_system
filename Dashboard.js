// ═══════════════════════════════════════════════════════════
//  Dashboard.gs · KPIs e Atividade Recente
// ═══════════════════════════════════════════════════════════

var Dashboard = (function () {

  // ── HELPER: valor de "ativo" vindo da planilha (booleano, 1 ou 'TRUE') ──
  function _ativo(v) {
    return v === true || v === 1 || String(v).trim().toUpperCase() === 'TRUE';
  }

  // ── KPIs DA HOME ─────────────────────────────────────────
  // Núcleo (usuários) + KPIs que cada módulo ativo declara no seu manifesto.
  function getKpisHome(token) {
    return withAuth(token, function(sess) {
      // Cada perfil vê só os indicadores dos módulos que pode abrir
      var kpis = Modulos.kpis(sess.perfil);
      // Indicador de administração: só para quem administra o sistema
      if (sess.perfil === PERFIS.ADMIN) {
        var usuarios = Util.sheetToObjects('Usuarios').filter(function(r) { return _ativo(r.Ativo); });
        kpis.push({ icone: 'shield-check', cor: 'kc-green', valor: usuarios.length, rotulo: 'Usuários do sistema', curto: 'Usuários', destino: 'usuarios' });
      }
      return Util.ok(kpis);
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

      atividades.sort(function(a, b) { return b.ts - a.ts; });

      return Util.ok(atividades.slice(0, 5));
    });
  }

  // ── HELPER: tempo relativo ────────────────────────────────
  function _tempoRelativo(dateStr) {
    if (!dateStr) return '';
    var d;
    // Suporte a formato BR dd/MM/yyyy HH:mm:ss
    if (typeof dateStr === 'string' && dateStr.indexOf('/') !== -1) {
      var parts = dateStr.split(' ');
      var dateParts = parts[0].split('/');
      var timeParts = parts[1] ? parts[1].split(':') : ['0','0','0'];
      d = new Date(
        parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]),
        parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || 0)
      );
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d)) return '';

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