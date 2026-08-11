"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import chapterSix from "../../content/continuations/06-porog-bez-prikazov.md?raw";
import chapterSeven from "../../content/continuations/07-otvet-svistka.md?raw";
import chapterEight from "../../content/continuations/08-zerkalo-pervogo-snega.md?raw";

const chapters = [
  { id: "chapter-6", numeral: "VI", title: "Порог, который не любит приказов", markdown: chapterSix },
  { id: "chapter-7", numeral: "VII", title: "Ответ свистка", markdown: chapterSeven },
  { id: "chapter-8", numeral: "VIII", title: "Зеркало первого снега", markdown: chapterEight },
];

function narrative(markdown: string) {
  const parts = markdown.split(/\n---\n/);
  return (parts[1] ?? markdown)
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replaceAll("\n", " "));
}

export default function ChaptersPage() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const index = chapters.findIndex((chapter) => chapter.id === window.location.hash.slice(1));
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => setActive(index));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selected = chapters[active];

  function choose(index: number) {
    setActive(index);
    window.history.replaceState(null, "", `#${chapters[index].id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <main className="reading-room">
    <header className="reading-topbar"><Link href="/#workshop">← Вернуться в Wiki</Link><span>Летопись Тео · продолжения</span></header>
    <div className="reading-layout">
      <aside className="chapter-index"><p>ГЛАВЫ</p>{chapters.map((chapter, index) => <button key={chapter.id} onClick={() => choose(index)} className={index === active ? "active" : ""}><span>{chapter.numeral}</span><strong>{chapter.title}</strong><small>11–12 минут</small></button>)}</aside>
      <article className="chapter-text">
        <header><p>ГЛАВА {selected.numeral}</p><h1>{selected.title}</h1><span>≈ 11–12 минут спокойного чтения</span></header>
        {narrative(selected.markdown).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <footer>{active < chapters.length - 1 ? <button onClick={() => choose(active + 1)}>Следующая глава →</button> : <Link href="/#workshop">Вернуться к вариантам развития →</Link>}</footer>
      </article>
    </div>
  </main>;
}
