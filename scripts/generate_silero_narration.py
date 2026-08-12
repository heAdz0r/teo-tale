#!/usr/bin/env python3
"""Generate cache-safe static OGG narration with Silero v5.5 Russian TTS."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

from narration_direction import (
    DirectionError,
    chapter_cues,
    direction_revision,
    load_direction,
    narration_revision,
    narration_segments,
    render_ssml,
)

try:
    import torch
except ImportError as error:
    raise SystemExit(
        "PyTorch is required. Run: python3 -m pip install -r requirements-tts.txt"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = "v5_5_ru"
MODEL_URL = "https://models.silero.ai/models/tts/ru/v5_5_ru.pt"
MODEL_LICENSE = "CC-NC-BY (see https://github.com/snakers4/silero-models)"
SPEAKERS = ("aidar", "baya", "kseniya", "xenia", "eugene")


def narrative(markdown: str) -> list[str]:
    body = markdown.split("\n---\n", 1)[-1].strip()
    return [
        re.sub(r"\s*\n\s*", " ", part).strip()
        for part in re.split(r"\n\s*\n", body)
        if part.strip()
    ]


def load_model(cache: Path):
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        partial = cache.with_suffix(".part")
        print(f"Downloading {MODEL_ID}…", flush=True)
        if shutil.which("curl") is None:
            raise SystemExit("curl is required for the resumable Silero model download")
        subprocess.run(
            [
                "curl", "--fail", "--location", "--continue-at", "-",
                "--retry", "5", "--retry-all-errors", "--retry-delay", "2",
                "--output", str(partial), MODEL_URL,
            ],
            check=True,
        )
        if partial.stat().st_size < 100_000_000:
            raise SystemExit(f"Downloaded Silero model is unexpectedly small: {partial.stat().st_size} bytes")
        partial.replace(cache)
    print(f"Loading {MODEL_ID} on CPU…", flush=True)
    model = torch.package.PackageImporter(str(cache)).load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    return model


def write_wav(path: Path, audio, sample_rate: int) -> None:
    samples = audio.detach().cpu().clamp(-1, 1).mul(32767).to(torch.int16).numpy()
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(samples.tobytes())


def synthesize(
    model,
    ssml: str,
    destination: Path,
    speaker: str,
    sample_rate: int,
    bitrate: str,
) -> float:
    destination.parent.mkdir(parents=True, exist_ok=True)
    wav_path = destination.with_suffix(".tmp.wav")
    ogg_path = destination.with_suffix(".tmp.ogg")
    audio = model.apply_tts(
        ssml_text=ssml,
        speaker=speaker,
        sample_rate=sample_rate,
        put_accent=True,
        put_yo=True,
    )
    write_wav(wav_path, audio, sample_rate)
    try:
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(wav_path), "-c:a", "libopus", "-b:a", bitrate,
                str(ogg_path),
            ],
            check=True,
        )
        ogg_path.replace(destination)
    finally:
        wav_path.unlink(missing_ok=True)
        ogg_path.unlink(missing_ok=True)
    return len(audio) / sample_rate


def audio_duration(path: Path) -> float | None:
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return float(probe.stdout.strip()) if probe.returncode == 0 else None
    except ValueError:
        return None


def chapter_files(selected: str | None) -> list[Path]:
    files = sorted((ROOT / "content" / "continuations").glob("[0-9][0-9]-*.md"))
    if selected:
        number = int(selected.removeprefix("chapter-"))
        files = [path for path in files if path.name.startswith(f"{number:02d}-")]
    if not files:
        raise SystemExit(f"No continuation markdown found for {selected or 'story'}")
    return files


def prepared_chapters(selected: str | None, direction: dict) -> list[dict]:
    chapters = []
    max_chars = direction["defaults"]["maxChars"]
    for markdown_path in chapter_files(selected):
        number = int(markdown_path.name[:2])
        chapter_id = f"chapter-{number}"
        paragraphs = narrative(markdown_path.read_text(encoding="utf-8"))
        segments = narration_segments(paragraphs, max_chars)
        cues = chapter_cues(chapter_id, paragraphs, segments, direction)
        chapters.append(
            {
                "id": chapter_id,
                "paragraphs": paragraphs,
                "revision": narration_revision(paragraphs, direction),
                "segments": [
                    {
                        "text": segment.text,
                        "ssml": render_ssml(segment, cues, direction),
                        "sceneBefore": segment.scene_before,
                    }
                    for segment in segments
                ],
            }
        )
    return chapters


def write_catalog(output: Path, direction: dict) -> None:
    voices = []
    for configured in direction["voices"]:
        voice_dir = output / configured["id"]
        chapters = sorted(
            path.parent.name
            for path in voice_dir.glob("chapter-*/manifest.json")
        )
        voices.append({**configured, "chapters": chapters})
    output.mkdir(parents=True, exist_ok=True)
    (output / "catalog.json").write_text(
        json.dumps(
            {
                "version": 1,
                "model": MODEL_ID,
                "defaultVoice": direction["defaultVoice"],
                "directionRevision": direction_revision(direction),
                "voices": voices,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chapter", help="Generate one chapter, for example chapter-6")
    parser.add_argument("--speaker", choices=SPEAKERS, help="Generate one voice (default from direction.json)")
    parser.add_argument("--all-speakers", action="store_true", help="Generate all voices declared in direction.json")
    parser.add_argument("--sample", action="store_true", help="Generate a short voice audition only")
    parser.add_argument("--validate-only", action="store_true", help="Validate direction and anchors without loading Silero")
    parser.add_argument("--sample-rate", type=int, choices=(24000, 48000), default=48000)
    parser.add_argument("--bitrate", default="48k")
    parser.add_argument("--force", action="store_true", help="Regenerate existing revision-matched audio")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "audio" / "narration")
    parser.add_argument(
        "--model-cache",
        type=Path,
        default=ROOT / ".cache" / "silero" / f"{MODEL_ID}.pt",
    )
    parser.add_argument(
        "--direction",
        type=Path,
        default=ROOT / "content" / "narration" / "direction.json",
    )
    args = parser.parse_args()

    try:
        direction = load_direction(args.direction)
        chapters = prepared_chapters(args.chapter, direction)
    except DirectionError as error:
        raise SystemExit(f"Narration direction is invalid: {error}") from error
    if direction.get("model") != MODEL_ID:
        raise SystemExit(f"Narration direction targets {direction.get('model')}, generator uses {MODEL_ID}")
    configured_speakers = tuple(voice["id"] for voice in direction["voices"])
    if any(speaker not in SPEAKERS for speaker in configured_speakers):
        raise SystemExit("Narration direction contains a speaker unavailable in Silero v5_5_ru")
    speakers = configured_speakers if args.all_speakers else (args.speaker or direction["defaultVoice"],)
    segment_count = sum(len(chapter["segments"]) for chapter in chapters)
    cue_count = sum(len(direction.get("chapters", {}).get(chapter["id"], {}).get("cues", [])) for chapter in chapters)
    print(
        f"Direction {direction_revision(direction)} is valid: "
        f"{len(chapters)} chapters, {segment_count} segments, {cue_count} cues, "
        f"{len(direction.get('pronunciations', []))} pronunciations"
    )
    if args.validate_only:
        return 0
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg with libopus is required to encode web-ready OGG files")
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
    model = load_model(args.model_cache)

    if args.sample:
        for speaker in speakers:
            text = (
                "Тео поднял голову. Талос молчал, а Весемир смотрел из-за Полога. "
                "Орт позвал Северина; Лея и тётка Меланья обернулись. "
                "«Ты тоже его видишь?» — шёпотом спросил Тео."
            )
            destination = args.output / "samples" / f"{speaker}.ogg"
            seconds = synthesize(
                model,
                render_ssml(narration_segments([text], direction["defaults"]["maxChars"])[0], [], direction),
                destination,
                speaker,
                args.sample_rate,
                args.bitrate,
            )
            print(f"Generated {destination.relative_to(ROOT)} ({seconds:.1f}s)")
        write_catalog(args.output, direction)
        return 0

    for speaker in speakers:
        for chapter in chapters:
            chapter_id = chapter["id"]
            chapter_revision = chapter["revision"]
            segments = chapter["segments"]
            output_dir = args.output / speaker / chapter_id
            manifest_path = output_dir / "manifest.json"
            previous_durations: dict[str, float | None] = {}
            if manifest_path.exists():
                try:
                    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
                    previous_durations = {
                        item["file"]: item.get("seconds")
                        for item in previous.get("segments", [])
                        if isinstance(item, dict) and isinstance(item.get("file"), str)
                    }
                except (json.JSONDecodeError, OSError):
                    pass
            manifest_segments = []
            for index, segment in enumerate(segments):
                destination = output_dir / f"{chapter_revision}-{index}.ogg"
                if destination.exists() and not args.force:
                    print(f"Keeping {destination.relative_to(ROOT)}")
                    duration = previous_durations.get(destination.name) or audio_duration(destination)
                else:
                    print(f"Synthesizing {speaker} {chapter_id} {index + 1}/{len(segments)}…", flush=True)
                    duration = synthesize(
                        model,
                        segment["ssml"],
                        destination,
                        speaker,
                        args.sample_rate,
                        args.bitrate,
                    )
                manifest_segments.append(
                    {
                        "file": destination.name,
                        "characters": len(segment["text"]),
                        "seconds": duration,
                        "sceneBefore": segment["sceneBefore"],
                        "text": segment["text"],
                        "ssml": segment["ssml"],
                    }
                )

            manifest = {
                "version": 2,
                "chapter": chapter_id,
                "revision": chapter_revision,
                "directionRevision": direction_revision(direction),
                "model": MODEL_ID,
                "speaker": speaker,
                "sampleRate": args.sample_rate,
                "license": MODEL_LICENSE,
                "segments": manifest_segments,
            }
            output_dir.mkdir(parents=True, exist_ok=True)
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"Ready: {speaker}/{chapter_id}, {len(segments)} segments")
    write_catalog(args.output, direction)
    return 0


if __name__ == "__main__":
    sys.exit(main())
