import { haversineDistanceMeters } from '@singalore/shared';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { ENTRY_ACCURACY_LIMIT_METERS } from './GeofenceEvaluator';
import { DISMISS_SUPPRESSION_MS } from './promptPolicy';

export interface BackgroundArrivalInput
{
  fix: LocationFix;
  targets: readonly GeofenceTarget[];
  geofenceTriggersEnabled: boolean;
  lastNotifiedAt: ReadonlyMap<string, number>;
  now: number;
  candidateLandmarkId?: string;
}

export type BackgroundArrivalResult =
  | { kind: 'arrived'; landmarkId: string; name: string }
  | { kind: 'approaching'; landmarkId: string }
  | { kind: 'none' };

export function evaluateBackgroundArrival(input: BackgroundArrivalInput): BackgroundArrivalResult
{
  if (!input.geofenceTriggersEnabled)
  {
    return { kind: 'none' };
  }
  const accurate = input.fix.accuracyMeters !== null && input.fix.accuracyMeters <= ENTRY_ACCURACY_LIMIT_METERS;
  const candidates = input.targets
    .filter((target) => target.hasPodcast)
    .filter((target) => input.candidateLandmarkId === undefined || target.landmarkId === input.candidateLandmarkId)
    .map((target) => ({ target, distance: haversineDistanceMeters(input.fix.latitude, input.fix.longitude, target.latitude, target.longitude) }))
    .sort((a, b) => a.distance - b.distance);
  for (const { target, distance } of candidates)
  {
    const notified = input.lastNotifiedAt.get(target.landmarkId);
    if (notified !== undefined && input.now - notified < DISMISS_SUPPRESSION_MS)
    {
      continue;
    }
    if (accurate && distance <= target.radiusMeters)
    {
      return { kind: 'arrived', landmarkId: target.landmarkId, name: target.name };
    }
  }
  const nearest = candidates[0];
  if (input.candidateLandmarkId !== undefined && nearest !== undefined)
  {
    return { kind: 'approaching', landmarkId: nearest.target.landmarkId };
  }
  return { kind: 'none' };
}

export function arrivalNotificationText(name: string): { title: string; body: string }
{
  return { title: `You have reached ${name}`, body: 'A podcast about this site is available. Tap to listen.' };
}
