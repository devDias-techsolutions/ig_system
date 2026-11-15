# Migração da Escola Dominical (EBD)

Origem: `modulos-pendentes/escola-dominical/` (legado, mantido como referência). Destino: módulo registrado no `Modulos.js`, no padrão visual da Home/Membros (`docs/UI-HOME.md`).

## Decisões do usuário
- Reativar o perfil **professor** (vê só as próprias turmas).
- Começar pela **Chamada**.
- **Alertas automáticos** (diário/segunda) e **importador de alunos (5 passos)** ficam para o **fim** (E5).
- Antes de implementar telas: **wireframe→design em imagem** (Chamada e Visão geral) para aprovação.

## Etapas
| Etapa | Conteúdo | Status |
|---|---|---|
| E1 | Backend na raiz: `EscolaDominical.js` (wrappers `ed_*`, `_safe_ed`), manifesto **definido mas não registrado**, abas/colunas iguais ao legado, neutralidade (nome da igreja via Config, chave `ALERTAS_CONFIG`), testes | feito |
| E1b | Imagem wireframe→design (Chamada, Visão geral) → aprovação | aprovado |
| E2 | Manifesto registrado, `professor` reativado (Code.js, Usuarios.js, `_usuarios.html`, `PERFIL_LABEL`), novo `_escola-dominical.html` com a tela **Chamada** (prefixo `edm-`/`EDM`), mini-modal "Nova aula" (provisório até a tela Aulas), pontos extras ao tocar no nome do aluno, e2e `tests/e2e/ebd.e2e.js` | feito |
| E3a | Turmas e Alunos (lista + FAB + modal; professor só vê Chamada e Alunos) | feito |
| E3b | Professores (vínculo usuário↔turma) e Aulas | feito |
| E3c | Ranking, Relatórios, Visão geral (mock aprovado) | pendente |
| E4 | Integração: Membros ("Importar da EBD"), KPIs da Home, atividade | pendente |
| E5 | Alertas automáticos + importador 5 passos | pendente |

## Pontos de atenção
- Testes estáticos: o núcleo não pode citar o módulo pelo nome (só `EscolaDominical.js` e `_escola-dominical.html` são exceção). Função global nova não pode duplicar nome de outro `.js` (por isso `_safe_ed`).
- `_escola-dominical.html` legado (≈4900 linhas) ainda está em `modulos-pendentes/`; será trazido e reestilizado por tela para não estourar o ratchet de UI (`npm run ui:baseline` só após reduzir valores fora da escala).
- Para ligar o módulo: ver comentário no fim de `EscolaDominical.js`.

## Mocks (seguir ao implementar)
- `docs/img/ebd-chamada-wireframe-design.png` — Chamada: hero compacto, atalhos circulares do módulo (Visão geral, Chamada, Turmas, Alunos, Professores, Aulas, Ranking, Relatórios), filtros Turma/Aula, chips (Presentes/Ausentes/Bíblias/Revistas), lista com 3 toggles redondos por aluno (Presente/Bíblia/Revista; Bíblia e Revista só com presença), barra flutuante (Visitantes, Oferta, pontos extras, Salvar chamada).
- `docs/img/ebd-visao-geral-wireframe-design.png` — Visão geral: bento (Alunos/Turmas/Professores), banner "turmas sem chamada", presença (anel + barras das últimas aulas), ranking top 3, presença por turma.

## Como adicionar a próxima tela (E3)
1. Acrescente `['id','icone-lucide','Rótulo']` em `EDM_TELAS` (`_escola-dominical.html`); o carrossel de atalhos aparece quando há mais de uma tela.
2. Implemente `renderEscolaDominical` por tela (hoje só Chamada) usando os mesmos blocos: `.edm-hero`, `.edm-atalhos` (`.hm-mod`), `.edm-chips`, `.edm-row`, `.edm-bar`.
3. Professor: o servidor já restringe turmas (`_classesDoProfessor`); sem permissão de criar aula/turma/aluno.
4. Mock de preview: `tests/preview/mock-backend.js` (funções `ed_*`).
