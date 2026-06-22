import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, publicUrl, TRACKS_BUCKET } from './supabase';
import type { Track, Room } from './types';

/**
 * Syncs audio playback with the room state stored in the database.
 * - When `room.playing` is true and a current track exists, plays from `position_seconds`.
 * - When Listen Together is on, listens to position_updated_at and seeks to match.
 * - The room owner drives playback state; non-owners follow.
 */
export function useRoomPlayback(
  room: Room | null,
  currentTrack: Track | null,
  isOwner: boolean,
  onEnded: () => void
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localPosition, setLocalPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localPlaying, setLocalPlaying] = useState(false);
  const lastSyncRef = useRef<number>(Date.now());

  // Get a playable URL for a track
  const trackUrl = useCallback((t: Track | null) => {
    if (!t) return null;
    return publicUrl(TRACKS_BUCKET, t.storage_path);
  }, []);

  // When track changes, load it
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const url = trackUrl(currentTrack);
    if (url && audio.src !== url) {
      audio.src = url;
      setLocalPosition(0);
      setDuration(0);
    }
  }, [currentTrack, trackUrl]);

  // Sync play/pause + position from room state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !room) return;

    if (room.playing && currentTrack) {
      // Compute effective position from server timestamp
      const elapsed = room.listen_together
        ? (Date.now() - new Date(room.position_updated_at).getTime()) / 1000
        : room.position_seconds;
      const target = room.listen_together ? room.position_seconds + elapsed : room.position_seconds;

      // Only seek if drift is significant
      if (Math.abs(audio.currentTime - target) > 1.5) {
        try { audio.currentTime = target; } catch { /* not loaded yet */ }
      }
      audio.play().then(() => setLocalPlaying(true)).catch(() => setLocalPlaying(false));
    } else {
      audio.pause();
      setLocalPlaying(false);
    }
  }, [room, currentTrack]);

  // Seek adjustments for Listen Together: periodically re-sync
  useEffect(() => {
    if (!room?.listen_together || !room.playing || !currentTrack) return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const elapsed = (Date.now() - new Date(room.position_updated_at).getTime()) / 1000;
      const expected = room.position_seconds + elapsed;
      if (Math.abs(audio.currentTime - expected) > 2) {
        try { audio.currentTime = expected; } catch { /* noop */ }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [room, currentTrack]);

  // Local time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setLocalPosition(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setLocalPlaying(true);
    const onPause = () => setLocalPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [currentTrack]);

  // Owner-only: push position updates to the DB periodically (Listen Together)
  const updateRoomPosition = useCallback(async (position: number) => {
    if (!room || !isOwner) return;
    lastSyncRef.current = Date.now();
    await supabase
      .from('rooms')
      .update({ position_seconds: position, position_updated_at: new Date().toISOString() })
      .eq('id', room.id);
  }, [room, isOwner]);

  // Periodic position sync for owner during Listen Together
  useEffect(() => {
    if (!isOwner || !room?.listen_together || !room.playing) return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused) updateRoomPosition(audio.currentTime);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOwner, room, updateRoomPosition]);

  // Owner controls
  const togglePlay = useCallback(async () => {
    if (!room || !isOwner || !currentTrack) return;
    const audio = audioRef.current;
    const newPos = audio?.currentTime ?? room.position_seconds;
    await supabase
      .from('rooms')
      .update({
        playing: !room.playing,
        position_seconds: newPos,
        position_updated_at: new Date().toISOString(),
      })
      .eq('id', room.id);
  }, [room, isOwner, currentTrack]);

  const seek = useCallback(async (seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
    setLocalPosition(seconds);
    if (room && isOwner) {
      await supabase
        .from('rooms')
        .update({ position_seconds: seconds, position_updated_at: new Date().toISOString() })
        .eq('id', room.id);
    }
  }, [room, isOwner]);

  // Handle track ended -> owner advances
  const handleEnded = useCallback(() => {
    if (isOwner) onEnded();
  }, [isOwner, onEnded]);

  return {
    audioRef,
    localPosition,
    duration: duration || currentTrack?.duration_seconds || 0,
    localPlaying,
    togglePlay,
    seek,
    handleEnded,
  };
}
