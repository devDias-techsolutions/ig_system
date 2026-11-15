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
| E3c | Visão geral (mock aprovado), Ranking, modos configuráveis (ícone de ajustes no cabeçalho de Chamada/Ranking) | feito |
| E3d | Relatórios: por turma + geral da aula (igual ao original), aberto automaticamente após salvar a chamada; compartilhar resumo (WhatsApp/copiar) | feito |
| E3e | Aba **Chamada** como no original (histórico do trimestre → turmas da aula → chamada em leitura/edição), oferta em padrão bancário, loading ao salvar, **retrato da aula**, trava de transferência e regra do professor | feito |
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

## Modos configuráveis (Config: `EBD_MODO_CHAMADA`, `EBD_MODO_RANKING`, `PONTOS_*`)
- **Chamada**: `presenca` (padrão: só o toggle de presença) ou `completa` (bíblia, revista e pontos extras por aluno). No modo presença o servidor **preserva** bíblia/revista/extras já lançados antes.
- **Ranking**: `presenca` (padrão: nº de presenças, desempate por %) ou `pontos` (soma de `TotalPontos` das chamadas: presença + bíblia + revista + extras). O ranking tem seletor local Presença/Pontos, turma e trimestre; o padrão vem da config.
- Ajustes salvos por `ed_salvarConfigEbd` (admin/secretaria). Admin/secretaria abrem na Visão geral; professor, na Chamada.
- Endpoints novos: `ed_getRanking`, `ed_getVisaoGeral`, `ed_getConfigEbd`, `ed_salvarConfigEbd`.

## Relatórios (`ed_getRelatorioAula`)
- Matriculados = alunos + professores ativos da turma (mesmo universo da chamada). Por turma: presentes, ausentes, visitantes, total (presentes+visitantes), bíblias/revistas (só no modo completo), oferta e % de presença (verde ≥80, dourado ≥50, vermelho abaixo).
- Geral da aula: soma das turmas + aproveitamento por turma. Professor vê só as suas turmas.
- Após **Salvar chamada** abre o relatório da turma com atalho para o geral. "Compartilhar" usa `navigator.share` ou copia o texto.
- A ordem das turmas é a da planilha (o original usava uma lista fixa de nomes da igreja, que não cabe no white-label).

## Aba Chamada (E3e)
- Fluxo em 3 níveis: **Histórico do trimestre em curso** (botão "Nova aula" no topo, só admin/secretaria; cada aula com `OK` = todas as turmas lançadas ou `!` = pendência) → **Turmas da aula** (status por turma; "Relatório geral da aula") → **Chamada da turma**.
- Chamada já lançada abre **somente leitura**; botão "Editar chamada" só aparece se `podeEditar`: professor apenas **no dia da aula**; secretaria/admin a qualquer momento. O servidor também recusa (`salvarChamada`).
- Oferta: máscara bancária (`edmOferta`): dígitos entram pela direita (1000 → 10,00). Salvar mostra spinner "Salvando chamada…" até a resposta; só então o toast.
- Endpoint novo: `ed_getHistoricoChamadas`. `ed_getChamada` devolve `podeEditar`, `turmaNome`, `aula`, `retratoFixo`.

## Travas dos relatórios (retrato)
- No **primeiro salvamento** da chamada de uma turma/aula, `ChamadasInfo` ganha `Matriculados` e `RetratoJSON` (quem estava na turma: alunos + professores, com nome). Colunas são acrescentadas automaticamente em planilhas antigas (`_garantirColunas`).
- `getRelatorioAula` usa `Matriculados` do retrato (aula lançada) → excluir/incluir/transferir aluno **não altera** percentuais antigos. `getChamada` de aula lançada lista o retrato; regravar ignora quem não estava nele. Aulas lançadas antes desta versão (sem retrato) continuam calculando pela turma atual.
- **Transferência de turma travada** durante o trimestre em curso (`editarAluno` recusa mudar `ClasseID`). Trimestre em curso = o da aula mais recente, se ela for futura ou tiver até 28 dias; depois disso a transferência é liberada (virada do trimestre).

## Frequência do aluno no trimestre (Chamada)
- Abaixo de cada aluno/professor na chamada há uma linha com uma bolinha por lição do trimestre (✓ presente, ✕ ausente, tracejada = sem registro) e o resumo `presentes/lançadas · %` (percentual sobre as lições já registradas). A lição aberta é destacada e acompanha a marcação feita na hora.
- Dados: `ed_getChamada` devolve `historicoPresenca` (por aluno e nº da lição), `licoes` (nºs das aulas do trimestre) e `totalLicoes`. Render em `_edmTimeline` (`_escola-dominical.html`).

## Aulas e Chamada: uma aba só (como no original)
- Não existe mais a aba "Aulas": o cadastro de aulas está na própria aba **Aulas e Chamada** — botão "Nova aula" no topo e menu ⋮ em cada aula (editar/excluir, só admin/secretaria).
- A linha de frequência do trimestre (bolinhas por lição + resumo + barra) aparece na **Chamada** (a lição aberta acompanha a marcação) e na aba **Alunos** (`ed_getFrequenciaTrimestre`, `_edmLinhaFreq`).
