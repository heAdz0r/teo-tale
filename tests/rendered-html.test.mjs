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
  assert.match(layout, /favicon\.svg/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/characters-cover.png", import.meta.url));
  await access(new URL("../public/favicon.svg", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  // Family recordings and raw STT stay intentionally outside the public repo.
  // Their absence must not prevent a clean clone from building or serving TTS.
  await assert.rejects(access(new URL("public/audio/19166.ogg", templateRoot)));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("server-renders the reading room, opening on chapter I", async () => {
  const response = await render("/chapters");
  assert.equal(response.status, 200);
  const html = await response.text();
  // the index lists every chapter; the reader itself opens the first one
  assert.match(html, /Замок над облаками/);
  assert.match(html, /В деревне, где жил Тео/);
  assert.match(html, /Порог, который не любит приказов/);
  assert.match(html, /Круг года/);
  assert.match(html, /Весемир/);
  assert.match(html, /Озвучить/);
  assert.match(html, /aria-label="Голос рассказчика"/);
  for (const voice of ["Ксения", "Бая", "Ксения II", "Айдар", "Евгений"]) {
    assert.match(html, new RegExp(voice));
  }
  assert.match(html, /data-direction-version="1"/);
  assert.match(html, /data-segments="[1-9][0-9]*"/);
  assert.doesNotMatch(html, /Вессимир|Талас\b/);
});

const readableChapters = [
  ["chapter-1", "Замок над облаками", "В деревне, где жил Тео"],
  ["chapter-2", "Сон об опустевшей деревне", "Прошёл месяц"],
  ["chapter-3", "Город и незнакомец", "Развилку Тео увидел издалека"],
  ["chapter-4", "Между коврами", "Тео проснулся среди ночи"],
  ["chapter-5", "Принц, который был вороном", "Приём кончился нескоро"],
  ["chapter-6", "Порог, который не любит приказов", "Тео ещё долго смотрел на принца"],
  ["chapter-7", "Ответ свистка", "Тео стоял среди первых деревьев"],
  ["chapter-8", "Зеркало первого снега", "Медная печать Талоса лежала"],
  ["chapter-9", "Голос в белой перчатке", "Щелчок под полом прозвучал негромко"],
  ["chapter-10", "Ворон, который знал", "Талос стоял по ту сторону зеркала"],
  ["chapter-11", "Совет, который сказал «нет»", "Совет собирали в комнате"],
  ["chapter-12", "Голос без приказа", "До часовой башни вели триста шестнадцать ступеней"],
  ["chapter-13", "Тихий Час", "Первое заседание совета без кольца"],
  ["chapter-14", "Что скрыли старейшины", "Но здесь же дети"],
  ["chapter-15", "Мальчик из-за моря", "Уходили на рассвете"],
  ["chapter-16", "Замок, который вернулся", "Обратная дорога заняла четыре дня"],
  ["chapter-17", "Четыре хранителя", "Северин остановился у первого дома"],
  ["chapter-18", "Круг года", "Крестовину от пугала подняли на холм"],
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
    assert.match(html, /aria-label="Голос рассказчика"/);
    assert.match(html, /data-segments="[1-9][0-9]*"/);
  });
}

test("ships complete revision-addressed Silero narration when generated", async (context) => {
  const catalogUrl = new URL("../public/audio/narration/catalog.json", import.meta.url);
  try {
    await access(catalogUrl);
  } catch {
    context.skip("narration is generated by the optional Docker Compose tts profile");
    return;
  }
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  assert.equal(catalog.model, "v5_5_ru");
  assert.equal(catalog.defaultVoice, "xenia");
  assert.equal(catalog.voices.length, 5);
  let teoMarked = 0;
  for (const voice of catalog.voices) {
    assert.deepEqual(voice.chapters, readableChapters.map(([id]) => id).sort());
    let segmentCount = 0;
    for (const [id] of readableChapters) {
      const manifest = JSON.parse(await readFile(new URL(`../public/audio/narration/${voice.id}/${id}/manifest.json`, import.meta.url), "utf8"));
      assert.equal(manifest.version, 2);
      assert.equal(manifest.chapter, id);
      assert.equal(manifest.model, "v5_5_ru");
      assert.equal(manifest.speaker, voice.id);
      assert.equal(manifest.directionRevision, catalog.directionRevision);
      assert.match(manifest.license, /CC-NC-BY/);
      assert.ok(manifest.segments.length > 0);
      for (const [index, segment] of manifest.segments.entries()) {
        assert.equal(segment.file, `${manifest.revision}-${index}.ogg`);
        assert.ok(segment.characters > 0 && segment.characters <= 700);
        assert.ok(segment.seconds > 0);
        assert.ok(segment.text.length > 0);
        assert.match(segment.ssml, /^<speak>.*<\/speak>$/s);
        if (segment.ssml.includes("Т+эо")) teoMarked += 1;
        await access(new URL(`../public/audio/narration/${voice.id}/${id}/${segment.file}`, import.meta.url));
        segmentCount += 1;
      }
    }
    assert.equal(segmentCount, 376);
  }
  assert.ok(teoMarked > 0);
});

test("chapter index and chronicle use server-readable chapter URLs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const readingRoom = await readFile(new URL("../app/chapters/page.tsx", import.meta.url), "utf8");
  const wiki = await readFile(new URL("../content/wiki.ts", import.meta.url), "utf8");
  const chapterSources = await readFile(new URL("../content/chapters.ts", import.meta.url), "utf8");

  for (const [id] of readableChapters) {
    // titles and numerals live in wiki.ts; content/chapters.ts owns the markdown
    assert.match(wiki, new RegExp(`id: "${id}"`));
    assert.match(chapterSources, new RegExp(`"${id}":`));
    assert.match(wiki, new RegExp(`/chapters\\?chapter=${id}`));
  }
  assert.doesNotMatch(page, /\/chapters#chapter-/);
  assert.doesNotMatch(page, /next\/link|<Link\b/);
  assert.doesNotMatch(readingRoom, /next\/link|<Link\b/);
  assert.doesNotMatch(readingRoom, /useEffect|window\.location\.hash|replaceState/);
});

test("the proposals mode is gone and the wiki points at the finished story", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const wiki = await readFile(new URL("../content/wiki.ts", import.meta.url), "utf8");

  // the three speculative routes, the editorial scenarios and the next-episode
  // blueprint were the "proposals" surface; the story is written, so they are out
  assert.doesNotMatch(wiki, /developmentRoutes|artifactScenarios|nextChapterBlueprint/);
  assert.doesNotMatch(page, /developmentRoutes|artifactScenarios|nextChapterBlueprint|function Workshop/);
  assert.doesNotMatch(wiki, /"предложение"|Предложение:|Редакторская гипотеза|редакторский сценарий/);

  // "Продолжения" is now a link into the reading room, not an in-page section
  assert.match(wiki, /label: "Продолжения".*href: "\/chapters"/);
  assert.doesNotMatch(wiki, /"workshop"/);

  const html = await (await render()).text();
  assert.match(html, /Продолжения/);
  assert.match(html, /href="\/chapters"/);
});

test("the overview reports a finished story, and the reader carries the closing chapters", async () => {
  // Only the overview section renders on the server; the rest are client sections.
  const home = await (await render()).text();
  assert.match(home, /Круг замкнут/);
  assert.match(home, /глав в летописи/);
  assert.match(home, /Открыть читалку/);
  assert.doesNotMatch(home, /Куда вести историю|Скелет следующих эпизодов|Зима украдена/);

  const reader = await (await render("/chapters")).text();
  for (const title of ["Тихий Час", "Четыре хранителя", "Круг года"]) {
    assert.match(reader, new RegExp(title));
  }
});
