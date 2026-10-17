import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { useData } from '../lib/store.jsx';
import { Icon, spring } from './ui.jsx';

export default function Nav() {
  const { isAdmin, matches, tournament } = useData();
  const live = matches.some((m) => m.status === 'live');
  const hasGroups = tournament?.groups?.length > 0;

  const links = [
    { to: '/', label: 'Главная', icon: Icon.home, end: true },
    { to: '/battles', label: 'Бои', icon: Icon.swords, dot: live },
    ...(hasGroups ? [{ to: '/groups', label: 'Группы', icon: Icon.table }] : []),
    { to: '/playoffs', label: 'Плей-офф', icon: Icon.bracket },
    { to: '/tracks', label: 'Треки', icon: Icon.disc },
    ...(isAdmin ? [{ to: '/admin', label: 'Админ', icon: Icon.cog }] : []),
  ];

  return (
    <>
    <motion.header className="nav" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}>
      <Link to="/" className="logo">
        <span className="logo__mark"><Icon.star /></span>
        <span>
          ТРЕК<span className="logo__year">’26</span>
        </span>
      </Link>
      <UserButton />
    </motion.header>

    <nav className="nav__links">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-pill" className="nav__pill" transition={spring} />}
                <l.icon />
                {l.label}
                {l.dot && <span className="nav__live" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

function UserButton() {
  const { user, displayName } = useData();
  const navigate = useNavigate();
  return (
      <div className="nav__user">
        {user ? (
          <motion.button
            className="avatar"
            title={`${displayName} — выйти`}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (confirm('Выйти из аккаунта?')) signOut(auth).then(() => navigate('/'));
            }}
          >
            {(displayName || '?')[0].toUpperCase()}
          </motion.button>
        ) : (
          user === null && (
            <Link to="/login" className="btn btn--pink btn--sm">
              Войти
            </Link>
          )
        )}
      </div>
  );
}
