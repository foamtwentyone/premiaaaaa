import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import { placements } from '../lib/tournament.js';
import MatchCard from '../components/MatchCard.jsx';
import { Cover, CountUp, Icon, stagger, pop, softSpring, spring } from '../components/ui.jsx';

const STAGE_TEXT = {
  setup: 'Скоро старт',
  groups: 'Групповой этап',
  playoffs: 'Плей-офф',
  finished: 'Победитель определён',
};

const DIGIT_COLORS = ['var(--pink)', 'var(--purple)', 'var(--blue)', 'var(--yellow)'];

function BouncyTitle({ lines }) {
  let i = 0;
  return (
    <h1 className="hero__title">
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }}>
          {line.split(' ').map((word, wi) => (
            <span key={wi} className="word">
              {[...word].map((ch, ci) => {
                const d = i++ * 0.035;
                return (
                  <motion.span
                    key={ch + d}
                    className="char"
                    style={li === 1 ? { color: DIGIT_COLORS[ci % DIGIT_COLORS.length], textShadow: '0 8px 0 rgba(42,24,89,.12)' } : undefined}
                    initial={{ y: 80, opacity: 0, rotate: -12, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.15 + d }}
                    whileHover={{ y: -14, rotate: -6, transition: spring }}
                  >
                    {ch}
                  </motion.span>
                );
              })}
              {wi < line.split(' ').length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

const STICKERS = [
  { icon: Icon.headphones, top: '0%', left: '6%', bg: 'var(--yellow)', size: 74, rot: -12 },
  { icon: Icon.flame, top: '2%', right: '8%', bg: 'var(--pink)', size: 66, rot: 10 },
  { icon: Icon.trophy, bottom: '18%', left: '9%', bg: 'var(--blue)', size: 60, rot: 8 },
  { icon: Icon.mic, bottom: '6%', right: '12%', bg: 'var(--lime)', size: 70, rot: -8 },
];

export default function Home() {
  const { tournament, matches, tracks, trackById, user } = useData();
  const live = matches.filter((m) => m.status === 'live');
  const done = matches.filter((m) => m.status === 'done');
  const stage = tournament?.stage ?? 'setup';
  const champ = trackById[tournament?.championId];
  const podium = stage === 'finished' ? placements(matches.filter((m) => m.stage !== 'group')).slice(0, 4) : [];

  return (
    <>
      <section className="hero">
        <div className="hero__stickers">
          {STICKERS.map((s, i) => (
            <motion.div
              key={i}
              className="sticker"
              style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom, width: s.size, height: s.size, background: s.bg, fontSize: s.size * 0.46 }}
              initial={{ scale: 0, rotate: s.rot - 40 }}
              animate={{ scale: 1, rotate: s.rot, y: [0, -14, 0] }}
              transition={{
                scale: { ...spring, delay: 0.6 + i * 0.1 },
                rotate: { ...spring, delay: 0.6 + i * 0.1 },
                y: { duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 },
              }}
            >
              <s.icon />
            </motion.div>
          ))}
        </div>

        <motion.div className="hero__kicker" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
          <span className={`badge ${stage === 'groups' || stage === 'playoffs' ? 'badge--live' : 'badge--purple'}`}>
            {STAGE_TEXT[stage]}
          </span>
        </motion.div>

        <BouncyTitle lines={['Лучший трек', '2026']} />

        <motion.p className="hero__sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: 0.7 }}>
          Турнир треков в формате The International: группы, верхняя и нижняя сетка, гранд-финал. Слушай оба трека, ставь каждому от 1 до 10 —
          дальше проходит тот, у кого средний балл выше.
        </motion.p>

        <motion.div className="row" style={{ justifyContent: 'center' }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.85 }}>
          <Link to="/battles" className="btn btn--pink btn--lg">
            {live.length ? `Голосовать · ${live.length}` : 'Смотреть бои'}
          </Link>
          {!user && (
            <Link to="/login" className="btn btn--ghost btn--lg">
              Регистрация
            </Link>
          )}
        </motion.div>

        <motion.div className="stats" variants={stagger} initial="hidden" animate="show" transition={{ delayChildren: 1 }}>
          {[
            { n: tracks.length, l: 'треков', c: 'var(--purple)' },
            { n: done.length, l: 'боёв сыграно', c: 'var(--pink)' },
            { n: live.length, l: 'в эфире', c: 'var(--blue-d)' },
          ].map((s) => (
            <motion.div key={s.l} className="stat" variants={pop}>
              <div className="stat__num" style={{ color: s.c }}>
                <CountUp value={s.n} />
              </div>
              <div className="stat__label">{s.l}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {champ && (
        <motion.section className="section card champion" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={softSpring}>
          <motion.span className="champion__crown" animate={{ rotate: [-8, 8, -8], y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
            <Icon.crown />
          </motion.span>
          <div className="badge" style={{ background: '#fff', color: 'var(--ink)' }}>Трек года 2026</div>
          <Cover track={champ} />
          <h2>{champ.title}</h2>
          <p style={{ fontWeight: 800, fontSize: 18, margin: '8px 0 0' }}>{champ.artist}</p>
          {podium.length > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
              {podium.slice(1).map((p) => (
                <span key={p.trackId} className="badge" style={{ background: 'rgba(255,255,255,.6)', color: 'var(--ink)' }}>
                  {p.place} · {trackById[p.trackId]?.title}
                </span>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {live.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>Сейчас в эфире</h2>
            <Link to="/battles" className="btn btn--ghost btn--sm">Все бои →</Link>
          </div>
          <motion.div className="grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {live.slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </motion.div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Как это работает</h2>
        </div>
        <motion.div className="steps" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
          {[
            { t: 'Групповой этап', d: 'Треки делятся на группы и встречаются каждый с каждым. Лучшие — в верхнюю сетку, следующие — в нижнюю.', c: 'var(--blue)' },
            { t: 'Слушай и оценивай', d: 'В каждом бою два трека. Прослушай оба и поставь каждому от 1 до 10. Голос можно менять, пока бой открыт.', c: 'var(--pink)' },
            { t: 'Double elimination', d: 'Проиграл в верхней сетке — падаешь в нижнюю. Проиграл в нижней — вылет. Победители сеток встречаются в гранд-финале.', c: 'var(--purple)' },
          ].map((s, i) => (
            <motion.div key={s.t} className="card card--flat card--tilt step" variants={pop}>
              <div className="step__num" style={{ background: s.c }}>{i + 1}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </>
  );
}
