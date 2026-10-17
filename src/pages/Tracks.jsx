import { useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import { Cover, Empty, accentFor, stagger, pop } from '../components/ui.jsx';

export default function Tracks() {
  const { tracks, tournament } = useData();
  const [q, setQ] = useState('');
  const out = new Set(tournament?.eliminated ?? []);
  const list = tracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <h1 className="page-title">Участники</h1>
      <p className="page-sub">Все номинанты премии. Можно послушать каждый трек заранее.</p>
      {tracks.length > 6 && (
        <input className="input" style={{ maxWidth: 380, marginBottom: 24 }} placeholder="Поиск по названию или артисту" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {list.length ? (
        <motion.div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }} variants={stagger} initial="hidden" animate="show">
          {list.map((t) => (
            <motion.div key={t.id} className="card card--flat" style={{ padding: 16 }} variants={pop}>
              <div className="track-tile" style={{ padding: 0, marginBottom: 14 }}>
                <Cover track={t} />
                <div className="track-tile__body">
                  <div className="track-tile__title">{t.title}</div>
                  <div className="muted">{t.artist}</div>
                  {out.has(t.id) && <span className="badge" style={{ marginTop: 6 }}>Выбыл в группах</span>}
                </div>
              </div>
              {t.audioUrl && <AudioPlayer src={t.audioUrl} accent={accentFor(t.id)} />}
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Empty icon="disc" title={tracks.length ? 'Ничего не нашлось' : 'Треков пока нет'}>
          {tracks.length ? 'Попробуй другой запрос.' : 'Организатор скоро добавит номинантов.'}
        </Empty>
      )}
    </>
  );
}
