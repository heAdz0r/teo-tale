#!/bin/sh
set -eu

git pull --ff-only
compose="docker compose -f compose.yaml -f compose.local.yaml"
$compose build site
$compose up -d site app

if ! $compose run --rm --no-deps --entrypoint sh app -c 'test -f /srv/narration/catalog.json'; then
  docker compose -f compose.yaml -f compose.local.yaml -f compose.tts.yaml --profile tts run --rm tts
  $compose restart app
fi

attempt=0
until [ "$attempt" -ge 30 ]; do
  if $compose exec -T app wget -qO- http://127.0.0.1/healthz | grep -q ok; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -ge 30 ]; then
  $compose logs --tail=100 site app
  exit 1
fi

$compose ps
