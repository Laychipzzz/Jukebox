import { useState, useRef, useCallback } from 'react';
import { Music, Upload, ArrowRight, Loader2, AlertCircle, X } from 'lucide-react';
import { supabase, publicUrl, AVATARS_BUCKET, randomColor, AVATAR_COLORS } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Avatar } from '../components/Avatar';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarColor, setAvatarColor] = useState(randomColor());
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
    setError(null);
  }, []);

  const clearAvatar = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!username.trim()) throw new Error('Please enter a username.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.user) throw new Error('Sign up failed. Please try again.');

        // Upload avatar if chosen
        let avatarUrl: string | null = null;
        if (avatarFile) {
          const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'png';
          const path = `${data.user.id}/avatar.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(AVATARS_BUCKET)
            .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
          if (upErr) throw upErr;
          avatarUrl = publicUrl(AVATARS_BUCKET, path);
        }

        // Set username + avatar on profile (trigger created a row, update it)
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ username: username.trim(), avatar_color: avatarColor, avatar_url: avatarUrl })
          .eq('id', data.user.id);
        if (profErr) throw profErr;

        await refreshProfile();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      // Friendlier messages for common auth errors
      if (msg.toLowerCase().includes('already registered')) {
        setError('This email is already registered. Try logging in instead.');
      } else if (msg.toLowerCase().includes('invalid login')) {
        setError('Wrong email or password.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30">
            <Music className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Jukebox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Make rooms, share tracks, listen together.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
          {/* Tabs */}
          <div className="mb-6 flex rounded-xl bg-slate-800/50 p-1">
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                {/* Avatar picker */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <Avatar
                      username={username || '?'}
                      avatarUrl={avatarPreview}
                      color={avatarColor}
                      size={88}
                      ring
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-slate-950 transition hover:bg-emerald-400"
                      aria-label="Upload profile picture"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={clearAvatar}
                        className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-300 ring-2 ring-slate-950 transition hover:bg-red-500 hover:text-white"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={onPickFile}
                      className="hidden"
                    />
                  </div>
                  {!avatarPreview && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAvatarColor(c)}
                          className={`h-5 w-5 rounded-full transition ${
                            avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : 'opacity-60 hover:opacity-100'
                          }`}
                          style={{ background: c }}
                          aria-label={`Pick color ${c}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Field label="Username">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="DJ_Spin"
                    className="auth-input"
                    autoComplete="username"
                    required
                  />
                </Field>
              </>
            )}

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === 'register' ? 'Create account' : 'Log in'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            {mode === 'register' ? (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(null); }} className="font-medium text-emerald-400 hover:underline">
                  Log in
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button onClick={() => { setMode('register'); setError(null); }} className="font-medium text-emerald-400 hover:underline">
                  Create an account
                </button>
              </>
            )}
          </p>
        </div>
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
