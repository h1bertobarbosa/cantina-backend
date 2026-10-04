#!/usr/bin/env bash

set -euo pipefail

docker build -t h1bertobarbosa/cantina-backend-migrations:latest -f Dockerfile.migrations .
docker build -t h1bertobarbosa/cantina-backend:latest -f Dockerfile .

docker push h1bertobarbosa/cantina-backend-migrations:latest
docker push h1bertobarbosa/cantina-backend:latest

ssh deploy@5.252.52.54 <<'REMOTE_DEPLOY'
set -euo pipefail

cd ~/cantina-backend
git pull --ff-only

docker pull h1bertobarbosa/cantina-backend-migrations:latest
docker pull h1bertobarbosa/cantina-backend:latest

docker stack deploy -c docker-compose.prd.yml cantina
REMOTE_DEPLOY
