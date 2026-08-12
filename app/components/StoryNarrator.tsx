"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import direction from "../../content/narration/direction.json";
import { narrationSegments } from "../lib/narration";

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";
type PlaybackMode = "studio" | "browser";
type VoiceId = (typeof direction.voices)[number]["id"];
type ManifestSegment = { file: string; text: string; seconds: number };
type NarrationManifest = {
  version: number;
  chapter: string;
  revision: string;
  directionRevision: string;
  speaker: VoiceId;
  segments: ManifestSegment[];
};

const VOICE_STORE = "teo-narrator-voice";
const voiceListeners = new Set<() => void>();
let voiceSnapshot: VoiceId | null = null;

function validVoice(value: string | null): value is VoiceId {
  return direction.voices.some((voice) => voice.id === value);
}

function getVoiceSnapshot(): VoiceId {
  if (voiceSnapshot) return voiceSnapshot;
  try {
    const stored = window.localStorage.getItem(VOICE_STORE);
    voiceSnapshot = validVoice(stored) ? stored : direction.defaultVoice;
  } catch {
    voiceSnapshot = direction.defaultVoice;
  }
  return voiceSnapshot;
}

function getServerVoiceSnapshot(): VoiceId {
  return direction.defaultVoice;
}

function subscribeVoice(listener: () => void) {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

function storeVoice(voice: VoiceId) {
  voiceSnapshot = voice;
  try { window.localStorage.setItem(VOICE_STORE, voice); } catch { /* private mode */ }
  voiceListeners.forEach((listener) => listener());
}

const paths = {
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M9 5.5v13M15 5.5v13",
  stop: "M7 7h10v10H7z",
} as const;

function Icon({ path }: { path: string }) {
  return <svg className="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function russianVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((voice) => /^ru(?:-|_)/i.test(voice.lang) && voice.localService)
    ?? voices.find((voice) => /^ru(?:-|_)/i.test(voice.lang));
}

function browserSpokenText(text: string) {
  let spoken = text;
  for (const item of [...direction.pronunciations].sort((left, right) => right.word.length - left.word.length)) {
    const escaped = item.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    spoken = spoken.replace(new RegExp(`(^|[^А-Яа-яЁёA-Za-z0-9_])(${escaped})(?=$|[^А-Яа-яЁёA-Za-z0-9_])`, "giu"),
      (_, edge: string, matched: string) => `${edge}${matched[0] === matched[0].toUpperCase() ? item.say : item.say.toLowerCase()}`,
    );
  }
  // Browser SpeechSynthesis does not understand Silero's stress marker. The
  // spelling correction (notably Тэо) still survives in the emergency fallback.
  return spoken.replaceAll("+", "");
}

function isManifest(value: unknown, chapterId: string, voice: VoiceId): value is NarrationManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<NarrationManifest>;
  return manifest.version === 2
    && manifest.chapter === chapterId
    && manifest.speaker === voice
    && typeof manifest.revision === "string"
    && typeof manifest.directionRevision === "string"
    && Array.isArray(manifest.segments)
    && manifest.segments.length > 0
    && manifest.segments.every((segment) => segment
      && typeof segment.file === "string"
      && typeof segment.text === "string");
}

