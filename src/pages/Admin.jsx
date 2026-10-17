import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../lib/store.jsx';
import { storage } from '../lib/firebase.js';
import {
  finishEarly, resumeTournament, saveTrack, deleteTrack, uploadFile, compressImage, normalizeAudioUrl, trackFromFile, listFolderTracks, startTournament, startPlayoffs, resetTournament,
  openMatch, closeMatch, reopenMatch, setWinner, openMany, closeAllLive, countVotes,
} from '../lib/api.js';
import { isPowerOfTwo, swissWinOptions, swissMatchCount, swissFinished, currentRanking } from '../lib/tournament.js';
import AudioPlayer from '../components/AudioPlayer.jsx';
import { Cover, Empty, StatusBadge, Icon, useToast, spring } from '../components/ui.jsx';

const TABS = [
  { id: 'tracks', label: 'Треки' },
  { id: 'tournament', label: 'Турнир' },
  { id: 'matches', label: 'Бои' },
];

export default function Admin() {
  const { isAdmin, adminCheck, user } = useData();
  const [tab, setTab] = useState('tracks');
  const toast = useToast();

  if (!user || !isAdmin) {
    return (
      <Empty icon="lock" title="Только для организатора">
        {user ? (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            {adminCheck === 'denied' ? (
              <div className="error" style={{ textAlign: 'left' }}>
                Правила Firestore не загружены — сайт не может проверить права. Выполните в папке проекта:
                <pre style={{ margin: '8px 0 0' }}>npx firebase deploy --only firestore</pre>
              </div>
            ) : (
              <p>
                В Firestore нет документа <b>admins / ваш UID</b>. Создайте коллекцию <code>admins</code>, а в поле
                <b> Document ID</b> вставьте UID ниже (не нажимайте Auto-ID).
              </p>
            )}
            <p className="tiny" style={{ marginBottom: 6 }}>Ваш UID:</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <code className="badge" style={{ textTransform: 'none', fontSize: 14 }}>{user.uid}</code>
              <button className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard.writeText(user.uid).then(() => toast('UID скопирован'))}>
                Копировать
              </button>
            </div>
            <p className="tiny">После этого обновите страницу.</p>
          </div>
        ) : (
          <Link to="/login?next=/admin" className="link-btn">Войти</Link>
        )}
      </Empty>
    );
  }

  return (
    <>
      <h1 className="page-title">Админка</h1>
      <p className="page-sub">Добавьте треки, настройте формат и запустите турнир. Голосованием в каждом бою управляете вы.</p>
      <div className="toggle" style={{ marginBottom: 28 }}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="admin-tab" className="toggle__pill" transition={spring} />}
            {t.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}>
          {tab === 'tracks' && <TracksAdmin />}
          {tab === 'tournament' && <TournamentAdmin />}
          {tab === 'matches' && <MatchesAdmin />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/* ================= Треки ================= */

const EMPTY = { title: '', artist: '', audioUrl: '', coverUrl: '' };

/** Обложка сжимается в браузере и хранится в базе — Storage не нужен */
function CoverButton({ onDone }) {
  const toast = useToast();
  return (
    <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>
      <Icon.upload /> Загрузить обложку
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            onDone(await compressImage(file));
          } catch (err) {
            toast(err.message, 'error');
          }
        }}
      />
    </label>
  );
}

function UploadButton({ folder, accept, onDone, label }) {
  const [progress, setProgress] = useState(null);
  const toast = useToast();
  if (!storage) return null;
  return (
    <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>
      {progress != null ? `${Math.round(progress * 100)}%` : label}
      <input
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            setProgress(0);
            onDone(await uploadFile(folder, file, setProgress));
            toast('Файл загружен');
          } catch (err) {
            toast(
              err.code?.startsWith('storage/')
                ? 'Firebase Storage не включён (нужен тариф Blaze). Положите mp3 в папку public/tracks — см. подсказку ниже'
                : `Загрузка не удалась: ${err.message}`,
              'error',
            );
          } finally {
            setProgress(null);
          }
        }}
      />
    </label>
  );
}

