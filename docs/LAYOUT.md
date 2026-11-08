# Layout System

Estrutura mínima de toda tela. Fica no shell (`index.html`, bloco "LAYOUT SYSTEM"); as telas só preenchem, nunca redefinem.

| Bloco | Uso |
| --- | --- |
| `.page` (`.page-narrow`) | Raiz do conteúdo: largura máxima, respiro lateral (`--gutter`) e espaço do menu inferior. |
| `.page-head` > `.page-title` + `.page-sub` | Título da tela e uma linha de apoio. |
| `.panel` > `.panel-title` + `.panel-text` | Bloco de conteúdo. |
| `.form-grid` (+ `.field`, `.span-all`) | Campos em colunas; 1 coluna no celular. |
| `.action-bar` > `.action-bar-status` + `.action-bar-btns` | Barra de ações fixa na base. No celular fica acima do menu inferior. |

Regras:
1. Botões da `.action-bar`: **secundário à esquerda, primário à direita**, sempre nesta ordem. Estados (sem alterações, salvando) mudam `disabled`/texto, nunca a posição.
2. Telas não declaram `.page`, `.panel`, `.form-grid` ou `.action-bar` no próprio CSS (o teste `layout:` falha).
3. Cores e espaços vêm dos tokens do shell (`--teal*`, `--sp-*`, `--gutter`).
4. CSS obsoleto é removido, não sobreposto.

Telas já migradas: Identidade, Home, Membros (raiz). Pendentes: Usuários e telas de acesso.
