// Чистая логика турнира: без Firebase, чтобы её можно было тестировать в Node.
//
// Формат как на The International:
//   1. Групповой этап — круговая система внутри групп, каждый «бой» — два трека.
//   2. Плей-офф double elimination: верхняя и нижняя сетка + гранд-финал.
//      В режиме "ti" верхняя половина групп стартует в верхней сетке,
//      следующая — в нижней (первый раунд нижней сетки — на вылет).
//      В режиме "classic" все стартуют в верхней сетке.
//
// Матч хранит источники слотов (seed / winner / loser другого матча),
// поэтому продвижение по сетке — это просто пересчёт слотов из результатов.

export const GROUP_LETTERS = 'ABCDEFGH'.split('');

/** Порядок посева для сетки размера n (1-индексированные сиды): [1,8,4,5,2,7,3,6] */
export function seedOrder(n) {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

export const isPowerOfTwo = (n) => n >= 1 && (n & (n - 1)) === 0;

/** Распределение треков по группам «змейкой», чтобы группы были ровными. */
export function splitIntoGroups(trackIds, groupCount) {
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: GROUP_LETTERS[i],
    name: `Группа ${GROUP_LETTERS[i]}`,
    trackIds: [],
  }));
  trackIds.forEach((id, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    const g = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[g].trackIds.push(id);
  });
  return groups;
}

/** Круговая система (метод круга): возвращает туры с парами треков. */
export function roundRobin(ids) {
  const list = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== null && b !== null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

/** Матчи группового этапа. */
export function buildGroupMatches(groups) {
  const matches = [];
  for (const g of groups) {
    roundRobin(g.trackIds).forEach((pairs, r) => {
      pairs.forEach(([a, b], i) => {
        matches.push({
          id: `g${g.id}-r${r + 1}-m${i + 1}`,
          stage: 'group',
          group: g.id,
          round: r + 1,
          order: i,
          label: `${g.name} · Тур ${r + 1}`,
          slotA: { type: 'seed', trackId: a },
          slotB: { type: 'seed', trackId: b },
          trackA: a,
          trackB: b,
          status: 'ready',
        });
      });
    });
  }
  return matches;
}

/** Таблица группы по завершённым матчам. */
export function groupStandings(group, matches) {
  const rows = new Map(
    group.trackIds.map((id) => [id, { trackId: id, played: 0, wins: 0, losses: 0, diff: 0, scoreSum: 0 }]),
  );
  for (const m of matches) {
    if (m.stage !== 'group' || m.group !== group.id || m.status !== 'done' || !m.result) continue;
    const a = rows.get(m.trackA);
    const b = rows.get(m.trackB);
    if (!a || !b) continue;
    const { avgA, avgB, winner } = m.result;
    a.played++; b.played++;
    a.scoreSum += avgA; b.scoreSum += avgB;
    a.diff += avgA - avgB; b.diff += avgB - avgA;
    if (winner === m.trackA) { a.wins++; b.losses++; } else { b.wins++; a.losses++; }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, avg: r.played ? r.scoreSum / r.played : 0 }))
    .sort(
      (x, y) =>
        y.wins - x.wins ||
        y.diff - x.diff ||
        y.avg - x.avg ||
        group.trackIds.indexOf(x.trackId) - group.trackIds.indexOf(y.trackId),
    );
}

/**
 * Сиды плей-офф из таблиц групп. Сначала все первые места, потом вторые и т.д.,
 * внутри одного места — по результату. Так A1 играет с последним сидом из другой группы.
 */
export function seedsFromGroups(groups, matches) {
  const tables = groups.map((g) => groupStandings(g, matches));
  const depth = Math.max(0, ...tables.map((t) => t.length));
  const seeds = [];
  for (let place = 0; place < depth; place++) {
    const tier = tables.map((t) => t[place]).filter(Boolean);
    tier.sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.avg - x.avg);
    seeds.push(...tier.map((r) => r.trackId));
  }
  return seeds;
}

/**
 * Генерация сетки double elimination.
 * @param upperSeeds  треки, стартующие в верхней сетке (степень двойки, >= 2), по силе
 * @param lowerSeeds  треки, стартующие в нижней (режим TI: столько же, сколько в верхней; иначе [])
 */
