import Link from "next/link";
import chapterSix from "../../content/continuations/06-porog-bez-prikazov.md?raw";
import chapterSeven from "../../content/continuations/07-otvet-svistka.md?raw";
import chapterEight from "../../content/continuations/08-zerkalo-pervogo-snega.md?raw";
import chapterNine from "../../content/continuations/09-golos-v-beloy-perchatke.md?raw";
import chapterTen from "../../content/continuations/10-voron-kotoryy-znal.md?raw";
import chapterEleven from "../../content/continuations/11-sovet-kotoryy-skazal-net.md?raw";
import chapterTwelve from "../../content/continuations/12-golos-bez-prikaza.md?raw";

const chapters = [
  { id: "chapter-6", numeral: "VI", title: "Порог, который не любит приказов", markdown: chapterSix },
  { id: "chapter-7", numeral: "VII", title: "Ответ свистка", markdown: chapterSeven },
  { id: "chapter-8", numeral: "VIII", title: "Зеркало первого снега", markdown: chapterEight },
  { id: "chapter-9", numeral: "IX", title: "Голос в белой перчатке", markdown: chapterNine },
  { id: "chapter-10", numeral: "X", title: "Ворон, который знал", markdown: chapterTen },
  { id: "chapter-11", numeral: "XI", title: "Совет, который сказал «нет»", markdown: chapterEleven },
  { id: "chapter-12", numeral: "XII", title: "Голос без приказа", markdown: chapterTwelve },
] as const;

function narrative(markdown: string) {
  const parts = markdown.split(/\n---\n/);
  return (parts[1] ?? markdown)
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replaceAll("\n", " "))
    .filter(Boolean);
}

type ChaptersPageProps = {
  searchParams?: Promise<{ chapter?: string | string[] }>;
};

export default async function ChaptersPage({ searchParams }: ChaptersPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const requested = Array.isArray(params?.chapter) ? params.chapter[0] : params?.chapter;
  const active = Math.max(0, chapters.findIndex((chapter) => chapter.id === requested));
  const selected = chapters[active];

  return <main className="reading-room">
    <header className="reading-topbar"><Link href="/#workshop">← Вернуться в Wiki</Link><span>Летопись Тео · продолжения</span></header>
    <div className="reading-layout">
      <aside className="chapter-index" aria-label="Готовые главы"><p>ГЛАВЫ</p>{chapters.map((chapter, index) => <form key={chapter.id} action="/chapters" method="get"><input type="hidden" name="chapter" value={chapter.id} /><button type="submit" className={index === active ? "active" : ""} aria-current={index === active ? "page" : undefined}><span>{chapter.numeral}</span><strong>{chapter.title}</strong><small>11–12 минут</small></button></form>)}</aside>
      <article className="chapter-text" id={selected.id}>
        <header><p>ГЛАВА {selected.numeral}</p><h1>{selected.title}</h1><span>≈ 11–12 минут спокойного чтения</span></header>
        {narrative(selected.markdown).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <footer>{active < chapters.length - 1 ? <Link href={`/chapters?chapter=${chapters[active + 1].id}`}>Следующая глава →</Link> : <Link href="/#workshop">Вернуться к вариантам развития →</Link>}</footer>
      </article>
    </div>
  </main>;
}
