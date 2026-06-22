/*
# Jukebox App - Create messages table

1. New Tables
- `messages`: chat messages in a room
  - `id` uuid PK
  - `room_id` uuid FK rooms CASCADE
  - `user_id` uuid FK profiles CASCADE
  - `content` text not null
  - `created_at` timestamptz

2. Indexes
- (room_id, created_at) for chat ordering

3. Security
- RLS enabled
- Members can read messages; members can insert messages
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_in_room" ON messages;
CREATE POLICY "messages_select_in_room"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = messages.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "messages_insert_in_room" ON messages;
CREATE POLICY "messages_insert_in_room"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = messages.room_id AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own"
ON messages FOR DELETE
TO authenticated
USING (messages.user_id = auth.uid());