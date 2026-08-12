import { BookReader } from "../components/BookReader";
import { narrative, readingMinutes, storyChapters as chapters } from "../../content/chapters";

type ChaptersPageProps = {
  searchParams?: Promise<{ chapter?: string | string[] }>;
};

export default async function ChaptersPage({ searchParams }: ChaptersPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const requested = Array.isArray(params?.chapter) ? params.chapter[0] : params?.chapter;
  const active = Math.max(0, chapters.findIndex((chapter) => chapter.id === requested));
  const selected = chapters[active];
  const previous = active > 0 ? chapters[active - 1] : undefined;
  const following = active < chapters.length - 1 ? chapters[active + 1] : undefined;

  return <main className="reading-room">
    <div className="reading-shell">
      <aside className="chapter-index" aria-label="Готовые главы">
        <p className="index-head">Содержание</p>
        <a className="index-back" href="/">← В энциклопедию</a>
        {chapters.map((chapter, index) => <form key={chapter.id} action="/chapters" method="get">
          <input type="hidden" name="chapter" value={chapter.id} />
          <button type="submit" data-season={chapter.season} className={index === active ? "active" : ""} aria-current={index === active ? "page" : undefined}>
            <span className="index-meta">
              <span className="index-numeral">{chapter.numeral}</span>
              <span className="index-minutes">{readingMinutes(chapter.markdown)} мин</span>
            </span>
            <span className="index-title">{chapter.title}</span>
          </button>
        </form>)}
      </aside>

      <BookReader
        chapter={{
          id: selected.id,
          numeral: selected.numeral,
          title: selected.title,
          season: selected.season,
          rubric: selected.rubric,
          paragraphs: narrative(selected.markdown),
          minutes: readingMinutes(selected.markdown),
        }}
        prev={previous && { id: previous.id, title: previous.title }}
        next={following && { id: following.id, title: following.title }}
      />
    </div>
  </main>;
}
