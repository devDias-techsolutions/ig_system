# Diretrizes de UI

Regras para desenhar qualquer tela. Complementa `docs/LAYOUT.md` (estrutura) com **hierarquia, escalas e orçamento de efeitos**.
Referências: Material Design 3, Apple HIG, WCAG 2.2 (alvo de toque e contraste), Nielsen Norman Group e *Refactoring UI*.

## 1. Princípios

1. **Peso visual proporcional à importância.** O que é persistente (navegação) fica discreto; o destaque vai para o conteúdo e para a ação principal.
2. **Um ponto de foco por tela.** Se tudo grita, nada é lido. O bloco 3D, por exemplo, é assinatura da Home e não aparece em outras telas.
3. **Escalas fixas, sem número solto.** Tipografia, espaço, raio, sombra e movimento vêm de tokens.
4. **Uma ação primária por tela.** Ações destrutivas ficam longe dela (menu ⋮ + confirmação interna).
5. **O controle certo para o dado.** Ligado/desligado = interruptor; escolha entre opções = seleção; nunca lista para sim/não.

## 2. Escalas (tokens no `index.html`)

| Escala | Valores | Tokens |
| --- | --- | --- |
| Texto | 12 · 14 · 16 · 20 · 28 (+ 32 só para número de KPI) | `--fs-xs` `--fs-sm` `--fs-md` `--fs-lg` `--fs-xl` `--fs-2xl` |
| Espaço (múltiplos de 4/8) | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 | `--sp-1` … `--sp-8` |
| Raio | 8 · 12 · 16 · 24 · pílula | `--r-1` … `--r-4`, `--r-pill` |
| Sombra | 3 níveis: pequena, média, grande | `--shadow-sm` `--shadow` `--shadow-lg` |
| Movimento | 150 · 200 · 250 ms | `--dur-fast` `--dur` `--dur-slow` (+ `--ease`) |

Corpo de texto: 14 ou 16 px. 12 px só para rótulos e legendas. Nunca abaixo de 12 px.
`--radius-sm/-/-lg/-xl` são herança: em código novo use `--r-*`.

## 3. Três níveis de navegação (cada um com seu papel)

| Nível | Peça | Regra |
| --- | --- | --- |
| Destinos principais | Barra inferior (celular) / menu lateral (desktop) | Discreta: ícone + rótulo curto, item ativo com cor e indicador fino. **Sem pílula pesada nem sombra.** |
| Seções do módulo | Abas | Altura de 48 px, texto 14 px, indicador de 2–3 px com cor de marca e contraste claro. |
| Identidade e ações globais | Cabeçalho | Logo, nome, usuário, sair. Uma linha. |

A navegação principal **nunca** é mais forte que o conteúdo.

## 4. Componentes

- **Botão:** altura mínima de 48 px no celular (alvo de toque), mesma altura na mesma linha; ícone com 8–12 px de respiro; um primário (preenchido), secundários em contorno ou tonais.
- **KPI compacto:** número a 32 px, rótulo a 12 px, ícone pequeno sem bloco 3D, estatísticas em linha; dois indicadores cabem lado a lado sem ocupar a tela.
- **Campo:** rótulo acima (12–14 px), altura 48–52 px, erro abaixo em 12 px.
- **Interruptor (`switch`):** estado escrito ao lado ("Ativo"/"Inativo"), alvo de 48 px.
- **Painel (`.panel`):** um por assunto; títulos pequenos em maiúsculas.
- **Estados vazios e carregando:** sempre desenhados (ícone + frase + ação), nunca área em branco.
- **Alertas e confirmações:** sempre toasts e modais da própria plataforma. Nunca `alert`, `confirm` ou `prompt` do navegador.

## 5. Orçamento de efeitos

- No máximo **uma animação contínua por tela** (`animation … infinite`).
- Brilho, spotlight e gradiente só em elementos **interativos** ou de assinatura (um por tela).
- Vidro (`backdrop-filter`) só em painéis e barras; nunca empilhado dentro de outro vidro.
- Sombra: no máximo 3 alturas, e a mais alta só em menus e modais.

## 6. Como as regras são cobradas (`npm test`)

`tests/ui.test.js` confere os tokens e conta, por tela, valores literais fora da escala (`font-size`, `border-radius`, `transition`) e animações contínuas. O limite de cada tela fica em `tests/ui-baseline.json` e **só pode diminuir**:

- Valor novo fora da escala → a suíte quebra. Use o token.
- Ao corrigir valores antigos, rode `npm run ui:baseline` para travar o ganho.
- A meta é chegar a zero em todas as telas.

## 7. Checklist de PR de tela

- [ ] Só tokens (`--fs-*`, `--sp-*`, `--r-*`, `--dur*`).
- [ ] Um ponto de foco e uma ação primária.
- [ ] Alvos de toque ≥ 48 px; contraste legível nos dois temas.
- [ ] Estados: vazio, carregando e erro desenhados.
- [ ] Sem `alert/confirm/prompt`; nada de CSS obsoleto sobreposto (remova).
- [ ] `npm test` verde; se corrigiu valores antigos, `npm run ui:baseline`.
