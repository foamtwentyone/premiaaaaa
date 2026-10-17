import { motion } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import Bracket from '../components/Bracket.jsx';
import FinalStandings from '../components/FinalStandings.jsx';
import { Empty, softSpring } from '../components/ui.jsx';

export default function Playoffs() {
  const { matches, tournament } = useData();
  const playoff = matches.filter((m) => m.stage !== 'group');
  const ti = tournament?.config?.mode === 'ti';

  return (
    <>
      <h1 className="page-title">Плей-офф</h1>
      <p className="page-sub">
        Double elimination: проиграл в верхней сетке — падаешь в нижнюю, проиграл в нижней — вылет.
        {ti ? ' Как на TI, нижняя половина групп стартует сразу в нижней сетке, и первый раунд там — на вылет.' : ''} Нажми на бой, чтобы открыть его.
      </p>
      {playoff.length ? (
        <motion.div className="card" style={{ padding: 20 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
          <Bracket matches={playoff} />
        </motion.div>
      ) : null}
      {tournament?.stage === 'finished' && <FinalStandings />}
      {playoff.length || tournament?.stage === 'finished' ? null : (
        <Empty icon="bracket" title="Сетка появится после группового этапа">
          Как только определятся участники плей-офф, здесь будет верхняя и нижняя сетка.
        </Empty>
      )}
    </>
  );
}
