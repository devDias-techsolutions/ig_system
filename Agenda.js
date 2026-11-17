// ═══════════════════════════════════════════════════════════
//  Agenda.gs · Eventos programados da igreja (calendário do Início)
//
//  Serviço do núcleo: qualquer usuário logado vê a agenda; só admin e secretaria
//  criam, editam e cancelam. Cancelar é desativar (a linha fica na planilha).
//  Datas ficam como aaaa-mm-dd e horas como hh:mm; a planilha pode devolvê-las como Date,
//  então tudo passa por _data()/_hora() antes de sair.
// ═══════════════════════════════════════════════════════════

var Agenda = (function () {

  var ABA = 'Eventos';
  var MAX_LISTA = 300;
  var DIAS_ATRAS = 40; // mostra o mês corrente completo mesmo depois de passado

  function _dd(n) { return (n < 10 ? '0' : '') + n; }

  function _data(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.getFullYear() + '-' + _dd(v.getMonth() + 1) + '-' + _dd(v.getDate());
    var m = String(v === undefined || v === null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }

  function _dataValida(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) && Number(m[1]) >= 2000;
  }

  function _hora(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : _dd(v.getHours()) + ':' + _dd(v.getMinutes());
    var m = String(v === undefined || v === null ? '' : v).match(/^(\d{1,2}):(\d{2})/);
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? _dd(Number(m[1])) + ':' + m[2] : '';
  }

  function _ativo(v) { return !(v === false || String(v).toLowerCase() === 'false' || String(v) === '0'); }

  function _saida(r) {
    return { id: String(r.ID), titulo: String(r.Titulo || ''), data: _data(r.Data), hora: _hora(r.Hora), local: String(r.Local || ''), descricao: String(r.Descricao || '') };
  }

  // Instalações antigas ainda não têm a aba: cria só o que falta (não mexe nas abas existentes)
  function _garantirAba() {
    if (!getSSInstance().getSheetByName(ABA)) SetupSheets.createAllSheets();
  }

  function _hoje() { var n = new Date(); return n.getFullYear() + '-' + _dd(n.getMonth() + 1) + '-' + _dd(n.getDate()); }

  // Eventos de cerca de 40 dias atrás em diante, em ordem de data e hora
  function listar() {
    _garantirAba();
    var ref = new Date(); ref.setDate(ref.getDate() - DIAS_ATRAS);
    var corte = ref.getFullYear() + '-' + _dd(ref.getMonth() + 1) + '-' + _dd(ref.getDate());
    var itens = Util.sheetToObjects(ABA).filter(function (r) { return r.ID && _ativo(r.Ativo); })
      .map(_saida).filter(function (e) { return e.data && e.data >= corte; });
    itens.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0); });
    return { hoje: _hoje(), itens: itens.slice(0, MAX_LISTA) };
  }

  function _limpar(d) {
    d = d || {};
    var titulo = String(d.titulo || '').replace(/\s+/g, ' ').trim();
    var data = String(d.data || '').trim();
    var hora = String(d.hora || '').trim();
    var local = String(d.local || '').replace(/\s+/g, ' ').trim();
    var descricao = String(d.descricao || '').trim();
    if (!titulo) return { erro: 'Informe o nome do evento.' };
    if (titulo.length > 80) return { erro: 'O nome do evento pode ter até 80 caracteres.' };
    if (!_dataValida(data)) return { erro: 'Informe uma data válida.' };
    if (hora && !_hora(hora)) return { erro: 'Informe um horário válido (por exemplo, 19:30).' };
    if (local.length > 80) return { erro: 'O local pode ter até 80 caracteres.' };
    if (descricao.length > 300) return { erro: 'A descrição pode ter até 300 caracteres.' };
    return { titulo: titulo, data: data, hora: hora ? _hora(hora) : '', local: local, descricao: descricao };
  }

  function salvar(d, sess) {
    var v = _limpar(d);
    if (v.erro) return v;
    _garantirAba();
    var id = d && d.id ? String(d.id) : '';
    if (id) {
      var atual = Util.findById(ABA, id);
      if (!atual || !_ativo(atual.Ativo)) return { erro: 'Evento não encontrado.' };
      Util.updateRow(ABA, atual._rowIndex, {
        ID: atual.ID, Titulo: v.titulo, Data: v.data, Hora: v.hora, Local: v.local, Descricao: v.descricao,
        Ativo: true, CriadoPor: atual.CriadoPor, CriadoEm: atual.CriadoEm
      });
      return { id: id };
    }
    id = Util.uuid();
    Util.insertRow(ABA, {
      ID: id, Titulo: v.titulo, Data: v.data, Hora: v.hora, Local: v.local, Descricao: v.descricao,
      Ativo: true, CriadoPor: (sess && sess.email) || '', CriadoEm: Util.nowISO()
    });
    return { id: id };
  }

  function remover(id) {
    var atual = id ? Util.findById(ABA, String(id)) : null;
    if (!atual || !_ativo(atual.Ativo)) return { erro: 'Evento não encontrado.' };
    Util.updateRow(ABA, atual._rowIndex, {
      ID: atual.ID, Titulo: atual.Titulo, Data: atual.Data, Hora: atual.Hora, Local: atual.Local, Descricao: atual.Descricao,
      Ativo: false, CriadoPor: atual.CriadoPor, CriadoEm: atual.CriadoEm
    });
    return { id: String(id) };
  }

  return { listar: listar, salvar: salvar, remover: remover };
})();

// ── Endpoints (google.script.run) ───────────────────────────
function _agGestor(token, fn) {
  return withAuth(token, function (sess) {
    if (sess.perfil !== 'admin' && sess.perfil !== 'secretaria') return Util.err('Você não tem permissão para alterar a agenda.');
    return fn(sess);
  });
}
function _agResposta(r) { return r.erro ? Util.err(r.erro) : Util.ok(r); }

function ag_listar(token)      { return withAuth(token, function () { return Util.ok(Agenda.listar()); }); }
function ag_salvar(token, d)   { return _agGestor(token, function (sess) { return _agResposta(Agenda.salvar(d, sess)); }); }
function ag_remover(token, id) { return _agGestor(token, function () { return _agResposta(Agenda.remover(id)); }); }
