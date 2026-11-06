# Testes

```
npm test              # suíte completa (um processo)
npm run test:static   # só análise estática
npm run test:runtime  # só execução com mocks do Google
```

Sem dependências externas: Node 18+ (`node:test`). O Apps Script é simulado em `helpers/gas.js`,
então os testes provam a lógica, não o comportamento da plataforma do Google.

## Testes pendentes por etapa

`roadmap.json` guarda `etapaAtual` e a etapa que libera cada teste. Testes de etapas futuras
aparecem como `# TODO` e não quebram a suíte. Ao concluir uma etapa:

1. Suba `etapaAtual` para o número da etapa.
2. Confirme que todos os testes liberados passam.

Se um teste pendente já estiver passando, o relatório avisa nos diagnósticos.
Teste que não está listado no `roadmap.json` precisa passar sempre.

## Preview das telas

```
LUCIDE_JS=/caminho/lucide.min.js npm run preview -- <pasta-de-saida> [admin|secretaria]
```

Monta o `index.html`, simula o backend (`tests/preview/mock-backend.js`) e gera capturas de celular e
desktop. O script confere em qual tela está e falha se estiver na errada. Usa dados simulados e não
carrega fontes do Google nem as bibliotecas de PDF: serve para conferir estrutura e visual, não
substitui o teste real no Apps Script. Requer o Playwright com Chromium instalado.

## Testes ponta a ponta (`npm run e2e`)

Abrem a tela real (index.html + módulos) num Chromium e ligam o `google.script.run` ao backend real
(os `.js` do projeto, com a planilha e o CacheService simulados). Substituem testes manuais: login/sair,
perfil secretaria, cadastrar/inativar/excluir membro conferindo lista e Home, editar sem duplicar, tela de usuários.
Requer `playwright` + Chromium (`npm i --no-save playwright && npx playwright install chromium`).
Para ícones, aponte `LUCIDE_JS` para um `lucide.min.js` local (opcional). Cada defeito encontrado no teste manual
vira um teste aqui, para nunca voltar.
