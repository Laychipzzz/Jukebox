/*
# Jukebox App - Create profiles table

1. New Tables
- `profiles`: extends auth.users with display name and avatar
  - `id` uuid PK FK to auth.users
  - `username` text unique (display name)
  - `avatar_color` text (hex color for default avatar gradient)
  - `avatar_url` text nullable (uploaded profile picture path in storage)
  - `created_at` timestamptz

2. Security
- RLS enabled
- All authenticated users can read profiles (needed for member lists, chat author info)
- Users can update only their own profile
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#3b82f6',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);