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
