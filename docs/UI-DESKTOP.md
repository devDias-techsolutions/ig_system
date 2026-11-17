# UI Desktop — wireframes e regras

O desktop (≥ 1024 px, com a sidebar fixa) **não é o celular esticado**: tem estrutura própria. O celular segue como está
(coluna única, menu gaveta, barra de ações fixa). Regra: o que muda de *estrutura* entre os dois fica no mesmo componente,
em um bloco `@media (min-width: 1024px)` logo abaixo da regra de celular — nada de camada de override no fim do arquivo.

## Chassi (todas as telas)

```
┌ sidebar 264 ┬──────────────────────────────────────────────────────────┐
│ marca       │ Início / Membros                                  ⋮  ← barra superior 56 px (caminho + ações)
│ Principal   ├──────────────────────────────────────────────────────────┤
│ Módulos     │   Título da página                    [ação secundária] [ação primária]
│ Admin       │   subtítulo (1 linha)                                   ← .page-head
│             │   ─ Aba ─ Aba ─ Aba ─                                   ← abas sublinhadas (D2)
│ usuário  ⎋  │   conteúdo em grade (largura útil até 1360 px, centrado)
└─────────────┴──────────────────────────────────────────────────────────┘
```

- **Barra superior**: caminho (`Início / Painel de controle / Alertas`) à esquerda; ações do módulo e menu ⋮ à direita.
  A barra do módulo (voltar + tags) só existe no celular.
- **Área de trabalho**: `.page` com até 1360 px. Telas de formulário (`.page-narrow`) migram para o layout em colunas na D3.
- **Cabeçalho da página**: `.page-head` = `.page-head-txt` (título + subtítulo) à esquerda e `.page-head-actions` à direita.
  A ação primária da tela mora aqui no desktop (não existe botão "+" flutuante).
- **Grade**: `.d-split` (conteúdo + coluna lateral de 360 px) e `.d-cols` (`--cols: N` colunas iguais). Abaixo de 1024 px viram uma coluna.
- Hierarquia de texto: 28 px título, 20 px seção, 14 px corpo, 12 px apoio. Espaços só pelos tokens `--sp-*`.

## Início (D1) — feito

```
┌ cartão da igreja: [logo 80]  Visão geral · Nome da igreja · lema            Segunda-feira, 16 de novembro ┐
├────────────────────────────────────────────────────────────────┬──────────────────────┤
│ Indicadores                                                     │ Atalhos              │
│ ┌ Módulo A ─────────┐ ┌ Módulo B ────────┐  (quantos couberem)  │ [ícone] Membros      │
│ │ números do módulo │ │ números           │                     │ [ícone] Escola Dom.  │
│ └ status ───────────┘ └ status ──────────┘                      │ Aniversariantes      │
│ Atividade recente (largura da coluna principal)                  │ uma pessoa por linha │
└────────────────────────────────────────────────────────────────┴──────────────────────┘
```

## Painel de controle (D1) — feito
Cartões de entrada em grade automática (`auto-fill, minmax(280px, 1fr)`), maiores que no celular.

## Próximas etapas
- **D2 Membros**: tabela (colunas ordenáveis, filtros em linha na barra de ferramentas, densidade confortável), detalhe em painel lateral,
  formulário em seções de duas colunas com cartão de prévia, carteirinhas em galeria + prévia fixa ao lado, cartas.
- **D3 Configurações** (Usuários, Identidade, Alertas, Atalhos): navegação de seções à esquerda (240 px), conteúdo em linhas
  "rótulo + descrição | controle", prévia ao vivo na Identidade, barra de salvar presa ao topo do conteúdo.
- **D4 Escola Dominical**: abas sublinhadas, tabelas de turmas/alunos/professores, chamada em grade, relatórios em painéis.
- **D5 Entrada**: login, primeiro acesso e recuperar senha em tela dividida (marca + formulário).


## Início (desktop) — painel com agenda
- Sem cartão institucional: título simples no canto superior esquerdo (saudação + data e igreja). O cartão continua só no celular.
- Coluna principal: indicadores, atalhos (grade de botões) e, lado a lado, aniversariantes e atividade recente.
- Coluna lateral (340px): calendário do mês e eventos programados da igreja, com estado vazio e botão "Agendar evento".
- Agenda (`Agenda.js`, aba `Eventos`): todos veem; admin e secretaria agendam, editam e cancelam. Instalações antigas criam a aba sozinhas na primeira vez.
