// Types mirroring the database schema
export type Profile = {
  id: string;
  username: string;
  avatar_color: string;
  avatar_url: string | null;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  code: string;
  passcode: string | null;
  owner_id: string;
  current_track_id: string | null;
  playing: boolean;
  position_seconds: number;
  position_updated_at: string;
  listen_together: boolean;
  created_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: Profile | null;
};

export type Track = {
  id: string;
  room_id: string;
  user_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration_seconds: number;
  storage_path: string;
  cover_color: string;
  play_order: number;
  created_at: string;
  profile?: Profile | null;
};

export type Message = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
};

export type ListenParticipant = {
  id: string;
  room_id: string;
  user_id: string;
  is_active: boolean;
  joined_at: string;
  last_seen_at: string;
  profile?: Profile | null;
};
