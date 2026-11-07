// ═══════════════════════════════════════════════════════════
//  Config.gs · Configurações da igreja (aba "Config")
//
//  É aqui que cada igreja é personalizada, SEM mexer em código:
//    NOME_IGREJA     nome completo
//    NOME_CURTO      nome curto (espaços pequenos)
//    LEMA_IGREJA     versículo ou lema exibido no cabeçalho da Home
//    COR_PRIMARIA    cor da marca no formato #RRGGBB (vazio = cor padrão)
//    LOGO_URL        link do logo (Drive ou https://...)
//    MODULOS_ATIVOS  ids dos módulos separados por vírgula (vazio = todos)
// ═══════════════════════════════════════════════════════════

var Config = (function () {

  var NOME_PADRAO = 'Minha Igreja';

  // Chaves criadas na aba Config (setupSpreadsheet) com a explicação para quem edita a planilha
  var CHAVES = [
    { Chave: 'NOME_IGREJA',    Valor: NOME_PADRAO, Descricao: 'Nome da igreja exibido na plataforma' },
    { Chave: 'NOME_CURTO',     Valor: '',          Descricao: 'Nome curto (opcional). Usado onde há pouco espaço' },
    { Chave: 'LEMA_IGREJA',    Valor: '',          Descricao: 'Versículo ou lema exibido no cabeçalho da tela inicial (opcional)' },
    { Chave: 'COR_PRIMARIA',   Valor: '',          Descricao: 'Cor da marca no formato #RRGGBB, ex.: #0F766E (vazio = cor padrão)' },
    { Chave: 'LOGO_URL',       Valor: '',          Descricao: 'Link do logo: compartilhamento do Google Drive (qualquer pessoa com o link) ou endereço https://. Vazio = iniciais da igreja' },
    { Chave: 'MODULOS_ATIVOS', Valor: '',          Descricao: 'Módulos liberados, separados por vírgula, ex.: membros. Vazio = todos os módulos instalados' }
  ];

  function _linhas() {
    // Antes do setup a aba não existe: nunca derruba a tela por isso
    try { return Util.sheetToObjects('Config'); } catch (e) { return []; }
  }

  // Valor da chave (texto sem espaços nas pontas) ou o padrão se não existir / estiver vazio
  function get(chave, padrao) {
    var rows = _linhas();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].Chave).trim() === chave) {
        var v = rows[i].Valor;
        v = (v === null || v === undefined) ? '' : String(v).trim();
        if (v !== '') return v;
        break;
      }
    }
    return padrao === undefined ? '' : padrao;
  }

  function _corValida(v) {
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '';
  }

  // Aceita link de compartilhamento do Drive (/d/ID ou ?id=ID) e converte para miniatura;
  // aceita https:// direto; qualquer outra coisa é ignorada (nunca http:, data:, javascript:).
  function _logoUrl(v) {
    v = String(v || '').trim();
    if (!v) return '';
    var drive = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{10,})/.exec(v);
    if (drive) return 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w256';
    return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : '';
  }

  // Dados de identidade usados pela tela (sempre válidos, mesmo sem Config)
  function identidade() {
    var nome = get('NOME_IGREJA', NOME_PADRAO);
    return {
      nome:        nome,
      nomeCurto:   get('NOME_CURTO', '') || nome,
      lema:        get('LEMA_IGREJA', ''),
      corPrimaria: _corValida(get('COR_PRIMARIA', '')),
      logoUrl:     _logoUrl(get('LOGO_URL', ''))
    };
  }

  // Iniciais para o logo provisório: "Igreja Vida Nova" → VN · "AD Central" → AD
  function iniciais(nome) {
    var w = String(nome || '').trim().split(/\s+/).filter(function (x) { return x && !/^(de|da|do|das|dos|e)$/i.test(x); });
    if (!w.length) return '?';
    if (/^[A-Z\u00C0-\u00DD]{2,3}$/.test(w[0])) return w[0];
    if (w.length > 2 && /^igreja$/i.test(w[0])) w.shift();
    return (w[0].charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  }

  // Ícone do app (aba do navegador, tela inicial do celular, PWA): o logo da Config
  // em tamanho grande ou, sem logo, um quadrado com as iniciais na cor da marca.
  function iconeUrl() {
    var id = identidade();
    if (id.logoUrl) return id.logoUrl.replace(/([?&]sz=)w\d+/, '$1w512');
    var cor = id.corPrimaria || '#0f766e';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="' + cor + '"/>' +
      '<text x="256" y="256" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="220" text-anchor="middle" dominant-baseline="central">' +
      iniciais(id.nomeCurto || id.nome).replace(/[<>&"']/g, '') + '</text></svg>';
    return 'data:image/svg+xml;base64,' + Utilities.base64Encode(svg, Utilities.Charset.UTF_8);
  }

  // JSON seguro para embutir dentro de <script>
  function identidadeJson() {
    return JSON.stringify(identidade()).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  }

  // Cria as chaves que ainda não existem (não altera valores já preenchidos).
  // Chamado pelo setupSpreadsheet(); pode ser executado quantas vezes quiser.
  function garantirChaves() {
    var existentes = {};
    _linhas().forEach(function (r) { existentes[String(r.Chave).trim()] = true; });
    var criadas = [];
    CHAVES.forEach(function (c) {
      if (existentes[c.Chave]) return;
      Util.insertRow('Config', {
        Chave: c.Chave, Valor: c.Valor, Descricao: c.Descricao, AtualizadoEm: Util.now()
      });
      criadas.push(c.Chave);
    });
    return criadas;
  }

  return {
    get: get, identidade: identidade, iniciais: iniciais, iconeUrl: iconeUrl, identidadeJson: identidadeJson,
    garantirChaves: garantirChaves, chaves: CHAVES
  };
})();
