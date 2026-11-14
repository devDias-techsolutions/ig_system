'use strict';
// Respostas simuladas do backend para o preview. Mesmo formato do Util.ok / Util.err.

const ok = (data) => ({ success: true, data });

// Aniversários fora do mês atual, para o pop-up de aniversariantes não cobrir a lista no preview.
function dia(d, deslocamentoMeses) {
  const mes = ((new Date().getMonth() + deslocamentoMeses) % 12) + 1;
  return String(d).padStart(2, '0') + '/' + String(mes).padStart(2, '0') + '/';
}

function membros() {
  const base = [
    ['Maria Aparecida Souza', 'F', dia(12, 3) + '1978', 'Membro', '(31) 98877-1001', true],
    ['João Carlos Pereira', 'M', dia(5, 4) + '1965', 'Presbítero', '(31) 98877-1002', true],
    ['Ana Beatriz Lima', 'F', dia(23, 5) + '1992', 'Cooperadora', '(31) 98877-1003', true],
    ['Pedro Henrique Alves', 'M', dia(30, 6) + '2001', 'Membro', '(31) 98877-1004', true],
    ['Lúcia Helena Costa', 'F', dia(17, 7) + '1958', 'Diaconisa', '(31) 98877-1005', false],
    ['Marcos Vinícius Rocha', 'M', dia(8, 8) + '1985', 'Diácono', '(31) 98877-1006', true],
  ];
  return base.map((m, i) => ({
    id: 'm' + (i + 1), rol: String(i + 1).padStart(4, '0'), nome: m[0], sexo: m[1], nascimento: m[2],
    funcao: m[3], celular: m[4], ativo: m[5], foto: '', Igreja: 'Igreja Exemplo', estadoCivil: 'Casado(a)',
    cidade: 'Belo Horizonte', estado: 'MG', batismo: '06/2005', email: 'membro' + (i + 1) + '@exemplo.test',
  }));
}

function usuarios() {
  return [
    { ID: 'u1', Nome: 'Ana Souza', Email: 'ana@igreja.test', Perfil: 'admin', Ativo: true, PrimeiroAcesso: false, CriadoEm: '01/11/2026 10:00:00', UltimoLogin: '03/11/2026 08:12:00' },
    { ID: 'u2', Nome: 'Carlos Lima', Email: 'carlos@igreja.test', Perfil: 'secretaria', Ativo: true, PrimeiroAcesso: false, CriadoEm: '02/11/2026 09:30:00', UltimoLogin: '' },
    { ID: 'u3', Nome: 'Rita Gomes', Email: 'rita@igreja.test', Perfil: 'secretaria', Ativo: false, PrimeiroAcesso: false, CriadoEm: '28/10/2026 14:00:00', UltimoLogin: '' },
  ];
}

// Devolve o código JS (string) com as funções simuladas, para ser injetado na página.
function serializar(perfil) {
  const sessao = { token: 'tok', id: 'u1', nome: 'Ana Souza', email: 'ana@igreja.test', perfil, primeiroAcesso: false };
  const kpis = (process.env.SEM_MODULOS ? [] : [
    { icone: 'users', cor: 'kc-teal', valor: 128, rotulo: 'Membros ativos', curto: 'Ativos', destino: 'membros' },
    { icone: 'user-x', cor: 'kc-gold', valor: 14, rotulo: 'Membros inativos', curto: 'Inativos', destino: 'membros' },
    { icone: 'camera', cor: 'kc-blue', valor: 37, rotulo: 'Membros sem foto', curto: 'Sem foto', dica: 'Complete os cadastros', destino: 'membros', alerta: true },
  ]).concat([{ icone: 'shield-check', cor: 'kc-green', valor: 3, rotulo: 'Usuários do sistema', curto: 'Usuários' }]);
  const fns = {
    getSession: () => ok(SESSAO),
    login: () => ok(SESSAO),
    logout: () => ok(true),
    getKpisHome: () => ok(KPIS),
    getAtividadeRecente: () => ok(ATIVIDADE),
    mb_listarMembros: () => ok(MEMBROS),
    mb_getProximoRol: () => ok('0129'),
    mb_getFotoMembro: () => ({ success: false, error: 'sem foto' }),
    usr_listar: () => ok(USUARIOS),
    usr_listarPermissoes: () => ({ success: false, error: 'sem matriz salva' }),
  };
  const atividade = [
    { icon: 'user-plus', texto: 'Usuário adicionado: Carlos Lima', tempo: '1d atrás', ts: 2 },
    { icon: 'user-plus', texto: 'Usuário adicionado: Rita Gomes', tempo: '6d atrás', ts: 1 },
  ];
  const corpo = Object.entries(fns).map(([k, f]) => `${JSON.stringify(k)}: ${f.toString()}`).join(',\n');
  return `(function(){ var SESSAO=${JSON.stringify(sessao)}, ATIVIDADE=${JSON.stringify(atividade)}, KPIS=${JSON.stringify(kpis)}, MEMBROS=${JSON.stringify(membros())}, USUARIOS=${JSON.stringify(usuarios())};
    function ok(d){ return {success:true,data:d}; }
    return {\n${corpo}\n}; })()`;
}

module.exports = { serializar };
