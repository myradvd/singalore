import type { PlaybackState } from '@/modules/audio/AudioEngine';
import { PLAYBACK_RATES } from '@/modules/prefs/preferencesSchema';

export function isActivelyPlaying(state: PlaybackState): boolean
{
  return state === 'playing' || state === 'buffering';
}

export function nextPlaybackRate(rate: number): number
{
  const index = PLAYBACK_RATES.findIndex((candidate) => candidate === rate);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1;
}

export function formatRate(rate: number): string
{
  return `${rate}x`;
}
