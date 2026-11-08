// ═══════════════════════════════════════════════════════════
//  Imagens.gs · Logo, marca d'água e assinatura da igreja
//
//  Enviadas pela tela Identidade (só admin) e guardadas na aba "Imagens"
//  da própria planilha, em base64 dividido em partes (limite de 50.000
//  caracteres por célula). Vantagens: não dependem de Drive nem de links
//  externos, e copiar a planilha leva as imagens junto.
//  O tipo do arquivo é descoberto pelos primeiros bytes (PNG/JPEG/WebP),
//  nunca pelo que o navegador informa; SVG não é aceito (pode conter script).
// ═══════════════════════════════════════════════════════════

var Imagens = (function () {

  var TIPOS = ['logo', 'marcaDagua', 'assinatura'];
  var MAX_BYTES = 100000;   // imagem já reduzida pelo navegador; 100 KB cabem nas 3 partes
  var PARTE = 45000;        // caracteres por célula (limite do Sheets: 50.000)

  function _tipoValido(tipo) { return TIPOS.indexOf(tipo) !== -1; }

  function _linha(tipo) {
    try {
      var rows = Util.sheetToObjects('Imagens');
      for (var i = 0; i < rows.length; i++) if (String(rows[i].Tipo) === tipo) return rows[i];
    } catch (e) { /* planilha ainda sem a aba: sem imagem */ }
    return null;
  }

  // 'data:image/png;base64,...' ou '' se não houver imagem
  function dataUri(tipo) {
    var r = _linha(tipo);
    if (!r || !r.Dados1) return '';
    return 'data:' + r.Mime + ';base64,' + r.Dados1 + (r.Dados2 || '') + (r.Dados3 || '');
  }

  function _mimePorBytes(b) {
    function x(i) { return b[i] & 255; }
    if (b.length > 8 && x(0) === 0x89 && x(1) === 0x50 && x(2) === 0x4E && x(3) === 0x47) return 'image/png';
    if (b.length > 3 && x(0) === 0xFF && x(1) === 0xD8 && x(2) === 0xFF) return 'image/jpeg';
    if (b.length > 12 && x(0) === 0x52 && x(1) === 0x49 && x(2) === 0x46 && x(3) === 0x46 && x(8) === 0x57 && x(9) === 0x45 && x(10) === 0x42 && x(11) === 0x50) return 'image/webp';
    return '';
  }

  function _gravar(tipo, mime, b64) {
    var dados = { Tipo: tipo, Mime: mime, Dados1: b64.slice(0, PARTE), Dados2: b64.slice(PARTE, 2 * PARTE), Dados3: b64.slice(2 * PARTE), AtualizadoEm: Util.now() };
    var r = _linha(tipo);
    if (r) Util.updateRow('Imagens', r._rowIndex, dados); else Util.insertRow('Imagens', dados);
  }

  function salvar(tipo, base64) {
    if (!_tipoValido(tipo)) throw new Error('Tipo de imagem inválido.');
    var b64 = String(base64 || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) throw new Error('Imagem inválida.');
    var bytes = Utilities.base64Decode(b64);
    if (bytes.length > MAX_BYTES) throw new Error('Imagem muito grande (máximo ' + Math.round(MAX_BYTES / 1000) + ' KB).');
    var mime = _mimePorBytes(bytes);
    if (!mime) throw new Error('Formato não aceito. Envie PNG, JPG ou WebP.');
    _gravar(tipo, mime, b64);
    return dataUri(tipo);
  }

  function remover(tipo) {
    if (!_tipoValido(tipo)) throw new Error('Tipo de imagem inválido.');
    var r = _linha(tipo);
    if (r) Util.updateRow('Imagens', r._rowIndex, { Tipo: tipo, Mime: '', Dados1: '', Dados2: '', Dados3: '', AtualizadoEm: Util.now() });
  }

  return { salvar: salvar, remover: remover, dataUri: dataUri, tipos: TIPOS, maxBytes: MAX_BYTES };
})();

// ── Endpoints (google.script.run) ─────────────────────────────

function _idtAdmin(token, fn) {
  return withAuth(token, function (sess) {
    if (sess.perfil !== 'admin') return Util.err('Apenas o administrador pode alterar a identidade da igreja.');
    return fn(sess);
  });
}

// Qualquer usuário logado: identidade completa (inclui a assinatura, que não vai na página de login)
function idt_obter(token) {
  return withAuth(token, function () { return Util.ok(Config.identidadeCompleta()); });
}

function idt_enviarImagem(token, tipo, base64) {
  return _idtAdmin(token, function () {
    try { Imagens.salvar(tipo, base64); } catch (e) { return Util.err(e.message); }
    return Util.ok(Config.identidadeCompleta());
  });
}

function idt_removerImagem(token, tipo) {
  return _idtAdmin(token, function () {
    try { Imagens.remover(tipo); } catch (e) { return Util.err(e.message); }
    return Util.ok(Config.identidadeCompleta());
  });
}
