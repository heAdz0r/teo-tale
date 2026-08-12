import { chapterIndex } from "./wiki";
import chapterOne from "./continuations/01-zamok-nad-oblakami.md?raw";
import chapterTwo from "./continuations/02-son-ob-opustevshey-derevne.md?raw";
import chapterThree from "./continuations/03-gorod-i-neznakomets.md?raw";
import chapterFour from "./continuations/04-mezhdu-kovrami.md?raw";
import chapterFive from "./continuations/05-prints-kotoryy-byl-voronom.md?raw";
import chapterSix from "./continuations/06-porog-bez-prikazov.md?raw";
import chapterSeven from "./continuations/07-otvet-svistka.md?raw";
import chapterEight from "./continuations/08-zerkalo-pervogo-snega.md?raw";
import chapterNine from "./continuations/09-golos-v-beloy-perchatke.md?raw";
import chapterTen from "./continuations/10-voron-kotoryy-znal.md?raw";
import chapterEleven from "./continuations/11-sovet-kotoryy-skazal-net.md?raw";
import chapterTwelve from "./continuations/12-golos-bez-prikaza.md?raw";
import chapterThirteen from "./continuations/13-tihiy-chas.md?raw";
import chapterFourteen from "./continuations/14-chto-skryli-stareyshiny.md?raw";
import chapterFifteen from "./continuations/15-malchik-iz-za-morya.md?raw";
import chapterSixteen from "./continuations/16-zamok-kotoryy-vernulsya.md?raw";
import chapterSeventeen from "./continuations/17-chetyre-hranitelya.md?raw";
import chapterEighteen from "./continuations/18-krug-goda.md?raw";

// Raw prose is centralized here because the reading room and the offline Silero
// generator must resolve the same immutable chapter text.
const sources: Record<string, string> = {
  "chapter-1": chapterOne,
  "chapter-2": chapterTwo,
  "chapter-3": chapterThree,
  "chapter-4": chapterFour,
  "chapter-5": chapterFive,
  "chapter-6": chapterSix,
  "chapter-7": chapterSeven,
  "chapter-8": chapterEight,
  "chapter-9": chapterNine,
  "chapter-10": chapterTen,
  "chapter-11": chapterEleven,
  "chapter-12": chapterTwelve,
  "chapter-13": chapterThirteen,
  "chapter-14": chapterFourteen,
  "chapter-15": chapterFifteen,
  "chapter-16": chapterSixteen,
  "chapter-17": chapterSeventeen,
  "chapter-18": chapterEighteen,
};

export function narrative(markdown: string) {
  const parts = markdown.split(/\n---\n/);
  return (parts[1] ?? markdown)
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replaceAll("\n", " "))
    .filter(Boolean);
}

export function readingMinutes(markdown: string) {
  const words = narrative(markdown).join(" ").split(/\s+/).filter(Boolean).length;
  const minutes = words / 120;
  return `${Math.max(1, Math.floor(minutes))}–${Math.max(2, Math.ceil(minutes) + 1)}`;
}

export const storyChapters = chapterIndex.map((chapter) => ({
  ...chapter,
  markdown: sources[chapter.id] ?? "",
}));

export function storyChapter(id: string) {
  return storyChapters.find((chapter) => chapter.id === id);
}
