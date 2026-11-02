import type { PlaybackState } from '@/modules/audio/AudioEngine';
import { pickPodcast, type PodcastPreferences } from '@/modules/audio/pickPodcast';
import type { CatalogState } from '@/modules/catalog/catalogStore';
import { PLAYBACK_RATES } from '@/modules/prefs/preferencesSchema';

export function isActivelyPlaying(state: PlaybackState): boolean
{
  return state === 'playing' || state === 'buffering';
}

// Returns the length of the episode that playback would pick for this landmark.
export function shownEpisodeSeconds(catalog: Pick<CatalogState, 'podcastsByLandmarkId'>, landmarkId: string, preferences: PodcastPreferences): number | null
{
  return pickPodcast(catalog.podcastsByLandmarkId.get(landmarkId) ?? [], preferences)?.durationSeconds ?? null;
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
