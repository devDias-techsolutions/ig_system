// Extraído de _membros.html na Etapa 2. Trecho de <script> da tela Membros.
// Reinserir junto com o botão "Importar da EBD" do formulário de novo membro.

// ═══════════════════════════════════════════════════════════
//  IMPORTAR DA EBD — pré-preenchimento de formulário
// ═══════════════════════════════════════════════════════════

var MB_EBD = { lista: [] };

// ── Abre modal de seleção de aluno EBD ───────────────────
function mbEBDImportarAbrir() {
  var modal = document.getElementById('mb-ebd-modal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', _mbEBDModalHtml());
  }
  var m = document.getElementById('mb-ebd-modal');
  m.classList.add('open');
  if (window.lucide) lucide.createIcons();
  document.getElementById('mb-ebd-busca').value = '';
  document.getElementById('mb-ebd-lista').innerHTML =
    '<div style="text-align:center;padding:48px 0;color:var(--text-muted);font-size:14px">Carregando alunos...</div>';
  _mbEBDCarregar();
}

function mbEBDFechar() {
  var m = document.getElementById('mb-ebd-modal');
  if (m) m.classList.remove('open');
}

// ── HTML do modal ─────────────────────────────────────────
function _mbEBDModalHtml() {
  return '<div class="modal-overlay" id="mb-ebd-modal" onclick="if(event.target===this)mbEBDFechar()">' +
    '<div class="modal-box" style="max-width:520px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:88dvh">' +

      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:28px 24px 16px;flex-shrink:0">' +
        '<div>' +
          '<div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:-.3px">Importar da EBD</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">Selecione o aluno para pré-preencher o formulário</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="mbEBDFechar()" ' +
        'style="width:36px;height:36px;padding:0;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<i data-lucide="x" style="width:16px;height:16px"></i>' +
        '</button>' +
      '</div>' +

      // Campo de busca
      '<div style="padding:0 24px 12px;flex-shrink:0">' +
        '<div style="position:relative">' +
          '<i data-lucide="search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-muted);pointer-events:none"></i>' +
          '<input id="mb-ebd-busca" type="text" placeholder="Buscar por nome..." ' +
          'oninput="_mbEBDFiltrar(this.value)" ' +
          'style="width:100%;height:40px;padding:0 12px 0 36px;border:1.5px solid var(--border);' +
          'border-radius:12px;background:var(--bg-glass);color:var(--text);font-size:13px;' +
          'font-family:inherit;outline:none;transition:border-color .15s" ' +
          'onfocus="this.style.borderColor=\'var(--teal)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
        '</div>' +
      '</div>' +

      // Separador
      '<div style="height:1px;background:var(--border);flex-shrink:0"></div>' +

      // Lista scrollável
      '<div id="mb-ebd-lista" style="flex:1;overflow-y:auto;padding:12px 16px 20px">' +
        '<div style="text-align:center;padding:48px 0;color:var(--text-muted);font-size:14px">Carregando...</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Carrega alunos EBD ainda não membros ─────────────────
function _mbEBDCarregar() {
  var token = App.session && App.session.token;
  if (!token) return;

  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        document.getElementById('mb-ebd-lista').innerHTML =
          '<div style="text-align:center;padding:32px;color:var(--danger)">Erro ao carregar alunos.</div>';
        return;
      }
      MB_EBD.lista = res.data || [];
      _mbEBDRenderizar(MB_EBD.lista);
    })
    .withFailureHandler(function(e) {
      document.getElementById('mb-ebd-lista').innerHTML =
        '<div style="text-align:center;padding:32px;color:var(--danger)">Erro de conexão.</div>';
    })
    .buscarAlunosParaImportar(token);
}

// ── Filtro por nome ───────────────────────────────────────
function _mbEBDFiltrar(termo) {
  var t = (termo || '').toLowerCase().trim();
  var filtrado = !t ? MB_EBD.lista : MB_EBD.lista.filter(function(a) {
    return (a.Nome || '').toLowerCase().indexOf(t) >= 0;
  });
  _mbEBDRenderizar(filtrado);
}

// ── Renderiza lista de alunos ─────────────────────────────
function _mbEBDRenderizar(lista) {
  var cont = document.getElementById('mb-ebd-lista');
  if (!cont) return;

  if (!lista.length) {
    cont.innerHTML =
      '<div style="text-align:center;padding:48px 0;color:var(--text-muted)">' +
        '<div style="font-size:32px;margin-bottom:12px">🎓</div>' +
        '<div style="font-size:14px;font-weight:600;color:var(--text)">Nenhum aluno encontrado</div>' +
        '<div style="font-size:12px;margin-top:4px">Alunos já cadastrados como membros não aparecem aqui.</div>' +
      '</div>';
    return;
  }

  cont.innerHTML = lista.map(function(a) {
    var turma = a._turma || '';
    var nasc  = _mbEBDFormatarData(a.DataNasc); // já formatada dd/mm/aaaa
    var tel   = a.Celular || '';
    var partes = [turma, nasc ? '📅 ' + nasc : '', tel ? '📱 ' + tel : ''].filter(Boolean);
    return '<div onclick="_mbEBDSelecionar(\'' + _mbEsc(a.ID) + '\')" ' +
      'class="ed-list-item" ' +
      'style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:13px 14px;border-radius:12px;cursor:pointer;margin-bottom:6px;' +
      'border:1.5px solid var(--border);background:var(--glass-bg-premium);' +
      'transition:border-color .15s,transform .1s" ' +
      'onmouseover="this.style.borderColor=\'var(--teal)\';this.style.transform=\'translateX(2px)\'" ' +
      'onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'">' +
        '<div style="min-width:0">' +
          '<div style="font-weight:700;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            _mbEsc(a.Nome) +
          '</div>' +
          (partes.length
            ? '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              partes.join(' · ') + '</div>'
            : '') +
        '</div>' +
        '<i data-lucide="chevron-right" style="width:15px;height:15px;color:var(--text-dim);flex-shrink:0;margin-left:8px"></i>' +
      '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ── Seleciona aluno e pré-preenche o formulário ───────────
function _mbEBDSelecionar(alunoId) {
  var aluno = MB_EBD.lista.find(function(a) { return String(a.ID) === String(alunoId); });
  if (!aluno) return;

  // Mapeamento EBD → campos do formulário de membros
  var map = {
    'mbf-nome':       aluno.Nome       || '',
    'mbf-nascimento': _mbEBDFormatarData(aluno.DataNasc),
    'mbf-celular':    aluno.Celular    || '',
    'mbf-email':      aluno.Email      || '',
    'mbf-sexo':       aluno.Sexo       || ''
  };

  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (!el || !map[id]) return;
    el.value = map[id];
    // Limpa erro visual se campo estava marcado
    var fld = el.closest && el.closest('.field');
    if (fld) fld.classList.remove('has-error');
    var err = document.getElementById(id.replace('mbf-','mbfe-'));
    if (err) err.style.display = 'none';
  });

  mbEBDFechar();
  showToast('Dados importados! Complete os campos restantes.', 'success');

  // Scroll para o topo do formulário
  var form = document.getElementById('mb-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Normaliza DataNasc da EBD para dd/mm/aaaa ─────────────
function _mbEBDFormatarData(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    // Já dd/mm/aaaa
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val.trim())) return val.trim();
    // ISO aaaa-mm-dd
    var iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  }
  if (val instanceof Date || (val && val.getDate)) {
    var d = new Date(val);
    if (!isNaN(d)) {
      return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
    }
  }
  return '';
}
