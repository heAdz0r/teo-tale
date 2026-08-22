"""Validated narration direction and SSML rendering for the Silero pipeline."""

from __future__ import annotations

import hashlib
import html
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


WORD_EDGE = r"А-Яа-яЁёA-Za-z0-9_"
ALLOWED_RATES = {"x-slow", "slow", "medium", "fast", "x-fast"}
ALLOWED_PITCHES = {"x-low", "low", "medium", "high", "x-high"}


@dataclass(frozen=True)
class Segment:
    text: str
    scene_before: bool = False


class DirectionError(ValueError):
    """Raised when narration direction is unsafe or no longer matches the story."""


def load_direction(path: Path) -> dict[str, Any]:
    try:
        direction = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DirectionError(f"Cannot read narration direction {path}: {error}") from error
    validate_direction(direction)
    return direction


def validate_direction(direction: dict[str, Any]) -> None:
    if direction.get("version") != 1:
        raise DirectionError("Narration direction must use version 1")
    voices = direction.get("voices")
    if not isinstance(voices, list) or not voices:
        raise DirectionError("Narration direction must declare at least one voice")
    voice_ids = [voice.get("id") for voice in voices if isinstance(voice, dict)]
    if len(voice_ids) != len(voices) or len(set(voice_ids)) != len(voice_ids):
        raise DirectionError("Narration voice IDs must be present and unique")
    if direction.get("defaultVoice") not in voice_ids:
        raise DirectionError("defaultVoice must reference a declared voice")

    defaults = direction.get("defaults", {})
    for key in ("maxChars", "paragraphPauseMs", "scenePauseMs"):
        if not isinstance(defaults.get(key), int) or defaults[key] < 0:
            raise DirectionError(f"defaults.{key} must be a non-negative integer")
    if defaults["maxChars"] < 100:
        raise DirectionError("defaults.maxChars is too small for stable narration")

    seen_words: set[str] = set()
    for item in direction.get("pronunciations", []):
        if not isinstance(item, dict) or not item.get("word") or not item.get("say"):
            raise DirectionError("Every pronunciation needs non-empty word and say values")
        folded = item["word"].casefold()
        if folded in seen_words:
            raise DirectionError(f"Duplicate pronunciation: {item['word']}")
        seen_words.add(folded)

    for chapter_id, chapter in direction.get("chapters", {}).items():
        if not re.fullmatch(r"chapter-[1-9][0-9]*", chapter_id):
            raise DirectionError(f"Invalid chapter key: {chapter_id}")
        for cue in chapter.get("cues", []):
            anchor = cue.get("anchor") if isinstance(cue, dict) else None
            if not isinstance(anchor, str) or not anchor.strip():
                raise DirectionError(f"Every cue in {chapter_id} needs an exact anchor")
            if cue.get("rate", "medium") not in ALLOWED_RATES:
                raise DirectionError(f"Unsupported rate in {chapter_id}: {cue.get('rate')}")
            if cue.get("pitch", "medium") not in ALLOWED_PITCHES:
                raise DirectionError(f"Unsupported pitch in {chapter_id}: {cue.get('pitch')}")
            for key in ("beforeMs", "afterMs"):
                if not isinstance(cue.get(key, 0), int) or cue.get(key, 0) < 0:
                    raise DirectionError(f"{key} must be a non-negative integer in {chapter_id}")


# A sentence ends at run of .!?… plus any closing quotes or brackets, followed by
# whitespace or the end of the paragraph. This slices the paragraph instead of
# matching pieces out of it: `re.findall` silently dropped every run it could not
# match, and the story uses the „…“ quote pair whose closing mark is not one of
# the marks the old pattern allowed after a full stop — so `„а если?“` narrated as
# `„а “`. Slicing can never lose a character.
_SENTENCE_END = re.compile(r'[.!?…]+[»«”“„"\')\]]*(?=\s|$)')


def _sentences(text: str) -> list[str]:
    sentences: list[str] = []
    start = 0
    for match in _SENTENCE_END.finditer(text):
        if match.end() <= start:
            continue
        piece = text[start:match.end()].strip()
        if piece:
            sentences.append(piece)
        start = match.end()
    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def _split_long_part(part: str, max_chars: int) -> list[str]:
    chunks: list[str] = []
    current = ""
    for word in part.split():
        candidate = f"{current} {word}" if current else word
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = word
    if current:
        chunks.append(current)
    return chunks


