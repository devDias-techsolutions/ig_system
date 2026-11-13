# Roteiro de UI — onde paramos e como retomar

Leia este arquivo primeiro se for continuar o trabalho de interface em outra sessão ou conta.
Regras em `docs/UI-GUIDELINES.md`; estrutura em `docs/LAYOUT.md`.

## Combinado com o dono do projeto

- Entregar **por etapas já mergeadas** em `main` (o deploy automático publica), para nada se perder se a sessão acabar.
- Edição **cirúrgica** nos arquivos (sem reescrever do zero). Frontend em ES5, sem `alert/confirm/prompt`.
- Cada etapa: branch → `npm test` verde → PR → merge → atualizar a tabela abaixo.
- Ao concluir um pedaço, disponibilizar o arquivo corrigido e o changelog.

## Etapas

| Etapa | O que é | Estado |
| --- | --- | --- |
| UI-1 | `UI-GUIDELINES.md`, tokens de escala no `index.html`, `tests/ui.test.js` + `ui-baseline.json` | Feita |
| UI-2 | Normalizar peças repetidas: cabeçalho, abas (48 px), barra inferior discreta, **KPI compacto** (bloco 3D menor, número 32 px, estatísticas em linha) | Pendente |
| UI-3 | Aplicar em Home → Membros → Usuários → Identidade (uma tela por PR) | Pendente |
| UI-4 | Telas de acesso (login, primeiro acesso, recuperar senha) | Pendente |
| UI-5 | Zerar o limite de valores fora da escala (`npm run ui:baseline` a cada ganho) | Contínuo |

## Diagnóstico que originou o plano

- Navegação sem proporção: barra inferior forte (ícones grandes, pílula pesada) e abas superiores fracas; a navegação principal disputa com os dados.
- KPI superdimensionado: bloco 3D de 82 px, título de 30 px e números de 48 px no mesmo cartão (três níveis de "grande").
- Vários estilos ao mesmo tempo: vidro, bloco 3D, bordas em degradê, sombras de várias alturas, raios variados.

## Estado medido (limite inicial em `tests/ui-baseline.json`)

Valores fora da escala por tela (fonte / raio / transição / animações contínuas):
`index.html` 32/20/34/9 · `_membros.html` 45/25/4/0 · `_usuarios.html` 27/11/4/1 · `_login.html` 10/0/2/4 · `_membros-cartas.html` 10/0/0/0 (cartão impresso: tamanhos próprios) · `_home.html` 0/3/2/1 · `_identidade.html` 4/2/0/0.

## Como trabalhar

```
npm test                 # suíte completa (inclui tests/ui.test.js)
npm run test:ui          # só as escalas
npm run ui:baseline      # grava o novo limite depois de corrigir valores
```

Para cada tela: trocar números soltos por tokens, remover CSS obsoleto, conferir o checklist da seção 7 das diretrizes e rodar `npm run e2e` (precisa de Playwright). Anotar aqui o que foi feito.

## Decisões em aberto

- Escala de texto mudou de 11/13/15/18/24 para 12/14/16/20/28 (os 24 usos de `--fs-*` ficaram 1–2 px maiores). Se algo estourar em tela pequena, ajustar a tela, não a escala.
- `--radius` (18 px) e `--radius-xl` (32 px) estão fora da escala de raios; migrar para `--r-3`/`--r-4` junto com cada tela.
