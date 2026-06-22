import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Music,
  Users,
  MessageSquare,
  Headphones,
  ListMusic,
  MoreVertical,
  LogOut,
  Trash2,
  X,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from '../components/Avatar';
import { ChatPanel } from '../components/ChatPanel';
import { PlaylistPanel } from '../components/PlaylistPanel';
import { ListenTogetherPanel } from '../components/ListenTogetherPanel';
import { useRoomPlayback } from '../lib/useRoomPlayback';
import type { Room, Track, Profile } from '../lib/types';

type Tab = 'playlist' | 'chat' | 'listen';

export function RoomScreen({ roomId, onBack }: { roomId: string; onBack: () => void }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('playlist');
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = room?.owner_id === profile?.id;

  // Load room + members
  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      const { data: r } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
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

    // Realtime: room updates (playback, listen_together toggle)
    const roomChannel = supabase
      .channel(`room_state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => onBack()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, onBack]);

  // Load current track and watch for changes
  useEffect(() => {
    if (!room) return;
    const load = async () => {
      if (!room.current_track_id) {
        setCurrentTrack(null);
        return;
      }
      const { data } = await supabase
        .from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('id', room.current_track_id)
        .maybeSingle();
      setCurrentTrack(data as unknown as Track | null);
    };
    load();

    const channel = supabase
      .channel(`room_track:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tracks', filter: `room_id=eq.${roomId}` },
        load
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [room?.id, room?.current_track_id]);

  // Load next track for skip
  const loadNextTrack = useCallback(async (): Promise<Track | null> => {
    if (!room) return null;
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(50);
    const all = (data ?? []) as Track[];
    if (all.length === 0) return null;
    const idx = all.findIndex((t) => t.id === room.current_track_id);
    if (idx === -1) return all[0];
    if (idx + 1 < all.length) return all[idx + 1];
    return null; // end of queue
  }, [room]);

  const onSkip = useCallback(async () => {
    if (!room || !isOwner) return;
    const next = await loadNextTrack();
    await supabase
      .from('rooms')
      .update({
        current_track_id: next?.id ?? null,
        playing: !!next,
        position_seconds: 0,
        position_updated_at: new Date().toISOString(),
      })
      .eq('id', room.id);
  }, [room, isOwner, loadNextTrack]);

  const {
    audioRef,
    localPosition,
    duration,
    togglePlay,
    seek,
    handleEnded,
  } = useRoomPlayback(room, currentTrack, isOwner, onSkip);

  // Auto-play first track if room has none and owner
  useEffect(() => {
    if (!room || !isOwner || room.current_track_id || loading) return;
    (async () => {
      const next = await loadNextTrack();
      if (next && room && !room.current_track_id) {
        await supabase
          .from('rooms')
          .update({ current_track_id: next.id, playing: true, position_seconds: 0, position_updated_at: new Date().toISOString() })
          .eq('id', room.id);
      }
    })();
  }, [room, isOwner, loading, loadNextTrack]);

  const toggleListenTogether = useCallback(async () => {
    if (!room || !isOwner) return;
    await supabase
      .from('rooms')
      .update({
        listen_together: !room.listen_together,
        position_seconds: audioRef.current?.currentTime ?? room.position_seconds,
        position_updated_at: new Date().toISOString(),
      })
      .eq('id', room.id);
    // If turning off, open playlist tab; if on, show listen tab
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
    await supabase
      .from('room_members')
      .delete()
      .eq('room_id', room.id)
      .eq('user_id', profile.id);
    onBack();
  }, [profile, room, onBack]);

  const deleteRoom = useCallback(async () => {
    if (!room || !isOwner) return;
    // Deleting the room cascades to all child tables (members, tracks, messages, listen_participants)
    await supabase.from('rooms').delete().eq('id', room.id);
    onBack();
  }, [room, isOwner, onBack]);

  const tabs = useMemo(() => {
    const base: { id: Tab; label: string; icon: typeof ListMusic }[] = [
      { id: 'playlist', label: 'Playlist', icon: ListMusic },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'listen', label: 'Listen', icon: Headphones },
    ];
    return base;
  }, []);

  if (loading || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} onEnded={handleEnded} preload="auto" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 text-emerald-400">
            <Music className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{room.name}</h1>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-emerald-400"
            >
              <span className="font-mono tracking-wider">#{room.code}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{members.length}</span>
          </button>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-4 top-14 z-50 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
                <button
                  onClick={() => { setShowMenu(false); setShowLeave(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4 text-slate-400" />
                  {isOwner ? 'Delete room' : 'Leave room'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-2 sm:px-6">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${
                  tab === t.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-4 py-3 sm:px-6">
        <div className="h-[calc(100vh-8rem)] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {/* Desktop: show playlist + chat side-by-side when on those tabs */}
          <div className="hidden h-full md:grid md:grid-cols-[1fr_360px]">
            <div className="border-r border-white/10">
              <PlaylistPanel
                room={room}
                currentTrack={currentTrack}
                isOwner={isOwner}
                onPlayPause={togglePlay}
                onSkip={onSkip}
                playing={room.playing}
                localPosition={localPosition}
                duration={duration}
                onSeek={seek}
              />
            </div>
            {tab === 'listen' ? (
              <ListenTogetherPanel
                roomId={room.id}
                ownerId={room.owner_id}
                onToggle={toggleListenTogether}
                active={room.listen_together}
              />
            ) : (
              <ChatPanel roomId={room.id} />
            )}
          </div>

          {/* Mobile: single panel based on tab */}
          <div className="h-full md:hidden">
            {tab === 'playlist' && (
              <PlaylistPanel
                room={room}
                currentTrack={currentTrack}
                isOwner={isOwner}
                onPlayPause={togglePlay}
                onSkip={onSkip}
                playing={room.playing}
                localPosition={localPosition}
                duration={duration}
                onSeek={seek}
              />
            )}
            {tab === 'chat' && <ChatPanel roomId={room.id} />}
            {tab === 'listen' && (
              <ListenTogetherPanel
                roomId={room.id}
                ownerId={room.owner_id}
                onToggle={toggleListenTogether}
                active={room.listen_together}
              />
            )}
          </div>
        </div>
      </main>

      {/* Members modal */}
      {showMembers && (
        <MembersModal members={members} ownerId={room.owner_id} onClose={() => setShowMembers(false)} />
      )}

      {/* Leave/delete confirm */}
      {showLeave && (
        <ConfirmModal
          title={isOwner ? 'Delete this room?' : 'Leave this room?'}
          message={
            isOwner
              ? 'Deleting the room will remove it for everyone — the playlist, chat, and all members. This cannot be undone.'
              : 'You will leave this room and stop hearing the music. You can rejoin later with the room code.'
          }
          confirmLabel={isOwner ? 'Delete room' : 'Leave room'}
          danger
          onClose={() => setShowLeave(false)}
          onConfirm={isOwner ? deleteRoom : leaveRoom}
        />
      )}
    </div>
  );
}

function MembersModal({ members, ownerId, onClose }: { members: Profile[]; ownerId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-emerald-400" /> Members
          </h2>
          <button onClick={onClose} className="text-slate-400 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2.5">
              <Avatar username={m.username} avatarUrl={m.avatar_url} color={m.avatar_color} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.username}</p>
              </div>
              {m.id === ownerId && (
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Owner
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-2 flex items-center gap-2">
          {danger && <Trash2 className="h-5 w-5 text-red-400" />}
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <p className="mb-5 text-sm text-slate-400">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium transition hover:bg-white/10">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
              danger ? 'bg-red-500 hover:bg-red-400' : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
