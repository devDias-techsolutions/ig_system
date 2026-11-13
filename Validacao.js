// ═══════════════════════════════════════════════════════════
//  Validação do cartão de membro por QR Code
//
//  • A secretaria emite o cartão com QR (opcional): cada emissão cria um CÓDIGO aleatório
//    na aba "Credenciais" e revoga os códigos anteriores do mesmo membro (cartão perdido = cartão novo).
//  • O QR abre uma página PÚBLICA (?page=validar&codigo=CÓDIGO) que mostra só: igreja, nome, função e situação.
//    A situação é lida na planilha NA HORA — inativar o membro invalida o cartão no mesmo instante.
//
//  Segurança:
//    – código de 32 hex (128 bits), não é ROL nem nome: não dá para adivinhar nem listar;
//    – "código inválido" e "código inexistente" respondem igual (sem pista para quem tenta adivinhar);
//    – limites de consulta (por código, por minuto no total e por minuto de códigos inválidos);
//    – a página não expõe CPF, RG, telefone, endereço, foto nem qualquer outro dado.
// ═══════════════════════════════════════════════════════════
var Validacao = (function () {

  var ABA = 'Credenciais';
  var HEADERS = ['Codigo', 'MembroId', 'Emitida', 'EmitidoPor', 'Status'];
  var LIMITES = { totalPorMin: 120, invalidosPorMin: 15, porCodigoHora: 30 };

  function _sheet() {
    var ss = getSSInstance();
    var sh = ss.getSheetByName(ABA);
    if (!sh) {   // instalações antigas: cria a aba na primeira emissão
      sh = ss.insertSheet(ABA);
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function _codigoNovo() {
    return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32).toLowerCase();
  }

  // ── Emissão (só usuário autenticado) ──────────────────────
  function emitir(token, membroId) {
    return withAuth(token, function (sess) {
      if (!membroId) return Util.err('Selecione o membro.');
      var m = Util.sheetToObjects('Membros').filter(function (r) { return String(r.id) === String(membroId); })[0];
      if (!m) return Util.err('Membro não encontrado.');
      if (!_ativo(m.ativo)) return Util.err('Só membros ativos recebem cartão com QR Code.');

      // O QR precisa apontar para o link público (/exec). Sem ele, o código nem é gerado:
      // um QR com o link de teste (/dev) só abriria para o dono e mostraria "Não foi possível abrir o arquivo".
      var base = Config.urlApp();
      if (!base) {
        return Util.err('Não foi possível descobrir o link público do sistema (o endereço atual não termina em /exec). ' +
          'Abra o sistema pelo link da implantação ou preencha a chave URL_APP na aba Config com a "URL do app da Web".');
      }

      var sh = _sheet(), v = sh.getDataRange().getValues();
      for (var i = 1; i < v.length; i++) {            // revoga os anteriores deste membro
        if (String(v[i][1]) === String(membroId) && v[i][4] === 'ativa') sh.getRange(i + 1, 5).setValue('revogada');
      }
      var codigo = _codigoNovo();
      sh.appendRow([codigo, String(membroId), Util.now(), sess.nome || sess.email || '', 'ativa']);
      var url = base + '?page=validar&codigo=' + codigo;
      return Util.ok({ codigo: codigo, url: url });
    });
  }

  function _ativo(v) { return v === true || v === 1 || ['TRUE', '1', 'SIM'].indexOf(String(v).trim().toUpperCase()) !== -1; }

  // ── Limites de uso (contadores no cache do script) ────────
  function _contar(chave, ttl) {
    var c = CacheService.getScriptCache();
    var n = Number(c.get(chave) || 0) + 1;
    c.put(chave, String(n), ttl);
    return n;
  }
  function _balde(seg) { return Math.floor(Date.now() / (seg * 1000)); }

  // ── Consulta pública ──────────────────────────────────────
  // Devolve só o necessário: { estado, nome, funcao, emitida }
  //   estado: ativo | inativo | cancelado | nao_encontrado | limite
  function consultar(codigo) {
    codigo = String(codigo || '').toLowerCase();
    if (_contar('vg:' + _balde(60), 120) > LIMITES.totalPorMin) return { estado: 'limite' };

    var invalido = function () {
      return _contar('vi:' + _balde(60), 120) > LIMITES.invalidosPorMin ? { estado: 'limite' } : { estado: 'nao_encontrado' };
    };
    if (!/^[0-9a-f]{32}$/.test(codigo)) return invalido();
    if (_contar('vc:' + codigo + ':' + _balde(3600), 3700) > LIMITES.porCodigoHora) return { estado: 'limite' };

    var v = _sheet().getDataRange().getValues(), cred = null;
    for (var i = 1; i < v.length; i++) { if (String(v[i][0]) === codigo) { cred = v[i]; break; } }
    if (!cred) return invalido();

    var m = Util.sheetToObjects('Membros').filter(function (r) { return String(r.id) === String(cred[1]); })[0];
    if (!m || cred[4] !== 'ativa') {
      return { estado: 'cancelado', nome: m ? String(m.nome || '') : '', funcao: '', emitida: _dia(cred[2]) };
    }
    return { estado: _ativo(m.ativo) ? 'ativo' : 'inativo', nome: String(m.nome || ''), funcao: String(m.funcao || ''), emitida: _dia(cred[2]) };
  }
  function _dia(v) { return String(v instanceof Date ? Utilities.formatDate(v, 'America/Sao_Paulo', 'dd/MM/yyyy') : v).slice(0, 10); }

  // ── Página pública ────────────────────────────────────────
  var TEXTOS = {
    ativo:          { titulo: 'Membro ativo',        msg: 'Cartão válido. A pessoa consta como membro desta igreja.' },
    inativo:        { titulo: 'Cartão inativo',       msg: 'Este cartão não está mais em vigor. A pessoa não consta como membro ativo.' },
    cancelado:      { titulo: 'Cartão cancelado',    msg: 'Este cartão foi cancelado ou substituído por outro mais recente.' },
    nao_encontrado: { titulo: 'Cartão não reconhecido', msg: 'Não encontramos este cartão. Pode ser falso ou ter sido digitado errado.' },
    limite:         { titulo: 'Muitas consultas',    msg: 'Tente novamente em alguns minutos.' }
  };

  // Logo na página pública: link do Drive não carrega de forma confiável para quem não está logado,
  // então o servidor lê o arquivo e embute a imagem (data:). Se não der, devolve '' e a página usa as iniciais.
  function _logoEmbutido(url) {
    url = String(url || '');
    if (!url) return '';
    // O Apps Script bloqueia 'data:' em <?= ?> dentro de src; por isso a página imprime com <?!= ?>
    // e aqui só passa o que é comprovadamente imagem em base64 ou https simples.
    if (url.indexOf('data:image/') === 0) {
      return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/]+={0,2}$/.test(url) ? url : '';
    }
    var m = /drive\.google\.com\/uc\?export=view&id=([\w-]{10,})/.exec(url);
    if (!m) return /^https:\/\/[^\s"'<>]+$/.test(url) ? url : '';   // https direto (ex.: GitHub raw)
    try {
      var blob = DriveApp.getFileById(m[1]).getBlob();
      if (blob.getBytes().length > 1500000) return '';   // grande demais para embutir
      if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.getContentType())) return '';
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) { return ''; }
  }

  // Qualquer falha vira uma página simples com o motivo (em vez da tela "Não foi possível abrir o arquivo" do Google).
  function pagina(codigo) {
    try { return _renderizar(codigo); }
    catch (e) {
      return HtmlService.createHtmlOutput(
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<body style="font-family:sans-serif;padding:24px"><h3>Não foi possível validar o cartão agora</h3>' +
        '<p>Tente novamente em instantes. Se persistir, avise a secretaria.</p>' +
        '<p style="color:#888;font-size:12px">Detalhe técnico: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p></body>'
      ).setTitle('Validação do cartão');
    }
  }

  function _renderizar(codigo) {
    var r = consultar(codigo), idt = Config.identidade(), t = TEXTOS[r.estado] || TEXTOS.nao_encontrado;
    var tmpl = HtmlService.createTemplateFromFile('validar');
    tmpl.d = {
      estado: r.estado, titulo: t.titulo, msg: t.msg,
      nome: r.nome || '', funcao: r.funcao || '', emitida: r.emitida || '',
      igreja: idt.nome, lema: idt.lema || '', logo: _logoEmbutido(idt.logoUrl),
      cor: idt.corPrimaria || '#0a4a8a',
      iniciais: String(idt.nome || '?').split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 3).toUpperCase(),
      agora: Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm")
    };
    return tmpl.evaluate()
      .setTitle('Validação do cartão · ' + idt.nome)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return { emitir: emitir, consultar: consultar, pagina: pagina, HEADERS: HEADERS, ABA: ABA, LIMITES: LIMITES };
})();

function mb_emitirCredencial(token, membroId) {
  try { return Validacao.emitir(token, membroId); }
  catch (e) { return { success: false, error: 'Erro ao emitir o QR Code: ' + (e && e.message || e) }; }
}
