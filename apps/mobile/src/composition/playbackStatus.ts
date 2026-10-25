import type { PlaybackStatusProvider } from '@/core/location';

export interface MutablePlaybackStatus extends PlaybackStatusProvider
{
  set(provider: PlaybackStatusProvider): void;
}

export function createMutablePlaybackStatus(): MutablePlaybackStatus
{
  let current: PlaybackStatusProvider = { isPlaying: () => false, currentLandmarkId: () => null };
  return {
    isPlaying: () => current.isPlaying(),
    currentLandmarkId: () => current.currentLandmarkId(),
    set: (provider) =>
    {
      current = provider;
    },
  };
}
