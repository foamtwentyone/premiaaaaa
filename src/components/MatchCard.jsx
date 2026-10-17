import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cover, StatusBadge, pop } from './ui.jsx';
import { useCountdown, formatLeft, useData } from '../lib/store.jsx';

function Side({ track, score, state }) {
  return (
    <div className={`match-card__side ${state}`}>
      <Cover track={track} />
      <div className="match-card__name">
        <div className="match-card__title">{track?.title ?? 'Определится позже'}</div>
        <div className="match-card__artist">{track?.artist ?? '—'}</div>
      </div>
      {score != null && <div className="match-card__score">{score.toFixed(2)}</div>}
    </div>
  );
}

export default function MatchCard({ match }) {
  const { trackById, myVotes } = useData();
  const left = useCountdown(match.status === 'live' ? match.endsAt : null);
  const a = trackById[match.trackA];
  const b = trackById[match.trackB];
  const r = match.status === 'done' ? match.result : null;
  const state = (id) => (!r ? '' : r.winner === id ? 'is-winner' : 'is-loser');
  const voted = myVotes[match.id];

  return (
    <motion.div variants={pop} whileHover={{ y: -5, rotate: -0.5 }} whileTap={{ scale: 0.98 }}>
      <Link to={`/battle/${match.id}`} className="card card--flat match-card">
        <div className="match-card__head">
          <span className="match-card__label">{match.label}</span>
          <StatusBadge status={match.status} />
        </div>
        <Side track={a} score={r?.avgA} state={state(match.trackA)} />
        <div className="match-card__vs">VS</div>
        <Side track={b} score={r?.avgB} state={state(match.trackB)} />
        <div className="match-card__foot">
          <span>{r ? `${r.votes} голос${plural(r.votes)}` : voted ? '✓ Вы проголосовали' : match.status === 'live' ? 'Оцените оба трека →' : ''}</span>
          <span>{left != null ? `⏱ ${formatLeft(left)}` : ''}</span>
        </div>
      </Link>
    </motion.div>
  );
}

export function plural(n) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return '';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'а';
  return 'ов';
}
