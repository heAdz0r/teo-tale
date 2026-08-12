#!/bin/sh
set -eu

git pull --ff-only
docker compose build site
docker compose up -d site app

if ! docker compose run --rm --no-deps --entrypoint sh app -c 'test -f /srv/narration/catalog.json'; then
  docker compose -f compose.yaml -f compose.tts.yaml --profile tts run --rm tts
  docker compose restart app
fi

attempt=0
until [ "$attempt" -ge 30 ]; do
  if docker compose exec -T app wget -qO- http://127.0.0.1/healthz | grep -q ok; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -ge 30 ]; then
  docker compose logs --tail=100 site app
  exit 1
fi

docker compose ps
