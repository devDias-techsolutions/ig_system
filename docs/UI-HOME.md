# Início (Home) — wireframe a seguir

> **Para qualquer conta/sessão que retome o trabalho de UI:** a Início tem um desenho **aprovado pelo dono do projeto** e já implementado. Ele é a referência da tela e o modelo de "tela planejada" (tipos e tamanhos de card diferentes, hierarquia clara, um ponto focal). Ao mexer na Início, **siga a imagem** `docs/img/home-wireframe-design.png`. Ao desenhar as outras telas, use a mesma lógica.

![Wireframe → design da Início](img/home-wireframe-design.png)

**Exceção aprovada:** na imagem o cartão verde tem dois botões embaixo ("Meu cartão" e "Ver membros"). O dono pediu para **removê-los**. Não recolocar.

## Estrutura (de cima para baixo)

1. **Cartão institucional** (`.hm-hero`) — sem barra superior (a topnav fica oculta só na Início: `renderView` em `index.html`).
   - Fundo: degradê profundo da **cor da igreja** (`--hero-a`/`--hero-b`, calculados em `aplicarIdentidade()` escurecendo `COR_PRIMARIA` até o texto branco ter contraste ≥ 5:1). Dourado de apoio: `--hero-gold`.
   - Linha de cima: pílula "Bom dia, Nome" + botão redondo com as iniciais do usuário. O botão abre o **menu do usuário** (Alterar senha, Alternar tema, Sair) — é o substituto da topnav.
   - Marca: **logo 88 px** (72 px no celular) com anel dourado (`IDENTIDADE.logoUrl`, ou iniciais se não houver), eyebrow (visão do perfil), **nome da igreja** e **lema**.
   - Grafismo temático em SVG (`_homeArte()`): arcos concêntricos, cruz em marca d'água, malha de pontos e brilhos. Só formas; sem animação infinita.
2. **Atalhos** (`.hm-mods`/`.hm-mod`) — módulos liberados ao perfil + Usuários (admin). Tiles verticais.
3. **Indicadores em mosaico** (`.hm-bento`, `#kpi-grid`) — 1 cartão **destaque** (Membros ativos, com "de N cadastrados") + cartões menores. Vêm de `getKpisHome`. Indicadores marcados `alerta: true` no servidor não viram cartão: viram a **faixa âmbar** abaixo ("N membros sem foto · Resolver" → abre Membros).
4. **Aniversariantes do mês** (painel) — 3 pessoas, "Hoje" destacado. Endpoint novo `mb_aniversariantesDoMes(token, 3)` (`Membros.js`): só nome + dia/mês + `hoje`, só ativos, exige sessão. Só aparece para perfis com o módulo Membros.
5. **Atividade recente** (painel, só admin) — `getAtividadeRecente`.

Desktop: mosaico em 3 colunas (destaque 1,5×); aniversariantes e atividade lado a lado (≥ 1100 px). Celular: destaque em linha inteira, menores em 2 colunas.

## Regras que se mantêm
- Só tokens (`--sp-*`, `--fs-*`, `--r-*`, `--dur*`); nada de cor fixa além das `--hero-*` do shell.
- ES5, avisos pelos modais/toasts da plataforma, estados de carregando/vazio/erro em cada bloco (`_homeEstado`, esqueleto).
- Nenhuma animação infinita na Início; `prefers-reduced-motion` respeitado.
- Conteúdo por perfil em `HOME_PERFIL` (admin: kpis/atividade; secretaria: kpis). Perfil novo = uma linha.

## Onde mexer
- `_home.html` (CSS + `renderHome`, `_kpiHtml`, `_loadKpis`, `_loadAniv`, `_loadActivity`, `homeToggleMenu`).
- `index.html`: tokens `--hero-*`, `aplicarIdentidade()`, `renderView` (oculta a topnav na Início).
- `Membros.js`: `aniversariantesDoMes` / `mb_aniversariantesDoMes`.
- Testes: `tests/runtime.test.js` (endpoint), `tests/e2e/fluxos.e2e.js` (Home), `tests/static.test.js`.

## Estado
| Item | Situação |
|---|---|
| Cartão institucional, atalhos, mosaico, faixa de atenção, aniversariantes, atividade | **Feito** |
| Botões "Meu cartão"/"Ver membros" no cartão | **Removidos de propósito** |
| Versão para tema claro conferida em imagem | Pendente (o cartão é o mesmo nos dois temas; só o resto muda) |
| Aplicar a mesma lógica (hierarquia, cartões de tamanhos diferentes) em Membros/Usuários | Pendente — pedir wireframe em imagem ao dono antes |
