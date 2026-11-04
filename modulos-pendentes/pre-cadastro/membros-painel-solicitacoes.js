// Extraído de _membros.html na Etapa 2. Trecho de <script> da tela Membros.
// Reinserir junto com o botão da toolbar (inbox + badge #mb-sol-badge) quando o módulo voltar.

// ═══════════════════════════════════════════════════════════
//  PRÉ-CADASTRO — painel de solicitações
// ═══════════════════════════════════════════════════════════

var MB_SOL = {
  lista:     [],
  carregado: false
};

// ── Abre modal de solicitações ─────────────────────────────
function mbAbrirSolicitacoes() {
  var modal = document.getElementById('mb-sol-modal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', _mbSolModalHtml());
  }
  var m = document.getElementById('mb-sol-modal');
  m.classList.add('open');
  if (window.lucide) lucide.createIcons();
  mbSolCarregar();
}

function mbFecharSolicitacoes() {
  var m = document.getElementById('mb-sol-modal');
  if (m) m.classList.remove('open');
}

// ── HTML do modal ────────────────────────────────────────
function _mbSolModalHtml() {
  return '<div class="modal-overlay" id="mb-sol-modal" onclick="if(event.target===this)mbFecharSolicitacoes()">' +
    '<div class="modal-box" style="max-width:680px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:88dvh">' +

      // Handle + accent já vêm do .modal-box::before e ::after

      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:28px 24px 16px;flex-shrink:0">' +
        '<div>' +
          '<div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.3px">Solicitações de Pré-cadastro</div>' +
          '<div id="mb-sol-sub" style="font-size:12px;color:var(--text-muted);margin-top:3px">Carregando...</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="mbSolGerarLink()" ' +
          'style="display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:10px">' +
            '<i data-lucide="share-2" style="width:14px;height:14px"></i>' +
            '<span style="font-size:13px;font-weight:600">Link WhatsApp</span>' +
          '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="mbFecharSolicitacoes()" ' +
          'style="width:36px;height:36px;padding:0;border-radius:10px;display:flex;align-items:center;justify-content:center">' +
            '<i data-lucide="x" style="width:16px;height:16px"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +

      // Tabs filtro
      '<div style="display:flex;gap:4px;padding:0 24px 12px;flex-shrink:0">' +
        '<button class="mb-tab mb-sol-tab active" onclick="mbSolFiltrar(\'pendente\',this)">⏳ Pendentes</button>' +
        '<button class="mb-tab mb-sol-tab" onclick="mbSolFiltrar(\'aprovado\',this)">✅ Aprovadas</button>' +
        '<button class="mb-tab mb-sol-tab" onclick="mbSolFiltrar(\'rejeitado\',this)">✗ Rejeitadas</button>' +
        '<button class="mb-tab mb-sol-tab" onclick="mbSolFiltrar(\'todos\',this)">Todas</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="mbSolCarregar()" ' +
        'style="margin-left:auto;width:32px;height:32px;padding:0;border-radius:8px;display:flex;align-items:center;justify-content:center" title="Recarregar">' +
          '<i data-lucide="refresh-cw" style="width:13px;height:13px"></i>' +
        '</button>' +
      '</div>' +

      // Separador
      '<div style="height:1px;background:var(--border);flex-shrink:0"></div>' +

      // Lista scrollável
      '<div id="mb-sol-lista" style="flex:1;overflow-y:auto;padding:16px 24px 24px">' +
        '<div style="text-align:center;padding:48px 0;color:var(--text-muted);font-size:14px">Carregando...</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Carregar lista do servidor ────────────────────────────
function mbSolCarregar() {
  var token = App.session && App.session.token;
  if (!token) return;

  document.getElementById('mb-sol-lista').innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--muted,#718096)">Carregando...</div>';

  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        showToast('Erro ao carregar solicitações.', 'error');
        return;
      }
      MB_SOL.lista     = res.data || [];
      MB_SOL.carregado = true;
      mbSolAtualizarBadge();
      mbSolRenderizar('pendente');
    })
    .withFailureHandler(function(e) {
      showToast((e && e.message) || 'Erro ao carregar.', 'error');
    })
    .listarSolicitacoes(token);
}

