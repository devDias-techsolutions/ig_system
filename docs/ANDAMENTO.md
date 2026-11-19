# Andamento do projeto

Quadro **informativo** para quem trabalha no sistema (qualquer conta, qualquer sessão). Não reserva nem bloqueia nada: serve para ninguém recomeçar do zero o que outro já adiantou. Atualize no começo e no fim de cada etapa.

## Como continuar o trabalho de outra sessão
- Trabalho só existe para as outras contas se estiver **no GitHub**. Arquivos soltos na máquina de uma sessão não são vistos por ninguém.
- Por isso: a cada bloco que funciona, `git commit` + `git push` na branch da etapa, **mesmo sem terminar e sem merge**. PR em rascunho (`draft`) é bem-vindo quando a etapa tem mais de um passo.
- Para retomar: `git fetch origin`, `git checkout <branch>`, ler a linha da etapa abaixo (estado e próximo passo) e seguir de onde parou. Se a branch ficou para trás do `main`, `git merge origin/main` antes de continuar.
- Ao começar algo novo, partir do `main` atualizado e ver se já existe branch ou PR aberto sobre o assunto (`git branch -r`, `gh pr list`).
- Merge só com CI verde. O **deploy** (publicar a nova versão do Apps Script) é feito pelo dono do projeto; o que está no `main` só chega aos usuários depois dele.

## Em andamento
| Etapa | Branch / PR | Estado | Próximo passo | Arquivos principais |
|---|---|---|---|---|
| R5: galeria de marcas e contraste do Início | `inicio-r5` | Implementada; testes locais passando | Aguardar CI e mergear; depois D2 (Membros) | `tests/e2e/dashboard.e2e.js` |
| Desktop D2: Membros (tabela, painel lateral, formulário em 2 colunas, carteirinhas, cartas) | (não iniciada; formulário com cartão ao vivo já feito) | Plano em `docs/UI-DESKTOP.md` | Tabela ordenável com filtros | `_membros.html` |
| Desktop D3: Usuários, Identidade, Alertas, Atalhos | (não iniciada) | Plano em `docs/UI-DESKTOP.md` | Layout de configurações com barra de ações ancorada | `_usuarios.html`, `_identidade.html`, `_alertas.html` |
| Desktop D4: Escola Dominical | (não iniciada) | — | — | `_escola*.html` |
| Desktop D5: login, primeiro acesso, recuperar senha | (não iniciada) | — | Tela dividida + QA em 1280/1366/1920 | `_login.html` |
| Etapa 18: documentação e "cópia limpa" (`Implantacao.limpar()`, confirmação "LIMPAR") | (não iniciada) | Desenho feito, sem código | Implementar limpeza + README/manual | `Implantacao.js`, `Code.js`, `docs/` |

## Concluído recentemente
- Cadastro de membro com cartão ao vivo (frente/verso girando) e pergunta de QR só ao gerar PDF.
- Padronização de estilo (hex/fonte soltos em Membros e Usuários viram tokens; cabeçalho de Usuários segue a cor da igreja). Restam literais legítimos: arte do cartão (impressão), câmera, texto branco sobre cor.
- R3 indicadores integrados + ações rápidas no cabeçalho, R1 tokens dinâmicos (#115) e R2 cor secundária + sugestão do logo (#116).
- Início desktop em uma tela (#114), densidade para notebook (#112), painel único (#109), agenda da igreja (#111).
- Alertas por e-mail (#101), Identidade "Sistema" (#102).

## Combinados de interface
- Telas desktop: conferir em 1280×720, 1366×768 e 1920×1080, sem rolagem do painel quando possível.
- Cores só por tokens semânticos (`docs/UI-GUIDELINES.md`); nada de hex solto em componente novo.
- Mostrar wireframe/diagnóstico e esperar aprovação antes de mudanças grandes de layout.
