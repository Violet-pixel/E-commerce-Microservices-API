#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo "Instale o Docker com Docker Compose antes de continuar."
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  db=$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))" 2>/dev/null || openssl rand -hex 18)
  sc=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" 2>/dev/null || openssl rand -hex 24)
  sed -i.bak "s/^DB_PASSWORD=.*/DB_PASSWORD=$db/; s/^SERVICE_CLIENT_SECRET=.*/SERVICE_CLIENT_SECRET=$sc/" .env && rm -f .env.bak
  echo "Arquivo .env criado com senhas aleatórias."
fi
docker compose up -d --build
port=$(grep '^APP_PORT=' .env | cut -d= -f2)
port=${port:-8080}
echo "Aguardando a API..."
i=0
until curl -fs "http://localhost:$port/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "A API demorou para responder. Veja: docker compose logs -f"
    exit 1
  fi
  sleep 2
done
echo "Cesto pronto em http://localhost:$port"
(command -v xdg-open >/dev/null && xdg-open "http://localhost:$port") || (command -v open >/dev/null && open "http://localhost:$port") || true
