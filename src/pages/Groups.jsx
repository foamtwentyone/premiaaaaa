import { motion } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import { groupStandings, seedsFromGroups, swissStandings } from '../lib/tournament.js';
import MatchCard from '../components/MatchCard.jsx';
import { Cover, Empty, ACCENTS, stagger, pop } from '../components/ui.jsx';

/** Швейцарка: общая таблица по счёту + бои по турам */
function SwissView() {
  const { tournament, matches, trackById } = useData();
  const { upperCount, mode, swissWins: wins } = tournament.config;
  const group = matches.filter((m) => m.stage === 'group');
  const rows = swissStandings(tournament.swiss.trackIds, group, wins);
  const qualified = rows.filter((r) => r.status === 'qualified').map((r) => r.trackId);
  // Места в сетке окончательны, только когда все определились, — до этого показываем «Проход»
  const done = rows.every((r) => r.status !== 'active');
  const upperSet = new Set(done ? qualified.slice(0, upperCount) : []);
  const lowerSet = new Set(done && mode === 'ti' ? qualified.slice(upperCount, upperCount * 2) : []);
  const rounds = [...new Set(group.map((m) => m.round))].sort((a, b) => b - a);

  const badge = (r) => {
    if (upperSet.has(r.trackId)) return <span className="badge badge--done">Верхняя сетка</span>;
    if (lowerSet.has(r.trackId)) return <span className="badge badge--yellow">Нижняя сетка</span>;
    if (r.status === 'qualified') return <span className="badge badge--done">Проход</span>;
    if (r.status === 'eliminated') return <span className="badge">Вылет</span>;
    return <span className="badge badge--ready">В игре</span>;
  };

  return (
    <>
      <h1 className="page-title">Групповой этап</h1>
      <p className="page-sub">
        Швейцарская система, как на TI: в каждом туре встречаются треки с одинаковым счётом. {wins} победы — проход в плей-офф, {wins} поражения — вылет.
        {mode === 'ti' ? ' Лучшие по счёту стартуют в верхней сетке, остальные прошедшие — в нижней.' : ''}
      </p>

      <motion.div className="card group-card" variants={pop} initial="hidden" animate="show">
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Трек</th>
              <th className="num">Счёт</th>
              <th className="num">±</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const t = trackById[r.trackId];
              const zone = upperSet.has(r.trackId) || (!done && r.status === 'qualified') ? 'zone-upper' : lowerSet.has(r.trackId) ? 'zone-lower' : r.status === 'eliminated' ? 'zone-out' : '';
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
                  <td className="num">{r.wins}-{r.losses}</td>
                  <td className="num">{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}</td>
                  <td>{badge(r)}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      {rounds.map((round) => {
        const list = group.filter((m) => m.round === round);
        return (
          <section className="section" key={round}>
            <div className="section__head">
              <h2>Тур {round}</h2>
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

export default function Groups() {
  const { tournament, matches, trackById } = useData();
  const groups = tournament?.groups ?? [];
  if (tournament?.swiss?.trackIds) return <SwissView />;
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