// ── Filtra por aba ────────────────────────────────────────
function mbSolFiltrar(status, btn) {
  document.querySelectorAll('.mb-sol-tab').forEach(function(b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  mbSolRenderizar(status);
}

// ── Renderiza a lista filtrada ────────────────────────────
function mbSolRenderizar(status) {
  var lista = status === 'todos'
    ? MB_SOL.lista
    : MB_SOL.lista.filter(function(s) { return s.status === status; });

  var sub = document.getElementById('mb-sol-sub');
  if (sub) sub.textContent = lista.length + ' solicitação(ões)';

  var cont = document.getElementById('mb-sol-lista');
  if (!cont) return;

  if (!lista.length) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted,#718096)">Nenhuma solicitação ' + (status === 'todos' ? '' : status) + '.</div>';
    return;
  }

  cont.innerHTML = lista.map(function(s) {
    var cor  = s.status === 'pendente' ? '#d97706' : s.status === 'aprovado' ? '#276749' : '#9b2c2c';
    var label = s.status === 'pendente' ? 'Pendente' : s.status === 'aprovado' ? 'Aprovado' : 'Rejeitado';
    var acoes = s.status === 'pendente'
      ? '<button class="btn btn-sm" style="background:#276749;color:#fff" onclick="mbSolAprovar(\'' + s.id + '\')" title="Aprovar">✓ Aprovar</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="mbSolRejeitar(\'' + s.id + '\')" title="Rejeitar">✗ Rejeitar</button>'
      : '';
    return '<div style="border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px;margin-bottom:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">' +
        '<div>' +
          '<div style="font-weight:700;font-size:15px">' + (s.nome || '—') + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' +
            (s.celular || '') + (s.email ? ' · ' + s.email : '') +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted)">' +
            'Batismo: ' + (_mbSolFmtMesAno(s.batismo) || '—') + ' em ' + (s.Igreja || '—') + ' · ' + (s.funcao || '—') +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);margin-top:3px">' +
            'Enviado em ' + (_mbSolFmtDataHora(s.dataSolicitacao) || '—') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
          '<span style="font-size:11px;font-weight:700;color:' + cor + ';background:' + cor + '20;' +
            'padding:2px 8px;border-radius:99px">' + label + '</span>' +
          acoes +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ── Aprovar solicitação ───────────────────────────────────
function mbSolAprovar(id) {
  var sol = MB_SOL.lista.find(function(s){ return s.id === id; });
  var nome = sol ? sol.nome : 'este candidato';

  var overlay = document.getElementById('modal-mb-confirm');
  if (!overlay) return;
  document.getElementById('mb-confirm-title').textContent = 'Aprovar pré-cadastro';
  document.getElementById('mb-confirm-body').textContent  = 'Aprovar "' + nome + '"? Os dados serão migrados para a aba Membros.';
  document.getElementById('mb-confirm-cancel').textContent = 'Cancelar';
  document.getElementById('mb-confirm-ok').textContent    = 'Aprovar';
  document.getElementById('mb-confirm-ok').className      = 'btn btn-primary btn-full';
  document.getElementById('mb-confirm-cancel').onclick = function(){ overlay.classList.remove('open'); };
  document.getElementById('mb-confirm-ok').onclick = function() {
    overlay.classList.remove('open');
    _mbSolAprovarExecutar(id);
  };
  overlay.classList.add('open');
}

function _mbSolAprovarExecutar(id) {
  var token = App.session && App.session.token;
  showToast('Aprovando...', 'info');
  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        showToast('Erro: ' + (res && res.error ? res.error : 'Tente novamente.'), 'error');
        return;
      }
      showToast('Membro aprovado e cadastrado com sucesso!', 'success');
      var sol = MB_SOL.lista.find(function(s){ return s.id === id; });
      if (sol) sol.status = 'aprovado';
      mbSolAtualizarBadge();
      mbSolRenderizar('pendente');
      MB.loaded = false;
    })
    .withFailureHandler(function(e) {
      showToast((e && e.message) || 'Erro ao aprovar.', 'error');
    })
    .aprovarSolicitacao(token, id);
}

// ── Rejeitar solicitação ──────────────────────────────────
function mbSolRejeitar(id) {
  var sol = MB_SOL.lista.find(function(s){ return s.id === id; });
  var nome = sol ? sol.nome : 'esta solicitação';

  var overlay = document.getElementById('modal-mb-confirm');
  if (!overlay) return;
  document.getElementById('mb-confirm-title').textContent = 'Rejeitar solicitação';
  document.getElementById('mb-confirm-body').textContent  = 'Rejeitar o pré-cadastro de "' + nome + '"? Esta ação não pode ser desfeita.';
  document.getElementById('mb-confirm-cancel').textContent = 'Cancelar';
  document.getElementById('mb-confirm-ok').textContent    = 'Rejeitar';
  document.getElementById('mb-confirm-ok').className      = 'btn btn-danger btn-full';
  document.getElementById('mb-confirm-cancel').onclick = function(){ overlay.classList.remove('open'); };
  document.getElementById('mb-confirm-ok').onclick = function() {
    overlay.classList.remove('open');
    _mbSolRejeitarExecutar(id);
  };
  overlay.classList.add('open');
}

