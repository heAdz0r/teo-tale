"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StoryNarrator } from "./StoryNarrator";

export type BookChapter = {
  id: string;
  numeral: string;
  title: string;
  season: string;
  rubric: string;
  paragraphs: string[];
  minutes: string;
};

type Settings = {
  size: number;   // px, body text
  leading: number; // unitless line-height
  measure: number; // rem, column width
  face: "serif" | "sans";
  tint: "vellum" | "sepia";
  mode: "paged" | "scroll"; // turning pages vs one long column
};

const DEFAULTS: Settings = { size: 20, leading: 1.75, measure: 34, face: "serif", tint: "vellum", mode: "paged" };
const STORE = "teo-reader";

const SIZES = [17, 18, 20, 22, 24, 26, 28];
const LEADINGS = [1.55, 1.75, 1.95];
const MEASURES = [28, 34, 40];

const glyphs = {
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  settings: "M6 5h12M6 12h12M6 19h12M9 3.5v3M15 10.5v3M11 17.5v3",
  close: "M6 6l12 12M18 6L6 18",
  back: "M19 12H6m0 0 5-5m-5 5 5 5",
  forward: "M5 12h13m0 0-5-5m5 5-5 5",
  paged: "M4 5h7v14H4zM13 5h7v14h-7z",
  scroll: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
} as const;

/* A headpiece per season, drawn rather than borrowed from a font: the motif that
   opens the chapter is the season the chapter belongs to. */
const headpieces: Record<string, string> = {
  winter: "M60 6v48M36 12l48 36M84 12L36 48M60 6l-6 8h12l-6-8M60 54l-6-8h12l-6 8",
  spring: "M60 54c0-16 0-26 0-26m0 0c0-10 8-18 18-18 0 12-8 18-18 18Zm0 0c0-10-8-18-18-18 0 12 8 18 18 18Z",
  summer: "M60 30a12 12 0 1 0 .1 0ZM60 4v10M60 46v10M34 30h10M76 30h10M42 12l7 7M71 41l7 7M78 12l-7 7M49 41l-7 7",
  autumn: "M60 54c0-14 6-24 14-30 8-6 14-8 14-8 0 12-4 22-12 28-8 6-16 10-16 10Zm0 0c0-14-6-24-14-30-8-6-14-8-14-8 0 12 4 22 12 28 8 6 16 10 16 10Z",
};

/* Scene-break ornaments also follow the season, so a pause looks like part of
   the same illumination rather than a generic dinkus. */
const ornaments: Record<string, string> = { winter: "❄", spring: "❧", summer: "✦", autumn: "❦" };

