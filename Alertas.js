// ═══════════════════════════════════════════════════════════
//  Alertas.gs · Alertas automáticos por e-mail (aniversariantes)
//
//  Serviço do núcleo: funciona só com Membros. Outros módulos entram como "fontes de
//  pessoas" ao registrar um objeto em __ALERTAS_FONTES__ (como os manifestos de módulo):
//    { id, nome, descricao, disponivel(), pessoas(), responsaveis()? , responsaveisRotulo?, responsaveisSub? }
//  pessoas() → [{ nome, nascimento, detalhe, grupo, papel, doGrupo, cobrarData }] só de ativos.
//  responsaveis() → [{ nome, email, grupo }]: quem pode receber os aniversários do próprio grupo.
//
//  Configuração: Propriedades do script (chave ALERTAS_CONFIG), editada na tela
//  Alertas (só admin). Ligar o envio automático cria os dois agendamentos:
//    · diário  — aniversariantes do dia, por volta das 8h (só envia se houver)
//    · semanal — resumo dos próximos 7 dias, segunda-feira por volta das 7h
//  Desligar remove os agendamentos. Datas são lidas por dia/mês, sem fuso:
//  evita o aviso um dia antes que acontece ao converter "dd/mm/aaaa" em Date.
// ═══════════════════════════════════════════════════════════

