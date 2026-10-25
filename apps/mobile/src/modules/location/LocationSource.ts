import type { LocationFix, LocationMode } from '@/core/location';

export interface LocationSourceHandle
{
  stop(): void;
}

export interface LocationSource
{
  readonly kind: 'device' | 'spoof';
  start(mode: LocationMode, onFix: (fix: LocationFix) => void, onError: (code: string) => void): Promise<LocationSourceHandle>;
}

export const MODE_SETTINGS: Record<LocationMode, { accuracy: 'balanced' | 'high'; distanceIntervalMeters: number; timeIntervalMs: number }> = {
  browse: { accuracy: 'balanced', distanceIntervalMeters: 15, timeIntervalMs: 5000 },
  tour: { accuracy: 'high', distanceIntervalMeters: 5, timeIntervalMs: 1000 },
};
