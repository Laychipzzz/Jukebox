/*
# Jukebox App - Add current_track FK, profile trigger, updated_at function

1. Schema changes
- Add FK from rooms.current_track_id to tracks(id) ON DELETE SET NULL
- Note: can't add FK directly due to circular dependency, so we leave it without FK and manage in app
- A unique constraint is not required; current_track_id is just a reference

2. Functions/Triggers
- `handle_new_user()`: trigger function that creates a profile row when a new auth.users row is inserted
- Trigger `on_auth_user_created` fires AFTER INSERT on auth.users

3. updated_at helper
- `update_listen_last_seen()`: helper RPC to heartbeat listen participation liveness (optional, we use direct update instead)
*/

-- Helper to safely add the FK on current_track_id (guarded by a check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rooms_current_track_id_fkey'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_current_track_id_fkey
      FOREIGN KEY (current_track_id) REFERENCES tracks(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();