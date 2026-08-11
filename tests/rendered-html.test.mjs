import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Teo family wiki", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/i);
  assert.match(html, /Летопись Тео/);
  assert.match(html, /Мальчик/);
  assert.match(html, /до облаков/);
  assert.match(html, /characters-cover\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("removes disposable starter surfaces and dependency", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(layout, /Летопись Тео/);
  assert.match(layout, /og\.png/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/characters-cover.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../content/raw-transcripts.json", import.meta.url));
  await access(new URL("../archive/audio/19166.ogg", import.meta.url));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("server-renders the continuation reading room", async () => {
  const response = await render("/chapters");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Порог, который не любит приказов/);
  assert.match(html, /Тео ещё долго смотрел на принца/);
  assert.match(html, /Весемир/);
  assert.match(html, /Талос/);
  assert.doesNotMatch(html, /Вессимир|Талас/);
});

const readableChapters = [
  ["chapter-6", "Порог, который не любит приказов", "Тео ещё долго смотрел на принца"],
  ["chapter-7", "Ответ свистка", "Тео стоял среди первых деревьев"],
  ["chapter-8", "Зеркало первого снега", "Медная печать Талоса лежала"],
  ["chapter-9", "Голос в белой перчатке", "Щелчок под полом прозвучал негромко"],
  ["chapter-10", "Ворон, который знал", "Талос стоял по ту сторону зеркала"],
  ["chapter-11", "Совет, который сказал «нет»", "Совет собирали в комнате"],
  ["chapter-12", "Голос без приказа", "До часовой башни вели триста шестнадцать ступеней"],
];

for (const [id, title, opening] of readableChapters) {
  test(`opens the full text for ${id} from its own URL`, async () => {
    const response = await render(`/chapters?chapter=${id}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(opening.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(`name="chapter" value="${id}"`));
    assert.match(html, new RegExp(`id="${id}"`));
  });
}

test("chapter cards use server-readable chapter URLs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const readingRoom = await readFile(new URL("../app/chapters/page.tsx", import.meta.url), "utf8");

  for (const [id] of readableChapters) {
    assert.match(page, new RegExp(`/chapters\\?chapter=${id}`));
    assert.match(readingRoom, new RegExp(`id: "${id}"`));
  }
  assert.doesNotMatch(page, /\/chapters#chapter-/);
  assert.doesNotMatch(readingRoom, /useEffect|window\.location\.hash|replaceState/);
});