export function StoryNarrator({ chapterId, paragraphs }: { chapterId: string; paragraphs: string[] }) {
  const fallbackSegments = useMemo(() => narrationSegments(paragraphs), [paragraphs]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef(new Map<number, string>());
  const manifestRef = useRef<NarrationManifest | null>(null);
  const modeRef = useRef<PlaybackMode>("studio");
  const speakBrowserRef = useRef<(index: number) => void>(() => {});
  const voice = useSyncExternalStore(subscribeVoice, getVoiceSnapshot, getServerVoiceSnapshot);
  const [state, setState] = useState<PlaybackState>("idle");
  const [mode, setMode] = useState<PlaybackMode>("studio");
  const [segment, setSegment] = useState(0);
  const [segmentCount, setSegmentCount] = useState(fallbackSegments.length);
  const [within, setWithin] = useState(0);

  const activeSegments = useCallback(
    () => manifestRef.current?.segments.map((item) => item.text) ?? fallbackSegments,
    [fallbackSegments],
  );

  const clearObjectUrls = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    window.speechSynthesis?.cancel();
    setState("idle");
    setSegment(0);
    setWithin(0);
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    clearObjectUrls();
  }, [chapterId, clearObjectUrls]);

  const speakBrowser = useCallback((index: number) => {
    const segments = activeSegments();
    if (!("speechSynthesis" in window) || !segments[index]) {
      setState("error");
      return;
    }
    modeRef.current = "browser";
    setMode("browser");
    setSegment(index);
    setWithin(0);
    const utterance = new SpeechSynthesisUtterance(browserSpokenText(segments[index]));
    utterance.lang = "ru-RU";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const browserVoice = russianVoice();
    if (browserVoice) utterance.voice = browserVoice;
    utterance.onstart = () => setState("playing");
    utterance.onend = () => {
      if (index + 1 < segments.length) speakBrowserRef.current(index + 1);
      else stop();
    };
    utterance.onerror = () => setState("error");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [activeSegments, stop]);

  useEffect(() => {
    speakBrowserRef.current = speakBrowser;
  }, [speakBrowser]);

  const loadManifest = useCallback(async () => {
    if (manifestRef.current?.speaker === voice && manifestRef.current.chapter === chapterId) {
      return manifestRef.current;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const response = await fetch(`/audio/narration/${voice}/${chapterId}/manifest.json`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Silero manifest ${response.status}`);
    const candidate: unknown = await response.json();
    if (!isManifest(candidate, chapterId, voice)) throw new Error("Invalid Silero manifest");
    manifestRef.current = candidate;
    setSegmentCount(candidate.segments.length);
    return candidate;
  }, [chapterId, voice]);

  const audioUrl = useCallback(async (index: number, manifest: NarrationManifest) => {
    const cached = urlsRef.current.get(index);
    if (cached) return cached;
    const item = manifest.segments[index];
    if (!item) throw new Error("Silero segment is absent from manifest");
    const controller = new AbortController();
    abortRef.current = controller;
    const response = await fetch(`/audio/narration/${voice}/${chapterId}/${item.file}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Silero audio ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("audio/")) throw new Error("TTS returned non-audio content");
    const url = URL.createObjectURL(blob);
    urlsRef.current.set(index, url);
    return url;
  }, [chapterId, voice]);

  const playStudio = useCallback(async (index: number, knownManifest?: NarrationManifest) => {
    setState("loading");
    setSegment(index);
    setWithin(0);
    try {
      const manifest = knownManifest ?? await loadManifest();
      const src = await audioUrl(index, manifest);
      const audio = audioRef.current;
      if (!audio) return;
      modeRef.current = "studio";
      setMode("studio");
      audio.src = src;
      audio.playbackRate = 1;
      await audio.play();
      setState("playing");
      if (index + 1 < manifest.segments.length) void audioUrl(index + 1, manifest).catch(() => {});
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      speakBrowser(index);
    }
  }, [audioUrl, loadManifest, speakBrowser]);

  function toggle() {
    const audio = audioRef.current;
    if (state === "loading") {
      stop();
      return;
    }
    if (state === "playing") {
      if (modeRef.current === "browser") window.speechSynthesis.pause();
      else audio?.pause();
      setState("paused");
      return;
    }
    if (state === "paused") {
      if (modeRef.current === "browser") window.speechSynthesis.resume();
      else void audio?.play();
      setState("playing");
      return;
    }
    void playStudio(0);
  }

  function selectVoice(nextVoice: VoiceId) {
    stop();
    clearObjectUrls();
    manifestRef.current = null;
    setSegmentCount(fallbackSegments.length);
    storeVoice(nextVoice);
  }

  function onEnded() {
    if (segment + 1 < segmentCount) void playStudio(segment + 1);
    else stop();
  }

  const progress = segmentCount ? ((segment + within) / segmentCount) * 100 : 0;
  const voiceLabel = direction.voices.find((item) => item.id === voice)?.label ?? voice;
  const label = state === "loading" ? "Готовим…"
    : state === "playing" ? "Пауза"
      : state === "paused" ? "Продолжить"
        : state === "error" ? "Нет голоса"
          : "Озвучить";
  const status = state === "idle" ? `Озвучка главы: ${voiceLabel}`
    : mode === "browser" ? `Системный русский голос, часть ${segment + 1} из ${segmentCount}`
      : `${voiceLabel}, часть ${segment + 1} из ${segmentCount}`;

  return <div
    className="narrator"
    data-direction-version={direction.version}
    data-segments={fallbackSegments.length}
  >
    <audio
      ref={audioRef}
      preload="none"
      onEnded={onEnded}
      onTimeUpdate={(event) => {
        const audio = event.currentTarget;
        setWithin(audio.duration ? audio.currentTime / audio.duration : 0);
      }}
    ><track kind="captions" /></audio>
    <label className="narrator-voice">
      <span className="visually-hidden">Голос рассказчика</span>
      <select
        value={voice}
        onChange={(event) => selectVoice(event.currentTarget.value as VoiceId)}
        aria-label="Голос рассказчика"
      >
        {direction.voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <button className="narrator-main" onClick={toggle} aria-label={`${label}. ${status}`}>
      <Icon path={state === "playing" ? paths.pause : paths.play} />
      <span>{label}</span>
      <i aria-hidden="true" style={{ width: `${progress}%` }} />
    </button>
    {(state !== "idle" || segment > 0) && <button className="narrator-stop" onClick={stop} aria-label="Остановить озвучку"><Icon path={paths.stop} /></button>}
    <span className="visually-hidden" role="status" aria-live="polite">{status}</span>
  </div>;
}
