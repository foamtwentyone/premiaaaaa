import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { isConfigured } from './lib/firebase.js';
import { DataProvider, useData } from './lib/store.jsx';
import Nav from './components/Nav.jsx';
import { Background, Loader, Empty, ToastProvider } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Battles from './pages/Battles.jsx';
import Battle from './pages/Battle.jsx';
import Groups from './pages/Groups.jsx';
import Playoffs from './pages/Playoffs.jsx';
import Tracks from './pages/Tracks.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';

function Page({ children }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {children}
    </motion.main>
  );
}

function Routed() {
  const { ready } = useData();
  const location = useLocation();
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  if (!ready) return <Loader />;
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Page><Home /></Page>} />
        <Route path="/battles" element={<Page><Battles /></Page>} />
        <Route path="/battle/:id" element={<Page><Battle /></Page>} />
        <Route path="/groups" element={<Page><Groups /></Page>} />
        <Route path="/playoffs" element={<Page><Playoffs /></Page>} />
        <Route path="/tracks" element={<Page><Tracks /></Page>} />
        <Route path="/login" element={<Page><Login /></Page>} />
        <Route path="/admin" element={<Page><Admin /></Page>} />
        <Route path="*" element={<Page><Empty icon="🌀" title="Страница не найдена">Похоже, этот трек ещё не записан.</Empty></Page>} />
      </Routes>
    </AnimatePresence>
  );
}

function SetupScreen() {
  return (
    <div className="shell">
      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="page-title" style={{ fontSize: 32 }}>Подключите Firebase</h1>
        <p className="muted">Сайт не видит настроек Firebase. Чтобы всё заработало:</p>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Скопируйте <code>.env.example</code> в <code>.env.local</code>.</li>
          <li>Заполните значения из Firebase Console → Project settings → Your apps.</li>
          <li>Перезапустите <code>npm run dev</code>.</li>
        </ol>
        <p className="tiny">Подробная инструкция — в README.md.</p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isConfigured) {
    return (
      <>
        <Background />
        <SetupScreen />
      </>
    );
  }
  return (
    <DataProvider>
      <ToastProvider>
        <Background />
        <Nav />
        <div className="shell">
          <Routed />
        </div>
      </ToastProvider>
    </DataProvider>
  );
}
