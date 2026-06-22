/*
# Jukebox App - Complete Schema

## Overview
A music-focused jukebox app where users create/join rooms with short codes, chat, upload tracks to a shared playlist, control playback, and optionally Listen Together (synchronized playback with all participants).

1. New Tables
- `profiles` - extends Supabase auth.users with display name and avatar URL
  - `id` (uuid, PK, FK to auth.users)
  - `username` (text, unique, display name)
  - `avatar_color` (text, hex color for default avatar gradient)
  - `avatar_url` (text, nullable, uploaded profile picture path)
  - `created_at` (timestamptz)
- `rooms` - a music room / group chat
  - `id` (uuid, PK)
  - `name` (text, room name)
  - `code` (text, unique, 6-char short code to join)
  - `passcode` (text, nullable, optional passcode to enter)
  - `owner_id` (uuid, FK to profiles, room owner)
  - `current_track_id` (uuid, nullable, FK to tracks, currently playing track)
  - `playing` (bool, default false, whether playback is active)
  - `position_seconds` (numeric, default 0, playback position)
  - `position_updated_at` (timestamptz, when position was last set)
  - `listen_together` (bool, default false, whether Listen Together mode is on)
  - `created_at` (timestamptz)
- `room_members` - members of each room (persists so you return to rooms you've joined)
  - `id` (uuid, PK)
  - `room_id` (uuid, FK to rooms)
  - `user_id` (uuid, FK to profiles)
  - `role` (text, default 'member', 'owner' or 'member')
  - `joined_at` (timestamptz)
  - UNIQUE constraint on (room_id, user_id)
- `tracks` - tracks in a room's shared playlist
  - `id` (uuid, PK)
  - `room_id` (uuid, FK to rooms)
  - `user_id` (uuid, FK to profiles, who added it)
  - `title` (text, song title)
  - `artist` (text, song artist)
  - `album` (text, nullable)
  - `duration_seconds` (int, track length)
  - `storage_path` (text, path to audio file in Supabase Storage)
  - `cover_color` (text, hex color for default cover art)
  - `play_order` (int, default 0, order in playlist)
  - `created_at` (timestamptz)
- `messages` - chat messages in a room
  - `id` (uuid, PK)
  - `room_id` (uuid, FK to rooms)
  - `user_id` (uuid, FK to profiles)
  - `content` (text, message content)
  - `created_at` (timestamptz)
- `listen_participants` - who is currently in the Listen Together session of a room
  - `id` (uuid, PK)
  - `room_id` (uuid, FK to rooms)
  - `user_id` (uuid, FK to profiles)
  - `is_active` (bool, default true, whether they're still in the call)
  - `joined_at` (timestamptz)
  - `last_seen_at` (timestamptz, for heartbeat/liveness)

2. Indexes
- rooms.code (unique)
- room_members (room_id, user_id) unique
- tracks.room_id
- messages.room_id
- listen_participants.room_id

3. Security (RLS)
- profiles: users read all, update own only
- rooms: authenticated can read all rooms; insert/update if owner; delete if owner
- room_members: members can read; insert if joining self as member; owner can delete members; member can delete self (leave)
- tracks: members can read; insert if member of room; delete if adder or owner
- messages: members can read; insert if member of room
- listen_participants: members can read; insert if joining self; update own; delete own (leave call)
- Storage bucket `avatars` for profile pictures, `tracks` for audio files — public read
*/