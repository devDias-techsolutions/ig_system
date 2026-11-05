#!/usr/bin/env bash
# Envia o código para o Apps Script (uso local). Requer: npx clasp login (uma vez) e SCRIPT_ID.
# Uso:  SCRIPT_ID=xxxxx ./scripts/deploy.sh [ID_DA_IMPLANTACAO]
set -euo pipefail
: "${SCRIPT_ID:?Defina SCRIPT_ID (ID do projeto Apps Script: Configurações do projeto > IDs)}"
cd "$(dirname "$0")/.."
node scripts/preparar-deploy.js dist
printf '{"scriptId":"%s","rootDir":"dist"}\n' "$SCRIPT_ID" > .clasp.json
npx --yes @google/clasp@2 push --force
if [ -n "${1:-}" ]; then
  npx --yes @google/clasp@2 deploy --deploymentId "$1" --description "deploy $(git rev-parse --short HEAD 2>/dev/null || date +%F)"
fi
rm -f .clasp.json
