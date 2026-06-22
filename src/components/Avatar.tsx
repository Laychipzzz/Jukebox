import { initials } from '../lib/format';

type AvatarProps = {
  username: string;
  avatarUrl?: string | null;
  color?: string;
  size?: number;
  ring?: boolean;
};

export function Avatar({ username, avatarUrl, color = '#3b82f6', size = 40, ring = false }: AvatarProps) {
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${ring ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900' : ''}`}
      style={{
        width: size,
        height: size,
        background: avatarUrl ? undefined : `linear-gradient(135deg, ${color}, ${shade(color, -25)})`,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-white" style={{ fontSize }}>
          {initials(username)}
        </div>
      )}
    </div>
  );
}

// darken/lighten a hex color by a percent (-100..100)
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
