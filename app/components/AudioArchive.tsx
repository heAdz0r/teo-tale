"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ArchiveTrack = {
  id: number;
  date: string;
  duration: string;
  file: string;
  chapter: string;
};

const glyphs = {
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M9 5.5v13M15 5.5v13",
  prev: "M18 6v12L9 12l9-6ZM6 5.5v13",
  next: "M6 6v12l9-6-9-6ZM18 5.5v13",
  back: "M11 8H5.5V2.5M5.9 8.4a7.5 7.5 0 1 1-1.4 5.1",
  forward: "M13 8h5.5V2.5M18.1 8.4a7.5 7.5 0 1 0 1.4 5.1",
  volume: "M4 10v4h3l4 3.5v-11L7 10H4Zm11-1.6a4.5 4.5 0 0 1 0 7.2m2.4-9.6a8 8 0 0 1 0 12",
  muted: "M4 10v4h3l4 3.5v-11L7 10H4Zm11 1 5 5m0-5-5 5",
} as const;

function Glyph({ d }: { d: string }) {
  return <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={d} /></svg>;
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const rates = [0.75, 1, 1.25, 1.5] as const;

export function AudioArchive({ tracks }: { tracks: ArchiveTrack[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  // Track whether playback was running before a track switch, so selecting the
  // next recording continues listening instead of silently swapping the source.
  const wasPlaying = useRef(false);

  const track = tracks[index];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTime() {
      setTime(audio!.currentTime);
      const ranges = audio!.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    }
    function onMeta() { setDuration(audio!.duration); }
    function onEnd() {
      if (index < tracks.length - 1) {
        wasPlaying.current = true;
        setIndex(index + 1);
      } else {
        setPlaying(false);
      }
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("progress", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("progress", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [index, tracks.length]);

  // A new source resets the clock; resume only if the listener was already playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setTime(0);
    setBuffered(0);
    setDuration(0);
    audio.load();
    if (!wasPlaying.current) return;
    wasPlaying.current = false;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [index]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, index]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  function nudge(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration || 0);
    setTime(audio.currentTime);
  }

  function select(next: number) {
    if (next === index) {
      toggle();
      return;
    }
    wasPlaying.current = playing;
    setIndex(next);
  }

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= tracks.length) return;
    wasPlaying.current = playing;
    setIndex(next);
  }

  // Metadata may not have loaded yet; fall back to the duration recorded in the wiki.
  const shown = duration || 0;
  const progress = shown ? (time / shown) * 100 : 0;
  const bufferPct = shown ? (buffered / shown) * 100 : 0;
  const numeral = track.chapter.split(" ")[0];
  const title = track.chapter.replace(/^\S+\s·\s/, "");

  return (
    <section className="listening-room" aria-label="Прослушивание аудиосказок">
      <audio ref={audioRef} preload="metadata" src={`/audio/${track.file}`} muted={muted}>
        <track kind="captions" />
      </audio>

      <article className="player-plate">
        <div className={playing ? "player-seal is-spinning" : "player-seal"} aria-hidden="true">
          <span>{numeral}</span>
        </div>

        <div className="player-body">
          <p className="player-kicker">Сейчас звучит</p>
          <h3>{title}</h3>
          <p className="player-date">{track.date} · запись #{track.id}</p>

          <div className="player-scrub" style={{ ["--played" as string]: `${progress}%`, ["--buffered" as string]: `${bufferPct}%` }}>
            <input
              type="range" min={0} max={shown || Number(0)} step={0.5} value={time}
              aria-label="Позиция воспроизведения"
              onChange={(event) => {
                const audio = audioRef.current;
                const next = Number(event.target.value);
                if (audio) audio.currentTime = next;
                setTime(next);
              }}
            />
          </div>
          <div className="player-times"><span>{clock(time)}</span><span>{shown ? clock(shown) : track.duration}</span></div>

          <div className="player-controls">
            <button onClick={() => step(-1)} disabled={index === 0} aria-label="Предыдущая запись"><Glyph d={glyphs.prev} /></button>
            <button onClick={() => nudge(-15)} aria-label="Назад на 15 секунд"><Glyph d={glyphs.back} /></button>
            <button className="player-main" onClick={toggle} aria-label={playing ? "Пауза" : "Слушать"}>
              <Glyph d={playing ? glyphs.pause : glyphs.play} />
            </button>
            <button onClick={() => nudge(15)} aria-label="Вперёд на 15 секунд"><Glyph d={glyphs.forward} /></button>
            <button onClick={() => step(1)} disabled={index === tracks.length - 1} aria-label="Следующая запись"><Glyph d={glyphs.next} /></button>

            <div className="player-aux">
              <button className="player-rate" onClick={() => setRate(rates[(rates.indexOf(rate as 1) + 1) % rates.length])} aria-label={`Скорость чтения ${rate}×, переключить`}>
                {rate}×
              </button>
              <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "Включить звук" : "Выключить звук"} aria-pressed={muted}>
                <Glyph d={muted ? glyphs.muted : glyphs.volume} />
              </button>
            </div>
          </div>
        </div>
      </article>

      <ol className="playlist">
        {tracks.map((item, position) => (
          <li key={item.id}>
            <button
              className={position === index ? "active" : ""}
              onClick={() => select(position)}
              aria-current={position === index ? "true" : undefined}
            >
              <span className="playlist-state" aria-hidden="true">
                <Glyph d={position === index && playing ? glyphs.pause : glyphs.play} />
              </span>
              <span className="playlist-name"><strong>{item.chapter}</strong><small>{item.date}</small></span>
              <span className="playlist-time">{item.duration}</span>
              <code>{item.file}</code>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
