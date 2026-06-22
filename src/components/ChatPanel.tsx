import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { formatRelativeTime } from '../lib/format';
import type { Message, Profile } from '../lib/types';

export function ChatPanel({ roomId }: { roomId: string }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profile:profiles!messages_user_id_fkey(*)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (active) {
        setMessages((data ?? []) as unknown as Message[]);
        setLoading(false);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);
      }
    })();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Fetch profile for the new message if not present
          const msg = payload.new as Message;
          if (msg.user_id && !msg.profile) {
            supabase
              .from('profiles')
              .select('*')
              .eq('id', msg.user_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msg.id ? { ...m, profile: data as Profile } : m))
                  );
                }
              });
          }
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 50);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !profile) return;
    setSending(true);
    setText('');
    await supabase.from('messages').insert({
      room_id: roomId,
      user_id: profile.id,
      content,
    });
    setSending(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-semibold">Chat</span>
        <span className="ml-auto text-xs text-slate-500">{messages.length}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No messages yet.<br />Say hi to the room.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isMe = m.user_id === profile?.id;
              const p = m.profile;
              return (
                <div key={m.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="pt-0.5">
                    <Avatar
                      username={p?.username ?? 'Unknown'}
                      avatarUrl={p?.avatar_url}
                      color={p?.avatar_color}
                      size={30}
                    />
                  </div>
                  <div className={`max-w-[78%] ${isMe ? 'items-end text-right' : ''}`}>
                    <div className={`flex items-baseline gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium text-slate-300">
                        {isMe ? 'You' : p?.username ?? 'Unknown'}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatRelativeTime(m.created_at)}</span>
                    </div>
                    <div
                      className={`mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-sm ${
                        isMe
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white/5 text-slate-200'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
