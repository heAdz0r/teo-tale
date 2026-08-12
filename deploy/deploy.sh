#!/bin/sh
set -eu

git pull --ff-only
docker compose build app
docker compose up -d app web

if ! docker compose run --rm --no-deps --entrypoint sh web -c 'test -f /srv/narration/catalog.json'; then
  docker compose --profile tts run --rm tts
  docker compose restart web
fi

attempt=0
until [ "$attempt" -ge 30 ]; do
  if docker compose exec -T web wget -qO- http://127.0.0.1/healthz | grep -q ok; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -ge 30 ]; then
  docker compose logs --tail=100 app web
  exit 1
fi

docker compose ps
