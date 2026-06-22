/*
# Jukebox App - Create tracks table

1. New Tables
- `tracks`: songs in a room's shared playlist
  - `id` uuid PK
  - `room_id` uuid FK rooms CASCADE
  - `user_id` uuid FK profiles CASCADE (who added it)
  - `title` text not null
  - `artist` text not null
  - `album` text nullable
  - `duration_seconds` int default 0
  - `storage_path` text not null (path to audio file in Supabase Storage)
  - `cover_color` text default (hex color for default cover art)
  - `play_order` int default 0
  - `created_at` timestamptz

2. Indexes
- (created_at, id) for playlist ordering

3. Security
- RLS enabled
- Members of a room can read tracks
- Members can insert tracks (any member can add to playlist)
- The adder or the room owner can delete tracks
*/

CREATE TABLE IF NOT EXISTS tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  duration_seconds int NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  cover_color text NOT NULL DEFAULT '#3b82f6',
  play_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracks_room_created ON tracks(room_id, created_at);

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracks_select_in_room" ON tracks;
CREATE POLICY "tracks_select_in_room"
ON tracks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = tracks.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tracks_insert_in_room" ON tracks;
CREATE POLICY "tracks_insert_in_room"
ON tracks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = tracks.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tracks_delete_own_or_owner" ON tracks;
CREATE POLICY "tracks_delete_own_or_owner"
ON tracks FOR DELETE
TO authenticated
USING (
  tracks.user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = tracks.room_id AND r.owner_id = auth.uid()
  )
);