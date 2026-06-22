import { useState, useEffect, useCallback } from 'react';
import {
  Music,
  Plus,
  LogOut,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
  Hash,
  Lock,
  X,
} from 'lucide-react';
import { supabase, generateRoomCode, randomColor } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from '../components/Avatar';
import { formatRelativeTime } from '../lib/format';
import type { Room, RoomMember, Profile } from '../lib/types';

type JoinedRoom = {
  room: Room;
  member: RoomMember;
  memberCount: number;
};

export function HomeScreen({ onOpenRoom }: { onOpenRoom: (roomId: string) => void }) {
  const { profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('room_members')
      .select(`room_id, joined_at, role, room:rooms(*), profile:profiles!room_members_user_id_fkey(*)`)
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const result: JoinedRoom[] = [];
    for (const row of data ?? []) {
      const room = row.room as unknown as Room;
      if (!room) continue;
      const { count } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);
      result.push({
        room,
        member: {
          id: '',
          room_id: room.id,
          user_id: profile.id,
          role: row.role,
          joined_at: row.joined_at,
          profile: row.profile as unknown as Profile,
        },
        memberCount: count ?? 0,
      });
    }
    setRooms(result);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30">
              <Music className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold">Jukebox</span>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="flex items-center gap-2">
                <Avatar
                  username={profile.username}
                  avatarUrl={profile.avatar_url}
                  color={profile.avatar_color}
                  size={34}
                />
                <span className="hidden text-sm font-medium text-slate-300 sm:inline">
                  {profile.username}
                </span>
              </div>
            )}
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Hey, {profile?.username}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {rooms.length === 0
                ? 'Join or create a room to start listening.'
                : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} you're in.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <Hash className="h-4 w-4" />
              Join
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Create room
            </button>
          </div>
        </div>

        {/* Rooms grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} onJoin={() => setShowJoin(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map(({ room, member, memberCount }) => (
              <button
                key={room.id}
                onClick={() => onOpenRoom(room.id)}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40"
                  style={{ background: randomColor() }}
                />
                <div className="relative flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 text-emerald-400">
                    <Music className="h-6 w-6" />
                  </div>
                  {member.role === 'owner' && (
                    <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                      Owner
                    </span>
                  )}
                </div>
                <div className="relative">
                  <h3 className="truncate font-semibold">{room.name}</h3>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono">{room.code}</span>
                    <span className="text-slate-600">·</span>
                    <Users className="h-3 w-3" />
                    <span>{memberCount}</span>
                    <span className="text-slate-600">·</span>
                    <span>{formatRelativeTime(member.joined_at)}</span>
                  </div>
                </div>
                <div className="relative flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">
                    {room.playing ? 'Now playing' : 'Idle'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); onOpenRoom(id); }}
        />
      )}
      {showJoin && (
        <JoinRoomModal
          onClose={() => setShowJoin(false)}
          onJoined={(id) => { setShowJoin(false); onOpenRoom(id); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/10 to-cyan-500/10 text-emerald-400">
        <Music className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">No rooms yet</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        Create a room and invite friends with the code, or join an existing one.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={onJoin}
          className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
        >
          <Hash className="h-4 w-4" /> Join
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Create room
        </button>
      </div>
    </div>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState(generateRoomCode());
  const [usePasscode, setUsePasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!name.trim()) { setError('Please enter a room name.'); return; }
    setLoading(true);
    setError(null);
    try {
      // Create room
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({
          name: name.trim(),
          code,
          passcode: usePasscode && passcode ? passcode : null,
          owner_id: profile.id,
        })
        .select()
        .single();
      if (roomErr) throw roomErr;
      if (!room) throw new Error('Failed to create room.');

      // Add owner as member
      const { error: memErr } = await supabase
        .from('room_members')
        .insert({ room_id: room.id, user_id: profile.id, role: 'owner' });
      if (memErr) throw memErr;

      onCreated(room.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create room.';
      // Code collision? Regenerate.
      if (msg.toLowerCase().includes('code')) setCode(generateRoomCode());
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Create a room">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Room name</span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday Night Vibes"
            className="auth-input"
            maxLength={40}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Room code</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              className="auth-input flex-1 font-mono uppercase tracking-widest"
              maxLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setCode(generateRoomCode())}
              className="rounded-xl bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10"
            >
              Shuffle
            </button>
          </div>
        </label>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={usePasscode}
              onChange={(e) => setUsePasscode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="flex items-center gap-1.5 text-sm text-slate-300">
              <Lock className="h-3.5 w-3.5" /> Require a passcode to join
            </span>
          </label>
          {usePasscode && (
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="e.g. secret123"
              className="auth-input mt-3"
              maxLength={50}
              required
            />
          )}
        </div>

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-medium transition hover:bg-white/10">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function JoinRoomModal({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const { profile } = useAuth();
  const [code, setCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPasscode, setNeedsPasscode] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: room, error: findErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();
      if (findErr) throw findErr;
      if (!room) throw new Error('No room with that code.');
      if (room.passcode && room.passcode !== passcode) {
        setNeedsPasscode(true);
        throw new Error('Wrong passcode.');
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!existing) {
        const { error: memErr } = await supabase
          .from('room_members')
          .insert({ room_id: room.id, user_id: profile.id, role: 'member' });
        if (memErr) throw memErr;
      }
      onJoined(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room.');
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Join a room">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Room code</span>
          <input
            autoFocus
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            className="auth-input text-center font-mono text-lg uppercase tracking-[0.3em]"
            maxLength={6}
            required
          />
        </label>

        {needsPasscode && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Passcode</span>
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter the passcode"
              className="auth-input"
              autoFocus
              required
            />
          </label>
        )}

        {error && <ErrorBox msg={error} />}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join room <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
