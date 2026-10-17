import { motion } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import { groupStandings, seedsFromGroups } from '../lib/tournament.js';
import MatchCard from '../components/MatchCard.jsx';
import { Cover, Empty, ACCENTS, stagger, pop } from '../components/ui.jsx';

export default function Groups() {
  const { tournament, matches, trackById } = useData();
  const groups = tournament?.groups ?? [];
  if (!groups.length) {
    return (
      <>
        <h1 className="page-title">Групповой этап</h1>
        <Empty icon="table" title="Группы ещё не сформированы">Организатор скоро запустит турнир.</Empty>
      </>
    );
  }
  // Зоны по текущей общей таблице — тот же посев, что и при формировании плей-офф
  const { upperCount, mode } = tournament.config;
  const seeds = seedsFromGroups(groups, matches.filter((m) => m.stage === 'group'));
  const upperSet = new Set(seeds.slice(0, upperCount));
  const lowerSet = new Set(mode === 'ti' ? seeds.slice(upperCount, upperCount * 2) : []);

  return (
    <>
      <h1 className="page-title">Групповой этап</h1>
      <p className="page-sub">Каждый трек встречается с каждым в своей группе. Победа в бою — +1. При равенстве побед решает разница средних баллов.</p>
      <div className="legend">
        <span><i style={{ background: 'var(--lime)' }} />Верхняя сетка</span>
        {lowerSet.size > 0 && <span><i style={{ background: 'var(--yellow)' }} />Нижняя сетка</span>}
        <span><i style={{ background: 'var(--line)' }} />Вылет</span>
      </div>

      <motion.div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' }} variants={stagger} initial="hidden" animate="show">
        {groups.map((g, gi) => {
          const rows = groupStandings(g, matches);
          return (
            <motion.div key={g.id} className="card group-card" variants={pop}>
              <h3>
                <span className="group-letter" style={{ background: ACCENTS[gi % ACCENTS.length] }}>{g.id}</span>
                {g.name}
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Трек</th>
                    <th className="num">В</th>
                    <th className="num">П</th>
                    <th className="num">±</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const zone = upperSet.has(r.trackId) ? 'zone-upper' : lowerSet.has(r.trackId) ? 'zone-lower' : 'zone-out';
                    const t = trackById[r.trackId];
                    return (
                      <motion.tr key={r.trackId} className={zone} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <div className="track-cell">
                            <Cover track={t} />
                            <span title={t ? `${t.artist} — ${t.title}` : ''}>
                              {t?.title ?? '—'}
                              <br />
                              <small className="muted">{t?.artist}</small>
                            </span>
                          </div>
                        </td>
                        <td className="num">{r.wins}</td>
                        <td className="num">{r.losses}</td>
                        <td className="num">{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          );
        })}
      </motion.div>

      {groups.map((g) => {
        const list = matches.filter((m) => m.stage === 'group' && m.group === g.id);
        return (
          <section className="section" key={g.id}>
            <div className="section__head">
              <h2>{g.name} · бои</h2>
              <span className="badge">{list.filter((m) => m.status === 'done').length} / {list.length}</span>
            </div>
            <motion.div className="grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
              {list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </motion.div>
          </section>
        );
      })}
    </>
  );
}