function _mbSolRejeitarExecutar(id) {
  var token = App.session && App.session.token;
  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) { showToast('Erro ao rejeitar.', 'error'); return; }
      showToast('Solicitação rejeitada.', 'warning');
      var sol = MB_SOL.lista.find(function(s){ return s.id === id; });
      if (sol) sol.status = 'rejeitado';
      mbSolAtualizarBadge();
      mbSolRenderizar('pendente');
    })
    .withFailureHandler(function(e) {
      showToast((e && e.message) || 'Erro.', 'error');
    })
    .atualizarStatusSolicitacao(token, id, 'rejeitado');
}

// ── Formata MM/AAAA — aceita ISO, Date ou string já formatada ──
function _mbSolFmtMesAno(val) {
  if (!val) return '';
  var s = String(val).trim();
  if (/^\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { var p=s.split('/'); return p[1]+'/'+p[2]; }
  var iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return iso[2]+'/'+iso[1];
  return s;
}

// ── Formata data/hora — dd/mm/aaaa HH:MM ─────────────────
function _mbSolFmtDataHora(val) {
  if (!val) return '';
  var s = String(val).trim();
  // Já está formatado (dd/mm/aaaa HH:MM:SS)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.substring(0, 16);
  // ISO 8601
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (iso) return iso[3]+'/'+iso[2]+'/'+iso[1]+' '+iso[4]+':'+iso[5];
  return s;
}

// ── Badge no botão da toolbar ─────────────────────────────
function mbSolAtualizarBadge() {
  var pendentes = MB_SOL.lista.filter(function(s){ return s.status === 'pendente'; }).length;
  var badge = document.getElementById('mb-sol-badge');
  if (!badge) return;
  if (pendentes > 0) {
    badge.textContent = pendentes;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// ── Gerar e copiar link do formulário público ─────────────
function mbSolGerarLink() {
  google.script.run
    .withSuccessHandler(function(url) {
      var link = url + '?view=precadastro';
      // Tenta copiar para clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function() {
          showToast('Link copiado! Cole no WhatsApp.', 'success');
        }).catch(function() {
          _mbSolExibirLink(link);
        });
      } else {
        _mbSolExibirLink(link);
      }
    })
    .withFailureHandler(function() {
      showToast('Erro ao gerar link.', 'error');
    })
    .getAppUrl();
}

function _mbSolExibirLink(link) {
  // Fallback quando clipboard API não está disponível:
  // exibe o link num modal de confirmação reutilizando o modal do sistema
  var overlay = document.getElementById('modal-mb-confirm');
  if (!overlay) return;
  document.getElementById('mb-confirm-title').textContent = 'Link de Pré-cadastro';
  document.getElementById('mb-confirm-body').innerHTML =
    '<div style="font-size:12px;margin-bottom:10px;color:var(--text-muted)">Selecione e copie o link abaixo:</div>' +
    '<input id="mb-link-input" value="' + link + '" readonly ' +
    'style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;' +
    'background:var(--bg-glass);color:var(--text);font-size:12px;font-family:monospace;' +
    'cursor:text;outline:none" onclick="this.select()">';
  document.getElementById('mb-confirm-cancel').textContent = 'Fechar';
  document.getElementById('mb-confirm-ok').textContent    = 'Copiar';
  document.getElementById('mb-confirm-ok').className      = 'btn btn-primary btn-full';
  document.getElementById('mb-confirm-cancel').onclick = function(){ overlay.classList.remove('open'); };
  document.getElementById('mb-confirm-ok').onclick = function() {
    var inp = document.getElementById('mb-link-input');
    if (inp) { inp.select(); document.execCommand('copy'); }
    showToast('Link copiado! Cole no WhatsApp.', 'success');
    overlay.classList.remove('open');
  };
  overlay.classList.add('open');
  // Auto-selecionar o input ao abrir
  setTimeout(function() {
    var inp = document.getElementById('mb-link-input');
    if (inp) inp.select();
  }, 100);
}
