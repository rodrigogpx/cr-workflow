#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/opt/cac360/nginx-certs}"
shift || true
DOMAINS=("$@")

if [ "${#DOMAINS[@]}" -eq 0 ]; then
  DOMAINS=(cac360.com.br hml.cac360.com.br)
fi

mkdir -p "$ROOT"

for domain in "${DOMAINS[@]}"; do
  dir="$ROOT/live/$domain"
  mkdir -p "$dir"
  if [ ! -f "$dir/fullchain.pem" ] || [ ! -f "$dir/privkey.pem" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout "$dir/privkey.pem" -out "$dir/fullchain.pem" \
      -subj "/CN=$domain" 2>/dev/null
    cp "$dir/fullchain.pem" "$dir/chain.pem"
    echo "Certificado autoassinado criado/garantido para $domain"
  else
    echo "Cert já existe para $domain (mantido)."
  fi
done

echo "Conteúdo atual de $ROOT/live:"
ls -l "$ROOT/live" || true
