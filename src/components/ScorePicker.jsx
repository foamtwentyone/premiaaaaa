import { motion, AnimatePresence } from 'framer-motion';
import { spring } from './ui.jsx';

// 1 — холодный синий … 10 — горячий розовый
const HUES = ['#22c1ff', '#2fb2ff', '#4a9dff', '#6688ff', '#8a4dff', '#a446f0', '#c040dc', '#dc3cc4', '#f03cb0', '#ff3ea5'];
const WORDS = ['', 'Мимо', 'Слабо', 'Так себе', 'Ну такое', 'Норм', 'Неплохо', 'Хорошо', 'Круто', 'Огонь', 'Шедевр'];

export default function ScorePicker({ value, onChange, disabled }) {
  return (
    <div className="scores">
      <div className="scores__head">
        <span className="label">
          Ваша оценка{value ? <> · <span style={{ color: HUES[value - 1] }}>{WORDS[value]}</span></> : ''}
        </span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value ?? 0}
            className="scores__value"
            style={{ color: value ? HUES[value - 1] : 'var(--ink-3)' }}
            initial={{ y: -16, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.6 }}
            transition={spring}
          >
            {value ?? '–'}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="scores__grid" role="radiogroup" aria-label="Оценка от 1 до 10">
        {HUES.map((hue, i) => {
          const n = i + 1;
          const on = value === n;
          return (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              className={`score ${on ? 'is-on' : value && n < value ? 'is-fill' : ''}`}
              style={{ '--hue': hue }}
              disabled={disabled}
              onClick={() => onChange(n)}
              whileHover={disabled ? undefined : { y: -4, scale: 1.08 }}
              whileTap={disabled ? undefined : { scale: 0.85, y: 2 }}
              animate={on ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
              transition={spring}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
