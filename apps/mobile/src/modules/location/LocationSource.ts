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

// No distance filter: Android sends nothing while a distance filter is unmet, so a user standing still
// would look like lost signal to the 10 s no-fix watchdog (D23). The time interval alone paces updates.
export const MODE_SETTINGS: Record<LocationMode, { accuracy: 'balanced' | 'high'; distanceIntervalMeters: number; timeIntervalMs: number }> = {
  browse: { accuracy: 'balanced', distanceIntervalMeters: 0, timeIntervalMs: 5000 },
  tour: { accuracy: 'high', distanceIntervalMeters: 0, timeIntervalMs: 1000 },
};
