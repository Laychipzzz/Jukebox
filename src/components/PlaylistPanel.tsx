import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Play,
  Pause,
  SkipForward,
  Trash2,
  Music2,
  Loader2,
  X,
  Plus,
  ListMusic,
} from 'lucide-react';
import { supabase, TRACKS_BUCKET, randomColor } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { formatRelativeTime, formatTime } from '../lib/format';
import type { Track, Room, Profile } from '../lib/types';

export function PlaylistPanel({
  room,
  currentTrack,
  isOwner,
  onPlayPause,
  onSkip,
  playing,
  localPosition,
  duration,
  onSeek,
}: {
  room: Room;
  currentTrack: Track | null;
  isOwner: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  playing: boolean;
  localPosition: number;
  duration: number;
  onSeek: (s: number) => void;
}) {
  const { profile } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTracks = useCallback(async () => {
    const { data } = await supabase
      .from('tracks')
      .select('*, profile:profiles!tracks_user_id_fkey(*)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    setTracks((data ?? []) as unknown as Track[]);
    setLoading(false);
  }, [room.id]);

  useEffect(() => {
    setLoading(true);
    loadTracks();

    const channel = supabase
      .channel(`tracks:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tracks', filter: `room_id=eq.${room.id}` },
        () => loadTracks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, loadTracks]);

  const deleteTrack = async (track: Track) => {
    // Delete file from storage
    await supabase.storage.from(TRACKS_BUCKET).remove([track.storage_path]);
    await supabase.from('tracks').delete().eq('id', track.id);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Now playing bar */}
      <div className="border-b border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4">
        {currentTrack ? (
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={{ background: `linear-gradient(135deg, ${currentTrack.cover_color}, ${shade(currentTrack.cover_color, -35)})` }}
            >
              <Music2 className="h-5 w-5 text-white/80" />
              {playing && (
                <div className="absolute bottom-1 left-1 flex items-end gap-0.5">
                  <span className="h-2 w-0.5 animate-eq bg-white" style={{ animationDelay: '0ms' }} />
                  <span className="h-3 w-0.5 animate-eq bg-white" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-0.5 animate-eq bg-white" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{currentTrack.title}</p>
              <p className="truncate text-xs text-slate-400">by {currentTrack.artist}</p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onPlayPause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 transition hover:bg-emerald-400"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                </button>
                <button
                  onClick={onSkip}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  title="Skip"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500">
            <Music2 className="h-6 w-6" />
            <span className="text-sm">Nothing playing. Add a track below.</span>
          </div>
        )}

        {/* Progress / seek */}
        {(currentTrack || duration > 0) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="w-10 text-right text-[10px] tabular-nums text-slate-400">{formatTime(localPosition)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              value={localPosition}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              disabled={!isOwner}
              className="seek-bar"
              style={{ ['--pct' as string]: `${(localPosition / Math.max(duration, 1)) * 100}%` }}
            />
            <span className="w-10 text-[10px] tabular-nums text-slate-400">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Track list */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <ListMusic className="h-3.5 w-3.5" />
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add track
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <Music2 className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No tracks yet.</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
            >
              <Upload className="h-3.5 w-3.5" /> Upload one
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((t, i) => {
              const isCurrent = currentTrack?.id === t.id;
              const canDelete = isOwner || t.user_id === profile?.id;
              const p = t.profile as unknown as Profile | null;
              return (
                <div
                  key={t.id}
                  className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition ${
                    isCurrent ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="w-5 text-center text-xs text-slate-500">{i + 1}</div>
                  <div
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
                    style={{ background: `linear-gradient(135deg, ${t.cover_color}, ${shade(t.cover_color, -35)})` }}
                  >
                    <Music2 className="h-4 w-4 text-white/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${isCurrent ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {t.title}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {t.artist}
                      {t.album ? ` · ${t.album}` : ''}
                    </p>
                  </div>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    {p && (
                      <div className="flex flex-shrink-0 items-center gap-1.5 text-slate-500" title={`Added by ${p.username}`}>
                        <Avatar username={p.username} avatarUrl={p.avatar_url} color={p.avatar_color} size={18} />
                        <span className="text-[10px]">{formatRelativeTime(t.created_at)}</span>
                      </div>
                    )}
                    <span className="text-[10px] tabular-nums text-slate-500">{formatTime(t.duration_seconds)}</span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => deleteTrack(t)}
                      className="flex-shrink-0 text-slate-600 transition hover:text-red-400"
                      title="Remove track"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          roomId={room.id}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); loadTracks(); }}
          triggerFileInput={() => fileRef.current?.click()}
        />
      )}
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={() => {}} />
    </div>
  );
}

function UploadModal({
  roomId,
  onClose,
  onUploaded,
}: {
  roomId: string;
  onClose: () => void;
  onUploaded: () => void;
  triggerFileInput: () => void;
}) {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    setFile(f);
    setError(null);
    // Auto-fill title from filename
    const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    if (!title) setTitle(base);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!file) { setError('Choose an audio file.'); return; }
    if (!title.trim()) { setError('Enter a track title.'); return; }
    if (!artist.trim()) { setError('Enter the artist name.'); return; }
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const path = `${roomId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from(TRACKS_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) throw upErr;

      // Get duration from the file
      const dur = await getAudioDuration(file);

      const { error: trackErr } = await supabase.from('tracks').insert({
        room_id: roomId,
        user_id: profile.id,
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || null,
        duration_seconds: Math.round(dur),
        storage_path: path,
        cover_color: randomColor(),
      });
      if (trackErr) throw trackErr;
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a track</h2>
          <button onClick={onClose} className="text-slate-400 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* File picker */}
          <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
            {file ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Music2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1.5 py-2">
                <Upload className="h-7 w-7 text-slate-500" />
                <span className="text-sm text-slate-400">Tap to choose an audio file</span>
                <span className="text-xs text-slate-600">MP3, WAV, OGG, M4A…</span>
                <input type="file" accept="audio/*" onChange={onPick} className="hidden" />
              </label>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song name"
              className="auth-input"
              maxLength={120}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Artist</span>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name"
              className="auth-input"
              maxLength={120}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Album (optional)</span>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Album name"
              className="auth-input"
              maxLength={120}
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              <span>{error}</span>
            </div>
          )}

          {progress > 0 && progress < 100 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-medium transition hover:bg-white/10">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Upload</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

function shade(hex: string, percent: number): string {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
