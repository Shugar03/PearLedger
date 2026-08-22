#!/usr/bin/env bash
# Publica PearLedger en GitHub (requiere gh autenticado)
set -euo pipefail

REPO_NAME="${1:-pear-ledger}"
GITHUB_USER="${2:-}"

if ! gh auth status &>/dev/null; then
  echo "❌ GitHub CLI no autenticado."
  echo "   Ejecuta: gh auth login"
  exit 1
fi

if [ -z "$GITHUB_USER" ]; then
  GITHUB_USER="$(gh api user -q .login)"
fi

echo "🍐 Creando repo público: ${GITHUB_USER}/${REPO_NAME}"

gh repo create "${GITHUB_USER}/${REPO_NAME}" \
  --public \
  --source=. \
  --remote=github \
  --description "Agente local de tesorería P2P — Hackathon Aleph 2026" \
  --push

echo "✅ Repo publicado: https://github.com/${GITHUB_USER}/${REPO_NAME}"
