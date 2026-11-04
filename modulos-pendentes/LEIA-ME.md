# Módulos pendentes (fora do MVP)

Esta pasta **não faz parte do deploy**. Nada aqui é carregado pelo núcleo nem deve ser colado no Apps Script.
Ela guarda o que saiu do MVP na Etapa 2, para voltar depois como módulo (Etapas 19 e 20 do plano).

O código original, sem nenhuma alteração, continua no commit `bbb6e9b` (por exemplo:
`git show bbb6e9b:index.html`).

## O que há aqui

| Pasta | Arquivo | Origem |
|---|---|---|
| `escola-dominical/` | `EscolaDominical.js` | arquivo inteiro |
| | `_escola-dominical.html` | arquivo inteiro |
| | `ImportarAlunosParaMembros.js` | `buscarAlunosParaImportar` de `Code.js` |
| | `membros-importar-ebd.js` | bloco "Importar da EBD" de `_membros.html` |
| `pre-cadastro/` | `_precadastro.html` | arquivo inteiro |
| | `PreCadastro.js` | `getAppUrl` e bloco de solicitações de `Code.js` |
| | `membros-painel-solicitacoes.js` | painel de solicitações de `_membros.html` |

## O que mudou no núcleo (pontos a religar quando o módulo voltar)

- **`index.html`:** `VIEWS`, `ROUTE_PERMISSIONS`, `authRequired`, `_homeViewForPerfil`, rótulos de perfil e o `include` da tela.
- **`_home.html`:** botão do módulo, item do menu inferior e os indicadores de alunos, professores e turmas.
- **`Dashboard.js`:** indicadores e atividade recente de aulas e alunos.
- **`SetupSheets.js`:** abas `Classes`, `Alunos`, `Professores`, `Aulas`, `Chamadas`, `ChamadasInfo`, `PontosExtras`, seed de pontos extras e as chaves de Config `ANO_LETIVO`, `PONTOS_PRESENCA`, `PONTOS_BIBLIA`, `PONTOS_REVISTA`.
- **`Code.js`:** constantes de abas em `SHEETS`, `PERFIS.PROFESSOR` e a rota pública `?view=precadastro`.
- **`Usuarios.js` e `_usuarios.html`:** perfil `professor` (validação, filtros, listas, coluna da matriz), grupo "Escola Dominical" da matriz de permissões, estado "parcial" e item do menu inferior.
- **`_membros.html`:** botão "Solicitações" da barra de ações, botão "Importar da EBD" do formulário e CSS herdado da Escola Dominical que não era usado.

## Atenção

- O pré-cadastro depende do módulo Membros (`Membros.salvarMembro`).
- A Escola Dominical é opcionalmente integrada ao Membros (importar aluno como membro).
- Usuários antigos com perfil `professor` não têm mais tela no MVP.
