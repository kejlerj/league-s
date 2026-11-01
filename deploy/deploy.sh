#!/bin/sh
set -eu

image="$1"

if [ ! -f .env ]; then
  echo "no .env in $(pwd): copy .env.example to .env and fill it in" >&2
  exit 1
fi

IMAGE="$image" docker compose up -d --wait --remove-orphans

health=$(IMAGE="$image" docker compose exec -T api wget -qO- http://127.0.0.1:8080/health)
echo "health: $health"
case "$health" in
  *'"status":"up"'*) ;;
  *) echo "health check failed" >&2; exit 1 ;;
esac

if grep -q '^IMAGE=' .env; then
  sed -i.bak "s#^IMAGE=.*#IMAGE=$image#" .env
  rm -f .env.bak
else
  echo "IMAGE=$image" >> .env
fi

docker image ls league-s --format '{{.Repository}}:{{.Tag}}' | grep -vx "$image" | tail -n +3 | xargs -r docker image rm >/dev/null 2>&1 || true