function Glyph({ d, className = "ico" }: { d: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={d} /></svg>;
}

/* Reading preferences are an external store (localStorage), so they are read
   through useSyncExternalStore: the server and the first client render both get
   DEFAULTS, and the saved settings are adopted without a state-setting effect.
   `snapshot` is cached because getSnapshot must be referentially stable. */
let snapshot: Settings | null = null;
const listeners = new Set<() => void>();

function readStore(): Settings {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): Settings {
  if (!snapshot) snapshot = readStore();
  return snapshot;
}

function getServerSnapshot(): Settings {
  return DEFAULTS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeStore(next: Settings) {
  snapshot = next;
  try { window.localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((listener) => listener());
}

export function BookReader({ chapter, prev, next }: {
  chapter: BookChapter;
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
}) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setSettings = writeStore;
  const [panel, setPanel] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [step, setStep] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const paged = settings.mode === "paged";
  // A reflow can shorten the book while the reader sits on a later page, so the
  // current page is clamped as it is read rather than corrected in an effect.
  const safePage = Math.max(0, Math.min(page, pages - 1));
  const turn = (delta: number) => setPage(Math.max(0, Math.min(pages - 1, safePage + delta)));

  // How far through this chapter the reader is, measured against the text block
  // rather than the document, so the header and footer do not skew it.
  useEffect(() => {
    if (paged) return;
    function onScroll() {
      const leaf = pageRef.current;
      if (!leaf) return;
      const start = leaf.offsetTop;
      const span = leaf.offsetHeight - window.innerHeight * 0.6;
      const value = span > 0 ? (window.scrollY - start) / span : 1;
      setProgress(Math.min(1, Math.max(0, value)));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [chapter.id, paged]);

  // Paged mode locks the document so the leaf itself is the whole view; the text
  // flows into CSS columns and a page turn is a translation by one column set.
  useEffect(() => {
    const root = document.documentElement;
    if (!paged) {
      root.classList.remove("reader-locked");
      return;
    }
    root.classList.add("reader-locked");
    return () => root.classList.remove("reader-locked");
  }, [paged]);

  // Snap the column height to a whole number of lines, so a page never ends on a
  // sliced line, then count how many page-turns the flow needs.
  useEffect(() => {
    const view = viewRef.current;
    const flow = flowRef.current;
    if (!view || !flow) return;

    // Scroll mode must not inherit the paged geometry: the measured height and
    // column count would clip the chapter to one screen.
    if (!paged) {
      view.style.width = "";
      flow.style.height = "";
      flow.style.columnCount = "";
      return;
    }

    const leaf = pageRef.current;
    let frame = 0;
    function measure() {
      if (!view || !flow || !leaf) return;

      // How many columns of exactly the chosen measure fit on the leaf. Letting
      // `column-width` decide would stretch a lone column to the full leaf, which
      // is how a 90-character line sneaks in.
      const box = getComputedStyle(leaf);
      const available = leaf.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
      const gap = parseFloat(getComputedStyle(flow).columnGap || "0") || 0;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const wanted = settings.measure * rem;
      const fits = Math.floor((available + gap) / (wanted + gap));
      const columns = Math.max(1, Math.min(2, fits));
      const width = columns > 1 ? columns * wanted + (columns - 1) * gap : Math.min(available, wanted);

      view.style.width = `${width}px`;
      flow.style.columnCount = String(columns);

      // Snap the height to whole lines so a page never ends on a sliced line.
      const line = settings.size * settings.leading;
      const lines = Math.max(6, Math.floor(view.clientHeight / line));
      flow.style.height = `${lines * line}px`;

      // Count real column boxes, then group them into spreads. Dividing
      // scrollWidth by the advance and rounding silently drops a final page whose
      // second column is empty.
      const columnWidth = (width - (columns - 1) * gap) / columns;
      const boxes = Math.max(1, Math.round((flow.scrollWidth + gap) / (columnWidth + gap)));
      setStep(width + gap);
      setPages(Math.max(1, Math.ceil(boxes / columns)));
    }
    // CHANGED: a hidden tab never runs requestAnimationFrame, so a chapter opened
    // in a background tab (cmd-click on "next chapter", a restored session) was
    // never measured: the flow kept its full natural height inside the clipped
    // viewport and all but the first screen of the chapter was unreachable, with
    // the pager stuck on "1 / 1". Layout metrics are available while hidden, so
    // measure straight away in that case and re-measure once the tab is shown.
    let timer = 0;
    function schedule() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (document.hidden) {
        timer = window.setTimeout(measure, 0);
        return;
      }
      frame = requestAnimationFrame(measure);
    }

    schedule();
    if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(() => {});
    // Observe the leaf, not the viewport: measure() resizes the viewport itself.
    const observer = new ResizeObserver(schedule);
    if (leaf) observer.observe(leaf);
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule); // CHANGED: re-measure on reveal
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer); // CHANGED
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule); // CHANGED
    };
  }, [paged, chapter.id, settings.size, settings.leading, settings.measure, settings.face]);

  useEffect(() => {
    if (!paged) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setPage(Math.min(pages - 1, safePage + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPage(Math.max(0, safePage - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, pages, safePage]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  const shiftSize = (delta: number) => {
    const at = SIZES.indexOf(settings.size);
    const index = at === -1 ? SIZES.indexOf(DEFAULTS.size) : at;
    const nextIndex = Math.min(SIZES.length - 1, Math.max(0, index + delta));
    set("size", SIZES[nextIndex]);
  };

  const read = paged ? (pages > 1 ? safePage / (pages - 1) : 1) : progress;

  const left = useMemo(() => {
    const total = Number(chapter.minutes.split("–")[1] ?? chapter.minutes);
    return Math.max(0, Math.round(total * (1 - read)));
  }, [chapter.minutes, read]);

  // The scene breaks are the chapter's real joints, so the margin thread marks
  // them as beads and the running head can say which part is open.
  const beads = useMemo(() => {
    const total = chapter.paragraphs.length;
    return chapter.paragraphs
      .map((paragraph, index) => (paragraph.trim() === "* * *" ? (index / total) * 100 : -1))
      .filter((value) => value >= 0);
  }, [chapter.paragraphs]);

  const part = useMemo(() => {
    const passed = beads.filter((bead) => bead <= read * 100).length;
    return { current: passed + 1, total: beads.length + 1 };
  }, [beads, read]);

  const ornament = ornaments[chapter.season] ?? "❧";
  const style = {
    ["--reader-size" as string]: `${settings.size}px`,
    ["--reader-leading" as string]: settings.leading,
    ["--reader-measure" as string]: `${settings.measure}rem`,
    ["--read" as string]: read,
  } as React.CSSProperties;

  return (
    <div className={paged ? "reader is-paged" : "reader is-scroll"} data-tint={settings.tint} data-face={settings.face} data-season={chapter.season} style={style}>
      <header className="reader-bar">
        <a className="reader-home" href="/#workshop"><Glyph d={glyphs.back} className="ico ico-sm" />Летопись</a>
        <p className="reader-running">
          <b>{chapter.numeral}</b>
          <span>{chapter.title}</span>
          <i>{paged ? `стр. ${safePage + 1} из ${pages}` : `часть ${part.current} из ${part.total}`}</i>
        </p>
        <div className="reader-tools">
          <StoryNarrator chapterId={chapter.id} paragraphs={chapter.paragraphs} />
          <span className="reader-left">{left > 0 ? `${left} мин` : "конец"}</span>
          <button className="reader-step" onClick={() => shiftSize(-1)} disabled={settings.size === SIZES[0]} aria-label="Уменьшить шрифт"><Glyph d={glyphs.minus} className="ico ico-sm" /></button>
          <button className="reader-step" onClick={() => shiftSize(1)} disabled={settings.size === SIZES[SIZES.length - 1]} aria-label="Увеличить шрифт"><Glyph d={glyphs.plus} className="ico ico-sm" /></button>
          <button className={panel ? "reader-step is-open" : "reader-step"} onClick={() => setPanel((open) => !open)} aria-expanded={panel} aria-label="Настройки чтения">
            <Glyph d={panel ? glyphs.close : glyphs.settings} className="ico ico-sm" />
          </button>
        </div>
      </header>

      {panel && (
        /* Every control shows what it does: the faces are set in themselves, the
           sizes are drawn at their own scale, the leading is three real lines,
           the width is a page diagram, the tint is a paper swatch. */
        <div className="reader-panel" role="dialog" aria-label="Настройки чтения">
          <section className="pane">
            <p>Чтение</p>
            <div className="pane-row">
              {([["paged", "страницами", glyphs.paged], ["scroll", "свитком", glyphs.scroll]] as const).map(([value, label, icon]) => (
                <button key={value} className={settings.mode === value ? "tile is-mode on" : "tile is-mode"} onClick={() => set("mode", value)}>
                  <Glyph d={icon} />
                  <small>{label}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pane">
            <p>Гарнитура</p>
            <div className="pane-row">
              {(["serif", "sans"] as const).map((face) => (
                <button key={face} data-face={face} className={settings.face === face ? "tile on" : "tile"} onClick={() => set("face", face)}>
                  <b className="tile-face">Аа</b>
                  <small>{face === "serif" ? "с засечками" : "без засечек"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pane">
            <p>Кегль</p>
            <div className="pane-row">
              {SIZES.map((value) => (
                <button key={value} className={settings.size === value ? "tile is-size on" : "tile is-size"} onClick={() => set("size", value)} aria-label={`${value} пикселей`}>
                  <b style={{ fontSize: `${Math.round(value * 0.86)}px` }}>А</b>
                  <small>{value}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pane">
            <p>Интерлиньяж</p>
            <div className="pane-row">
              {LEADINGS.map((value, index) => (
                <button key={value} className={settings.leading === value ? "tile on" : "tile"} onClick={() => set("leading", value)}>
                  <span className="tile-lines" style={{ ["--gap" as string]: `${value * 4}px` }} aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <small>{["плотно", "обычно", "свободно"][index]}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pane">
            <p>Полоса набора</p>
            <div className="pane-row">
              {MEASURES.map((value, index) => (
                <button key={value} className={settings.measure === value ? "tile on" : "tile"} onClick={() => set("measure", value)}>
                  <span className="tile-page" style={{ ["--w" as string]: `${40 + index * 18}%` }} aria-hidden="true">
                    <i /><i /><i /><i />
                  </span>
                  <small>{["узкая", "средняя", "широкая"][index]}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="pane">
            <p>Бумага</p>
            <div className="pane-row">
              {(["vellum", "sepia"] as const).map((tint) => (
                <button key={tint} data-tint={tint} className={settings.tint === tint ? "tile is-paper on" : "tile is-paper"} onClick={() => set("tint", tint)}>
                  <span className="tile-swatch" aria-hidden="true">Аа</span>
                  <small>{tint === "vellum" ? "пергамент" : "сепия"}</small>
                </button>
              ))}
            </div>
          </section>

          <button className="reader-reset" onClick={() => setSettings(DEFAULTS)}>Вернуть как было</button>
        </div>
      )}

      <div className="reader-page" ref={pageRef} id={chapter.id}>
        {/* Margin thread: fills as the chapter is read, beads mark the pauses. */}
        <div className="reader-thread" aria-hidden="true">
          <span className="thread-fill" style={{ height: `${progress * 100}%` }} />
          {beads.map((bead) => (
            <span key={bead} className={bead <= progress * 100 ? "thread-bead passed" : "thread-bead"} style={{ top: `${bead}%` }} />
          ))}
        </div>

        <span className="reader-folio" aria-hidden="true">{chapter.numeral}</span>


        <div className="book-viewport" ref={viewRef}>
          <div className="book-flow" ref={flowRef} style={paged ? { transform: `translateX(-${safePage * step}px)` } : undefined}>
            <header className="incipit">
              <svg className="headpiece" viewBox="0 0 120 60" aria-hidden="true">
                <path className="headpiece-rule" d="M0 30h34M86 30h34" />
                <path className="headpiece-motif" d={headpieces[chapter.season] ?? headpieces.winter} />
              </svg>
              <p className="rubric">Глава {chapter.numeral}</p>
              <h1>{chapter.title}</h1>
              <p className="argument">{chapter.rubric}</p>
              <p className="colophon">
                <span>{chapter.minutes} минут вслух</span>
                <em>{ornament}</em>
                <span>{part.total} части</span>
              </p>
            </header>
            <div className="book">
              {chapter.paragraphs.map((paragraph, index) => paragraph.trim() === "* * *"
                ? <p key={index} className="book-break" aria-hidden="true"><span>{ornament}</span></p>
                : <p key={index}>{paragraph}</p>)}
            </div>
          </div>
          {paged && <>
            <button className="turn-zone is-back" onClick={() => turn(-1)} disabled={safePage === 0} aria-label="Предыдущая страница" />
            <button className="turn-zone is-fwd" onClick={() => turn(1)} disabled={safePage >= pages - 1} aria-label="Следующая страница" />
          </>}
        </div>

        {paged && (
          <nav className="pager" aria-label="Страницы главы">
            <button onClick={() => turn(-1)} disabled={safePage === 0} aria-label="Предыдущая страница"><Glyph d={glyphs.back} className="ico ico-sm" /></button>
            <span className="pager-count">{safePage + 1} <i>/</i> {pages}</span>
            <button onClick={() => turn(1)} disabled={safePage >= pages - 1} aria-label="Следующая страница"><Glyph d={glyphs.forward} className="ico ico-sm" /></button>
          </nav>
        )}

        {/* CHANGED: in paged mode this footer used to mount only on the last page.
            It shares the leaf's flex column with the viewport, so appearing there
            shrank the viewport after the column height had been measured, and the
            last page ended on a sliced line. Keep it mounted and only veil it, so
            the measured height holds for every page. */}
        <footer className={!paged || safePage >= pages - 1 ? "reader-foot" : "reader-foot is-veiled"} aria-hidden={!paged || safePage >= pages - 1 ? undefined : true}>
          {prev
            ? <a className="reader-turn" href={`/chapters?chapter=${prev.id}`}><Glyph d={glyphs.back} className="ico ico-sm" /><span><small>Предыдущая глава</small>{prev.title}</span></a>
            : <a className="reader-turn" href="/#workshop"><Glyph d={glyphs.back} className="ico ico-sm" /><span><small>Назад</small>Все продолжения</span></a>}
          {next
            ? <a className="reader-turn is-next" href={`/chapters?chapter=${next.id}`}><span><small>Следующая глава</small>{next.title}</span><Glyph d={glyphs.forward} className="ico ico-sm" /></a>
            : <a className="reader-turn is-next" href="/#workshop"><span><small>Дальше</small>Варианты развития</span><Glyph d={glyphs.forward} className="ico ico-sm" /></a>}
        </footer>
      </div>
    </div>
  );
}
