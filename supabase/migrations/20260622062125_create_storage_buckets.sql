/*
# Jukebox App - Storage buckets: avatars and tracks

1. Storage buckets
- `avatars`: public read, for profile pictures
- `tracks`: public read, for uploaded audio files

Note: Storage buckets in Supabase are created in the storage schema. We insert directly into storage.buckets.
RLS on storage.objects is set with policies allowing authenticated users to manage their own folder.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tracks', 'tracks', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated to read avatar objects (public bucket, so this is belt-and-suspenders)
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid())
WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- Tracks: public read, members can upload
DROP POLICY IF EXISTS "tracks_read_public" ON storage.objects;
CREATE POLICY "tracks_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'tracks');

DROP POLICY IF EXISTS "tracks_insert_auth" ON storage.objects;
CREATE POLICY "tracks_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tracks' AND owner = auth.uid());

DROP POLICY IF EXISTS "tracks_delete_own" ON storage.objects;
CREATE POLICY "tracks_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tracks' AND owner = auth.uid());