export function buildPlayoffs(upperSeeds, lowerSeeds = []) {
  const U = upperSeeds.length;
  if (!isPowerOfTwo(U) || U < 2) throw new Error('В верхней сетке должно быть 2, 4, 8 или 16 треков');
  if (lowerSeeds.length && lowerSeeds.length !== U)
    throw new Error('В нижней сетке должно стартовать столько же треков, сколько в верхней');
  if (!lowerSeeds.length && U < 4) throw new Error('Для классической сетки нужно минимум 4 трека');

  const matches = [];
  const ubRounds = Math.log2(U);
  const seedSlot = (trackId) => ({ type: 'seed', trackId });
  const add = (m) => (matches.push({ status: 'pending', trackA: null, trackB: null, seq: matches.length, ...m }), m.id);
  const W = (id) => ({ type: 'winner', matchId: id });
  const L = (id) => ({ type: 'loser', matchId: id });

  const ubName = (r) =>
    r === ubRounds ? 'Финал верхней сетки' : r === ubRounds - 1 ? 'Полуфинал верхней сетки' : `Верхняя сетка · Раунд ${r}`;

  // Верхняя сетка
  const ub = [];
  let prev = [];
  const order = seedOrder(U);
  for (let r = 1; r <= ubRounds; r++) {
    const count = U / 2 ** r;
    const round = [];
    for (let i = 0; i < count; i++) {
      const slotA = r === 1 ? seedSlot(upperSeeds[order[i * 2] - 1]) : W(prev[i * 2]);
      const slotB = r === 1 ? seedSlot(upperSeeds[order[i * 2 + 1] - 1]) : W(prev[i * 2 + 1]);
      round.push(add({ id: `ub-r${r}-m${i + 1}`, stage: 'upper', round: r, order: i, label: ubName(r), slotA, slotB }));
    }
    ub.push(round);
    prev = round;
  }

  // Нижняя сетка
  let lbRound = 0;
  const lbMatches = [];
  const lbAdd = (slots, kind) => {
    lbRound++;
    const ids = slots.map(([a, b], i) =>
      add({ id: `lb-r${lbRound}-m${i + 1}`, stage: 'lower', round: lbRound, order: i, kind, slotA: a, slotB: b }),
    );
    lbMatches.push(ids);
    return ids;
  };
  const pairUp = (pool, kind) => {
    const pairs = [];
    for (let i = 0; i < pool.length; i += 2) pairs.push([pool[i], pool[i + 1]]);
    return lbAdd(pairs, kind).map(W);
  };

  let pool;
  let startK;
  if (lowerSeeds.length) {
    const lo = seedOrder(U).map((s) => seedSlot(lowerSeeds[s - 1]));
    pool = pairUp(lo, 'elim');
    startK = 1;
  } else {
    pool = pairUp(ub[0].map(L), 'pair');
    startK = 2;
  }
  for (let k = startK; k <= ubRounds; k++) {
    // Проигравшие из верхней сетки встают в обратном порядке — меньше ранних повторных встреч
    const drop = [...ub[k - 1]].reverse().map(L);
    pool = lbAdd(pool.map((p, i) => [drop[i], p]), 'drop').map(W);
    if (k < ubRounds && pool.length > 1) pool = pairUp(pool, 'pair');
  }

  const lbTotal = lbRound;
  for (const m of matches) {
    if (m.stage !== 'lower') continue;
    m.label =
      m.round === lbTotal ? 'Финал нижней сетки' : m.round === lbTotal - 1 ? 'Полуфинал нижней сетки' : `Нижняя сетка · Раунд ${m.round}`;
  }

  add({
    id: 'gf',
    stage: 'final',
    round: 1,
    order: 0,
    label: 'Гранд-финал',
    slotA: W(ub[ubRounds - 1][0]),
    slotB: pool[0],
  });

  return resolveSlots(matches);
}

/** Решение по боям: средний балл, при равенстве — больше голосов, затем трек A. */
export function decide(match, votes) {
  const list = votes.filter((v) => v.matchId === match.id);
  const n = list.length;
  const sumA = list.reduce((s, v) => s + v.a, 0);
  const sumB = list.reduce((s, v) => s + v.b, 0);
  const avgA = n ? sumA / n : 0;
  const avgB = n ? sumB / n : 0;
  const prefA = list.filter((v) => v.a > v.b).length;
  const prefB = list.filter((v) => v.b > v.a).length;
  let winner;
  if (Math.abs(avgA - avgB) > 1e-9) winner = avgA > avgB ? match.trackA : match.trackB;
  else if (prefA !== prefB) winner = prefA > prefB ? match.trackA : match.trackB;
  else winner = match.trackA;
  const loser = winner === match.trackA ? match.trackB : match.trackA;
  return { avgA: round2(avgA), avgB: round2(avgB), votes: n, winner, loser };
}

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Пересчитывает трек в каждом слоте плей-офф из результатов матчей-источников.
 * Возвращает новый массив; status 'pending' → 'ready', когда оба слота известны.
 * Если результат источника сброшен, зависимые матчи тоже сбрасываются.
 */
export function resolveSlots(matches) {
  const sorted = [...matches].sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0));
  const byId = new Map(sorted.map((m) => [m.id, { ...m }]));
  const pick = (slot) => {
    if (!slot) return null;
    if (slot.type === 'seed') return slot.trackId ?? null;
    const src = byId.get(slot.matchId);
    if (!src || src.status !== 'done' || !src.result) return null;
    return slot.type === 'winner' ? src.result.winner : src.result.loser;
  };
  // Матчи упорядочены так, что источник всегда раньше зависимого
  for (const m of byId.values()) {
    const a = pick(m.slotA);
    const b = pick(m.slotB);
    const changed = a !== m.trackA || b !== m.trackB;
    m.trackA = a;
    m.trackB = b;
    if (!a || !b) {
      m.status = 'pending';
      delete m.result;
    } else if (m.status === 'pending' || (changed && m.status !== 'ready')) {
      m.status = 'ready';
      delete m.result;
    }
  }
  return [...byId.values()];
}

/** Чемпион — победитель гранд-финала. */
export function champion(matches) {
  const gf = matches.find((m) => m.id === 'gf');
  return gf?.status === 'done' ? gf.result.winner : null;
}

/** Итоговые места: кто где вылетел. */
export function placements(matches) {
  const gf = matches.find((m) => m.id === 'gf');
  if (!gf || gf.status !== 'done') return [];
  const lower = matches.filter((m) => m.stage === 'lower' && m.status === 'done');
  const maxRound = Math.max(0, ...lower.map((m) => m.round));
  const result = [
    { place: '1', trackId: gf.result.winner },
    { place: '2', trackId: gf.result.loser },
  ];
  let place = 3;
  for (let r = maxRound; r >= 1; r--) {
    const out = lower.filter((m) => m.round === r).map((m) => m.result.loser);
    const label = out.length > 1 ? `${place}–${place + out.length - 1}` : `${place}`;
    out.forEach((trackId) => result.push({ place: label, trackId }));
    place += out.length;
  }
  return result;
}
