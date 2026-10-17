import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc, writeBatch,
  query, where, serverTimestamp, Timestamp, getCountFromServer,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase.js';
import {
  splitIntoGroups, buildGroupMatches, seedsFromGroups, buildPlayoffs, resolveSlots, decide, champion,
} from './tournament.js';

const TOURNAMENT = () => doc(db, 'tournament', 'main');

/* ---------- Треки ---------- */

/** Dropbox / Google Drive ссылки → прямые ссылки на файл */
export function normalizeAudioUrl(url) {
  const u = url.trim();
  if (/^https?:\/\/(www\.)?dropbox\.com\//.test(u)) {
    const url = new URL(u);
    url.searchParams.delete('dl');
    url.searchParams.set('raw', '1');
    return url.toString();
  }
  const drive = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  return u;
}

export async function saveTrack(id, data) {
  const payload = {
    title: data.title.trim(),
    artist: data.artist.trim(),
    audioUrl: normalizeAudioUrl(data.audioUrl),
    coverUrl: data.coverUrl?.trim() || '',
    updatedAt: serverTimestamp(),
  };
  if (id) return updateDoc(doc(db, 'tracks', id), payload);
  return addDoc(collection(db, 'tracks'), { ...payload, createdAt: serverTimestamp() });
}

export const deleteTrack = (id) => deleteDoc(doc(db, 'tracks', id));

