"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AudioArchive } from "./components/AudioArchive";
import {
  archive, artifacts, canonStats, characters, continuity,
  episodes, navSections, places, plotThreads,
  type WikiGroup, type WikiSectionId, worldOverview, worldPrinciples,
} from "../content/wiki";

const searchable = [
  ...worldPrinciples.map((item) => ({ section: "world" as const, title: item.title, text: item.text })),
  ...places.map((item) => ({ section: "world" as const, title: item.name, text: item.text })),
  ...characters.map((item) => ({ section: "characters" as const, title: item.name, text: [...item.canon, item.arc, item.question].join(" ") })),
  ...episodes.map((item) => ({ section: "chronicle" as const, title: item.title, text: `${item.summary} ${item.details.join(" ")} ${item.beats.join(" ")}` })),
  ...plotThreads.map((item) => ({ section: "plot" as const, title: item.title, text: `${item.now} ${item.craft} ${item.payoff}` })),
  ...artifacts.map((item) => ({ section: "artifacts" as const, title: item.name, text: `${item.canon} ${item.rule}` })),
  ...continuity.map((item) => ({ section: "continuity" as const, title: item.issue, text: `${item.evidence} ${item.decision}` })),
];

const groups: WikiGroup[] = ["Канон", "Мастерская"];

/* One icon set: single 20px box, single stroke weight, no font-dependent glyphs. */
const icons = {
  search: "M10.5 3a7.5 7.5 0 1 0 4.55 13.45L20 21.5 21.5 20l-4.55-4.55A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z",
  arrowRight: "M5 12h13m0 0-5-5m5 5-5 5",
  home: "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21m0-18C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21M3.5 9h17m-17 6h17",
  people: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Zm7.5.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM3 19.5c0-3 2.7-5 6-5s6 2 6 5m2.5-5.2c2.1.4 3.5 1.9 3.5 4",
  scroll: "M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4Zm0 0a2 2 0 0 0-2 2v2h2M9 8h6M9 12h6M9 16h4",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  file: "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Zm0 0v4h4",
  chevron: "m6 9 6 6 6-6",
} as const;

