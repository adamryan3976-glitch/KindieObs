import { useAuth } from './hooks/useAuth.js';
import SignInScreen from './components/SignInScreen.jsx';
import { ClassroomApp } from './components/ClassroomApp.jsx';

export default function App() {
  const { user, loading, error, signIn, logOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen onSignIn={signIn} error={error} />;
  }

  return <ClassroomApp user={user} onSignOut={logOut} />;
}
