import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined — ещё загружается
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [loaded, setLoaded] = useState({ tracks: false, tournament: false, matches: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  useEffect(() => {
    const done = (k) => () => setLoaded((s) => (s[k] ? s : { ...s, [k]: true }));
    const unsubs = [
      onSnapshot(collection(db, 'tracks'), (s) => {
        setTracks(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        done('tracks')();
      }, done('tracks')),
      onSnapshot(doc(db, 'tournament', 'main'), (s) => {
        setTournament(s.exists() ? s.data() : { stage: 'setup', groups: [] });
        done('tournament')();
      }, done('tournament')),
      onSnapshot(collection(db, 'matches'), (s) => {
        setMatches(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        done('matches')();
      }, done('matches')),
    ];
    return () => unsubs.forEach((u) => typeof u === 'function' && u());
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setMyVotes({});
      setProfile(null);
      return;
    }
    getDoc(doc(db, 'admins', user.uid)).then((s) => setIsAdmin(s.exists())).catch(() => setIsAdmin(false));
    const u1 = onSnapshot(doc(db, 'users', user.uid), (s) => setProfile(s.exists() ? s.data() : null), () => {});
    const u2 = onSnapshot(query(collection(db, 'votes'), where('uid', '==', user.uid)), (s) => {
      const map = {};
      s.docs.forEach((d) => (map[d.data().matchId] = d.data()));
      setMyVotes(map);
    }, () => {});
    return () => { u1(); u2(); };
  }, [user]);

  const value = useMemo(() => {
    const trackById = Object.fromEntries(tracks.map((t) => [t.id, t]));
    const sorted = [...matches].sort(
      (a, b) => stageRank(a) - stageRank(b) || (a.round ?? 0) - (b.round ?? 0) || (a.group ?? '').localeCompare(b.group ?? '') || (a.order ?? 0) - (b.order ?? 0),
    );
    return {
      user, isAdmin, profile,
      tracks: [...tracks].sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)),
      trackById, tournament, matches: sorted, myVotes,
      ready: user !== undefined && loaded.tracks && loaded.tournament && loaded.matches,
      displayName: profile?.name || user?.displayName || user?.email?.split('@')[0] || '',
    };
  }, [user, isAdmin, profile, tracks, tournament, matches, myVotes, loaded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const STAGE_RANK = { group: 0, upper: 1, lower: 2, final: 3 };
const stageRank = (m) => STAGE_RANK[m.stage] ?? 9;

export const useData = () => useContext(Ctx);

/** Секунды до дедлайна, тикает раз в секунду */
export function useCountdown(endsAt) {
  const target = endsAt?.toMillis?.() ?? null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return target ? Math.max(0, Math.floor((target - now) / 1000)) : null;
}

export function formatLeft(sec) {
  if (sec == null) return '';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return d ? `${d}д ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Бой принимает голоса прямо сейчас? */
export function isVotingOpen(m) {
  if (m?.status !== 'live') return false;
  const end = m.endsAt?.toMillis?.();
  return !end || end > Date.now();
}
