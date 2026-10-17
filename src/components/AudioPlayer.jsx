import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon, spring } from './ui.jsx';

// Одновременно играет только один трек: запуск одного ставит на паузу остальные
let current = null;

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const VOLUME_KEY = 'premia:volume';

function savedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) ? v : 0.8;
  } catch {
    return 0.8;
  }
}

export default function AudioPlayer({ src, accent }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(savedVolume);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    setError(false);
    setTime(0);
    setDuration(0);
    setPlaying(false);
  }, [src]);

  useEffect(() => () => {
    if (current === audio.current) current = null;
  }, []);

  const toggle = async () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      try {
        await a.play();
      } catch {
        setError(true);
      }
    } else {
      a.pause();
    }
  };

  const skip = (delta) => {
    const a = audio.current;
    if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + delta), duration || a.duration || 0);
  };

  const changeVolume = (v) => {
    setVolume(v);
    setMuted(v === 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* приватный режим — не страшно */
    }
  };

  const shownTime = seeking ?? time;
  const progress = duration ? (shownTime / duration) * 100 : 0;
  const volShown = muted ? 0 : volume;

  return (
    <div className="player" style={{ '--accent': accent }}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setError(true)}
      />
      <div className="player__main">
        <motion.button
          className="play"
          onClick={toggle}
          whileTap={{ scale: 0.88 }}
          transition={spring}
          aria-label={playing ? 'Пауза' : 'Слушать'}
        >
          <motion.span key={playing ? 'p' : 's'} initial={{ scale: 0.4, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring} style={{ display: 'grid' }}>
            {playing ? <Icon.pause /> : <Icon.play />}
          </motion.span>
        </motion.button>
        <div className="player__body">
          <input
            className="range"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={shownTime}
            style={{ '--p': `${progress}%` }}
            onChange={(e) => setSeeking(parseFloat(e.target.value))}
            onPointerUp={() => {
              if (seeking != null && audio.current) audio.current.currentTime = seeking;
              setSeeking(null);
            }}
            onKeyUp={() => {
              if (seeking != null && audio.current) audio.current.currentTime = seeking;
              setSeeking(null);
            }}
            aria-label="Перемотка"
            disabled={!duration}
          />
          <div className="player__times">
            <span>{fmt(shownTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      <div className="player__bottom">
        <button className="mute" onClick={() => skip(-10)} aria-label="Назад на 10 секунд" title="−10 сек">
          <Icon.back5 />
        </button>
        <button className="mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
          {volShown === 0 ? <Icon.mute /> : <Icon.vol />}
        </button>
        <input
          className="range range--thin player__vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volShown}
          style={{ '--p': `${volShown * 100}%` }}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          aria-label="Громкость"
        />
        <div className={`eq ${playing ? 'is-on' : ''}`} aria-hidden>
          <span /><span /><span /><span />
        </div>
      </div>
      {error && <div className="player__error">Не удаётся воспроизвести файл. Проверьте, что ссылка ведёт прямо на аудио.</div>}
    </div>
  );
}
