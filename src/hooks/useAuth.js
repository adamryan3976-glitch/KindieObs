import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

export function useAuth() {
  // undefined = still checking; null = signed out; object = signed in
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // Popup blockers or a cancelled sign-in land here.
      setError(e.message || 'Sign-in failed. Please try again.');
    }
  };

  const logOut = () => signOut(auth);

  return { user, loading: user === undefined, error, signIn, logOut };
}
