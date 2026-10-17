import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cover, softSpring } from './ui.jsx';
import { useData } from '../lib/store.jsx';

const PREFIX = { upper: 'ВС', lower: 'НС', final: 'ГФ' };
const shortName = (m) => (m ? `${PREFIX[m.stage]} Р${m.round}·${m.order + 1}` : '');

function groupByRound(list) {
  const rounds = new Map();
  for (const m of list) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round).push(m);
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([, ms]) => ms.sort((a, b) => a.order - b.order));
}

function Node({ match, byId, register }) {
  const { trackById } = useData();
  const navigate = useNavigate();
  const r = match.status === 'done' ? match.result : null;

  const side = (slot, trackId, score) => {
    const t = trackById[trackId];
    if (!trackId) {
      const src = byId.get(slot?.matchId);
      const hint = slot?.type === 'loser' ? `Проигравший ${shortName(src)}` : `Победитель ${shortName(src)}`;
      return (
        <div className="bnode__side is-tbd">
          <span className="bnode__tbd-dot" />
          <span className="t">{hint}</span>
        </div>
      );
    }
    const cls = !r ? '' : r.winner === trackId ? 'is-winner' : 'is-loser';
    return (
      <div className={`bnode__side ${cls}`}>
        <Cover track={t} />
        <span className="t" title={t ? `${t.artist} — ${t.title}` : ''}>{t?.title ?? '…'}</span>
        {score != null && <span className="s">{score.toFixed(1)}</span>}
      </div>
    );
  };

  return (
    <motion.div
      ref={(el) => register(match.id, el)}
      className={`bnode ${match.status === 'live' ? 'is-live' : ''}`}
      onClick={() => navigate(`/battle/${match.id}`)}
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...softSpring, delay: match.round * 0.06 + match.order * 0.03 }}
      title={match.label}
    >
      {side(match.slotA, match.trackA, r?.avgA)}
      {side(match.slotB, match.trackB, r?.avgB)}
    </motion.div>
  );
}

function Columns({ rounds, byId, register, titleFor }) {
  return rounds.map((ms) => (
    <div className="bracket__col" key={ms[0].id}>
      <div className="bracket__col-title">{titleFor(ms[0])}</div>
      <div className="bracket__col-body">
        {ms.map((m) => (
          <Node key={m.id} match={m} byId={byId} register={register} />
        ))}
      </div>
    </div>
  ));
}

export default function Bracket({ matches }) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const upper = groupByRound(matches.filter((m) => m.stage === 'upper'));
  const lower = groupByRound(matches.filter((m) => m.stage === 'lower'));
  const gf = matches.find((m) => m.stage === 'final');

  const box = useRef(null);
  const els = useRef(new Map());
  const [paths, setPaths] = useState([]);
  const register = (id, el) => (el ? els.current.set(id, el) : els.current.delete(id));

  useLayoutEffect(() => {
    const compute = () => {
      const root = box.current?.getBoundingClientRect();
      if (!root) return;
      const out = [];
      for (const m of matches) {
        const to = els.current.get(m.id)?.getBoundingClientRect();
        if (!to) continue;
        [m.slotA, m.slotB].forEach((slot, i) => {
          if (slot?.type !== 'winner') return;
          const from = els.current.get(slot.matchId)?.getBoundingClientRect();
          if (!from) return;
          const x1 = from.right - root.left;
          const y1 = from.top + from.height / 2 - root.top;
          const x2 = to.left - root.left;
          const y2 = to.top + to.height * (i === 0 ? 0.3 : 0.7) - root.top;
          const dx = Math.max(16, (x2 - x1) / 2);
          out.push({
            key: `${slot.matchId}-${m.id}`,
            d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
            done: byId.get(slot.matchId)?.status === 'done',
          });
        });
      }
      setPaths(out);
    };
    compute();
    // Пересчитываем после того, как отыграют анимации появления
    const t = setTimeout(compute, 700);
    const ro = new ResizeObserver(compute);
    if (box.current) ro.observe(box.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const title = (m) => m.label.replace(/^(Верхняя|Нижняя) сетка · /, '').replace(/ (верхней|нижней) сетки$/, '');

  return (
    <div className="bracket-wrap">
      <div className="bracket" ref={box}>
        <svg className="bracket__svg" width="100%" height="100%">
          {paths.map((p) => (
            <motion.path
              key={p.key}
              d={p.d}
              className={p.done ? 'is-done' : ''}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          ))}
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          <div className="bracket-section">
            <div className="bracket-section__title">
              <span className="bracket-section__dot" style={{ background: 'var(--lime)' }} />
              <h2>Верхняя сетка</h2>
            </div>
            <div style={{ display: 'flex', gap: 44 }}>
              <Columns rounds={upper} byId={byId} register={register} titleFor={title} />
            </div>
          </div>
          {lower.length > 0 && (
            <div className="bracket-section">
              <div className="bracket-section__title">
                <span className="bracket-section__dot" style={{ background: 'var(--yellow)' }} />
                <h2>Нижняя сетка</h2>
              </div>
              <div style={{ display: 'flex', gap: 44 }}>
                <Columns rounds={lower} byId={byId} register={register} titleFor={title} />
              </div>
            </div>
          )}
        </div>

        {gf && (
          <div className="bracket__col" style={{ justifyContent: 'center' }}>
            <div className="bracket-section__title" style={{ justifyContent: 'center' }}>
              <span className="bracket-section__dot" style={{ background: 'var(--pink)' }} />
              <h2>Гранд-финал</h2>
            </div>
            <Node match={gf} byId={byId} register={register} />
          </div>
        )}
      </div>
    </div>
  );
}