export function uploadFile(folder, file, onProgress) {
  if (!storage) throw new Error('Firebase Storage не настроен');
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const task = uploadBytesResumable(ref(storage, `${folder}/${Date.now()}_${safe}`), file, {
    contentType: file.type,
  });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress?.(s.bytesTransferred / s.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

/* ---------- Профиль ---------- */

export const saveProfile = (uid, name) =>
  setDoc(doc(db, 'users', uid), { name: name.trim().slice(0, 40), updatedAt: serverTimestamp() });

/* ---------- Голоса ---------- */

export const voteId = (matchId, uid) => `${matchId}_${uid}`;

export const submitVote = (matchId, uid, a, b) =>
  setDoc(doc(db, 'votes', voteId(matchId, uid)), { matchId, uid, a, b, updatedAt: serverTimestamp() });

export async function countVotes(matchId) {
  const snap = await getCountFromServer(query(collection(db, 'votes'), where('matchId', '==', matchId)));
  return snap.data().count;
}

async function loadVotes(matchId) {
  const snap = await getDocs(query(collection(db, 'votes'), where('matchId', '==', matchId)));
  return snap.docs.map((d) => d.data());
}

/* ---------- Турнир (админ) ---------- */

async function loadMatches() {
  const snap = await getDocs(collection(db, 'matches'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const clean = (m) => {
  const { id, ...rest } = m;
  Object.keys(rest).forEach((k) => rest[k] === undefined && delete rest[k]);
  return rest;
};

/** Записывает матчи пачками (лимит батча Firestore — 500 операций). */
async function writeMatches(list, deletions = []) {
  const ops = [
    ...deletions.map((id) => (b) => b.delete(doc(db, 'matches', id))),
    ...list.map((m) => (b) => b.set(doc(db, 'matches', m.id), clean(m))),
  ];
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function deleteVotesFor(matchIds) {
  for (const id of matchIds) {
    const snap = await getDocs(query(collection(db, 'votes'), where('matchId', '==', id)));
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * config: { useGroups, groupCount, upperCount, mode: 'ti'|'classic', shuffle }
 */
export async function startTournament(trackIds, config) {
  const ids = config.shuffle ? shuffle(trackIds) : trackIds;
  const old = await loadMatches();
  await deleteVotesFor(old.map((m) => m.id));

  if (config.useGroups) {
    const groups = splitIntoGroups(ids, config.groupCount);
    await writeMatches(buildGroupMatches(groups), old.map((m) => m.id));
    await setDoc(TOURNAMENT(), {
      stage: 'groups', config, groups, championId: null, startedAt: serverTimestamp(),
    });
  } else {
    const upper = ids.slice(0, config.upperCount);
    const lower = config.mode === 'ti' ? ids.slice(config.upperCount, config.upperCount * 2) : [];
    await writeMatches(buildPlayoffs(upper, lower), old.map((m) => m.id));
    await setDoc(TOURNAMENT(), {
      stage: 'playoffs', config, groups: [], championId: null, startedAt: serverTimestamp(),
    });
  }
}

export async function startPlayoffs(tournament) {
  const all = await loadMatches();
  const groupMatches = all.filter((m) => m.stage === 'group');
  if (groupMatches.some((m) => m.status !== 'done')) throw new Error('Сначала завершите все бои группового этапа');
  const { upperCount, mode } = tournament.config;
  const seeds = seedsFromGroups(tournament.groups, groupMatches);
  const upper = seeds.slice(0, upperCount);
  const lower = mode === 'ti' ? seeds.slice(upperCount, upperCount * 2) : [];
  const old = all.filter((m) => m.stage !== 'group');
  await deleteVotesFor(old.map((m) => m.id));
  await writeMatches(buildPlayoffs(upper, lower), old.map((m) => m.id));
  await updateDoc(TOURNAMENT(), {
    stage: 'playoffs', eliminated: seeds.slice(upperCount + lower.length), championId: null,
  });
}

export async function resetTournament() {
  const old = await loadMatches();
  await deleteVotesFor(old.map((m) => m.id));
  await writeMatches([], old.map((m) => m.id));
  await setDoc(TOURNAMENT(), { stage: 'setup', groups: [], championId: null });
}

/** Открыть голосование. hours = 0 — без ограничения по времени. */
export function openMatch(id, hours = 0) {
  return updateDoc(doc(db, 'matches', id), {
    status: 'live',
    openedAt: serverTimestamp(),
    endsAt: hours ? Timestamp.fromMillis(Date.now() + hours * 3600e3) : null,
  });
}

/** Пересчитать сетку после изменения результата и сохранить изменившиеся матчи. */
async function commitWithPropagation(all, changedId) {
  const playoff = all.filter((m) => m.stage !== 'group');
  const before = new Map(all.map((m) => [m.id, JSON.stringify(clean(m))]));
  const resolved = playoff.length ? resolveSlots(playoff) : [];
  const next = [...all.filter((m) => m.stage === 'group'), ...resolved];
  const changed = next.filter((m) => m.id === changedId || before.get(m.id) !== JSON.stringify(clean(m)));
  // Матчи, у которых сменились треки, теряют старые голоса
  const resetIds = changed.filter((m) => m.id !== changedId && !m.result).map((m) => m.id);
  await deleteVotesFor(resetIds);
  await writeMatches(changed);
  const champ = champion(resolved);
  const t = await getDoc(TOURNAMENT());
  if (t.exists() && t.data().stage !== 'groups') {
    await updateDoc(TOURNAMENT(), { stage: champ ? 'finished' : 'playoffs', championId: champ });
  }
}

/** Закрыть голосование, посчитать средние баллы, продвинуть победителя. */
export async function closeMatch(id) {
  const all = await loadMatches();
  const m = all.find((x) => x.id === id);
  const votes = await loadVotes(id);
  m.result = decide(m, votes);
  m.status = 'done';
  m.closedAt = Timestamp.now();
  await commitWithPropagation(all, id);
  return m.result;
}

/** Админ вручную назначает победителя (например, если нет голосов). */
export async function setWinner(id, winner) {
  const all = await loadMatches();
  const m = all.find((x) => x.id === id);
  const votes = await loadVotes(id);
  const r = decide(m, votes);
  m.result = { ...r, winner, loser: winner === m.trackA ? m.trackB : m.trackA, manual: true };
  m.status = 'done';
  await commitWithPropagation(all, id);
}

/** Вернуть бой в состояние «готов» (результат и голоса сохраняются до нового закрытия). */
export async function reopenMatch(id) {
  const all = await loadMatches();
  const m = all.find((x) => x.id === id);
  m.status = 'ready';
  delete m.result;
  m.endsAt = null;
  await commitWithPropagation(all, id);
}

export async function closeAllLive(matches) {
  for (const m of matches.filter((x) => x.status === 'live')) await closeMatch(m.id);
}

export async function openMany(ids, hours) {
  const batch = writeBatch(db);
  const endsAt = hours ? Timestamp.fromMillis(Date.now() + hours * 3600e3) : null;
  ids.forEach((id) => batch.update(doc(db, 'matches', id), { status: 'live', openedAt: serverTimestamp(), endsAt }));
  await batch.commit();
}
