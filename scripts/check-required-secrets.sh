#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Uso: $0 <environment> <SECRET_NAME...>"
  exit 1
fi

environment="$1"
shift

missing=()

for secret_name in "$@"; do
  if [ -z "${!secret_name:-}" ]; then
    missing+=("$secret_name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "❌ Segredos obrigatórios ausentes para o ambiente '$environment':"
  for item in "${missing[@]}"; do
    echo "  - $item"
  done
  exit 1
fi

echo "✅ Checklist de segredos obrigatórios concluído para '$environment'"
for secret_name in "$@"; do
  echo "  - $secret_name: definido"
done