def narration_segments(paragraphs: list[str], max_chars: int) -> list[Segment]:
    """Pack prose without losing paragraph or scene boundaries."""
    units: list[tuple[str, bool, bool]] = []
    scene_before = False
    for paragraph in paragraphs:
        text = paragraph.strip()
        if not text:
            continue
        if text == "* * *":
            scene_before = True
            continue
        sentences = _sentences(text)
        for index, sentence in enumerate(sentences or [text]):
            for subindex, part in enumerate(_split_long_part(sentence.strip(), max_chars)):
                units.append((part, index == 0 and subindex == 0, scene_before))
                scene_before = False

    segments: list[Segment] = []
    current = ""
    current_scene = False
    for text, paragraph_start, starts_scene in units:
        separator = "\n\n" if paragraph_start and current else (" " if current else "")
        candidate = f"{current}{separator}{text}"
        if starts_scene or (current and len(candidate) > max_chars):
            if current:
                segments.append(Segment(current, current_scene))
            current = text
            current_scene = starts_scene
        else:
            current = candidate
            current_scene = current_scene or starts_scene
    if current:
        segments.append(Segment(current, current_scene))
    return segments


def _say_pronunciations(text: str, direction: dict[str, Any]) -> str:
    result = text
    for item in sorted(direction.get("pronunciations", []), key=lambda entry: len(entry["word"]), reverse=True):
        pattern = re.compile(
            rf"(?<![{WORD_EDGE}]){re.escape(item['word'])}(?![{WORD_EDGE}])",
            re.IGNORECASE,
        )

        def replace(match: re.Match[str]) -> str:
            spoken = item["say"]
            return spoken if match.group(0)[0].isupper() else spoken.lower()

        result = pattern.sub(replace, result)
    return result


def _break(milliseconds: int) -> str:
    return f'<break time="{milliseconds}ms"/>' if milliseconds else ""


def _spoken(text: str, direction: dict[str, Any]) -> str:
    return html.escape(_say_pronunciations(text, direction), quote=False)


def render_ssml(segment: Segment, cues: list[dict[str, Any]], direction: dict[str, Any]) -> str:
    matches: list[tuple[int, int, dict[str, Any]]] = []
    for cue in cues:
        starts = [match.start() for match in re.finditer(re.escape(cue["anchor"]), segment.text)]
        if not starts:
            continue
        if len(starts) != 1:
            raise DirectionError(f"Cue is ambiguous inside a segment: {cue['anchor']!r}")
        matches.append((starts[0], starts[0] + len(cue["anchor"]), cue))
    matches.sort(key=lambda item: item[0])
    for previous, current in zip(matches, matches[1:]):
        if current[0] < previous[1]:
            raise DirectionError(f"Overlapping cues: {previous[2]['anchor']!r} and {current[2]['anchor']!r}")

    parts: list[str] = []
    cursor = 0
    for start, end, cue in matches:
        parts.append(_spoken(segment.text[cursor:start], direction))
        rate = cue.get("rate", "medium")
        pitch = cue.get("pitch", "medium")
        directed = _spoken(cue.get("say", segment.text[start:end]), direction)
        parts.append(_break(cue.get("beforeMs", 0)))
        if rate != "medium" or pitch != "medium":
            directed = f'<prosody rate="{rate}" pitch="{pitch}">{directed}</prosody>'
        parts.append(directed)
        parts.append(_break(cue.get("afterMs", 0)))
        cursor = end
    parts.append(_spoken(segment.text[cursor:], direction))

    defaults = direction["defaults"]
    body = "".join(parts).replace("\n\n", _break(defaults["paragraphPauseMs"]))
    prefix = _break(defaults["scenePauseMs"]) if segment.scene_before else ""
    return f"<speak>{prefix}{body}</speak>"


def chapter_cues(chapter_id: str, paragraphs: list[str], segments: list[Segment], direction: dict[str, Any]) -> list[dict[str, Any]]:
    cues = direction.get("chapters", {}).get(chapter_id, {}).get("cues", [])
    chapter_text = "\n\n".join(paragraph for paragraph in paragraphs if paragraph.strip() != "* * *")
    for cue in cues:
        count = chapter_text.count(cue["anchor"])
        if count != 1:
            raise DirectionError(
                f"Cue anchor in {chapter_id} must occur exactly once, found {count}: {cue['anchor']!r}"
            )
        if not any(cue["anchor"] in segment.text for segment in segments):
            raise DirectionError(f"Cue crosses a segment boundary in {chapter_id}: {cue['anchor']!r}")
    return cues


def direction_revision(direction: dict[str, Any]) -> str:
    canonical = json.dumps(direction, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]


def narration_revision(paragraphs: list[str], direction: dict[str, Any]) -> str:
    # The revision names the audio files, so it has to cover everything that
    # decides what is spoken. Hashing only the paragraphs let a segmentation fix
    # ship without renaming a single file, leaving manifests describing audio
    # that no longer matched them.
    source = "\n\n".join(paragraphs)
    spoken = "\0".join(
        segment.text for segment in narration_segments(paragraphs, direction["defaults"]["maxChars"])
    )
    payload = f"{source}\0{direction_revision(direction)}\0{spoken}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
