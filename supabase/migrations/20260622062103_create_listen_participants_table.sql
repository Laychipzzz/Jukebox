/*
# Jukebox App - Create listen_participants table

Tracks who is currently in a room's Listen Together (synced playback) session.

1. New Tables
- `listen_participants`: active participants in Listen Together
  - `id` uuid PK
  - `room_id` uuid FK rooms CASCADE
  - `user_id` uuid FK profiles CASCADE
  - `is_active` bool default true
  - `joined_at` timestamptz
  - `last_seen_at` timestamptz (heartbeat for liveness)

2. Indexes
- unique (room_id, user_id)

3. Security
- RLS enabled
- Members can read participants
- Users can insert/update/delete their own participation rows
*/

CREATE TABLE IF NOT EXISTS listen_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE listen_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select_in_room" ON listen_participants;
CREATE POLICY "participants_select_in_room"
ON listen_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = listen_participants.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants_insert_self" ON listen_participants;
CREATE POLICY "participants_insert_self"
ON listen_participants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_update_self" ON listen_participants;
CREATE POLICY "participants_update_self"
ON listen_participants FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_delete_self" ON listen_participants;
CREATE POLICY "participants_delete_self"
ON listen_participants FOR DELETE
TO authenticated
USING (auth.uid() = user_id);