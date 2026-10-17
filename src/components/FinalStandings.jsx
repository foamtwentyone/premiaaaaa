import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useData } from '../lib/store.jsx';
import { finalStandings } from '../lib/tournament.js';
import { Cover, Icon, stagger, pop } from './ui.jsx';

const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/** Короткая подпись стадии для узких экранов */
const shortStage = (stage) =>
  stage
    .replace('Нижняя сетка · Раунд ', 'Нижняя сетка · Р')
    .replace('Полуфинал нижней сетки', '½ нижней сетки')
    .replace('Групповой этап', 'Группы');

/** Итоговая таблица мест: группы + плей-офф + средний балл за весь турнир */
export default function FinalStandings() {
  const { matches, tournament, trackById } = useData();
  const rows = finalStandings(matches, { groups: tournament?.groups ?? [], championId: tournament?.championId });
  if (!rows.length) return null;

  return (
    <section className="section">
      <div className="section__head">
        <h2>Итоговая таблица</h2>
        <span className="badge">{rows.length} треков</span>
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 18 }}>
        Места по стадии вылета: гранд-финал, раунды нижней сетки, затем групповой этап. Внутри одного места — по среднему баллу за весь турнир.
      </p>
      <motion.div className="card standings" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
        <div className="standings__head">
          <span>Место</span>
          <span>Трек</span>
          <span className="standings__stage">Стадия</span>
          <span className="num" title="Победы – поражения за весь турнир">В–П</span>
          <span className="num" title="Средний балл за все бои">Балл</span>
        </div>
        {rows.map((r) => {
          const t = trackById[r.trackId];
          const medal = MEDAL[r.placeNum] && !r.place.includes('–') ? MEDAL[r.placeNum] : '';
          return (
            <motion.div key={r.trackId} variants={pop} className={`standings__row ${medal ? `is-${medal}` : ''}`}>
              <span className={`standings__place ${medal ? `standings__place--${medal}` : ''}`}>
                {r.placeNum === 1 && medal ? <Icon.crown /> : r.place}
              </span>
              <span className="standings__track">
                <Cover track={t} />
                <span>
                  <b>{t?.title ?? '—'}</b>
                  <small className="muted">{t?.artist}</small>
                  <small className="standings__stage-inline">{shortStage(r.stage)}</small>
                </span>
              </span>
              <span className="standings__stage muted">{r.stage}</span>
              <span className="num">{r.wins}–{r.losses}</span>
              <span className="num standings__avg">{r.played ? r.avg.toFixed(2) : '—'}</span>
            </motion.div>
          );
        })}
      </motion.div>
      <p className="tiny" style={{ marginTop: 12 }}>
        Все бои — на страницах <Link to="/groups" className="link-btn">групп</Link> и <Link to="/playoffs" className="link-btn">плей-офф</Link>.
      </p>
    </section>
  );
}
