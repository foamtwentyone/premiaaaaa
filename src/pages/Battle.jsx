import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmailVerification } from 'firebase/auth';
import { useData, useCountdown, formatLeft, isVotingOpen } from '../lib/store.jsx';
import { submitVote } from '../lib/api.js';
import AudioPlayer from '../components/AudioPlayer.jsx';
import ScorePicker from '../components/ScorePicker.jsx';
import { Cover, StatusBadge, Empty, CountUp, Icon, accentFor, fireConfetti, useToast, softSpring, spring } from '../components/ui.jsx';
import { plural } from '../components/MatchCard.jsx';

function Contender({ track, side, score, onScore, canVote, result, avg, delay }) {
  const accent = accentFor(track?.id);
  const isWinner = result && result.winner === track?.id;
  return (
    <motion.div
      className={`card contender ${isWinner ? 'is-winner' : ''}`}
      style={{ '--accent': accent }}
      initial={{ opacity: 0, x: side === 'a' ? -60 : 60, rotate: side === 'a' ? -3 : 3 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      transition={{ ...softSpring, delay }}
    >
      <div className="contender__top">
        <motion.div whileHover={{ rotate: side === 'a' ? -4 : 4, scale: 1.04 }} transition={spring}>
          <Cover track={track} />
        </motion.div>
        <div style={{ minWidth: 0 }}>
          <h2 className="contender__title">{track?.title ?? 'Определится позже'}</h2>
          <div className="contender__artist">{track?.artist ?? ''}</div>
          {isWinner && (
            <motion.span className="badge badge--done" style={{ marginTop: 10 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.6 }}>
              <Icon.trophy /> Проходит дальше
            </motion.span>
          )}
        </div>
      </div>

      {track?.audioUrl && <AudioPlayer src={track.audioUrl} accent={accent} />}

      {result ? (
        <div className="contender__result">
          <span className="contender__avg" style={{ color: isWinner ? 'var(--lime-d)' : 'var(--ink-3)' }}>
            <CountUp value={avg} decimals={2} duration={1400} />
          </span>
          <span className="muted">средний балл</span>
        </div>
      ) : (
        track && <ScorePicker value={score} onChange={onScore} disabled={!canVote} />
      )}
    </motion.div>
  );
}

/** Стрелка листания пар: в строке под заголовком или большая — по бокам экрана */
function PagerButton({ to, dir, side }) {
  const Glyph = dir === 'left' ? Icon.chevronLeft : Icon.chevronRight;
  const label = dir === 'left' ? 'Предыдущая пара' : 'Следующая пара';
  const cls = side ? `pager-side pager-side--${dir}` : 'pager__btn';
  if (!to) return <span className={`${cls} is-disabled`} aria-hidden><Glyph /></span>;
  return (
    <Link to={`/battle/${to.id}`} className={cls} title={`${label} (${dir === 'left' ? '←' : '→'})`} aria-label={label}>
      <Glyph />
    </Link>
  );
}

export default function Battle() {
  const { id } = useParams();
  const { matches, trackById, user, myVotes } = useData();
  const toast = useToast();
  const m = matches.find((x) => x.id === id);
  const mine = myVotes[id];
  const [a, setA] = useState(mine?.a ?? null);
  const [b, setB] = useState(mine?.b ?? null);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(m?.status === 'live' ? m.endsAt : null);
  const btn = useRef(null);
  const celebrated = useRef(false);
  const navigate = useNavigate();

  // Пары того же тура (той же стадии и раунда) — их можно листать стрелками
  const siblings = m ? matches.filter((x) => x.stage === m.stage && x.round === m.round) : [];
  const index = siblings.findIndex((x) => x.id === id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];

  const siblingIds = siblings.map((x) => x.id).join(',');
  useEffect(() => {
    const ids = siblingIds.split(',');
    const onKey = (e) => {
      // Не перехватываем стрелки, когда фокус в ползунке, поле ввода или с модификаторами
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // Текущую пару берём из адреса: при быстрых нажатиях уходящая страница ещё жива
      const cur = ids.indexOf(decodeURIComponent(window.location.pathname.split('/').pop()));
      const target = ids[cur + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (cur >= 0 && target) navigate(`/battle/${target}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [siblingIds, navigate]);

  useEffect(() => {
    setA(mine?.a ?? null);
    setB(mine?.b ?? null);
  }, [mine?.a, mine?.b]);

  useEffect(() => {
    if (m?.status === 'done' && !celebrated.current) {
      celebrated.current = true;
      setTimeout(() => fireConfetti(), 500);
    }
  }, [m?.status]);

  if (!m) return <Empty icon="question" title="Бой не найден"><Link to="/battles" className="link-btn">← Ко всем боям</Link></Empty>;

  const ta = trackById[m.trackA];
  const tb = trackById[m.trackB];
  const open = isVotingOpen(m) && left !== 0;
  const verified = user?.emailVerified;
  const canVote = open && !!user && verified;
  const result = m.status === 'done' ? m.result : null;
  const changed = mine && (mine.a !== a || mine.b !== b);

  const send = async () => {
    setBusy(true);
    try {
      await submitVote(m.id, user.uid, a, b);
      fireConfetti(btn.current);
      toast(mine ? 'Голос обновлён' : 'Голос принят!');
    } catch (e) {
      toast(e.code === 'permission-denied' ? 'Голосование по этому бою закрыто' : 'Не получилось отправить голос', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Link to="/battles" className="tiny" style={{ fontWeight: 800 }}>← Все бои</Link>
          <h1 className="page-title" style={{ fontSize: 'clamp(26px, 4.5vw, 40px)', marginTop: 8 }}>{m.label}</h1>
        </div>
        <div className="row">
          {left != null && left > 0 && <span className="badge badge--yellow"><Icon.timer /> {formatLeft(left)}</span>}
          <StatusBadge status={left === 0 ? 'ready' : m.status} />
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="pager">
          <PagerButton to={prev} dir="left" />
          <div className="pager__dots" aria-label={`Пара ${index + 1} из ${siblings.length}`}>
            {siblings.map((x, i) => (
              <Link
                key={x.id}
                to={`/battle/${x.id}`}
                title={`Пара ${i + 1}${myVotes[x.id] ? ' · вы проголосовали' : ''}`}
                className={`pager__dot ${x.id === id ? 'is-current' : myVotes[x.id] ? 'is-voted' : x.status === 'live' ? 'is-live' : ''}`}
              />
            ))}
          </div>
          <span className="pager__count">{index + 1} / {siblings.length}</span>
          <PagerButton to={next} dir="right" />
        </div>
      )}

      {siblings.length > 1 && (
        <>
          <PagerButton to={prev} dir="left" side />
          <PagerButton to={next} dir="right" side />
        </>
      )}

      <div className="arena">
        <Contender track={ta} side="a" score={a} onScore={setA} canVote={canVote} result={result} avg={result?.avgA} delay={0.05} />
        <motion.div
          className="arena__vs"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: -8 }}
          whileHover={{ rotate: 8, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.3 }}
        >
          VS
        </motion.div>
        <Contender track={tb} side="b" score={b} onScore={setB} canVote={canVote} result={result} avg={result?.avgB} delay={0.15} />
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div key="res" className="card vote-bar" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
            <div>
              <h3 style={{ fontSize: 20 }}>Победитель: {trackById[result.winner]?.title}</h3>
              <div className="muted">
                {result.votes} голос{plural(result.votes)}
                {result.manual ? ' · решение организатора' : ''}
                {mine ? ` · ваши оценки: ${mine.a} и ${mine.b}` : ''}
              </div>
            </div>
          </motion.div>
        ) : m.status === 'live' && ta && tb ? (
          <motion.div key="vote" className="card vote-bar" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: 0.3 }}>
            {!user ? (
              <>
                <div>
                  <h3 style={{ fontSize: 20 }}>Хочешь проголосовать?</h3>
                  <div className="muted">Войди или зарегистрируйся — это займёт 10 секунд.</div>
                </div>
                <Link to={`/login?next=/battle/${m.id}`} className="btn btn--pink">Войти</Link>
              </>
            ) : !verified ? (
              <>
                <div>
                  <h3 style={{ fontSize: 20 }}>Подтверди почту</h3>
                  <div className="muted">Мы отправили письмо на {user.email}. После подтверждения обнови страницу.</div>
                </div>
                <div className="row">
                  <button className="btn btn--ghost btn--sm" onClick={() => sendEmailVerification(user).then(() => toast('Письмо отправлено'), () => toast('Попробуйте чуть позже', 'error'))}>
                    Отправить ещё раз
                  </button>
                  <button className="btn btn--sm" onClick={() => user.reload().then(() => location.reload())}>Я подтвердил</button>
                </div>
              </>
            ) : !open ? (
              <div>
                <h3 style={{ fontSize: 20 }}>Время вышло</h3>
                <div className="muted">Голосование закрыто, скоро организатор подведёт итоги.</div>
              </div>
            ) : (
              <>
                <div>
                  <h3 style={{ fontSize: 20 }} className="inline-ico">{mine && !changed ? <>Голос учтён <Icon.check /></> : 'Оцени оба трека'}</h3>
                  <div className="muted">
                    {mine && !changed ? 'Можно изменить оценки, пока бой открыт.' : 'Средний балл всех слушателей решит, кто пройдёт дальше.'}
                  </div>
                </div>
                <motion.button
                  ref={btn}
                  className="btn btn--pink btn--lg"
                  disabled={!a || !b || busy || (mine && !changed)}
                  onClick={send}
                  whileTap={{ scale: 0.94 }}
                >
                  {busy ? 'Отправляем…' : mine ? 'Обновить голос' : 'Проголосовать'}
                </motion.button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="wait" className="card vote-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div>
              <h3 style={{ fontSize: 20 }}>
                {m.status === 'cancelled' ? 'Бой отменён' : m.status === 'pending' ? 'Соперники ещё не определены' : 'Голосование скоро откроется'}
              </h3>
              <div className="muted">{m.status === 'cancelled' ? 'Турнир завершён досрочно.' : 'Треки уже можно послушать заранее.'}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
