/*
# Jukebox App - Create room_members table

Persists membership so users return to rooms they joined.

1. New Tables
- `room_members`: members of each room
  - `id` uuid PK
  - `room_id` uuid FK rooms CASCADE
  - `user_id` uuid FK profiles CASCADE
  - `role` text default 'member' ('owner' or 'member')
  - `joined_at` timestamptz

2. Indexes
- unique (room_id, user_id)

3. Security
- RLS enabled
- Members of a room can read membership (anyone in the room)
- A user can insert themselves (join), so we relax insert to allow a user to join any room
- A member can delete themselves (leave); owner can be deleted via the rooms delete cascade
*/

CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_in_room" ON room_members;
CREATE POLICY "members_select_in_room"
ON room_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "members_insert_self" ON room_members;
CREATE POLICY "members_insert_self"
ON room_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_delete_self" ON room_members;
CREATE POLICY "members_delete_self"
ON room_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_update_self" ON room_members;
CREATE POLICY "members_update_self"
ON room_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);