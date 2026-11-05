# Enviar o código do GitHub para o Apps Script

O GitHub **não** consegue escrever no Apps Script sozinho. A ponte é o `clasp` (ferramenta oficial do Google).
Aqui ele roda de duas formas: automática (GitHub Actions) ou manual (seu computador).

O que é enviado: `*.js`, `*.html` da raiz e `appsscript.json`. Nunca `tests/`, `modulos-pendentes/`, `scripts/`, `docs/`.

> Atenção: `push --force` faz o projeto do Apps Script ficar **idêntico** ao repositório. Arquivo que só existe no
> editor do Apps Script é apagado. Use um projeto dedicado a este código.

## Preparação (uma vez)

1. Ative a API: https://script.google.com/home/usersettings → **Google Apps Script API: Ativada**.
2. Pegue o **ID do script**: no editor, Configurações do projeto → IDs → *ID do script*.
3. No seu computador (Node 18+): `npx @google/clasp@2 login` (abre o navegador). Isso cria `~/.clasprc.json`.

## Opção A — Automático (GitHub Actions)

No GitHub: Settings → Secrets and variables → Actions → *New repository secret*:

| Segredo | Valor |
|---|---|
| `SCRIPT_ID` | ID do script (passo 2) |
| `CLASPRC_JSON` | **conteúdo inteiro** do arquivo `~/.clasprc.json` |
| `DEPLOYMENT_ID` | *(opcional)* ID da implantação do app da web, para atualizar o mesmo link. Em Implantar → Gerenciar implantações |

A partir daí, todo merge na `main` roda os testes e, se passarem, envia ao Apps Script. Também dá para disparar à mão em
Actions → *deploy-apps-script* → Run workflow. Sem os segredos o workflow só avisa e não faz nada.

Sem `DEPLOYMENT_ID` o código é enviado, mas o app da web continua na versão anterior até você fazer
Implantar → Gerenciar implantações → Editar → Nova versão.

## Opção B — Manual (seu computador)

```bash
SCRIPT_ID=xxxx ./scripts/deploy.sh            # só envia o código
SCRIPT_ID=xxxx ./scripts/deploy.sh ID_IMPLANTACAO   # envia e atualiza a implantação
```

## Cuidados
- `CLASPRC_JSON` dá acesso à sua conta Google: guarde só como segredo do repositório, nunca em arquivo versionado
  (`.gitignore` já bloqueia `.clasprc.json` e `.clasp.json`).
- Um projeto Apps Script por igreja: use `SCRIPT_ID` diferente (a Etapa 17 automatiza isso).
