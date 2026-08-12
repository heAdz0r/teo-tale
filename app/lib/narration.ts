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

/**
 * Splits a chapter at paragraph and sentence boundaries. Every segment stays
 * below the practical long-text limits of local Silero inference.
 */
export function narrationSegments(paragraphs: string[], maxChars = NARRATION_CHUNK_CHARS) {
  const parts = paragraphs.flatMap((paragraph) => {
    const text = paragraph.trim();
    if (!text || text === "* * *") return [];
    const sentences = text.match(/[^.!?…]+(?:[.!?…]+[»”"]*)?(?:\s+|$)/gu);
    return (sentences ?? [text]).flatMap((sentence) => splitLongPart(sentence.trim(), maxChars));
  });

  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const candidate = current ? `${current}\n\n${part}` : part;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = part;
  }
  if (current) chunks.push(current);
  return chunks;
}
