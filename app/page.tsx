"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  archive, artifacts, artifactScenarios, canonStats, characters, continuity, developmentRoutes,
  episodes, navSections, nextChapterBlueprint, places, plotThreads,
  type WikiSectionId, worldOverview, worldPrinciples,
} from "../content/wiki";

const searchable = [
  ...worldPrinciples.map((item) => ({ section: "world" as const, title: item.title, text: item.text })),
  ...places.map((item) => ({ section: "world" as const, title: item.name, text: item.text })),
  ...characters.map((item) => ({ section: "characters" as const, title: item.name, text: [...item.canon, item.arc, item.question].join(" ") })),
  ...episodes.map((item) => ({ section: "chronicle" as const, title: item.title, text: `${item.summary} ${item.details.join(" ")} ${item.beats.join(" ")}` })),
  ...plotThreads.map((item) => ({ section: "plot" as const, title: item.title, text: `${item.now} ${item.strengthen} ${item.payoff}` })),
  ...artifacts.map((item) => ({ section: "artifacts" as const, title: item.name, text: `${item.canon} ${item.rule}` })),
  ...artifactScenarios.map((item) => ({ section: "artifacts" as const, title: item.artifact, text: `${item.situation} ${item.choicePrice} ${item.consequence}` })),
  ...continuity.map((item) => ({ section: "continuity" as const, title: item.issue, text: `${item.evidence} ${item.decision}` })),
  ...developmentRoutes.map((item) => ({ section: "workshop" as const, title: item.title, text: `${item.premise} ${item.next.join(" ")}` })),
];

