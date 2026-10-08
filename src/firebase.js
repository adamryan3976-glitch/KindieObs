import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// These values come from your Firebase project settings (see README.md).
// K-Doc shares a Firebase project with FDK Letters, so they're the same six
// values. They are safe to expose in client-side code -- real access control
// is enforced by firestore.rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length > 0) {
  console.error(
    'Missing Firebase config values: ' +
      missingKeys.join(', ') +
      '. Copy .env.example to .env and fill in your Firebase project settings (see README.md).'
  );
}

export const PHOTO_URL = import.meta.env.VITE_KDOC_PHOTO_URL || '';
if (!PHOTO_URL) console.warn('VITE_KDOC_PHOTO_URL is not set -- photos are disabled (see README.md).');

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Keeps a copy of class data on the device, so the app opens and observations
// can be written with spotty classroom Wi-Fi. Writes made offline sync
// automatically when the connection comes back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
