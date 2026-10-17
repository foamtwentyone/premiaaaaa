import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';

// Вместо пустого экрана показываем текст ошибки — так проще понять, что не так с настройкой
function ErrorScreen({ error }) {
  return (
    <div className="shell">
      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="page-title" style={{ fontSize: 30 }}>Что-то пошло не так</h1>
        <p className="muted">Сайт не смог запуститься. Текст ошибки:</p>
        <pre className="error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(error?.message || error)}</pre>
        <p className="tiny">Частые причины: опечатка в .env.local, не создана база Firestore, не включена Authentication.</p>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));

// App импортируется динамически: ошибка при инициализации Firebase тоже попадёт на экран
import('./App.jsx')
  .then(({ default: App }) =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    ),
  )
  .catch((error) => root.render(<ErrorScreen error={error} />));
