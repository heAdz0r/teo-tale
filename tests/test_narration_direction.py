import copy
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from narration_direction import (  # noqa: E402
    DirectionError,
    Segment,
    chapter_cues,
    direction_revision,
    load_direction,
    narration_segments,
    render_ssml,
)


def narrative(markdown: str) -> list[str]:
    body = markdown.split("\n---\n", 1)[-1].strip()
    return [" ".join(part.split()) for part in body.split("\n\n") if part.strip()]


class NarrationDirectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "content" / "narration" / "direction.json"
        cls.direction = load_direction(cls.path)

    def test_teo_pronunciation_and_cue_render_as_supported_ssml(self):
        segment = Segment("Тео поднял голову & замер.")
        cue = {
            "anchor": "поднял голову",
            "rate": "slow",
            "pitch": "low",
            "beforeMs": 200,
            "afterMs": 500,
        }
        ssml = render_ssml(segment, [cue], self.direction)
        self.assertIn("Т+эо", ssml)
        self.assertIn('&lt;', render_ssml(Segment("Тео < замка"), [], self.direction))
        self.assertIn('<break time="200ms"/>', ssml)
        self.assertIn('<prosody rate="slow" pitch="low">поднял голову</prosody>', ssml)
        self.assertIn('<break time="500ms"/>', ssml)

    def test_scene_and_paragraph_boundaries_survive_segmentation(self):
        segments = narration_segments(
            ["Первый абзац.", "Второй абзац.", "* * *", "Новая сцена."],
            700,
        )
        self.assertEqual(len(segments), 2)
        self.assertIn("\n\n", segments[0].text)
        self.assertTrue(segments[1].scene_before)
        ssml = render_ssml(segments[1], [], self.direction)
        self.assertIn('<break time="1100ms"/>', ssml)

    def test_every_repository_cue_is_unique_and_segment_local(self):
        files = sorted((ROOT / "content" / "continuations").glob("[0-9][0-9]-*.md"))
        checked = 0
        for path in files:
            chapter_id = f"chapter-{int(path.name[:2])}"
            paragraphs = narrative(path.read_text(encoding="utf-8"))
            segments = narration_segments(paragraphs, self.direction["defaults"]["maxChars"])
            checked += len(chapter_cues(chapter_id, paragraphs, segments, self.direction))
        self.assertEqual(checked, 20)

    def test_stale_cue_fails_before_synthesis(self):
        with self.assertRaisesRegex(DirectionError, "exactly once"):
            chapter_cues(
                "chapter-1",
                ["Совсем другой текст."],
                [Segment("Совсем другой текст.")],
                self.direction,
            )

    def test_direction_revision_changes_for_editorial_change(self):
        edited = copy.deepcopy(self.direction)
        edited["defaults"]["scenePauseMs"] += 1
        self.assertNotEqual(direction_revision(self.direction), direction_revision(edited))

    def test_schema_and_direction_stay_side_by_side(self):
        schema = json.loads((self.path.parent / "direction.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["version"]["const"], self.direction["version"])


if __name__ == "__main__":
    unittest.main()
