/*
# Jukebox App - Create rooms table

1. New Tables
- `rooms`: a music room / group chat
  - `id` uuid PK
  - `name` text not null (room name)
  - `code` text unique not null (6-char short code to join)
  - `passcode` text nullable (optional passcode to enter)
  - `owner_id` uuid FK profiles (room owner)
  - `current_track_id` uuid nullable (currently playing track)
  - `playing` bool default false (whether playback is active)
  - `position_seconds` numeric default 0 (playback position)
  - `position_updated_at` timestamptz (when position was last set)
  - `listen_together` bool default false (Listen Together mode on/off)
  - `created_at` timestamptz

2. Indexes
- unique index on code

3. Security
- RLS enabled
- All authenticated can SELECT rooms (needed to find by code)
- Only owner can INSERT (creating a room), UPDATE (changing playback/track), DELETE
*/

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  passcode text,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  current_track_id uuid,
  playing boolean NOT NULL DEFAULT false,
  position_seconds numeric NOT NULL DEFAULT 0,
  position_updated_at timestamptz NOT NULL DEFAULT now(),
  listen_together boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_all" ON rooms;
CREATE POLICY "rooms_select_all"
ON rooms FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "rooms_insert_own" ON rooms;
CREATE POLICY "rooms_insert_own"
ON rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_update_own" ON rooms;
CREATE POLICY "rooms_update_own"
ON rooms FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_delete_own" ON rooms;
CREATE POLICY "rooms_delete_own"
ON rooms FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);