import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/* ---------- Палитра для треков без обложки ---------- */

export const ACCENTS = ['#ff3ea5', '#8a4dff', '#22c1ff', '#ffb800', '#46c92a', '#ff8a3d'];

export function accentFor(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export const spring = { type: 'spring', stiffness: 420, damping: 26 };
export const softSpring = { type: 'spring', stiffness: 220, damping: 22 };

/* ---------- Обложка ---------- */

export function Cover({ track, className = '', style }) {
  const [broken, setBroken] = useState(false);
  const color = accentFor(track?.id);
  const initials = (track?.title || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className={`cover ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, ...style }}
    >
      {track?.coverUrl && !broken ? (
        <img src={track.coverUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className="cover__initials">{initials}</span>
      )}
    </div>
  );
}

/* ---------- Статус боя ---------- */

const STATUS = {
  live: ['live', 'Голосование'],
  ready: ['ready', 'Скоро'],
  pending: ['pending', 'Ждёт соперников'],
  done: ['done', 'Завершён'],
};

export function StatusBadge({ status }) {
  const [cls, text] = STATUS[status] ?? STATUS.pending;
  return <span className={`badge badge--${cls}`}>{text}</span>;
}

/* ---------- Загрузка / пусто ---------- */

export function Loader() {
  return (
    <div className="loader">
      <div className="loader__dots">
        <span /><span /><span /><span />
      </div>
    </div>
  );
}

export function Empty({ icon = 'headphones', title, children }) {
  const Glyph = Icon[icon] ?? Icon.headphones;
  return (
    <motion.div className="card empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <motion.span
        className="empty__icon"
        animate={{ rotate: [0, -10, 10, -6, 0], y: [0, -8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1 }}
      >
        <Glyph />
      </motion.span>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </motion.div>
  );
}

/* ---------- Анимация появления списков ---------- */

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const pop = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
};

/* ---------- Тосты ---------- */

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, type = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, text, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        <AnimatePresence>
          {list.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.type === 'error' ? 'toast--error' : ''}`}
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={spring}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Конфетти (canvas, без зависимостей) ---------- */

export function fireConfetti(originEl) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const rect = originEl?.getBoundingClientRect?.();
  const ox = rect ? rect.left + rect.width / 2 : innerWidth / 2;
  const oy = rect ? rect.top + rect.height / 2 : innerHeight / 2;
  const parts = Array.from({ length: 140 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 7 + Math.random() * 11;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      round: Math.random() > 0.6,
    };
  });

  // Физика считается по времени, а не по кадрам: одинаково плавно на 60, 120 и 144 Гц.
  // k — доля «эталонного» кадра 60 Гц, прошедшая с прошлого кадра.
  const start = performance.now();
  let last = start;
  const tick = (now) => {
    const k = Math.min(3, (now - last) / (1000 / 60));
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32 * k;
      p.vx *= Math.pow(0.985, k);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.r += p.vr * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      }
      ctx.restore();
    }
    if (now - start < 3000) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

/* ---------- Фон ---------- */

export function Background() {
  return (
    <div className="bg" aria-hidden>
      <div className="bg__blob bg__blob--1" />
      <div className="bg__blob bg__blob--2" />
      <div className="bg__blob bg__blob--3" />
      <div className="bg__pattern" />
    </div>
  );
}

/* ---------- Анимированное число ---------- */

export function CountUp({ value, decimals = 0, duration = 900 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toFixed(decimals)}</>;
}

/* ---------- Иконки ---------- */

const svg = (d, props = {}) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    {d}
  </svg>
);

export const Icon = {
  home: () => svg(<><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>),
  swords: () => svg(<><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6M16 16l4 4M19 21l2-2" /><path d="M9.5 6.5L13 3h3v3l-3.5 3.5" /><path d="M5 14l-2 5 5-2" /></>),
  table: () => svg(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M9 10v10" /></>),
  bracket: () => svg(<><path d="M3 5h5v6h4M3 17h5v-6M12 11h4v0M16 8v6h5" /></>),
  disc: () => svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></>),
  cog: () => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  play: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>,
  pause: () => <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.6" /><rect x="14" y="4" width="5" height="16" rx="1.6" /></svg>,
  vol: () => svg(<><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>),
  mute: () => svg(<><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" /></>),
  back5: () => svg(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>),
  headphones: () => svg(<><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor" /><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor" /></>),
  flame: () => svg(<path d="M12 2c1 3 4.2 4.6 5 8 .3-1 .2-2-.3-3 2 1.6 2.8 4 2.8 6.5a7.5 7.5 0 0 1-15 0c0-3.3 2-5.6 4-7 0 1.8.6 3 1.7 3.6C10 7 10.6 4.6 12 2z" fill="currentColor" />),
  trophy: () => svg(<><path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" fill="currentColor" /><path d="M7.5 6H4.5v1a3.5 3.5 0 0 0 3.3 3.5M16.5 6h3v1a3.5 3.5 0 0 1-3.3 3.5M12 14v4M8 20.5h8" /></>),
  mic: () => svg(<><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></>),
  crown: () => svg(<path d="M3 7.5l4.8 4.3L12 4.5l4.2 7.3L21 7.5l-1.8 11.5H4.8z" fill="currentColor" />),
  timer: () => svg(<><circle cx="12" cy="13.5" r="7.5" /><path d="M12 10v3.5l2.3 2M9.5 2.5h5" /></>),
  check: () => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  upload: () => svg(<path d="M12 15.5V4M7 8.5L12 4l5 4.5M5 20h14" />),
  close: () => svg(<path d="M6 6l12 12M18 6L6 18" />),
  star: () => svg(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" strokeWidth="1.6" />),
  radio: () => svg(<><rect x="3" y="8" width="18" height="12.5" rx="3" /><path d="M7 8l9.5-5" /><circle cx="15.5" cy="14.2" r="2.6" /><path d="M6.8 12.5h2.5M6.8 16h2.5" /></>),
  flag: () => svg(<><path d="M5 21.5V3.5" /><path d="M5 4h13l-2.5 4.5L18 13H5z" fill="currentColor" /></>),
  hourglass: () => svg(<path d="M6 3h12M6 21h12M7 3c0 4.5 5 5.5 5 9s-5 4.5-5 9M17 3c0 4.5-5 5.5-5 9s5 4.5 5 9" />),
  lock: () => svg(<><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /><circle cx="12" cy="15.5" r="1.4" fill="currentColor" /></>),
  question: () => svg(<><circle cx="12" cy="12" r="9.5" /><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.5" /><circle cx="12" cy="17.3" r="0.6" fill="currentColor" /></>),
  google: () => (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H2v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 13.9a6.6 6.6 0 0 1 0-4.2V6.8H2a11 11 0 0 0 0 9.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 6.8l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4z" />
    </svg>
  ),
};
