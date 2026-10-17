import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  sendEmailVerification, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { saveProfile } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { Icon, useToast, softSpring, spring } from '../components/ui.jsx';

const ERRORS = {
  'auth/invalid-credential': 'Неверная почта или пароль',
  'auth/wrong-password': 'Неверная почта или пароль',
  'auth/user-not-found': 'Такого пользователя нет',
  'auth/email-already-in-use': 'Эта почта уже зарегистрирована',
  'auth/weak-password': 'Пароль должен быть не короче 6 символов',
  'auth/invalid-email': 'Некорректная почта',
  'auth/too-many-requests': 'Слишком много попыток, попробуйте позже',
  'auth/popup-closed-by-user': 'Окно входа закрыто',
  'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase Console',
};

export default function Login() {
  const [mode, setMode] = useState('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const next = params.get('next') || '/battles';

  useEffect(() => {
    if (user && !busy) navigate(next, { replace: true });
  }, [user, busy, navigate, next]);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(ERRORS[e.code] ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'up') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await saveProfile(cred.user.uid, name || email.split('@')[0]);
        await sendEmailVerification(cred.user);
        toast('Готово! Подтверди почту по ссылке из письма');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    });
  };

  const google = () =>
    run(async () => {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await saveProfile(cred.user.uid, cred.user.displayName || cred.user.email.split('@')[0]).catch(() => {});
    });

  const reset = () => {
    if (!email) return setError('Введите почту, чтобы восстановить пароль');
    run(async () => {
      await sendPasswordResetEmail(auth, email);
      toast('Письмо для сброса пароля отправлено');
    });
  };

  return (
    <motion.div className="card auth" initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={softSpring}>
      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
          <h1>{mode === 'in' ? 'С возвращением!' : 'Создать аккаунт'}</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
            {mode === 'in' ? 'Войди, чтобы оценивать треки.' : 'Один аккаунт — один голос в каждом бою.'}
          </p>
        </motion.div>
      </AnimatePresence>

      <button className="btn btn--ghost btn--block" onClick={google} disabled={busy}>
        <Icon.google /> Продолжить с Google
      </button>

      <div className="divider">или по почте</div>

      {error && (
        <motion.div className="error" initial={{ x: -10 }} animate={{ x: [0, -8, 8, -4, 0] }} transition={{ duration: 0.35 }}>
          {error}
        </motion.div>
      )}

      <form onSubmit={submit}>
        <AnimatePresence initial={false}>
          {mode === 'up' && (
            <motion.div className="field" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <label htmlFor="name">Ник</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Как тебя называть" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="field">
          <label htmlFor="email">Почта</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@mail.ru" />
        </div>
        <div className="field">
          <label htmlFor="pass">Пароль</label>
          <input id="pass" className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Минимум 6 символов" />
        </div>
        <button className="btn btn--pink btn--block btn--lg" disabled={busy} style={{ marginTop: 8 }}>
          {busy ? 'Секунду…' : mode === 'in' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <button className="link-btn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>
          {mode === 'in' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
        </button>
        {mode === 'in' && <button className="link-btn" onClick={reset}>Забыли пароль?</button>}
      </div>
    </motion.div>
  );
}
