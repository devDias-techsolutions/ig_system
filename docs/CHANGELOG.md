# Changelog (interface)

## Refinamento visual — identidade dinâmica
- **R1 · Tokens em camadas.** Marca (`--brand-1/2`) → semânticos (`--surface-0..4`, `--text-1..4`, `--line*`, `--accent*`, `--ok/--warn/--danger`) → componentes. `gerarPaleta(marca1, marca2, tema)` calcula neutros tingidos pela marca, destaque legível e texto sobre o destaque, para Light e Dark com a mesma arquitetura. Os nomes antigos (`--bg2`, `--teal`, `--text-muted`…) continuam como apelidos e serão migrados aos poucos; telas novas usam só os semânticos. Teste `tests/e2e/paleta.e2e.js` garante contraste (AA) em 10 marcas × 2 temas.
