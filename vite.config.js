import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i;
const TRACKS_DIR = resolve(__dirname, 'public/tracks');

const listTracks = () => {
  try {
    return readdirSync(TRACKS_DIR).filter((f) => AUDIO.test(f)).sort((a, b) => a.localeCompare(b, 'ru'));
  } catch {
    return [];
  }
};

/** Список файлов из public/tracks → /tracks/index.json (и в dev, и в сборке) — для импорта в админке */
function tracksIndex() {
  return {
    name: 'tracks-index',
    configureServer(server) {
      server.middlewares.use('/tracks/index.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(listTracks()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'tracks/index.json', source: JSON.stringify(listTracks()) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tracksIndex()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
        },
      },
    },
  },
});
