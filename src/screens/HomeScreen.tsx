import { useState, useEffect, useCallback } from 'react';
import {
  Music,
  Plus,
  LogOut,
  Users,
  Loader2,
  AlertCircle,
  Hash,
  Lock,
  X,
  ArrowRight,
  ChevronDown,
  MessageSquare,
  Headphones,
  ListMusic,
  MoreVertical,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { supabase, generateRoomCode } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from '../components/Avatar';
import { ChatPanel } from '../components/ChatPanel';
import { PlaylistPanel } from '../components/PlaylistPanel';
import { ListenTogetherPanel } from '../components/ListenTogetherPanel';
import { useRoomPlayback } from '../lib/useRoomPlayback';
import type { Room, Track, Profile } from '../lib/types';

type Tab = 'playlist' | 'chat' | 'listen';

type JoinedRoom = {
  room: Room;
  role: string;
  memberCount: number;
};

export function HomeScreen() {
  const { profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('room_members')
      .select('room_id, joined_at, role, room:rooms(*)')
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: true });

    if (error) { console.error(error); setLoadingRooms(false); return; }

    const result: JoinedRoom[] = [];
    for (const row of data ?? []) {
      const room = row.room as unknown as Room;
      if (!room) continue;
      const { count } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);
      result.push({ room, role: row.role, memberCount: count ?? 0 });
    }
    setRooms(result);
    setLoadingRooms(false);
  }, [profile]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Realtime: watch membership changes (join / leave / room deleted)
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`home_members:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `user_id=eq.${profile.id}` },
        () => loadRooms())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setRooms((prev) => prev.filter((r) => r.room.id !== deletedId));
          setActiveRoomId((cur) => cur === deletedId ? null : cur);
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile, loadRooms]);

  const handleRoomJoined = useCallback((id: string) => {
    setShowCreate(false);
    setShowJoin(false);
    loadRooms().then(() => setActiveRoomId(id));
  }, [loadRooms]);

  const handleLeaveOrDelete = useCallback(() => {
    setActiveRoomId(null);
    loadRooms();
  }, [loadRooms]);

  const activeRoom = rooms.find((r) => r.room.id === activeRoomId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">
      {/* ── Sidebar ── */}
      <aside className="flex w-[72px] flex-col items-center gap-1.5 border-r border-white/10 bg-slate-950 py-3 sm:w-[232px] sm:items-stretch sm:px-2">
        {/* Logo */}
        <div className="mb-1 flex h-10 items-center gap-2.5 px-1 sm:px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30">
            <Music className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="hidden text-base font-bold sm:block">Jukebox</span>
        </div>

        <div className="mx-auto h-px w-8 bg-white/10 sm:w-full" />

        {/* Joined rooms */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-1">
          {loadingRooms ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            </div>
          ) : (
            rooms.map(({ room, role, memberCount }) => (
              <SidebarRoomButton
                key={room.id}
                room={room}
                role={role}
                memberCount={memberCount}
                active={room.id === activeRoomId}
                onClick={() => setActiveRoomId(room.id)}
              />
            ))
          )}
        </nav>

        {/* Add / Join */}
        <div className="flex flex-col gap-0.5">
          <SidebarAction icon={<Hash className="h-4 w-4" />} label="Join a room" onClick={() => setShowJoin(true)} />
          <SidebarAction icon={<Plus className="h-4 w-4" />} label="Create a room" onClick={() => setShowCreate(true)} accent />
        </div>

        <div className="mx-auto h-px w-8 bg-white/10 sm:w-full" />

        {/* User strip */}
        <div className="relative px-1 sm:px-0">
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl p-2 text-left transition hover:bg-white/5"
          >
            {profile && (
              <>
                <Avatar username={profile.username} avatarUrl={profile.avatar_url} color={profile.avatar_color} size={32} />
                <div className="hidden min-w-0 flex-1 sm:block">
                  <p className="truncate text-sm font-medium leading-none">{profile.username}</p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">Online</p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 sm:block" />
              </>
            )}
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
                <button
                  onClick={() => { setShowUserMenu(false); signOut(); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4 text-slate-400" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {activeRoom ? (
          <RoomView
            key={activeRoom.room.id}
            roomId={activeRoom.room.id}
            onLeaveOrDelete={handleLeaveOrDelete}
          />
        ) : (
          <Splash
            hasRooms={rooms.length > 0}
            onJoin={() => setShowJoin(true)}
            onCreate={() => setShowCreate(true)}
          />
        )}
      </main>

      {showCreate && (
        <CreateRoomModal profile={profile} onClose={() => setShowCreate(false)} onCreated={handleRoomJoined} />
      )}
      {showJoin && (
        <JoinRoomModal profile={profile} onClose={() => setShowJoin(false)} onJoined={handleRoomJoined} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Splash (shown when no room is selected)
// ─────────────────────────────────────────────
function Splash({ hasRooms, onJoin, onCreate }: { hasRooms: boolean; onJoin: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 text-emerald-400">
        <Music className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold">{hasRooms ? 'Pick a room' : 'Welcome to Jukebox'}</h2>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        {hasRooms
          ? 'Select a room from the sidebar to open the playlist and chat, or create / join another one.'
          : 'Create a room or join one with a short code to start listening with others.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onJoin} className="flex items-center gap-2 rounded-xl bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
          <Hash className="h-4 w-4" /> Join a room
        </button>
        <button onClick={onCreate} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Create a room
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RoomView — the full room UI inside the main panel
// ─────────────────────────────────────────────
function RoomView({ roomId, onLeaveOrDelete }: { roomId: string; onLeaveOrDelete: () => void }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('playlist');
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = room?.owner_id === profile?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRoom(null);

    (async () => {
      const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (!active) return;
      setRoom(r as Room | null);

      const { data: mems } = await supabase
        .from('room_members')
        .select('profile:profiles!room_members_user_id_fkey(*)')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      if (!active) return;
      setMembers(
        (mems ?? [])
          .map((m) => (m as unknown as { profile: Profile | null }).profile)
          .filter((p): p is Profile => p !== null)
      );
      setLoading(false);
    })();

    const ch = supabase
      .channel(`room_state:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => onLeaveOrDelete())
      .subscribe();

    return () => { active = false; void supabase.removeChannel(ch); };
  }, [roomId, onLeaveOrDelete]);

  // Current track
  useEffect(() => {
    if (!room?.id) return;
    const load = async () => {
      if (!room.current_track_id) { setCurrentTrack(null); return; }
      const { data } = await supabase
        .from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('id', room.current_track_id).maybeSingle();
      setCurrentTrack(data as unknown as Track | null);
    };
    load();
    const ch = supabase
      .channel(`room_track:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks', filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [room?.id, room?.current_track_id, roomId]);

  // Members realtime
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`room_members_rt:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        async () => {
          const { data: mems } = await supabase
            .from('room_members')
            .select('profile:profiles!room_members_user_id_fkey(*)')
            .eq('room_id', roomId)
            .order('joined_at', { ascending: true });
          setMembers(
            (mems ?? [])
              .map((m) => (m as unknown as { profile: Profile | null }).profile)
              .filter((p): p is Profile => p !== null)
          );
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [roomId]);

  const loadNextTrack = useCallback(async (): Promise<Track | null> => {
    if (!room) return null;
    const { data } = await supabase.from('tracks').select('*').eq('room_id', room.id).order('created_at', { ascending: true }).limit(50);
    const all = (data ?? []) as Track[];
    if (all.length === 0) return null;
    const idx = all.findIndex((t) => t.id === room.current_track_id);
    if (idx === -1) return all[0];
    return idx + 1 < all.length ? all[idx + 1] : null;
  }, [room]);

  const onSkip = useCallback(async () => {
    if (!room || !isOwner) return;
    const next = await loadNextTrack();
    await supabase.from('rooms').update({
      current_track_id: next?.id ?? null, playing: !!next, position_seconds: 0, position_updated_at: new Date().toISOString(),
    }).eq('id', room.id);
  }, [room, isOwner, loadNextTrack]);

  const { audioRef, localPosition, duration, togglePlay, seek, handleEnded } = useRoomPlayback(room, currentTrack, isOwner, onSkip);

  // Auto-queue first track for owner
  useEffect(() => {
    if (!room || !isOwner || room.current_track_id || loading) return;
    (async () => {
      const next = await loadNextTrack();
      if (next) await supabase.from('rooms').update({ current_track_id: next.id, playing: true, position_seconds: 0, position_updated_at: new Date().toISOString() }).eq('id', room.id);
    })();
  }, [room, isOwner, loading, loadNextTrack]);

  const toggleListenTogether = useCallback(async () => {
    if (!room || !isOwner) return;
    await supabase.from('rooms').update({
      listen_together: !room.listen_together,
      position_seconds: audioRef.current?.currentTime ?? room.position_seconds,
      position_updated_at: new Date().toISOString(),
    }).eq('id', room.id);
    setTab(!room.listen_together ? 'listen' : 'playlist');
  }, [room, isOwner, audioRef]);

  const copyCode = useCallback(() => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [room]);

  const leaveRoom = useCallback(async () => {
    if (!profile || !room) return;
    await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', profile.id);
    onLeaveOrDelete();
  }, [profile, room, onLeaveOrDelete]);

  const deleteRoom = useCallback(async () => {
    if (!room || !isOwner) return;
    await supabase.from('rooms').delete().eq('id', room.id);
    onLeaveOrDelete();
  }, [room, isOwner, onLeaveOrDelete]);

  if (loading || !room) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: typeof ListMusic }[] = [
    { id: 'playlist', label: 'Playlist', icon: ListMusic },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'listen', label: 'Listen Together', icon: Headphones },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <audio ref={audioRef} onEnded={handleEnded} preload="auto" />

      {/* Room header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 text-emerald-400">
          <Music className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-none">{room.name}</h1>
          <button onClick={copyCode} className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-emerald-400">
            <span className="font-mono tracking-wider">#{room.code}</span>
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <button onClick={() => setShowMembers(true)} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">
          <Users className="h-3.5 w-3.5" />
          <span>{members.length}</span>
        </button>
        <div className="relative">
          <button onClick={() => setShowMenu((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
                <button
                  onClick={() => { setShowMenu(false); setShowConfirm(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-white/5"
                >
                  {isOwner
                    ? <><Trash2 className="h-4 w-4 text-red-400" /><span className="text-red-400">Delete room</span></>
                    : <><LogOut className="h-4 w-4 text-slate-400" /><span className="text-slate-300">Leave room</span></>}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 sm:px-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            {tab === t.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-400" />}
          </button>
        ))}
      </div>

      {/* Content — playlist always left, chat/listen right on desktop */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: playlist + right panel side by side */}
        <div className="hidden flex-1 overflow-hidden md:flex">
          <div className="flex-1 overflow-hidden border-r border-white/10">
            <PlaylistPanel
              room={room} currentTrack={currentTrack} isOwner={isOwner}
              onPlayPause={togglePlay} onSkip={onSkip} playing={room.playing}
              localPosition={localPosition} duration={duration} onSeek={seek}
            />
          </div>
          <div className="w-[340px] shrink-0 overflow-hidden">
            {tab === 'listen'
              ? <ListenTogetherPanel roomId={room.id} ownerId={room.owner_id} onToggle={toggleListenTogether} active={room.listen_together} />
              : <ChatPanel roomId={room.id} />}
          </div>
        </div>

        {/* Mobile: single panel based on active tab */}
        <div className="flex flex-1 overflow-hidden md:hidden">
          {tab === 'playlist' && (
            <PlaylistPanel
              room={room} currentTrack={currentTrack} isOwner={isOwner}
              onPlayPause={togglePlay} onSkip={onSkip} playing={room.playing}
              localPosition={localPosition} duration={duration} onSeek={seek}
            />
          )}
          {tab === 'chat' && <div className="flex-1 overflow-hidden"><ChatPanel roomId={room.id} /></div>}
          {tab === 'listen' && (
            <div className="flex-1 overflow-hidden">
              <ListenTogetherPanel roomId={room.id} ownerId={room.owner_id} onToggle={toggleListenTogether} active={room.listen_together} />
            </div>
          )}
        </div>
      </div>

      {showMembers && (
        <MembersModal members={members} ownerId={room.owner_id} onClose={() => setShowMembers(false)} />
      )}
      {showConfirm && (
        <ConfirmModal
          title={isOwner ? 'Delete this room?' : 'Leave this room?'}
          message={isOwner
            ? 'This removes the room for everyone — playlist, chat, and all members. Cannot be undone.'
            : 'You will leave this room. You can rejoin any time with the room code.'}
          confirmLabel={isOwner ? 'Delete room' : 'Leave room'}
          danger
          onClose={() => setShowConfirm(false)}
          onConfirm={isOwner ? deleteRoom : leaveRoom}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar pieces
// ─────────────────────────────────────────────
function SidebarRoomButton({ room, role, memberCount, active, onClick }: { room: Room; role: string; memberCount: number; active: boolean; onClick: () => void }) {
  const initials = room.name.slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      title={room.name}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left transition sm:px-2 ${active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${active ? 'bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 text-emerald-300' : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200'}`}>
        {initials}
      </div>
      <div className="hidden min-w-0 flex-1 sm:block">
        <p className={`truncate text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>{room.name}</p>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Users className="h-2.5 w-2.5" /><span>{memberCount}</span>
          {role === 'owner' && <><span>·</span><span className="text-amber-500/70">Owner</span></>}
          {room.playing && <><span>·</span><span className="text-emerald-500/80">Playing</span></>}
        </div>
      </div>
      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400" />}
    </button>
  );
}

function SidebarAction({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} title={label} className={`flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left text-sm font-medium transition sm:px-2 ${accent ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-emerald-500/10' : 'bg-white/5'}`}>{icon}</div>
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────
function CreateRoomModal({ profile, onClose, onCreated }: { profile: Profile | null; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(generateRoomCode());
  const [usePasscode, setUsePasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!name.trim()) { setError('Enter a room name.'); return; }
    setLoading(true); setError(null);
    try {
      const { data: room, error: rErr } = await supabase.from('rooms').insert({
        name: name.trim(), code, passcode: usePasscode && passcode ? passcode : null, owner_id: profile.id,
      }).select().single();
      if (rErr) throw rErr;
      await supabase.from('room_members').insert({ room_id: room.id, user_id: profile.id, role: 'owner' });
      onCreated(room.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed.';
      if (msg.toLowerCase().includes('code')) setCode(generateRoomCode());
      setError(msg); setLoading(false);
    }
  };

  return (
    <ModalShell title="Create a room" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Room name">
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night Vibes" className="auth-input" maxLength={40} required />
        </Field>
        <Field label="Room code">
          <div className="flex gap-2">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} className="auth-input flex-1 font-mono uppercase tracking-widest" maxLength={6} required />
            <button type="button" onClick={() => setCode(generateRoomCode())} className="rounded-xl bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10">Shuffle</button>
          </div>
        </Field>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={usePasscode} onChange={(e) => setUsePasscode(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500" />
            <span className="flex items-center gap-1.5 text-sm text-slate-300"><Lock className="h-3.5 w-3.5" /> Require a passcode</span>
          </label>
          {usePasscode && <input type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode…" className="auth-input mt-3" maxLength={50} required />}
        </div>
        {error && <ErrorBox msg={error} />}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-medium transition hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function JoinRoomModal({ profile, onClose, onJoined }: { profile: Profile | null; onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPasscode, setNeedsPasscode] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const { data: room, error: fErr } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
      if (fErr) throw fErr;
      if (!room) throw new Error('No room with that code.');
      if (room.passcode) {
        if (!passcode) { setNeedsPasscode(true); setLoading(false); return; }
        if (room.passcode !== passcode) { setNeedsPasscode(true); throw new Error('Incorrect passcode.'); }
      }
      const { data: existing } = await supabase.from('room_members').select('id').eq('room_id', room.id).eq('user_id', profile.id).maybeSingle();
      if (!existing) await supabase.from('room_members').insert({ room_id: room.id, user_id: profile.id, role: 'member' });
      onJoined(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.'); setLoading(false);
    }
  };

  return (
    <ModalShell title="Join a room" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Room code">
          <input autoFocus type="text" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setNeedsPasscode(false); setError(null); }} placeholder="ABC123" className="auth-input text-center font-mono text-xl uppercase tracking-[0.4em]" maxLength={6} required />
        </Field>
        {needsPasscode && (
          <Field label="Passcode">
            <input type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter the passcode" className="auth-input" autoFocus />
          </Field>
        )}
        {error && <ErrorBox msg={error} />}
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join room <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </ModalShell>
  );
}

function MembersModal({ members, ownerId, onClose }: { members: Profile[]; ownerId: string; onClose: () => void }) {
  return (
    <ModalShell title="Members" onClose={onClose}>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2.5">
            <Avatar username={m.username} avatarUrl={m.avatar_url} color={m.avatar_color} size={36} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.username}</p>
            {m.id === ownerId && <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">Owner</span>}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell title={title} onClose={onClose}>
      <p className="mb-5 text-sm text-slate-400">{message}</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium transition hover:bg-white/10">Cancel</button>
        <button onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} disabled={busy}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${danger ? 'bg-red-500 hover:bg-red-400' : 'bg-emerald-500 hover:bg-emerald-400'}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
        </button>
      </div>
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
          <button onClick={onClose} className="text-slate-400 transition hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{msg}</span>
    </div>
  );
}
