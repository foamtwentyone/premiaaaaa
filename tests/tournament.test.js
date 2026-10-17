import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedOrder, roundRobin, splitIntoGroups, buildGroupMatches, groupStandings, currentRanking,
  seedsFromGroups, buildPlayoffs, resolveSlots, decide, champion, placements,
} from '../src/lib/tournament.js';

const ids = (n, p = 't') => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);

// Прогоняет сетку до конца: в каждом матче побеждает трек с меньшим номером
function playAll(matches, strength = (id) => -Number(id.replace(/\D/g, ''))) {
  let ms = matches;
  for (let guard = 0; guard < 200; guard++) {
    const ready = ms.find((m) => m.status === 'ready');
    if (!ready) break;
    const votes = [{ matchId: ready.id,
      a: strength(ready.trackA) > strength(ready.trackB) ? 9 : 3,
      b: strength(ready.trackA) > strength(ready.trackB) ? 3 : 9 }];
    ms = resolveSlots(ms.map((m) => (m.id === ready.id ? { ...m, status: 'done', result: decide(m, votes) } : m)));
  }
  return ms;
}

test('seedOrder', () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(seedOrder(2), [1, 2]);
});

test('roundRobin: каждый с каждым ровно раз', () => {
  for (const n of [3, 4, 5, 8]) {
    const pairs = roundRobin(ids(n)).flat();
    assert.equal(pairs.length, (n * (n - 1)) / 2);
    const keys = new Set(pairs.map((p) => [...p].sort().join('|')));
    assert.equal(keys.size, pairs.length);
  }
});

test('splitIntoGroups ровно делит', () => {
  const g = splitIntoGroups(ids(16), 2);
  assert.equal(g[0].trackIds.length, 8);
  assert.equal(g[1].trackIds.length, 8);
});

test('групповой этап → сиды', () => {
  const groups = splitIntoGroups(ids(8), 2);
  let ms = buildGroupMatches(groups);
  assert.equal(ms.length, 12);
  ms = ms.map((m) => ({ ...m, status: 'done', result: decide(m, [{ matchId: m.id, a: m.trackA < m.trackB ? 8 : 2, b: m.trackA < m.trackB ? 2 : 8 }]) }));
  const st = groupStandings(groups[0], ms);
  assert.equal(st[0].wins, 3);
  const seeds = seedsFromGroups(groups, ms);
  assert.equal(seeds.length, 8);
  assert.equal(new Set(seeds).size, 8);
});

for (const [u, ti] of [[2, true], [4, true], [8, true], [16, true], [4, false], [8, false], [16, false]]) {
  test(`плей-офф U=${u} ${ti ? 'TI' : 'classic'} доигрывается до чемпиона`, () => {
    const upper = ids(u, 'u');
    const lower = ti ? ids(u, 'l') : [];
    const all = [...upper, ...lower];
    const strength = (id) => -all.indexOf(id);
    let ms = buildPlayoffs(upper, lower);
    const total = all.length;
    // Каждый выбывший проигрывает дважды, стартовавшие в нижней — один раз, у чемпиона ≤1 поражения
    assert.equal(ms.length, ti ? 3 * u - 2 : 2 * u - 2, 'кол-во матчей');
    ms = playAll(ms, strength);
    assert.ok(ms.every((m) => m.status === 'done'), 'все матчи сыграны');
    assert.equal(champion(ms), 'u1');
    // Каждый трек, кроме чемпиона, должен выбыть ровно один раз
    const pl = placements(ms);
    assert.equal(pl.length, total);
    assert.equal(new Set(pl.map((p) => p.trackId)).size, total);
  });
}

test('сброс результата откатывает зависимые матчи', () => {
  let ms = playAll(buildPlayoffs(ids(4, 'u'), []));
  const reset = ms.map((m) => (m.id === 'ub-r1-m1' ? { ...m, status: 'ready', result: undefined } : m));
  const r = resolveSlots(reset);
  assert.equal(r.find((m) => m.id === 'gf').status, 'pending');
  assert.equal(r.find((m) => m.id === 'ub-r2-m1').status, 'pending');
});

test('decide: ничья по среднему решается количеством предпочтений', () => {
  const m = { id: 'x', trackA: 'a', trackB: 'b' };
  const r = decide(m, [{ matchId: 'x', a: 10, b: 1 }, { matchId: 'x', a: 1, b: 2 }, { matchId: 'x', a: 1, b: 9 }]);
  assert.equal(r.avgA, 4);
  assert.equal(r.avgB, 4);
  assert.equal(r.winner, 'b');
});

test('currentRanking: в плей-офф лидер — непобеждённый в верхней сетке', () => {
  let ms = buildPlayoffs(['a', 'b', 'c', 'd'], []);
  const play = (id, winnerSide) => {
    ms = resolveSlots(ms.map((m) => {
      if (m.id !== id) return m;
      const aWins = winnerSide === 'A';
      return { ...m, status: 'done', result: decide(m, [{ matchId: m.id, a: aWins ? 9 : 2, b: aWins ? 2 : 9 }]) };
    }));
  };
  play('ub-r1-m1', 'B'); // d побеждает a
  play('ub-r1-m2', 'A'); // b побеждает c
  const r = currentRanking(['a', 'b', 'c', 'd'], ms);
  assert.deepEqual(r.slice(0, 2).sort(), ['b', 'd']);
});

test('currentRanking: на групповом этапе — по победам', () => {
  const ms = [
    { id: 'x', stage: 'group', status: 'done', trackA: 'a', trackB: 'b', result: { winner: 'b', loser: 'a', avgA: 3, avgB: 8 } },
    { id: 'y', stage: 'group', status: 'done', trackA: 'b', trackB: 'c', result: { winner: 'b', loser: 'c', avgA: 7, avgB: 5 } },
  ];
  assert.equal(currentRanking(['a', 'b', 'c'], ms)[0], 'b');
});
