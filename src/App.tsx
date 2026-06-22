import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RoomScreen } from './screens/RoomScreen';
import { Loader2 } from 'lucide-react';

function AppInner() {
  const { session, loading } = useAuth();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  // Clear active room when user changes/logs out
  useEffect(() => {
    if (!session) setActiveRoom(null);
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (activeRoom) {
    return <RoomScreen roomId={activeRoom} onBack={() => setActiveRoom(null)} />;
  }

  return <HomeScreen onOpenRoom={(id) => setActiveRoom(id)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
