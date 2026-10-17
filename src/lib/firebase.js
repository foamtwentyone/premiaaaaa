import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const env = import.meta.env;
const useEmulators = env.VITE_USE_EMULATORS === 'true';

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-key' : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-premia' : undefined),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (useEmulators ? 'demo-premia.appspot.com' : undefined),
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(config.apiKey && config.projectId);

export const app = isConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app && config.storageBucket ? getStorage(app) : null;

if (auth) auth.languageCode = 'ru';

// Локальная разработка без реального проекта: npm run emulators + VITE_USE_EMULATORS=true
if (app && useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  if (storage) connectStorageEmulator(storage, '127.0.0.1', 9199);
}