/** Импорт mp3 из папки public/tracks: название, артист и обложка берутся из тегов файла */
function FolderImport() {
  const { tracks } = useData();
  const toast = useToast();
  const [files, setFiles] = useState(null);
  const [progress, setProgress] = useState(null);

  const load = () => listFolderTracks().then(setFiles).catch(() => setFiles([]));
  useEffect(() => {
    load();
  }, []);

  const added = new Set(tracks.map((t) => t.audioUrl));
  const fresh = (files ?? []).filter((f) => !added.has(f.audioUrl));

  const importAll = async () => {
    setProgress(0);
    let ok = 0;
    for (const [i, f] of fresh.entries()) {
      try {
        await saveTrack(null, await trackFromFile(f.audioUrl));
        ok++;
      } catch (err) {
        toast(`${f.name}: ${err.message}`, 'error');
      }
      setProgress((i + 1) / fresh.length);
    }
    setProgress(null);
    toast(`Добавлено треков: ${ok}`);
  };

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="section__head" style={{ marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 20 }}>Папка public/tracks</h3>
          <p className="tiny" style={{ margin: '6px 0 0' }}>
            Скиньте mp3 в папку — название, артист и обложка возьмутся из самого файла. Новые файлы видны после перезапуска <code>npm run dev</code>.
          </p>
        </div>
        <div className="row">
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={progress != null}>Обновить</button>
          <button className="btn btn--pink" onClick={importAll} disabled={!fresh.length || progress != null}>
            {progress != null ? `Добавляем… ${Math.round(progress * 100)}%` : `Добавить новые (${fresh.length})`}
          </button>
        </div>
      </div>
      {progress != null && <div className="progress" style={{ marginBottom: 12 }}><span style={{ width: `${progress * 100}%` }} /></div>}
      {files?.length ? (
        <div className="row" style={{ gap: 8 }}>
          {files.map((f) => (
            <span key={f.name} className={`badge ${added.has(f.audioUrl) ? 'badge--done' : 'badge--ready'}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
              {added.has(f.audioUrl) && <Icon.check />} {f.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{files ? 'В папке пока нет аудиофайлов.' : 'Загружаем список…'}</p>
      )}
    </div>
  );
}

function TracksAdmin() {
  const { tracks, tournament } = useData();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const locked = tournament?.stage && tournament.stage !== 'setup';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }));

  // Пустые поля (название, артист, обложка) заполняются из тегов указанного файла
  const fillFromFile = async (url = form.audioUrl) => {
    if (!url.trim()) return;
    const meta = await trackFromFile(url).catch(() => null);
    if (!meta) return;
    setForm((f) => ({
      ...f,
      title: f.title || meta.title,
      artist: f.artist || meta.artist,
      coverUrl: f.coverUrl || meta.coverUrl,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveTrack(editing, form);
      toast(editing ? 'Трек обновлён' : 'Трек добавлен');
      setForm(EMPTY);
      setEditing(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <FolderImport />
    <div className="admin-grid">
      <form className="card" onSubmit={submit}>
        <h3 style={{ fontSize: 20, marginBottom: 18 }}>{editing ? 'Редактировать трек' : 'Новый трек'}</h3>
        <div className="field">
          <label>Название</label>
          <input className="input" value={form.title} onChange={set('title')} required maxLength={120} />
        </div>
        <div className="field">
          <label>Артист</label>
          <input className="input" value={form.artist} onChange={set('artist')} required maxLength={120} />
        </div>
        <div className="field">
          <label>Ссылка на аудио (mp3 / m4a / ogg)</label>
          <input className="input" value={form.audioUrl} onChange={set('audioUrl')} onBlur={() => fillFromFile()} required placeholder="/tracks/песня.mp3 или https://…/track.mp3" />
          <div className="row">
            <UploadButton folder="audio" accept="audio/*" label={<><Icon.upload /> Загрузить файл</>} onDone={(url) => { set('audioUrl')(url); fillFromFile(url); }} />
          </div>
          <span className="tiny">
            Бесплатный способ: положите mp3 в папку проекта <code>public/tracks</code> и впишите <code>/tracks/имя_файла.mp3</code> —
            пустые поля и обложка заполнятся из тегов файла.
            Подойдут и прямые ссылки (Dropbox преобразуется автоматически). Ссылки на Яндекс Диск, ВК и YouTube не работают.
          </span>
        </div>
        <div className="field">
          <label>Обложка (необязательно)</label>
          <div className="row">
            {form.coverUrl && <Cover track={{ id: 'preview', title: form.title, coverUrl: form.coverUrl }} style={{ width: 56, borderRadius: 14 }} />}
            <CoverButton onDone={set('coverUrl')} />
            {form.coverUrl && <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('coverUrl')('')}>Убрать</button>}
          </div>
          <input className="input" value={form.coverUrl.startsWith('data:') ? '' : form.coverUrl} onChange={set('coverUrl')} placeholder="…или ссылка на картинку" />
        </div>
        {form.audioUrl && <div style={{ marginBottom: 16 }}><AudioPlayer src={normalizeAudioUrl(form.audioUrl)} accent="var(--purple)" /></div>}
        <div className="row">
          <button className="btn btn--pink" disabled={busy}>{editing ? 'Сохранить' : 'Добавить трек'}</button>
          {editing && <button type="button" className="btn btn--ghost" onClick={() => { setEditing(null); setForm(EMPTY); }}>Отмена</button>}
        </div>
      </form>

      <div className="card">
        <div className="section__head" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 20 }}>Все треки · {tracks.length}</h3>
        </div>
        {locked && <div className="notice" style={{ marginBottom: 14 }}>Турнир уже идёт: удаление треков сломает сетку. Редактировать название и ссылку можно.</div>}
        <div className="admin-list">
          <AnimatePresence initial={false}>
            {tracks.map((t, i) => (
              <motion.div key={t.id} className="admin-row" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={spring}>
                <span className="tiny" style={{ width: 22, textAlign: 'center' }}>{i + 1}</span>
                <Cover track={t} />
                <div className="admin-row__body">
                  <div className="admin-row__title">{t.title}</div>
                  <div className="tiny">{t.artist}</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(t.id); setForm({ ...EMPTY, ...t }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Изм.</button>
                <button
                  className="btn btn--danger btn--sm"
                  disabled={locked}
                  onClick={() => confirm(`Удалить «${t.title}»?`) && deleteTrack(t.id).then(() => toast('Удалено'))}
                >
                  <Icon.close />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {!tracks.length && <p className="muted">Добавьте первый трек слева.</p>}
        </div>
      </div>
    </div>
    </>
  );
}

/* ================= Турнир ================= */

/** Досрочное завершение: организатор выбирает победителя (по умолчанию — текущий лидер) */
function EarlyFinish() {
  const { tournament, matches, trackById } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const participants = [...new Set(matches.flatMap((m) => [m.trackA, m.trackB]).filter(Boolean))];
  const ranking = currentRanking(participants, matches);
  const [pick, setPick] = useState('');
  const champion = pick || ranking[0] || '';

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (tournament.endedEarly) {
    return (
      <div className="notice" style={{ marginTop: 24 }}>
        Турнир завершён досрочно. Победитель: <b>{trackById[tournament.championId]?.title ?? '—'}</b>.
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => confirm('Возобновить турнир? Отменённые бои снова станут доступны для голосования.') && run(() => resumeTournament(tournament), 'Турнир возобновлён')}
          >
            Возобновить турнир
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '3px solid var(--line)' }}>
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>Завершить досрочно</h3>
      <p className="tiny" style={{ marginTop: 0 }}>
        Голосование во всех открытых и оставшихся боях остановится, победитель появится на главной. Сыгранные результаты сохранятся.
      </p>
      <div className="field">
        <span className="label">Победитель турнира</span>
        <select className="select" value={champion} onChange={(e) => setPick(e.target.value)}>
          {ranking.map((id, i) => (
            <option key={id} value={id}>
              {i === 0 ? '★ ' : ''}{trackById[id]?.title ?? id}{trackById[id]?.artist ? ` — ${trackById[id].artist}` : ''}{i === 0 ? ' (лидер сейчас)' : ''}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn btn--orange btn--block"
        disabled={busy || !champion}
        onClick={() =>
          confirm(`Завершить турнир досрочно? Победитель — «${trackById[champion]?.title}».`) &&
          run(() => finishEarly(tournament, champion), 'Турнир завершён')
        }
      >
        <Icon.flag /> Завершить турнир досрочно
      </button>
    </div>
  );
}

function TournamentAdmin() {
  const { tracks, tournament, matches } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState({ format: 'swiss', swissWins: 3, groupCount: 2, upperCount: 4, mode: 'ti', shuffle: true });
  const stage = tournament?.stage ?? 'setup';
  const n = tracks.length;
  const swiss = cfg.format === 'swiss';
  const winOptions = swissWinOptions(n);
  // В швейцарке проходит ровно половина: TI — четверть в верхнюю и четверть в нижнюю, классика — половина в верхнюю
  const swissWins = winOptions.includes(cfg.swissWins) ? cfg.swissWins : winOptions[Math.min(1, winOptions.length - 1)];
  const upperCount = swiss ? (cfg.mode === 'ti' ? n / 4 : n / 2) : cfg.upperCount;
  const useGroups = cfg.format !== 'none';

  const plan = useMemo(() => {
    const lower = cfg.mode === 'ti' ? upperCount : 0;
    const qualified = upperCount + lower;
    const errors = [];
    if (swiss) {
      if (!winOptions.length) {
        errors.push(`Для швейцарки нужно 8, 16 или 32 трека (сейчас ${n}). Добавьте или уберите треки, либо выберите другой формат.`);
      }
      const perTrack = 2 * swissWins - 1;
      return {
        lower, qualified, errors, perTrack,
        groupMatches: winOptions.length ? swissMatchCount(n, swissWins) : 0,
        playoffMatches: winOptions.length ? (cfg.mode === 'ti' ? 3 * upperCount - 2 : 2 * upperCount - 2) : 0,
        out: winOptions.length ? n / 2 : 0,
      };
    }
    if (!isPowerOfTwo(cfg.upperCount)) errors.push('Размер верхней сетки должен быть степенью двойки');
    if (cfg.mode === 'classic' && cfg.upperCount < 4) errors.push('Для классической сетки нужно минимум 4 трека');
    if (useGroups) {
      if (n < cfg.groupCount * 2) errors.push(`Нужно минимум ${cfg.groupCount * 2} трека для ${cfg.groupCount} групп`);
      if (qualified > n) errors.push(`В плей-офф проходят ${qualified}, а треков всего ${n}`);
    } else if (n < qualified) {
      errors.push(`Без групп нужно ровно ${qualified} треков (сейчас ${n}). Лишние не попадут в турнир.`);
    }
    const perGroup = useGroups ? Math.ceil(n / cfg.groupCount) : 0;
    const groupMatches = useGroups
      ? Array.from({ length: cfg.groupCount }, (_, i) => {
          const size = Math.floor(n / cfg.groupCount) + (i < n % cfg.groupCount ? 1 : 0);
          return (size * (size - 1)) / 2;
        }).reduce((a, b) => a + b, 0)
      : 0;
    const playoffMatches = cfg.mode === 'ti' ? 3 * cfg.upperCount - 2 : 2 * cfg.upperCount - 2;
    return { lower, qualified, errors, perGroup, groupMatches, playoffMatches, out: Math.max(0, n - qualified) };
  }, [cfg, n, swiss, swissWins, upperCount, useGroups, winOptions.length]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const groupDone = matches.filter((m) => m.stage === 'group');
  const runningSwiss = tournament?.swiss?.trackIds && tournament?.config?.swissWins;
  const allGroupDone = runningSwiss
    ? swissFinished(tournament.swiss.trackIds, groupDone, tournament.config.swissWins)
    : groupDone.length > 0 && groupDone.every((m) => m.status === 'done');
  // В швейцарке туры появляются по ходу, поэтому общее число боёв считаем заранее
  const groupTotal = runningSwiss ? swissMatchCount(tournament.swiss.trackIds.length, tournament.config.swissWins) : groupDone.length;
  const groupPlayed = groupDone.filter((m) => m.status === 'done').length;
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="admin-grid">
      <div className="card">
        <h3 style={{ fontSize: 20, marginBottom: 6 }}>Формат</h3>
        <p className="tiny" style={{ marginTop: 0 }}>Текущая стадия: <b>{{ setup: 'настройка', groups: 'групповой этап', playoffs: 'плей-офф', finished: 'завершён' }[stage]}</b></p>

        <div className="field">
          <span className="label">Групповой этап</span>
          <div className="toggle">
            {[['swiss', 'Швейцарка (как TI)'], ['groups', 'Группы'], ['none', 'Сразу плей-офф']].map(([v, l]) => (
              <button key={v} type="button" className={cfg.format === v ? 'is-on' : ''} onClick={() => set('format', v)}>
                {cfg.format === v && <motion.span layoutId="cfg-groups" className="toggle__pill" transition={spring} />}
                {l}
              </button>
            ))}
          </div>
          <span className="tiny">
            {swiss
              ? `В каждом туре встречаются треки с одинаковым счётом. ${swissWins ?? 3} победы — проход, ${swissWins ?? 3} поражения — вылет. У трека максимум ${plan.perTrack ?? 5} боёв.`
              : cfg.format === 'groups'
                ? 'Каждый трек играет с каждым в своей группе — боёв заметно больше.'
                : 'Без группового этапа: треки сразу попадают в сетку.'}
          </span>
        </div>

        {swiss && winOptions.length > 1 && (
          <div className="field">
            <span className="label">Побед для выхода (и поражений для вылета)</span>
            <div className="toggle">
              {winOptions.map((v) => (
                <button key={v} type="button" className={swissWins === v ? 'is-on' : ''} onClick={() => set('swissWins', v)}>
                  {swissWins === v && <motion.span layoutId="cfg-sw" className="toggle__pill" transition={spring} />}
                  {v}-0
                </button>
              ))}
            </div>
          </div>
        )}

        {cfg.format === 'groups' && (
          <div className="field">
            <span className="label">Количество групп</span>
            <div className="toggle">
              {[1, 2, 3, 4].map((v) => (
                <button key={v} type="button" className={cfg.groupCount === v ? 'is-on' : ''} onClick={() => set('groupCount', v)}>
                  {cfg.groupCount === v && <motion.span layoutId="cfg-gc" className="toggle__pill" transition={spring} />}
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <span className="label">Сетка плей-офф</span>
          <div className="toggle">
            {[['ti', 'Как на TI'], ['classic', 'Классика']].map(([v, l]) => (
              <button key={v} type="button" className={cfg.mode === v ? 'is-on' : ''} onClick={() => set('mode', v)}>
                {cfg.mode === v && <motion.span layoutId="cfg-mode" className="toggle__pill" transition={spring} />}
                {l}
              </button>
            ))}
          </div>
          <span className="tiny">
            {cfg.mode === 'ti'
              ? 'Половина участников стартует в верхней сетке, половина — в нижней (первый раунд нижней — на вылет).'
              : 'Все стартуют в верхней сетке, проигравшие падают в нижнюю.'}
          </span>
        </div>

        {!swiss && <div className="field">
          <span className="label">Треков в верхней сетке</span>
          <div className="toggle">
            {[2, 4, 8, 16].map((v) => (
              <button key={v} type="button" className={cfg.upperCount === v ? 'is-on' : ''} onClick={() => set('upperCount', v)}>
                {cfg.upperCount === v && <motion.span layoutId="cfg-uc" className="toggle__pill" transition={spring} />}
                {v}
              </button>
            ))}
          </div>
        </div>}

        <label className="row" style={{ cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={cfg.shuffle} onChange={(e) => set('shuffle', e.target.checked)} />
          <span style={{ fontWeight: 800 }}>Перемешать треки при жеребьёвке</span>
        </label>
        {!cfg.shuffle && <p className="tiny" style={{ marginTop: 0 }}>Порядок — как в списке треков (сверху — самые сильные сиды).</p>}

        <div className="summary">
          <div><b>{n}</b><span>треков</span></div>
          {cfg.format === 'groups' && <div><b>{cfg.groupCount}×{plan.perGroup}</b><span>групп × треков</span></div>}
          {swiss && <div><b>{plan.groupMatches}</b><span>боёв в швейцарке</span></div>}
          <div><b>{upperCount || '—'}</b><span>в верхней сетке</span></div>
          {plan.lower > 0 && <div><b>{plan.lower}</b><span>в нижней сетке</span></div>}
          <div><b>{plan.out}</b><span>{useGroups ? 'вылетят в группах' : 'не участвуют'}</span></div>
          <div><b>{plan.groupMatches + plan.playoffMatches}</b><span>боёв всего</span></div>
        </div>

        {plan.errors.map((e) => <div key={e} className="error">{e}</div>)}

        <button
          className="btn btn--pink btn--block"
          disabled={busy || plan.errors.length > 0}
          onClick={() => {
            if (stage !== 'setup' && !confirm('Турнир уже запущен. Начать заново? Все бои и голоса будут удалены.')) return;
            const config = { ...cfg, useGroups, upperCount, swissWins: swiss ? swissWins : null };
            run(() => startTournament(tracks.map((t) => t.id), config), 'Турнир запущен!');
          }}
        >
          {stage === 'setup' ? 'Запустить турнир' : 'Перезапустить с этими настройками'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 20, marginBottom: 14 }}>Ход турнира</h3>
        <ol className="muted" style={{ paddingLeft: 20, lineHeight: 1.7, marginTop: 0 }}>
          <li>Добавьте треки во вкладке «Треки».</li>
          <li>Выберите формат и нажмите «Запустить турнир».</li>
          <li>Во вкладке «Бои» открывайте голосование (можно сразу целый тур) и закрывайте его — победитель посчитается по среднему баллу.</li>
          <li>Когда все групповые бои сыграны, сформируйте плей-офф кнопкой ниже.</li>
          <li>Победители автоматически продвигаются по верхней и нижней сетке до гранд-финала.</li>
        </ol>

        {stage === 'groups' && (
          <div style={{ marginTop: 18 }}>
            <div className="progress" style={{ marginBottom: 10 }}>
              <span style={{ width: `${(groupPlayed / Math.max(1, groupTotal)) * 100}%` }} />
            </div>
            <p className="tiny">
              Групповых боёв сыграно: {groupPlayed} из {groupTotal}
              {runningSwiss && !allGroupDone ? '. Следующий тур швейцарки появится сам, как только закроете все бои текущего.' : ''}
            </p>
            <button className="btn btn--lime btn--block" disabled={busy || !allGroupDone} onClick={() => run(() => startPlayoffs(tournament), 'Плей-офф сформирован!')}>
              Сформировать плей-офф
            </button>
          </div>
        )}

        {(stage === 'groups' || stage === 'playoffs' || tournament?.endedEarly) && <EarlyFinish />}

        {stage !== 'setup' && (
          <button
            className="btn btn--danger btn--sm"
            style={{ marginTop: 24 }}
            disabled={busy}
            onClick={() => confirm('Сбросить турнир полностью? Треки останутся, бои и голоса удалятся.') && run(resetTournament, 'Турнир сброшен')}
          >
            Сбросить турнир
          </button>
        )}
      </div>
    </div>
  );
}

/* ================= Бои ================= */

const DURATIONS = [
  [0, 'Без лимита'],
  [1, '1 час'],
  [6, '6 часов'],
  [24, '24 часа'],
  [72, '3 дня'],
];

function MatchRow({ m, hours }) {
  const { trackById } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState(null);
  const a = trackById[m.trackA];
  const b = trackById[m.trackB];

  useEffect(() => {
    if (m.status !== 'live') return;
    let alive = true;
    const load = () => countVotes(m.id).then((c) => alive && setVotes(c)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [m.id, m.status]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const r = await fn();
      toast(typeof ok === 'function' ? ok(r) : ok);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="admin-match" layout transition={spring}>
      <div>
        <div className="row" style={{ marginBottom: 6 }}>
          <StatusBadge status={m.status} />
          <span className="tiny">{m.label}</span>
          {m.status === 'live' && votes != null && <span className="badge badge--purple">{votes} голосов</span>}
          {m.status === 'live' && m.endsAt && <span className="tiny">до {m.endsAt.toDate().toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        <div className="admin-match__names">
          {a?.title ?? '—'}
          {m.result && <b style={{ color: 'var(--purple)' }}> {m.result.avgA}</b>}
          <span className="vs">VS</span>
          {b?.title ?? '—'}
          {m.result && <b style={{ color: 'var(--purple)' }}> {m.result.avgB}</b>}
        </div>
      </div>
      <div className="row">
        {m.status === 'ready' && (
          <button className="btn btn--lime btn--sm" disabled={busy} onClick={() => run(() => openMatch(m.id, hours), 'Голосование открыто')}>Открыть</button>
        )}
        {m.status === 'live' && (
          <button
            className="btn btn--pink btn--sm"
            disabled={busy}
            onClick={() => (votes !== 0 || confirm('Голосов нет — победит первый трек. Закрыть?')) && run(() => closeMatch(m.id), (r) => `Победил «${trackById[r.winner]?.title}»`)}
          >
            Закрыть и подсчитать
          </button>
        )}
        {(m.status === 'live' || m.status === 'ready') && a && b && (
          <select
            className="select"
            style={{ width: 'auto', padding: '8px 12px' }}
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && confirm('Назначить победителя вручную?') && run(() => setWinner(m.id, e.target.value), 'Победитель назначен')}
          >
            <option value="">Вручную…</option>
            <option value={m.trackA}>{a.title}</option>
            <option value={m.trackB}>{b.title}</option>
          </select>
        )}
        {m.status === 'done' && (
          <button
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => confirm('Отменить результат? Зависимые бои плей-офф тоже сбросятся.') && run(() => reopenMatch(m.id), 'Результат отменён')}
          >
            Отменить результат
          </button>
        )}
        <Link to={`/battle/${m.id}`} className="btn btn--ghost btn--sm">↗</Link>
      </div>
    </motion.div>
  );
}

function MatchesAdmin() {
  const { matches } = useData();
  const toast = useToast();
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState('active');
  const [busy, setBusy] = useState(false);

  if (!matches.length) return <Empty icon="swords" title="Боёв пока нет">Запустите турнир во вкладке «Турнир».</Empty>;

  const ready = matches.filter((m) => m.status === 'ready');
  const live = matches.filter((m) => m.status === 'live');
  // Ближайший тур: минимальный (стадия, раунд) среди готовых боёв
  const next = ready[0];
  const nextRound = next ? ready.filter((m) => m.stage === next.stage && m.round === next.round) : [];
  const shown = filter === 'active' ? matches.filter((m) => m.status === 'ready' || m.status === 'live') : matches;

  const bulk = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="field" style={{ margin: 0 }}>
            <span className="label">Длительность голосования</span>
            <select className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 'auto' }}>
              {DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="row">
            {nextRound.length > 0 && (
              <button className="btn btn--lime" disabled={busy} onClick={() => bulk(() => openMany(nextRound.map((m) => m.id), hours), `Открыто боёв: ${nextRound.length}`)}>
                Открыть {next.stage === 'group' ? `тур ${next.round}` : `«${next.label}»`} ({nextRound.length})
              </button>
            )}
            {ready.length > 0 && (
              <button className="btn btn--blue" disabled={busy} onClick={() => bulk(() => openMany(ready.map((m) => m.id), hours), `Открыто боёв: ${ready.length}`)}>
                Открыть все готовые ({ready.length})
              </button>
            )}
            {live.length > 0 && (
              <button className="btn btn--pink" disabled={busy} onClick={() => confirm(`Закрыть ${live.length} боёв и подсчитать?`) && bulk(() => closeAllLive(matches), 'Итоги подведены')}>
                Закрыть все ({live.length})
              </button>
            )}
          </div>
        </div>
        <p className="tiny" style={{ marginBottom: 0 }}>По истечении времени голоса перестают приниматься автоматически, но итоги подводятся, когда вы нажмёте «Закрыть».</p>
      </div>

      <div className="toggle" style={{ marginBottom: 16 }}>
        {[['active', 'Активные'], ['all', 'Все']].map(([v, l]) => (
          <button key={v} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>
            {filter === v && <motion.span layoutId="m-filter" className="toggle__pill" transition={spring} />}
            {l}
          </button>
        ))}
      </div>

      <div className="admin-list">
        {shown.map((m) => <MatchRow key={m.id} m={m} hours={hours} />)}
        {!shown.length && <p className="muted">Нет активных боёв — посмотрите вкладку «Все».</p>}
      </div>
    </>
  );
}