function Icon({ d, className = "ico" }: { d: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={d} /></svg>;
}

const mobilePrimary: Array<{ id: WikiSectionId; icon: string }> = [
  { id: "overview", icon: icons.home },
  { id: "world", icon: icons.globe },
  { id: "characters", icon: icons.people },
  { id: "chronicle", icon: icons.scroll },
];

/* ---------------------------------------------------------------------------
   The volvelle — an almanac wheel used as an instrument, not an ornament.
   The first version drew winter broken at twelve o'clock, because that theft was
   the only confirmed fact. The story is finished now: all four parts are back
   with named keepers, so every arc is whole and carries its own pigment, and the
   readout names the person who holds that season rather than a rumour.
   --------------------------------------------------------------------------- */
const seasonRing = [
  { key: "winter", label: "Зима", labelX: 200, labelY: 100, arcs: ["M94.3 82.6 A158 158 0 0 1 305.7 82.6"] },
  { key: "spring", label: "Весна", labelX: 302, labelY: 204, arcs: ["M317.4 94.3 A158 158 0 0 1 317.4 305.7"] },
  { key: "summer", label: "Лето", labelX: 200, labelY: 310, arcs: ["M305.7 317.4 A158 158 0 0 1 94.3 317.4"] },
  { key: "autumn", label: "Осень", labelX: 98, labelY: 204, arcs: ["M82.6 305.7 A158 158 0 0 1 82.6 94.3"] },
] as const;

const ticks = Array.from({ length: 72 }, (_, index) => {
  const angle = (index * 5 * Math.PI) / 180;
  const inner = index % 3 === 0 ? 126 : 132;
  return {
    x1: (200 + inner * Math.sin(angle)).toFixed(1), y1: (200 - inner * Math.cos(angle)).toFixed(1),
    x2: (200 + 138 * Math.sin(angle)).toFixed(1), y2: (200 - 138 * Math.cos(angle)).toFixed(1),
  };
});

// Season -> the keeper and the state recorded for that part in the artifact
// catalogue, so the wheel reports real data rather than a decorative caption.
const seasonNames: Record<string, string> = { winter: "Зима", spring: "Весна", summer: "Лето", autumn: "Осень" };
function seasonPart(key: string) {
  return artifacts.find((item) => item.season === key);
}
function seasonState(key: string) {
  const part = seasonPart(key);
  return part ? `${part.owner} · ${part.state}` : "состояние неизвестно";
}

function Volvelle() {
  const [season, setSeason] = useState<string | null>(null);
  const onSeason = (key: string | null) => setSeason(key);

  return (
    <figure className="volvelle-wrap">
      <svg className="volvelle" viewBox="0 0 400 400" role="img"
        aria-label="Круг года замкнут: четыре части вернулись к четырём названным хранителям.">
        <circle className="v-ring" cx="200" cy="200" r="178" />
        <circle className="v-ring-inner" cx="200" cy="200" r="150" />
        <g className="v-ticks">{ticks.map((tick, index) => <line key={index} {...tick} />)}</g>

        {seasonRing.map((season) => (
          <g key={season.key} className="v-seg" tabIndex={0} role="button"
            aria-label={`${season.label}: ${seasonState(season.key)}`}
            onMouseEnter={() => onSeason(season.key)} onMouseLeave={() => onSeason(null)}
            onFocus={() => onSeason(season.key)} onBlur={() => onSeason(null)}>
            {season.arcs.map((arc, index) => (
              <path key={index} d={arc} className={`v-arc ${season.key} is-whole`} />
            ))}
            {season.arcs.map((arc, index) => <path key={`hit-${index}`} className="v-hit" d={arc} />)}
            <text className="v-season" x={season.labelX} y={season.labelY} textAnchor="middle">
              {season.label}
            </text>
          </g>
        ))}

        <circle className="v-core" cx="200" cy="200" r="46" />
        <g className="v-star">
          <path d="M200 138v14M200 248v14M138 200h14M248 200h14" />
          <path d="M156 156l10 10M244 244l-10-10M244 156l-10 10M156 244l10-10" opacity=".6" />
        </g>
        <text className="v-core-mark" x="200" y="214" textAnchor="middle">Т</text>
      </svg>
      <figcaption className="volvelle-legend">
        <b><i className="solid" />круг замкнут · осень → зима → весна → лето</b>
      </figcaption>
      <p className="volvelle-status" data-season={season ?? undefined} aria-live="polite">
        {season
          ? <><b>{seasonNames[season]}</b> — {seasonState(season)}</>
          : <span className="hint">Наведите на время года, чтобы узнать, у кого эта часть сейчас.</span>}
      </p>
    </figure>
  );
}

export default function Home() {
  const [active, setActive] = useState<WikiSectionId>("overview");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

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
      if (event.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  // After a section change, land keyboard focus on the new heading instead of
  // leaving it behind in the navigation.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const heading = frameRef.current?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [active]);

  // Scroll reveal is opt-in from JS, so the page reads completely without it.
  // The timeout is a safety net: nothing may stay invisible because an observer
  // callback never fired.
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) return;
    root.classList.add("reveal-on");

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    targets.forEach((target) => observer.observe(target));

    const safety = window.setTimeout(() => targets.forEach((target) => target.classList.add("is-in")), 1600);
    return () => {
      window.clearTimeout(safety);
      observer.disconnect();
    };
  }, [active]);

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
    setSheetOpen(false);
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
          {groups.map((group) => (
            <Fragment key={group}>
              <p className="nav-group label">{group}</p>
              {navSections.filter((item) => item.group === group).map((item) => (
                item.href
                  ? <a key={item.id} className="nav-item" href={item.href}>{item.label}</a>
                  : <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id as WikiSectionId)} aria-current={active === item.id ? "page" : undefined}>
                    {item.label}
                  </button>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-note"><span className="status-dot" /><p><strong>Живой канон</strong><br />Версия от 12 августа 2026</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="search-wrap">
            <Icon d={icons.search} />
            <input id="wiki-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Искать героя, место или артефакт…" aria-label="Поиск по энциклопедии" />
            <kbd>⌘ K</kbd>
            {query && (
              <div className="search-results" role="status" aria-live="polite">
                {results.length ? <>
                  <p className="search-count">Найдено: {results.length}</p>
                  {results.map((result) => (
                    <button key={`${result.section}-${result.title}`} onClick={() => navigate(result.section)}>
                      <span>{navSections.find((item) => item.id === result.section)?.label}</span><strong>{result.title}</strong>
                    </button>
                  ))}
                </> : <p className="search-empty">Ничего не найдено — попробуйте имя, место или артефакт.</p>}
              </div>
            )}
          </div>
          <div className="legend"><span className="dot canon" />история завершена · 18 глав</div>
        </header>

        <div className="page-frame section-enter" key={active} ref={frameRef}>
          {active === "overview" && <Overview navigate={navigate} />}
          {active === "world" && <World />}
          {active === "characters" && <Characters />}
          {active === "chronicle" && <Chronicle />}
          {active === "plot" && <Plot />}
          {active === "artifacts" && <Artifacts />}
          {active === "continuity" && <Continuity />}
          {active === "archive" && <Archive />}
        </div>
      </section>

      {/* Mobile navigation keeps real names; CSS reveals it only below 700px. */}
      <nav className="mobile-bar" aria-label="Основные разделы">
        {mobilePrimary.map((item) => {
          const section = navSections.find((entry) => entry.id === item.id);
          if (!section) return null;
          return (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => navigate(item.id)} aria-current={active === item.id ? "page" : undefined}>
              <Icon d={item.icon} /><strong>{section.short}</strong>
            </button>
          );
        })}
        <button
          className={sheetOpen || !mobilePrimary.some((item) => item.id === active) ? "active" : ""}
          onClick={() => setSheetOpen((open) => !open)}
          aria-expanded={sheetOpen}
          aria-label="Остальные разделы"
        >
          <Icon d={icons.more} /><strong>Ещё</strong>
        </button>
      </nav>

      {sheetOpen && <>
        <button className="mobile-sheet-scrim" onClick={() => setSheetOpen(false)} aria-label="Закрыть список разделов" />
        <div className="mobile-sheet" role="dialog" aria-label="Все разделы энциклопедии">
          {groups.map((group) => (
            <Fragment key={group}>
              <p>{group}</p>
              {navSections.filter((item) => item.group === group).map((item) => (
                item.href
                  ? <a key={item.id} href={item.href}>{item.label}</a>
                  : <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => navigate(item.id as WikiSectionId)}>{item.label}</button>
              ))}
            </Fragment>
          ))}
        </div>
      </>}
    </main>
  );
}

