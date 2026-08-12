# Летопись Тео

Семейная wiki по пяти авторским аудиосказкам: мир, персонажи, хронология,
сюжетные линии, артефакты, реестр нестыковок и варианты продолжения.

## Содержание проекта

- `archive/audio/` — пять исходных записей OGG;
- `content/raw-transcripts.json` — автоматическая STT-расшифровка;
- `content/wiki.ts` — отредактированный канон и редакторская мастерская;
- `content/continuations/` — готовые главы-продолжения для чтения вслух;
- `app/` — интерактивный интерфейс wiki.

Исходные аудио и сырая расшифровка намеренно исключены из Git и публикации;
они остаются только в локальной директории проекта.

Wiki работает на [vinext](https://github.com/cloudflare/vinext).

## Prerequisites

- Node.js `>=22.13.0`
- Bun `>=1.2` для рекомендуемого локального запуска

## Quick Start

```bash
bun install
bun run dev
```

Wiki откроется по адресу, который напечатает dev-сервер (обычно
`http://localhost:3000`). Проверить production-сборку и тесты можно так:

```bash
bun run build
bun run test:bun
```

Сценарии остаются совместимы с npm: `npm install`, `npm run dev`, `npm test`.

## Озвучка Silero

Читалка воспроизводит заранее сгенерированные OGG-фрагменты Silero `v5_5_ru`.
Для локальной генерации нужны Python 3, PyTorch и `ffmpeg` с `libopus`:

```bash
python3 -m pip install -r requirements-tts.txt
npm run tts:sample
python3 scripts/generate_silero_narration.py --chapter chapter-6
npm run tts:generate
```

Режиссёрский источник — `content/narration/direction.json`: там находятся
ручные ударения имён, произносимые варианты фраз, паузы, темп и высота тона.
Перед генерацией его точные текстовые якоря проверяются командой
`npm run tts:validate`; синтез не начнётся при устаревшей или неоднозначной
разметке. Синтаксис и правила редактирования описаны в
`content/narration/README.md`.

По умолчанию используется голос `xenia`. Один другой голос генерируется через
`--speaker aidar|baya|kseniya|xenia|eugene`, все доступные голоса и их образцы —
командами `npm run tts:all-voices` и `npm run tts:samples`. Интерфейс показывает
селектор рассказчика и загружает манифест из
`public/audio/narration/<voice>/chapter-N/`. Если выбранного пакета нет,
используется системный голос браузера `ru-RU`.

Модель кэшируется в `.cache/silero/`. Изменение текста или режиссуры создаёт
новую SHA-256-ревизию имён файлов, поэтому CDN не отдаст старое произношение.
Готовые OGG и веса модели не хранятся в Git: их воспроизводит генератор из
текста и `content/narration/direction.json`.

## Docker Compose

Репозиторий не содержит сгенерированные OGG и веса модели. На сервере они
создаются в named volumes и не теряются при пересборке приложения:

```bash
docker compose -f compose.yaml -f compose.tts.yaml --profile tts run --rm tts
TEO_PORT=8080 docker compose up -d --build site app
docker compose --profile smoke run --rm smoke
```

Первый синтез всех пяти голосов требует сети, нескольких гигабайт свободного
места и до 4 ГБ RAM. Последующие запуски генератора идемпотентны. Для обычного
обновления достаточно `./deploy/deploy.sh`: он запускает TTS только при пустом
volume. Внешний bind и порт задаются через `TEO_BIND` и `TEO_PORT`.
Production-домен — `https://teo.superlapka.ru`; `www` перенаправляется на него.
В Coolify оба домена должны быть назначены публичному сервису `app` (Nginx),
а `site` остаётся внутренним приложением без домена.

Upstream обозначает лицензию весов Silero как CC-NC-BY. Перед любым
коммерческим использованием проверьте актуальную лицензию проекта Silero.

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `bun run dev`: запустить Wiki локально
- `bun run build`: проверить production-сборку vinext
- `bun run test:bun`: собрать Wiki и проверить все серверные страницы через Bun
- `bun run db:generate`: сгенерировать миграции Drizzle после изменения схемы

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