var Alertas = (function () {

  var CHAVE = 'ALERTAS_CONFIG';
  var MAX_DEST = 20;
  var MAX_NOMES_AVISO = 30;
  var H_DIARIO = 8, H_SEMANAL = 7;
  var H_DIARIO_FN = 'alertas_rodarDiario', H_SEMANAL_FN = 'alertas_rodarSemanal';
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

  // ── Configuração ─────────────────────────────────────────
  function _padrao() {
    return { ativo: false, fontes: {}, responsaveis: false, semNasc: false, destinatarios: [] };
  }

  function _bool(v, def) { return v === undefined || v === null ? def : (v === true || v === 'true' || v === 1); }

  function _destinatarios(lista, legado) {
    var vistos = {}, saida = [];
    (Array.isArray(lista) ? lista : []).forEach(function (d) {
      if (!d || saida.length >= MAX_DEST) return;
      var email = String(d.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || vistos[email]) return;
      vistos[email] = true;
      saida.push({
        nome: String(d.nome || '').trim().slice(0, 60),
        email: email,
        dia: legado ? _bool(d.alertaDia, true) : _bool(d.dia, true),
        semana: legado ? _bool(d.alertaSemana, true) : _bool(d.semana, true)
      });
    });
    return saida;
  }

  // Aceita o formato antigo (email_ativo, alerta_dia…) e devolve sempre o formato atual.
  // Fonte sem escolha salva vale "ligada"; ids guardados de módulos removidos são descartados.
  function _normalizar(raw) {
    var p = _padrao(), ids = _fontes().map(function (f) { return f.id; });
    var legado = !!raw && typeof raw === 'object' && raw.email_ativo !== undefined && raw.ativo === undefined;
    var salvas = (raw && raw.fontes && typeof raw.fontes === 'object') ? raw.fontes : {};
    if (raw && typeof raw === 'object') {
      if (legado) {
        p.ativo = _bool(raw.email_ativo, false);
        p.responsaveis = _bool(raw.alerta_dia, false);
        p.semNasc = _bool(raw.alerta_sem_nasc, false);
        salvas = { membros: raw.alerta_membros !== false };
      } else {
        p.ativo = _bool(raw.ativo, false);
        p.responsaveis = _bool(raw.responsaveis, false);
        p.semNasc = _bool(raw.semNasc, false);
      }
      p.destinatarios = _destinatarios(raw.destinatarios, legado);
    }
    ids.forEach(function (id) { p.fontes[id] = _bool(salvas[id], true); });
    return p;
  }

  function _ler() {
    try {
      var s = PropertiesService.getScriptProperties().getProperty(CHAVE);
      return _normalizar(s ? JSON.parse(s) : null);
    } catch (e) { return _normalizar(null); }
  }

  function _gravar(cfg) {
    PropertiesService.getScriptProperties().setProperty(CHAVE, JSON.stringify(cfg));
  }

  // ── Fontes de pessoas ────────────────────────────────────
  function _aba(nome) {
    try { return Util.sheetToObjects(nome); } catch (e) { return null; }   // null = a aba não existe
  }

  function _ativo(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v === null || v === undefined) return false;
    var s = String(v).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'SIM';
  }

  var FONTE_MEMBROS = {
    id: 'membros', nome: 'Membros', descricao: 'Aniversariantes da lista de membros ativos.',
    disponivel: function () { return _aba('Membros') !== null; },
    pessoas: function () {
      return (_aba('Membros') || []).filter(function (m) { return _ativo(m.ativo); })
        .map(function (m) { return { nome: String(m.nome || ''), nascimento: m.nascimento, detalhe: '', grupo: '', papel: '', doGrupo: false, cobrarData: true }; });
    }
  };

  function _fontes() {
    var extras = (typeof __ALERTAS_FONTES__ !== 'undefined' && Array.isArray(__ALERTAS_FONTES__)) ? __ALERTAS_FONTES__ : [];
    return [FONTE_MEMBROS].concat(extras);
  }

  function _fontesAtivas(cfg) {
    return _fontes().filter(function (f) {
      var ok = false;
      try { ok = !!f.disponivel(); } catch (e) { ok = false; }
      return ok && cfg.fontes[f.id] !== false;
    });
  }

  function _fonteResponsaveis() {
    return _fontes().filter(function (f) { return typeof f.responsaveis === 'function'; })[0] || null;
  }

  // ── Datas ────────────────────────────────────────────────
  // Dia e mês do nascimento, sem passar por fuso horário. null se não houver data legível
  function _diaMes(v) {
    if (v === null || v === undefined || v === '') return null;
    var d, m;
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (isNaN(v.getTime())) return null;
      d = v.getDate(); m = v.getMonth() + 1;
    } else {
      var s = String(v).trim(), r;
      if ((r = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) { d = +r[3]; m = +r[2]; }
      else if ((r = /^(\d{1,2})\/(\d{1,2})(\/\d{2,4})?$/.exec(s))) { d = +r[1]; m = +r[2]; }
      else return null;
    }
    return (m >= 1 && m <= 12 && d >= 1 && d <= 31) ? { d: d, m: m } : null;
  }

  function _faz(v, ref) {
    var dm = _diaMes(v);
    return !!dm && dm.d === ref.getDate() && dm.m === ref.getMonth() + 1;
  }

  function _igreja() {
    try { return String(Config.identidade().nome || 'Igreja'); } catch (e) { return 'Igreja'; }
  }

  function _esc(t) {
    return String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _dd(n) { return ('0' + n).slice(-2); }

  function _rotulo(ref, hoje) {
    var dm = _dd(ref.getDate()) + '/' + _dd(ref.getMonth() + 1);
    return ref.getTime() === hoje.getTime() ? 'Hoje · ' + dm : DIAS[ref.getDay()] + ' ' + dm;
  }

  // Pessoas das fontes ligadas e quem faz aniversário em cada um dos `dias` dias a partir de `inicio`
  function _levantar(cfg, inicio, dias) {
    var hoje = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    var fontes = _fontesAtivas(cfg).map(function (f) {
      var gente = [];
      try { gente = f.pessoas() || []; } catch (e) { Logger.log('[Alertas] Fonte ' + f.id + ': ' + e.message); }
      return { id: f.id, nome: f.nome, pessoas: gente };
    });
    var lista = [];
    for (var i = 0; i < dias; i++) {
      var ref = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
      lista.push({
        rotulo: _rotulo(ref, hoje),
        fontes: fontes.map(function (f) { return { id: f.id, nome: f.nome, pessoas: f.pessoas.filter(function (p) { return _faz(p.nascimento, ref); }) }; })
      });
    }
    return { dias: lista, fontes: fontes };
  }

  // ── Texto do e-mail ──────────────────────────────────────
  function _secaoHtml(titulo, itens, vazio) {
    return '<h3 style="margin:18px 0 6px;font-size:14px;color:#1f2937">' + _esc(titulo) + '</h3>' +
      (itens.length
        ? '<ul style="margin:0;padding-left:20px;color:#374151;line-height:1.7">' + itens.map(function (t) { return '<li>' + _esc(t) + '</li>'; }).join('') + '</ul>'
        : '<p style="margin:0;color:#6b7280;font-size:13px">' + _esc(vazio) + '</p>');
  }

  function _moldura(titulo, corpo) {
    return '<meta charset="UTF-8"><div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:8px">' +
      '<p style="margin:0 0 2px;font-size:12px;color:#6b7280">' + _esc(_igreja()) + '</p>' +
      '<h2 style="margin:0 0 6px;font-size:18px;color:#111827">' + _esc(titulo) + '</h2>' + corpo + '</div>';
  }

  function _linhas(itens) {
    return itens.map(function (t) { return '  - ' + t; }).join('\n');
  }

  function _nomeItem(p, rotulo) {
    return (rotulo ? rotulo + ' — ' : '') + p.nome + (p.papel && p.papel !== 'aluno' ? ' (' + p.papel + ')' : '') + (p.detalhe ? ' · ' + p.detalhe : '');
  }

  // Uma seção por fonte: [{ nome, itens }]
  function _secoes(dados, comRotulo) {
    return dados.fontes.map(function (f, n) {
      var itens = [];
      dados.dias.forEach(function (d) { d.fontes[n].pessoas.forEach(function (p) { itens.push(_nomeItem(p, comRotulo ? d.rotulo : '')); }); });
      return { nome: f.nome, itens: itens };
    });
  }

  function _semData(cfg, dados) {
    var itens = [];
    if (!cfg.semNasc) return itens;
    dados.fontes.forEach(function (f) {
      f.pessoas.filter(function (p) { return p.cobrarData && !_diaMes(p.nascimento); })
        .forEach(function (p) { itens.push(f.nome + ': ' + p.nome + (p.detalhe ? ' · ' + p.detalhe : '')); });
    });
    return itens.length > MAX_NOMES_AVISO ? itens.slice(0, MAX_NOMES_AVISO).concat(['… e mais ' + (itens.length - MAX_NOMES_AVISO)]) : itens;
  }

  function _enviar(email, assunto, plain, html) {
    if (!EMAIL_RE.test(String(email || ''))) return false;
    try {
      GmailApp.sendEmail(email, assunto, plain, { htmlBody: html, name: _igreja() });
      return true;
    } catch (e) {
      Logger.log('[Alertas] Falha ao enviar para ' + email + ': ' + e.message);
      return false;
    }
  }

  function _contar(r, ok) { if (ok) r.enviados++; else r.falhas++; }

  function _total(secoes) { return secoes.reduce(function (n, s) { return n + s.itens.length; }, 0); }

  function _primeiroNome(n) { return String(n || '').split(' ')[0]; }

  // Aviso aos responsáveis: cada um recebe só os aniversários do próprio grupo
  function _paraResponsaveis(cfg, dados, r, titulo, quando) {
    var fonte = _fonteResponsaveis();
    if (!cfg.responsaveis || !fonte || cfg.fontes[fonte.id] === false) return;
    var resp = [];
    try { resp = fonte.responsaveis() || []; } catch (e) { Logger.log('[Alertas] Responsáveis: ' + e.message); }
    var n = dados.fontes.map(function (f) { return f.id; }).indexOf(fonte.id);
    if (n < 0) return;
    resp.filter(function (x) { return EMAIL_RE.test(String(x.email || '').trim()); }).forEach(function (x) {
      var linhas = [];
      dados.dias.forEach(function (d) {
        d.fontes[n].pessoas.filter(function (p) { return p.doGrupo && String(p.grupo) === String(x.grupo); })
          .forEach(function (p) { linhas.push((dados.dias.length > 1 ? d.rotulo + ' — ' : '') + p.nome); });
      });
      if (!linhas.length) return;
      var oi = 'Olá, ' + _primeiroNome(x.nome) + '! ' + quando;
      _contar(r, _enviar(String(x.email).trim(), _igreja() + ' — ' + titulo, oi + '\n' + _linhas(linhas),
        _moldura(titulo, '<p style="color:#374151">' + _esc(oi) + '</p><ul style="color:#374151;line-height:1.7">' + linhas.map(function (t) { return '<li>' + _esc(t) + '</li>'; }).join('') + '</ul>')));
    });
  }

  // ── Envios ───────────────────────────────────────────────
  function enviarDiario(cfg) {
    var r = { enviados: 0, falhas: 0, aniversariantes: 0 };
    var dados = _levantar(cfg, new Date(), 1), secoes = _secoes(dados, false);
    r.aniversariantes = _total(secoes);
    if (!r.aniversariantes) return r;

    var assunto = _igreja() + ' — Aniversariantes de hoje';
    var plain = assunto + '\n' + secoes.map(function (s) { return '\n' + s.nome + ':\n' + (s.itens.length ? _linhas(s.itens) : '  Nenhum hoje.'); }).join('');
    var html = _moldura('Aniversariantes de hoje', secoes.map(function (s) { return _secaoHtml(s.nome, s.itens, 'Nenhum hoje.'); }).join(''));
    cfg.destinatarios.filter(function (d) { return d.dia; }).forEach(function (d) { _contar(r, _enviar(d.email, assunto, plain, html)); });
    _paraResponsaveis(cfg, dados, r, 'Aniversário na sua turma', 'Hoje é aniversário no seu grupo:');
    return r;
  }

  function enviarSemanal(cfg) {
    var r = { enviados: 0, falhas: 0, aniversariantes: 0 };
    var dados = _levantar(cfg, new Date(), 7), secoes = _secoes(dados, true), faltam = _semData(cfg, dados);
    r.aniversariantes = _total(secoes);

    var assunto = _igreja() + ' — Aniversariantes da semana';
    var plain = assunto + '\n' + secoes.map(function (s) { return '\n' + s.nome + ':\n' + (s.itens.length ? _linhas(s.itens) : '  Nenhum nesta semana.'); }).join('') +
      (faltam.length ? '\n\nSem data de nascimento cadastrada:\n' + _linhas(faltam) : '');
    var html = _moldura('Aniversariantes da semana', secoes.map(function (s) { return _secaoHtml(s.nome, s.itens, 'Nenhum nesta semana.'); }).join('') +
      (faltam.length ? _secaoHtml('Sem data de nascimento cadastrada', faltam, '') : ''));
    cfg.destinatarios.filter(function (d) { return d.semana; }).forEach(function (d) { _contar(r, _enviar(d.email, assunto, plain, html)); });
    _paraResponsaveis(cfg, dados, r, 'Aniversários da sua turma', 'Aniversários no seu grupo nesta semana:');
    return r;
  }

  // ── Agendamentos ─────────────────────────────────────────
  function _gatilhos() {
    try { return ScriptApp.getProjectTriggers(); } catch (e) { return null; }
  }

  function _nosso(t) {
    var fn = t.getHandlerFunction();
    if (fn === H_DIARIO_FN || fn === H_SEMANAL_FN) return true;
    // acionadores criados antes da tela, declarados pelo módulo que os criou
    return _fontes().some(function (f) { return (f.gatilhosAntigos || []).indexOf(fn) !== -1; });
  }

  function _agendamentos() {
    var g = _gatilhos();
    if (g === null) return { ok: false, diario: false, semanal: false };
    var fns = g.map(function (t) { return t.getHandlerFunction(); });
    return { ok: true, diario: fns.indexOf(H_DIARIO_FN) !== -1, semanal: fns.indexOf(H_SEMANAL_FN) !== -1 };
  }

  function _remover() {
    (_gatilhos() || []).forEach(function (t) { if (_nosso(t)) ScriptApp.deleteTrigger(t); });
  }

  function _criar() {
    _remover();
    ScriptApp.newTrigger(H_SEMANAL_FN).timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(H_SEMANAL).create();
    ScriptApp.newTrigger(H_DIARIO_FN).timeBased().everyDays(1).atHour(H_DIARIO).create();
  }

  // ── Telas (retorno para google.script.run) ───────────────
  function _remetente() {
    try {
      var u = (typeof Session.getEffectiveUser === 'function') ? Session.getEffectiveUser() : Session.getActiveUser();
      return String(u.getEmail() || '');
    } catch (e) { return ''; }
  }

  function _cota() {
    try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; }
  }

  function obter() {
    var resp = _fonteResponsaveis();
    return {
      config: _ler(),
      agendamentos: _agendamentos(),
      fontes: _fontes().map(function (f) {
        var ok = false;
        try { ok = !!f.disponivel(); } catch (e) { ok = false; }
        return { id: f.id, nome: f.nome, descricao: f.descricao || '', disponivel: ok };
      }),
      responsaveis: resp ? { rotulo: resp.responsaveisRotulo || 'Avisar os responsáveis', sub: resp.responsaveisSub || '' } : null,
      horarios: { diario: H_DIARIO, semanal: H_SEMANAL },
      remetente: _remetente(),
      cota: _cota()
    };
  }

  function _validar(dados) {
    var cfg = _normalizar(dados && typeof dados === 'object' ? dados : null);
    var bruto = (dados && Array.isArray(dados.destinatarios)) ? dados.destinatarios : [];
    var invalido = bruto.filter(function (d) { return d && String(d.email || '').trim() && !EMAIL_RE.test(String(d.email).trim().toLowerCase()); })[0];
    if (invalido) return { erro: 'O e-mail "' + String(invalido.email).trim().slice(0, 60) + '" não é válido.' };
    if (bruto.length > MAX_DEST) return { erro: 'No máximo ' + MAX_DEST + ' destinatários.' };
    if (cfg.ativo && !cfg.destinatarios.length && !cfg.responsaveis) return { erro: 'Adicione pelo menos um destinatário (ou ligue o aviso aos responsáveis) antes de ativar.' };
    if (cfg.ativo && !_fontesAtivas(cfg).length) return { erro: 'Ligue pelo menos uma fonte em "O que entra nos e-mails".' };
    return { cfg: cfg };
  }

  function salvar(dados) {
    var v = _validar(dados);
    if (v.erro) return { erro: v.erro };
    var cfg = v.cfg, aviso = '';
    try {
      if (cfg.ativo) _criar(); else _remover();
    } catch (e) {
      Logger.log('[Alertas] Agendamento: ' + e.message);
      cfg.ativo = false;
      _gravar(cfg);
      return { erro: 'Não foi possível criar os agendamentos (' + e.message + '). Autorize o script a gerenciar acionadores e tente de novo. Suas escolhas foram salvas com o envio desligado.' };
    }
    _gravar(cfg);
    return { dados: obter(), aviso: aviso };
  }

  function testar(email) {
    if (!EMAIL_RE.test(String(email || ''))) return { erro: 'Sua conta não tem um e-mail válido para receber o teste.' };
    var txt = 'Este é um e-mail de teste dos alertas de ' + _igreja() + '.\nSe você o recebeu, o envio está funcionando.';
    var ok = _enviar(email, '[Teste] Alertas de ' + _igreja(), txt,
      _moldura('E-mail de teste', '<p style="color:#374151">Se você recebeu esta mensagem, o envio de alertas está funcionando.</p>'));
    return ok ? { enviado: email } : { erro: 'Não foi possível enviar. Confira se o script tem permissão para enviar e-mails e se a cota do dia não acabou.' };
  }

  function enviarAgora(tipo) {
    var cfg = _ler();
    if (tipo !== 'dia' && tipo !== 'semana') return { erro: 'Tipo de envio inválido.' };
    if (!cfg.destinatarios.length && !cfg.responsaveis) return { erro: 'Salve pelo menos um destinatário antes de enviar.' };
    var r = tipo === 'dia' ? enviarDiario(cfg) : enviarSemanal(cfg);
    if (tipo === 'dia' && !r.aniversariantes) return { dados: r, aviso: 'Ninguém faz aniversário hoje. Nenhum e-mail foi enviado.' };
    if (!r.enviados && r.falhas) return { erro: 'Nenhum e-mail foi enviado. Confira a permissão de envio e a cota do dia.' };
    return { dados: r };
  }

  // Corpo dos acionadores
  function rodarDiario() {
    var cfg = _ler();
    if (!cfg.ativo) return;
    try { var r = enviarDiario(cfg); Logger.log('[Alertas] Diário: ' + JSON.stringify(r)); }
    catch (e) { Logger.log('[Alertas] Diário falhou: ' + e.message); }
  }
  function rodarSemanal() {
    var cfg = _ler();
    if (!cfg.ativo) return;
    try { var r = enviarSemanal(cfg); Logger.log('[Alertas] Semanal: ' + JSON.stringify(r)); }
    catch (e) { Logger.log('[Alertas] Semanal falhou: ' + e.message); }
  }

  return {
    obter: obter, salvar: salvar, testar: testar, enviarAgora: enviarAgora,
    rodarDiario: rodarDiario, rodarSemanal: rodarSemanal,
    _normalizar: _normalizar, _diaMes: _diaMes
  };
})();

// ── Endpoints (google.script.run) — só administrador ──────────

function _altAdmin(token, fn) {
  return withAuth(token, function (sess) {
    if (sess.perfil !== 'admin') return Util.err('Apenas o administrador gerencia os alertas.');
    return fn(sess);
  });
}

function _altResposta(r) {
  if (r.erro) return Util.err(r.erro);
  var out = Util.ok(r.dados);
  if (r.aviso) out.aviso = r.aviso;
  return out;
}

function alertas_obter(token)            { return _altAdmin(token, function () { return Util.ok(Alertas.obter()); }); }
function alertas_salvar(token, config)   { return _altAdmin(token, function () { return _altResposta(Alertas.salvar(config)); }); }
function alertas_enviarAgora(token, tipo){ return _altAdmin(token, function () { return _altResposta(Alertas.enviarAgora(tipo)); }); }
function alertas_testar(token) {
  return _altAdmin(token, function (sess) {
    var r = Alertas.testar(sess.email);
    return r.erro ? Util.err(r.erro) : Util.ok(r);
  });
}

// Acionadores (sem parâmetros)
function alertas_rodarDiario()   { Alertas.rodarDiario(); }
function alertas_rodarSemanal()  { Alertas.rodarSemanal(); }
