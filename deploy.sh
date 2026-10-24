#!/usr/bin/env bash
#
# Deploy do backend: build e push das imagens (migrations + api),
# executa as migrations como job efemero no Swarm e, se concluirem,
# atualiza o service da API.
#
# Uso: ./deploy.sh

set -euo pipefail

# Garante que o build rode a partir da raiz de cantina-backend/
cd "$(dirname "$0")"

VPS="root@95.111.232.237"

API_IMAGE="h1bertobarbosa/cantina-backend:latest"
MIGRATIONS_IMAGE="h1bertobarbosa/cantina-backend-migrations:latest"

echo "==> Build das imagens (migrations + api)"
docker build --pull -f Dockerfile.migrations -t "$MIGRATIONS_IMAGE" .
docker build --pull -f Dockerfile -t "$API_IMAGE" .

echo "==> Push"
docker push "$MIGRATIONS_IMAGE"
docker push "$API_IMAGE"

# ------------------------------------------------------------------
# Migrations: roda na VPS como replicated-job. Se falharem, o ssh
# retorna non-zero e este script aborta ANTES de atualizar a API.
# ------------------------------------------------------------------
echo "==> Migrations em $VPS"
ssh "$VPS" "bash -s" <<'REMOTE'
set -Eeuo pipefail

IMAGE="h1bertobarbosa/cantina-backend-migrations:latest"
ENV_FILE="/opt/cantina/config/backend.env"
SERVICE="cantina-migrations-$(date +%s)"

echo "===== 1. BAIXANDO IMAGEM ====="
docker pull "$IMAGE"

DIGEST="$(docker image inspect "$IMAGE" \
  --format '{{index .RepoDigests 0}}')"

echo "Imagem: $DIGEST"

echo
echo "===== 2. EXECUTANDO MIGRATIONS ====="

docker service create \
  --name "$SERVICE" \
  --mode replicated-job \
  --replicas 1 \
  --max-concurrent 1 \
  --restart-condition none \
  --constraint 'node.role==manager' \
  --network cantina_db_network \
  --env-file "$ENV_FILE" \
  --limit-memory 256M \
  "$DIGEST" \
  --wait up

echo
echo "===== 3. STATUS ====="
docker service ps "$SERVICE" --no-trunc

echo
echo "===== 4. LOGS ====="
docker service logs "$SERVICE" --tail 100

echo
echo "===== 5. VERIFICANDO RESULTADO ====="

STATE="$(docker service ps "$SERVICE" \
  --format '{{.CurrentState}}' | head -1)"

if [[ "$STATE" == Complete* ]]; then
  echo "Migrations executadas com sucesso."
  docker service rm "$SERVICE"
else
  echo "ERRO: migrations nao concluidas."
  echo "Servico preservado para investigacao: $SERVICE"
  exit 1
fi

echo
echo "===== FIM ====="
REMOTE

echo "==> Update do service cantina-api_cantinabackend em $VPS"
ssh "$VPS" \
  "docker service update \
     --detach=false \
     --image $API_IMAGE \
     cantina-api_cantinabackend"

echo "==> Deploy concluido."
