// Silero is most stable on bounded passages. Short segments also keep the first
// play latency low while preserving enough context for sentence intonation.
export const NARRATION_CHUNK_CHARS = 700;

function splitLongPart(part: string, maxChars: number) {
  const words = part.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = word;
  }
  if (current) chunks.push(current);
  return chunks;
}

// A sentence ends at a run of .!?… plus any closing quotes or brackets, followed
// by whitespace or the end of the paragraph. This slices the paragraph instead of
// matching pieces out of it: `String.match` silently dropped every run it could
// not match, and the story uses the „…“ quote pair whose closing mark was not one
// of the marks the old pattern allowed after a full stop — so `„а если?“` was
// narrated as `„а “`. Slicing can never lose a character.
const SENTENCE_END = /[.!?…]+[»«”“„"')\]]*(?=\s|$)/gu;

function sentences(text: string) {
  const out: string[] = [];
  let start = 0;
  SENTENCE_END.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (end <= start) continue;
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Splits a chapter at paragraph and sentence boundaries. Every segment stays
 * below the practical long-text limits of local Silero inference.
 */
export function narrationSegments(paragraphs: string[], maxChars = NARRATION_CHUNK_CHARS) {
  // Mirror of `narration_segments` in scripts/narration_direction.py. The two must
  // agree segment for segment: Python's output is the Silero manifest, this one is
  // the browser-voice fallback and the `data-segments` count the reader shows. They
  // used to disagree — this side joined every sentence with a paragraph break and
  // ignored `* * *` entirely, so a chapter reported ~22 segments against the
  // manifest's ~24, with the pauses in different places.
  const units: { text: string; paragraphStart: boolean; startsScene: boolean }[] = [];
  let sceneBefore = false;
  for (const paragraph of paragraphs) {
    const text = paragraph.trim();
    if (!text) continue;
    if (text === "* * *") {
      sceneBefore = true;
      continue;
    }
    sentences(text).forEach((sentence, index) => {
      splitLongPart(sentence, maxChars).forEach((part, subindex) => {
        units.push({ text: part, paragraphStart: index === 0 && subindex === 0, startsScene: sceneBefore });
        sceneBefore = false;
      });
    });
  }

  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const separator = current ? (unit.paragraphStart ? "\n\n" : " ") : "";
    const candidate = `${current}${separator}${unit.text}`;
    if (unit.startsScene || (current && candidate.length > maxChars)) {
      if (current) chunks.push(current);
      current = unit.text;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