function PageHead({ group, kicker, title, intro }: { group: WikiGroup; kicker: string; title: string; intro: string }) {
  return <header className="page-head">
    <p className="page-head-meta label">{group}<em>·</em>{kicker}</p>
    <h1>{title}</h1><div className="rule" /><p className="lede">{intro}</p>
  </header>;
}

function Overview({ navigate }: { navigate: (section: WikiSectionId) => void }) {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <p className="overline">Летопись · том первый</p>
        <h1>
          <span className="line"><span>Мальчик,</span></span>
          <span className="line"><span>который достал</span></span>
          <span className="line"><span><em>до облаков</em></span></span>
        </h1>
        <p className="hero-intro">Тео — одиннадцатилетний мастер, фантазёр и тот, кто вернул временам года их границы. История дописана до конца: восемнадцать глав от лестницы до облаков до снега, выпавшего вовремя, — и все восемнадцать можно читать вслух, включая первые пять, переложенные из аудиозаписей.</p>
        <div className="hero-actions">
          <a className="primary" href="/chapters">Открыть читалку <Icon d={icons.arrowRight} /></a>
          <button className="text-button" onClick={() => navigate("chronicle")}>Смотреть хронику всех глав</button>
        </div>
      </div>
      <Volvelle />
    </section>

    {/* The ledger leads with the story's actual state, not with a headcount. */}
    <section className="ledger" aria-label="Состояние канона" data-reveal>
      <div className="alarm"><strong><span className="frost-mark" />Круг замкнут</strong><span>зима вернулась в свои границы</span></div>
      {canonStats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
    </section>

    {/* The cover artwork returns where a book actually puts it: a frontispiece
        plate facing the opening page. */}
    <figure className="frontispiece" data-reveal>
      <Image src="/characters-cover.png" width={1536} height={1024} priority alt="Тео, старец Весемир и принц Талос у воздушного замка" />
      <figcaption>
        <span>Фронтиспис</span>
        <strong>Тео · Весемир · Талос</strong>
        <em>Мальчик, наставник и принц — три голоса, на которых держится первый том.</em>
      </figcaption>
    </figure>

    <section className="overview-grid" data-reveal>
      <article className="featured-thread">
        <p className="card-kicker">Чем всё кончилось</p>
        <h2>Круг года нельзя<br />собрать приказом.</h2>
        <p>Четыре сезонные части соединяются только добровольным «да» четырёх хранителей — и потому враг годами уговаривал, а не нападал. Тео пришёл к нему без клинка и без свистка и просто попросил.</p>
        <button className="link-arrow" onClick={() => navigate("plot")}>Посмотреть все восемь линий <Icon d={icons.arrowRight} className="ico ico-sm" /></button>
      </article>
      <div className="quick-links">
        <button onClick={() => navigate("characters")}><strong>Кто есть кто</strong><small>тринадцать карточек персонажей</small><Icon d={icons.arrowRight} /></button>
        <button onClick={() => navigate("continuity")}><strong>Разобранные нестыковки</strong><small>десять вопросов, все закрыты</small><Icon d={icons.arrowRight} /></button>
        <a href="/chapters"><strong>Восемнадцать глав вслух</strong><small>от I «Замок над облаками» до XVIII «Круг года»</small><Icon d={icons.arrowRight} /></a>
      </div>
    </section>
  </>;
}

function World() {
  return <>
    <PageHead group="Канон" kicker="Атлас" title="Мир истории" intro="Мир строится от маленького и знакомого к большому и чудесному: деревня, дорога, богатая крепость, горный рубеж, заклятый лес и остановленный час. А кончается всё там же, где началось — на круглом холме над восемью соломенными крышами." />
    <figure className="world-plate" data-reveal>
      <Image src={worldOverview.image} width={1536} height={1024} alt={worldOverview.alt} />
      <figcaption><span>Панорама мира</span>{worldOverview.caption}</figcaption>
    </figure>
    {/* Every principle is canon now: the eighteen chapters established all of them,
        so the card no longer carries a canon/proposal badge. */}
    <div className="principle-grid" data-reveal>{worldPrinciples.map((item) => <article key={item.title} className="canon-card"><span>канон</span><h2>{item.title}</h2><p>{item.text}</p></article>)}</div>
    <h2 className="section-title">География пути</h2>
    {/* Numbering survives here because the places really are walked in order. */}
    <div className="route-line">{places.map((place, index) => <article key={place.name} data-reveal><div className="route-index">{String(index + 1).padStart(2, "0")}</div><div><span>{place.kind}</span><h3>{place.name}</h3><p>{place.text}</p></div></article>)}</div>
  </>;
}

function CharacterCard({ character }: { character: (typeof characters)[number] }) {
  const [open, setOpen] = useState(false);
  const visible = open ? character.canon : character.canon.slice(0, 3);
  const hidden = character.canon.length - 3;

  return <article className="character-card" data-reveal>
    {/* Characters introduced in chapters XIII–XVIII have no commissioned portrait
        yet, so the card falls back to an initial plate instead of a broken image. */}
    {character.image
      ? <Image className="character-portrait" src={character.image} width={1254} height={1254} alt={character.imageAlt} />
      : <div className="character-portrait is-initial" aria-hidden="true"><span>{character.mark}</span></div>}
    <div className="character-card-content">
      <div className="character-top"><span className="portrait-token">{character.mark}</span><div><p>{character.role}</p><h2>{character.name}</h2></div></div>
      <ul>{visible.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      {hidden > 0 && (
        <button className="character-more" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Свернуть" : `Ещё ${hidden} факта`}<Icon d={icons.chevron} className="ico ico-sm" />
        </button>
      )}
      <div className="arc"><span>ДУГА</span><p>{character.arc}</p></div>
      <blockquote>{character.question}</blockquote>
    </div>
  </article>;
}

function Characters() {
  return <>
    <PageHead group="Канон" kicker="Действующие лица" title="Персонажи" intro="Тринадцать карточек: факты из глав, пройденная дуга и главный вопрос героя — теперь с ответом, потому что история дописана до конца." />
    <div className="character-grid">{characters.map((character) => <CharacterCard key={character.name} character={character} />)}</div>
  </>;
}

function Chronicle() {
  return <>
    <PageHead group="Канон" kicker="Летопись" title="Восемнадцать глав" intro="Полная хронология: пять аудиосказок, записанных голосом, и тринадцать глав, дописанных текстом. Порядок событий, бытовые детали, решения Тео и цена каждого решения — от лестницы до облаков до снега, выпавшего вовремя." />
    <div className="timeline">{episodes.map((episode) => <article key={episode.no} data-reveal><div className="roman">{episode.no}</div><div className="episode-body"><div className="episode-meta"><span>{episode.date}</span><span>{episode.duration}</span><span>{episode.kind}</span></div><h2>{episode.title}</h2><p>{episode.summary}</p><ul className="episode-details">{episode.details.map((detail) => <li key={detail}>{detail}</li>)}</ul><div className="chips">{episode.beats.map((beat) => <span key={beat}>{beat}</span>)}</div>{episode.href && <a className="episode-read" href={episode.href}>Читать главу <Icon d={icons.arrowRight} className="ico ico-sm" /></a>}</div></article>)}</div>
  </>;
}

function Plot() {
  return <>
    <PageHead group="Мастерская" kicker="Сюжетные нити" title="Что держало историю" intro="Восемь линий, и все закрыты. У каждой — итог, приём, которым она держалась, и развязка, которую она обещала с самого начала." />
    <div className="thread-list">{plotThreads.map((thread) => <article key={thread.title} data-reveal><div className="thread-heading"><h2>{thread.title}</h2><span>{thread.state}</span></div><p>{thread.now}</p><dl><div><dt>Как сделано</dt><dd>{thread.craft}</dd></div><div><dt>Развязка</dt><dd>{thread.payoff}</dd></div></dl></article>)}</div>
  </>;
}

function Artifacts() {
  return <>
    <PageHead group="Канон" kicker="Каталог" title="Артефакты и правила" intro="Магия здесь создаёт сюжет, а не отменяет трудности: у каждого предмета есть возможность, граница и цена, и все три проверены в главах." />
    <div className="artifact-table">
      <div className="artifact-row artifact-header"><span aria-hidden="true" /><span>Артефакт</span><span>Что было в главах</span><span>Правило и цена</span></div>
      {/* data-season lets the four seasonal parts carry their own pigment; the
          personal gifts stay gold, because they belong to no season. */}
      {artifacts.map((artifact) => <article className="artifact-row" key={artifact.name} data-season={artifact.season ?? undefined}>
        <Image className="artifact-thumb" src={artifact.image} width={1254} height={1254} alt={artifact.imageAlt} />
        <div><h2>{artifact.name}</h2><p>{artifact.owner}</p><b>{artifact.state}</b></div>
        <p>{artifact.canon}</p>
        <p className="proposal">{artifact.rule}</p>
      </article>)}
    </div>
  </>;
}

function Continuity() {
  return <>
    <PageHead group="Мастерская" kicker="Редакторская" title="Разобранные нестыковки" intro="Десять вопросов, которые оставляли аудиосказки, — и глава, в которой каждый из них закрыт. Это уже не список задач, а протокол: что было слышно в записи и как это решено в тексте." />
    {/* Severity is the real signal, so the old row numbers are gone. */}
    <div className="continuity-list">{continuity.map((item) => <article key={item.issue} data-reveal><div className="issue-head"><h2>{item.issue}</h2><b className={`severity ${item.severity}`}>{item.severity}</b></div><div className="issue-columns"><div><h3>Что слышно в сказках</h3><p>{item.evidence}</p></div><div><h3>Рабочее решение</h3><p>{item.decision}</p></div></div></article>)}</div>
  </>;
}

function Archive() {
  return <>
    <PageHead group="Канон" kicker="Источники" title="Архив аудиосказок" intro="Пять исходных голосовых сохранены без изменений — это первоисточник глав I–V. Автоматическая расшифровка лежит рядом и служит источником для канона; имена и важные формулировки желательно сверять на слух." />
    <div className="archive-note"><strong>51 минута 35 секунд</strong><p>Локальная расшифровка Whisper · русский язык · исходники OGG</p></div>
    <AudioArchive tracks={archive} />
    <div className="source-map"><div><span>Оригиналы</span><code>archive/audio/</code></div><div><span>Сырая STT-расшифровка</span><code>content/raw-transcripts.json</code></div><div><span>Канон Wiki</span><code>content/wiki.ts</code></div></div>
  </>;
}
