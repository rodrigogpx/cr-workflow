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
    docker run --rm --entrypoint sh -v "$ROOT":/etc/letsencrypt certbot/certbot:latest -c "
      set -e
      d=/etc/letsencrypt/live/$domain
      mkdir -p \"\$d\"
      openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout \"\$d/privkey.pem\" -out \"\$d/fullchain.pem\" \
        -subj '/CN=$domain' 2>/dev/null
      cp \"\$d/fullchain.pem\" \"\$d/chain.pem\"
      echo \"Certificado autoassinado criado/garantido para $domain\"
    "
  else
    echo "Cert já existe para $domain (mantido)."
  fi
done

echo "Conteúdo atual de $ROOT/live:"
docker run --rm -v "$ROOT":/etc/letsencrypt alpine sh -c "ls -l /etc/letsencrypt/live || true"
