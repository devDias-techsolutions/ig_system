# Layout System

Estrutura mínima de toda tela. Fica no shell (`index.html`, bloco "LAYOUT SYSTEM"); as telas só preenchem, nunca redefinem.

| Bloco | Uso |
| --- | --- |
| `.page` (`.page-narrow`) | Raiz do conteúdo: largura máxima, respiro lateral (`--gutter`) e espaço do menu inferior. |
| `.page-head` > `.page-title` + `.page-sub` | Título da tela e uma linha de apoio. |
| `.panel` > `.panel-head` > `.panel-title` (+ `.panel-text`) | **Setor** (container de vidro). Todo grupo de conteúdo de uma tela fica dentro de um `.panel`. |
| `.form-grid` (+ `.field`, `.span-all`) | Campos em colunas; 1 coluna no celular. |
| `.action-bar` > `.action-bar-status` + `.action-bar-btns` | Barra de ações fixa na base. No celular fica acima do menu inferior. |

## Setorização (como uma tela se divide)

- Fundo da tela → **`.panel`** (vidro, um por assunto) → itens dentro dele (cartões de indicador, módulos, campos, listas).
- Nada de cartões ou campos soltos direto no fundo. Cabeçalho da tela (`.page-head`/hero) e barra de módulo são as únicas peças fora de um painel.
- O título do setor é sempre o `.panel-title` (letras pequenas, maiúsculas). Subtítulos dentro do mesmo painel usam outro `.panel-head`.
- Dois painéis lado a lado (ex.: Módulos | Atividade) usam o mesmo componente, só em colunas do `.hm-cols`.

Regras:
1. Botões da `.action-bar`: **secundário à esquerda, primário à direita**, sempre nesta ordem. Estados (sem alterações, salvando) mudam `disabled`/texto, nunca a posição.
2. Telas não declaram `.page`, `.panel`, `.form-grid` ou `.action-bar` no próprio CSS (o teste `layout:` falha).
3. Cores e espaços vêm dos tokens do shell (`--teal*`, `--sp-*`, `--gutter`).
4. CSS obsoleto é removido, não sobreposto.

Telas já migradas: Home, Membros, Usuários, Identidade. Pendentes: telas de acesso (login, primeiro acesso, recuperar senha).