export default function Home() {
  const [active, setActive] = useState<WikiSectionId>("overview");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const hash = window.location.hash.slice(1) as WikiSectionId;
    if (!navSections.some((item) => item.id === hash)) return;
    const frame = window.requestAnimationFrame(() => setActive(hash));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#wiki-search")?.focus();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    if (!normalized) return [];
    return searchable
      .filter((item) => `${item.title} ${item.text}`.toLocaleLowerCase("ru").includes(normalized))
      .slice(0, 8);
  }, [query]);

  function navigate(section: WikiSectionId) {
    setActive(section);
    setQuery("");
    window.history.replaceState(null, "", `#${section}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="wiki-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("overview")} aria-label="Открыть главную страницу">
          <span className="brand-sigil">Т</span>
          <span><strong>Летопись Тео</strong><small>семейная wiki</small></span>
        </button>
        <nav aria-label="Разделы энциклопедии">
          {navSections.map((item) => (
            <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)}>
              <span>{item.eyebrow}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="status-dot" /><p><strong>Живой канон</strong><br />Версия от 11 августа 2026</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="search-wrap">
            <span aria-hidden="true">⌕</span>
            <input id="wiki-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Искать героя, место или артефакт…" aria-label="Поиск по энциклопедии" />
            <kbd>⌘ K</kbd>
            {query && (
              <div className="search-results">
                {results.length ? results.map((result) => (
                  <button key={`${result.section}-${result.title}`} onClick={() => navigate(result.section)}>
                    <span>{navSections.find((item) => item.id === result.section)?.label}</span><strong>{result.title}</strong>
                  </button>
                )) : <p>Ничего не найдено</p>}
              </div>
            )}
          </div>
          <div className="legend"><span className="dot canon" />канон <span className="dot idea" />редакторское</div>
        </header>

        <div className="page-frame">
          {active === "overview" && <Overview navigate={navigate} />}
          {active === "world" && <World />}
          {active === "characters" && <Characters />}
          {active === "chronicle" && <Chronicle />}
          {active === "plot" && <Plot />}
          {active === "artifacts" && <Artifacts />}
          {active === "continuity" && <Continuity />}
          {active === "workshop" && <Workshop />}
          {active === "archive" && <Archive />}
        </div>
      </section>
    </main>
  );
}

function PageHead({ index, kicker, title, intro }: { index: string; kicker: string; title: string; intro: string }) {
  return <header className="page-head"><p>{index} / {kicker}</p><h1>{title}</h1><div className="rule" /><p className="lede">{intro}</p></header>;
}

function Overview({ navigate }: { navigate: (section: WikiSectionId) => void }) {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <p className="overline">КАНОН · ТОМ ПЕРВЫЙ</p>
        <h1>Мальчик,<br />который достал<br /><em>до облаков</em></h1>
        <p className="hero-intro">Тео — одиннадцатилетний мастер, фантазёр и будущий хранитель времён года. Это живая энциклопедия его мира: что уже случилось, что требует ответа и куда история может повернуть дальше.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => navigate("chronicle")}>Читать хронику <span>→</span></button>
          <button className="text-button" onClick={() => navigate("workshop")}>Открыть варианты сюжета</button>
        </div>
      </div>
      <figure className="cover-frame">
        <Image src="/characters-cover.png" width={1536} height={1024} priority alt="Тео, старец Весемир и принц Талос у воздушного замка" />
        <figcaption><span>Главные персонажи</span><strong>Тео · Весемир · Талос</strong></figcaption>
      </figure>
    </section>
    <section className="stats" aria-label="Сводка канона">{canonStats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</section>
    <section className="overview-grid">
      <article className="featured-thread"><p className="card-kicker">ГЛАВНЫЙ КОНФЛИКТ</p><h2>Кто-то собирает<br />времена года.</h2><p>Зимний артефакт исчез из сокровищницы Талоса. Первый снег уже выпал, а за горным хребтом скрыт проход к древней силе.</p><button onClick={() => navigate("plot")}>Проследить сюжетную линию →</button></article>
      <div className="quick-links">
        <button onClick={() => navigate("characters")}><span>02</span><strong>Кто есть кто</strong><small>6 карточек персонажей</small></button>
        <button onClick={() => navigate("continuity")}><span>06</span><strong>Что нужно уточнить</strong><small>8 нестыковок и решений</small></button>
        <button onClick={() => navigate("workshop")}><span>07</span><strong>Что будет дальше</strong><small>3 маршрута продолжения</small></button>
      </div>
    </section>
  </>;
}

function World() {
  return <>
    <PageHead index="01" kicker="АТЛАС" title="Мир истории" intro="Мир строится от маленького и знакомого к большому и чудесному: деревня, дорога, богатая крепость, горный рубеж и земли, где сама смена времён года стала оружием." />
    <figure className="world-plate">
      <Image src={worldOverview.image} width={1536} height={1024} alt={worldOverview.alt} />
      <figcaption><span>Панорама мира</span>{worldOverview.caption}</figcaption>
    </figure>
    <div className="principle-grid">{worldPrinciples.map((item) => <article key={item.title} className={item.status === "канон" ? "canon-card" : "idea-card"}><span>{item.status}</span><h2>{item.title}</h2><p>{item.text}</p></article>)}</div>
    <h2 className="section-title">География пути</h2>
    <div className="route-line">{places.map((place, index) => <article key={place.name}><div className="route-index">{String(index + 1).padStart(2, "0")}</div><div><span>{place.kind}</span><h3>{place.name}</h3><p>{place.text}</p></div></article>)}</div>
  </>;
}

function Characters() {
  return <>
    <PageHead index="02" kicker="ДЕЙСТВУЮЩИЕ ЛИЦА" title="Персонажи" intro="Карточки разделяют уже рассказанные факты, возможную внутреннюю арку и вопрос, который способен двигать героя дальше." />
    <div className="character-grid">{characters.map((character, index) => <article key={character.name} className="character-card">
      <Image className="character-portrait" src={character.image} width={1254} height={1254} alt={character.imageAlt} />
      <div className="character-card-content">
        <div className="character-top"><span className="portrait-token">{character.mark}</span><div><p>{character.role}</p><h2>{character.name}</h2></div><b>{String(index + 1).padStart(2, "0")}</b></div>
        <ul>{character.canon.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        <div className="arc"><span>ДУГА</span><p>{character.arc}</p></div><blockquote>{character.question}</blockquote>
      </div>
    </article>)}</div>
  </>;
}

function Chronicle() {
  return <>
    <PageHead index="03" kicker="ЛЕТОПИСЬ" title="Пять рассказанных глав" intro="Подробная хронология бережно следует пяти аудиозаписям: сохраняет порядок событий, маленькие бытовые детали, решения Тео и уже посеянные тайны, не смешивая канон с редакторскими продолжениями." />
    <div className="timeline">{episodes.map((episode) => <article key={episode.no}><div className="roman">{episode.no}</div><div className="episode-body"><div className="episode-meta"><span>{episode.date}</span><span>{episode.duration}</span></div><h2>{episode.title}</h2><p>{episode.summary}</p><ul className="episode-details">{episode.details.map((detail) => <li key={detail}>{detail}</li>)}</ul><div className="chips">{episode.beats.map((beat) => <span key={beat}>{beat}</span>)}</div></div></article>)}</div>
  </>;
}

function Plot() {
  return <>
    <PageHead index="04" kicker="СЮЖЕТНЫЕ НИТИ" title="Что держит историю" intro="Каждая линия получает текущее состояние, способ усиления и обещанную развязку. Это помогает не терять посеянные детали и строить главы с отдачей." />
    <div className="thread-list">{plotThreads.map((thread, index) => <article key={thread.title}><div className="thread-number">{String(index + 1).padStart(2, "0")}</div><div><div className="thread-heading"><h2>{thread.title}</h2><span>{thread.state}</span></div><p>{thread.now}</p><dl><div><dt>Как укрепить</dt><dd>{thread.strengthen}</dd></div><div><dt>Возможная отдача</dt><dd>{thread.payoff}</dd></div></dl></div></article>)}</div>
  </>;
}

function Artifacts() {
  return <>
    <PageHead index="05" kicker="КАТАЛОГ" title="Артефакты и правила" intro="Чтобы магия создавала сюжет, а не отменяла трудности, каждому предмету нужны ясная возможность, граница и цена." />
    <div className="artifact-table"><div className="artifact-row artifact-header"><span aria-hidden="true" /><span>Артефакт</span><span>Канон</span><span>Рабочее ограничение</span></div>{artifacts.map((artifact) => <article className="artifact-row" key={artifact.name}><Image className="artifact-thumb" src={artifact.image} width={1254} height={1254} alt={artifact.imageAlt} /><div><h2>{artifact.name}</h2><p>{artifact.owner}</p><b>{artifact.state}</b></div><p>{artifact.canon}</p><p className="proposal">{artifact.rule}</p></article>)}</div>
    <h2 className="section-title">Ситуации, где артефакт придётся применить</h2>
    <div className="scenario-grid">{artifactScenarios.map((scenario, index) => <article key={`${scenario.artifact}-${index}`}>
      <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{scenario.artifact}</strong></div>
      <h3>Ситуация</h3><p>{scenario.situation}</p>
      <h3>Выбор и цена</h3><p>{scenario.choicePrice}</p>
      <h3>Последствие</h3><p>{scenario.consequence}</p>
    </article>)}</div>
  </>;
}

function Continuity() {
  return <>
    <PageHead index="06" kicker="РЕДАКТОРСКАЯ" title="Нестыковки и решения" intro="Это не список ошибок, а карта мест, где одно уточнение способно сделать мир убедительнее. Рабочие решения можно принять, изменить или оставить загадкой." />
    <div className="continuity-list">{continuity.map((item, index) => <article key={item.issue}><div className="issue-head"><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.issue}</h2><b className={`severity ${item.severity}`}>{item.severity}</b></div><div className="issue-columns"><div><h3>Что слышно в сказках</h3><p>{item.evidence}</p></div><div><h3>Рабочее решение</h3><p>{item.decision}</p></div></div></article>)}</div>
  </>;
}

function Workshop() {
  const [route, setRoute] = useState(0);
  const selected = developmentRoutes[route];
  return <>
    <PageHead index="07" kicker="МАСТЕРСКАЯ АВТОРА" title="Куда вести историю" intro="Три направления не конкурируют насмерть: одно может стать внешним приключением, второе — тайной мира, третье — внутренним конфликтом союзника." />
    <div className="route-tabs" role="tablist" aria-label="Варианты продолжения">{developmentRoutes.map((item, index) => <button key={item.key} onClick={() => setRoute(index)} className={route === index ? "active" : ""} role="tab" aria-selected={route === index}><span>{item.key}</span>{item.title}</button>)}</div>
    <article className="route-detail"><div className="route-title"><div><p>{selected.tone}</p><h2>{selected.title}</h2></div><span>{selected.key}</span></div><p className="route-premise">{selected.premise}</p><h3>Три ближайших поворота</h3><ol>{selected.next.map((item) => <li key={item}>{item}</li>)}</ol><div className="why"><strong>Почему работает</strong><p>{selected.strength}</p></div></article>
    <h2 className="section-title">Семь готовых глав для чтения</h2>
    <div className="chapter-cards">
      <Link href="/chapters?chapter=chapter-6"><span>VI · 11–12 минут</span><strong>Порог, который не любит приказов</strong><p>Талос объясняет Полог, Тео пишет родителям и отвечает за историю с караваном.</p></Link>
      <Link href="/chapters?chapter=chapter-7"><span>VII · 11–12 минут</span><strong>Ответ свистка</strong><p>Свисток создаёт встречу, клинок требует решения, а лес начинает забирать память.</p></Link>
      <Link href="/chapters?chapter=chapter-8"><span>VIII · 11–12 минут</span><strong>Зеркало первого снега</strong><p>Тео раскрывает способ кражи и узнаёт, почему опасен даже осколок зимы.</p></Link>
      <Link href="/chapters?chapter=chapter-9"><span>IX · 11–12 минут</span><strong>Голос в белой перчатке</strong><p>Отражение крадёт голос Талоса, а Тео и Лея останавливают первый замок весенней двери.</p></Link>
      <Link href="/chapters?chapter=chapter-10"><span>X · 11–12 минут</span><strong>Ворон, который знал</strong><p>Талос раскрывает сон Весемира и объясняет, почему следил за Тео с самого начала.</p></Link>
      <Link href="/chapters?chapter=chapter-11"><span>XI · 11–12 минут</span><strong>Совет, который сказал «нет»</strong><p>Принц признаётся в опасности своего дара, а двор учится проверять даже знакомый голос.</p></Link>
      <Link href="/chapters?chapter=chapter-12"><span>XII · 11–12 минут</span><strong>Голос без приказа</strong><p>Свисток возвращает помощь отца, Талос отказывается от преимущества, а весенняя дверь закрывается.</p></Link>
    </div>
    <h2 className="section-title">Скелет следующих эпизодов</h2><div className="blueprint">{nextChapterBlueprint.map((item) => <article key={item.beat}><span>{item.beat}</span><p>{item.text}</p></article>)}</div>
  </>;
}

function Archive() {
  return <>
    <PageHead index="08" kicker="ИСТОЧНИКИ" title="Архив аудиосказок" intro="Пять исходных голосовых сохранены без изменений. Автоматическая расшифровка лежит рядом и служит источником для канона; имена и важные формулировки желательно сверять на слух." />
    <div className="archive-note"><strong>51 минут 35 секунд</strong><p>Локальная расшифровка Whisper · русский язык · исходники OGG</p></div>
    <div className="archive-list">{archive.map((item) => <article key={item.id}><span className="file-icon">◉</span><div><h2>{item.chapter}</h2><p>{item.date} · сообщение #{item.id}</p></div><strong>{item.duration}</strong><code>{item.file}</code></article>)}</div>
    <div className="source-map"><div><span>Оригиналы</span><code>archive/audio/</code></div><div><span>Сырая STT-расшифровка</span><code>content/raw-transcripts.json</code></div><div><span>Канон Wiki</span><code>content/wiki.ts</code></div></div>
  </>;
}
