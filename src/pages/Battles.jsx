import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { Empty, stagger, spring } from '../components/ui.jsx';

const TABS = [
  { id: 'live', label: 'В эфире', filter: (m) => m.status === 'live' },
  { id: 'ready', label: 'Скоро', filter: (m) => m.status === 'ready' || m.status === 'pending' },
  { id: 'done', label: 'Сыгранные', filter: (m) => m.status === 'done' },
];

export default function Battles() {
  const { matches } = useData();
  const [tab, setTab] = useState(matches.some((m) => m.status === 'live') ? 'live' : 'done');
  const current = TABS.find((t) => t.id === tab);
  let list = matches.filter(current.filter);
  if (tab === 'done') list = [...list].reverse();

  return (
    <>
      <h1 className="page-title">Бои</h1>
      <p className="page-sub">Открой бой, послушай оба трека и поставь каждому оценку от 1 до 10.</p>

      <div className="toggle" style={{ marginBottom: 28 }}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="battles-tab" className="toggle__pill" transition={spring} />}
            {t.label} · {matches.filter(t.filter).length}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
          {list.length ? (
            <motion.div className="grid" variants={stagger} initial="hidden" animate="show">
              {list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </motion.div>
          ) : (
            <Empty icon={tab === 'live' ? '📻' : tab === 'done' ? '🏁' : '⏳'} title={tab === 'live' ? 'Сейчас голосований нет' : 'Пока пусто'}>
              {tab === 'live' ? 'Загляни позже — новые бои открываются по ходу турнира.' : 'Здесь появятся бои, когда турнир стартует.'}
            </Empty>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
