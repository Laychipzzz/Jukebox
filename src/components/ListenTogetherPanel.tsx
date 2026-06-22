import { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Loader2, PhoneOff, Mic } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { formatRelativeTime } from '../lib/format';
import type { ListenParticipant } from '../lib/types';

export function ListenTogetherPanel({
  roomId,
  ownerId,
  onToggle,
  active,
}: {
  roomId: string;
  ownerId: string;
  onToggle: () => void;
  active: boolean;
}) {
  const { profile, user } = useAuth();
  const [participants, setParticipants] = useState<ListenParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load participants
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      // Mark stale participants inactive (last_seen > 15s ago)
      const cutoff = new Date(Date.now() - 15000).toISOString();
      await supabase
        .from('listen_participants')
        .update({ is_active: false })
        .eq('room_id', roomId)
        .lt('last_seen_at', cutoff)
        .neq('is_active', false);

      const { data } = await supabase
        .from('listen_participants')
        .select('*, profile:profiles!listen_participants_user_id_fkey(*)')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });
      if (mounted) {
        setParticipants((data ?? []) as unknown as ListenParticipant[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`listen:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listen_participants', filter: `room_id=eq.${roomId}` },
        () => {
          // Refetch on any change
          supabase
            .from('listen_participants')
            .select('*, profile:profiles!listen_participants_user_id_fkey(*)')
            .eq('room_id', roomId)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .then(({ data }) => {
              if (mounted) setParticipants((data ?? []) as unknown as ListenParticipant[]);
            });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Heartbeat while listening together
  const heartbeat = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('listen_participants')
      .update({ last_seen_at: new Date().toISOString(), is_active: true })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
  }, [roomId, user]);

  useEffect(() => {
    if (active && user) {
      // Join / upsert participation
      (async () => {
        await supabase
          .from('listen_participants')
          .upsert(
            {
              room_id: roomId,
              user_id: user.id,
              is_active: true,
              last_seen_at: new Date().toISOString(),
              joined_at: new Date().toISOString(),
            },
            { onConflict: 'room_id,user_id' }
          );
        heartbeat();
      })();
      heartbeatRef.current = setInterval(heartbeat, 8000);
    } else if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      // Mark self inactive
      if (user) {
        supabase
          .from('listen_participants')
          .update({ is_active: false })
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .then();
      }
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [active, roomId, user, heartbeat]);

  // Cleanup on unmount: mark inactive
  useEffect(() => {
    return () => {
      if (user && active) {
        supabase
          .from('listen_participants')
          .update({ is_active: false })
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .then();
      }
    };
  }, [active, roomId, user]);

  const isOwner = profile?.id === ownerId;
  const meInCall = participants.some((p) => p.user_id === user?.id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Headphones className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold">Listen Together</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {active ? 'Live' : 'Off'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!active && (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
            <Headphones className="mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">Listen Together is off</p>
            <p className="mt-1 max-w-[220px] text-xs text-slate-500">
              {isOwner
                ? 'Turn it on and everyone in the room can sync up and hear the same track at the same time.'
                : 'Only the room owner can start a Listen Together session.'}
            </p>
          </div>
        )}

        {active && loading && (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {active && !loading && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                In the session
              </span>
              <span className="text-xs text-slate-500">{participants.length} listening</span>
            </div>
            {participants.length === 0 ? (
              <p className="text-center text-sm text-slate-500">Nobody&apos;s here yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {participants.map((p) => {
                  const prof = p.profile;
                  const isMe = p.user_id === user?.id;
                  const isOwnerPart = p.user_id === ownerId;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center"
                    >
                      <div className="relative">
                        <Avatar
                          username={prof?.username ?? '?'}
                          avatarUrl={prof?.avatar_url}
                          color={prof?.avatar_color}
                          size={48}
                          ring
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900">
                          <Mic className="h-2.5 w-2.5 text-slate-950" />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {isMe ? 'You' : prof?.username ?? 'Unknown'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {isOwnerPart ? 'Owner' : `Joined ${formatRelativeTime(p.joined_at)}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!meInCall && (
              <p className="mt-3 text-center text-xs text-amber-400/80">
                You haven&apos;t joined the session yet — toggling will add you.
              </p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        {isOwner ? (
          <button
            onClick={onToggle}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              active
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-950 hover:brightness-110'
            }`}
          >
            {active ? (
              <><PhoneOff className="h-4 w-4" /> End Listen Together</>
            ) : (
              <><Headphones className="h-4 w-4" /> Start Listen Together</>
            )}
          </button>
        ) : (
          <p className="text-center text-xs text-slate-500">
            {active ? 'Listening along with the room.' : 'Waiting for the owner to start the session.'}
          </p>
        )}
      </div>
    </div>
  );
}
