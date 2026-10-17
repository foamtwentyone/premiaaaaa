import test from 'node:test';
import assert from 'node:assert/strict';
import {
  swissWinOptions, swissMatchCount, swissStandings, buildSwissRound1, nextSwissRound, swissFinished,
  seedsFromSwiss, buildPlayoffs, resolveSlots, decide, champion,
} from '../src/lib/tournament.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

/** Доигрывает швейцарку: результат боя задаёт функция beats(a, b) */
function playSwiss(trackIds, wins, beats) {
  let matches = buildSwissRound1(trackIds);
  for (let guard = 0; guard < 50; guard++) {
    matches = matches.map((m) => {
      if (m.status === 'done') return m;
      const aWins = beats(m.trackA, m.trackB);
      return { ...m, status: 'done', result: decide(m, [{ matchId: m.id, a: aWins ? 9 : 3, b: aWins ? 3 : 9 }]) };
    });
    const next = nextSwissRound(trackIds, matches, wins);
    if (!next) break;
    matches = [...matches, ...next];
  }
  return matches;
}

test('варианты числа побед', () => {
  assert.deepEqual(swissWinOptions(8), [2]);
  assert.deepEqual(swissWinOptions(16), [2, 3]);
  assert.deepEqual(swissWinOptions(32), [2, 3, 4]);
  assert.deepEqual(swissWinOptions(12), []);
});

for (const [n, wins] of [[8, 2], [16, 3], [16, 2], [32, 3], [32, 4]]) {
  for (const kind of ['по силе', 'случайно']) {
    test(`швейцарка ${n} треков до ${wins} побед (${kind})`, () => {
      const t = ids(n);
      let seed = n * 7 + wins;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      const beats = kind === 'по силе' ? (a, b) => t.indexOf(a) < t.indexOf(b) : () => rnd() < 0.5;
      const matches = playSwiss(t, wins, beats);

      assert.ok(swissFinished(t, matches, wins), 'швейцарка завершена');
      assert.equal(matches.length, swissMatchCount(n, wins), 'число боёв');
      const st = swissStandings(t, matches, wins);
      assert.equal(st.filter((r) => r.status === 'qualified').length, n / 2, 'проходит половина');
      for (const r of st) assert.ok(r.played <= 2 * wins - 1, 'не больше 2·wins−1 боёв на трек');

      const seen = new Set();
      for (const m of matches) {
        const key = [m.trackA, m.trackB].sort().join('|');
        assert.ok(!seen.has(key), `повторная встреча ${key}`);
        seen.add(key);
        assert.ok(!m.bucket.includes('/'), `в паре разный счёт: ${m.bucket}`);
      }
    });
  }
}

test('16 треков, 3 победы: 33 боя вместо 56 в группах', () => {
  assert.equal(swissMatchCount(16, 3), 33);
});

test('швейцарка → плей-офф TI → чемпион', () => {
  const t = ids(16);
  const beats = (a, b) => t.indexOf(a) < t.indexOf(b);
  const sw = playSwiss(t, 3, beats);
  const seeds = seedsFromSwiss(t, sw, 3);
  assert.deepEqual(seeds.slice(0, 2), ['t1', 't2']); // 3-0
  let po = buildPlayoffs(seeds.slice(0, 4), seeds.slice(4, 8));
  for (let i = 0; i < 40; i++) {
    const m = po.find((x) => x.status === 'ready');
    if (!m) break;
    const aWins = beats(m.trackA, m.trackB);
    po = resolveSlots(po.map((x) => (x.id === m.id ? { ...x, status: 'done', result: decide(x, [{ matchId: x.id, a: aWins ? 9 : 1, b: aWins ? 1 : 9 }]) } : x)));
  }
  assert.equal(champion(po), 't1');
});
