import { haversineDistanceMeters } from '@singalore/shared';
import type { GeofenceTarget, LocationFix } from '@/core/location';

/** Fixes less accurate than this cannot trigger an entry, to avoid false prompts from GPS jumps. */

export const ENTRY_ACCURACY_LIMIT_METERS = 40;
export const EXIT_MARGIN_MIN_METERS = 15;
export const EXIT_MARGIN_RADIUS_FRACTION = 0.5;
export const EXIT_CONFIRM_FIXES = 2;
export const EXIT_CONFIRM_MS = 5000;

export type GeofenceTransition =
  | { type: 'enter'; landmarkId: string; at: number; distanceMeters: number }
  | { type: 'exit'; landmarkId: string; at: number };

interface InsideRecord
{
  outsideFixes: number;
  firstOutsideAt: number | null;
}
/**
 * Distance at which the walker counts as having left a geofence.
 * Larger than the entry radius (hysteresis) so the prompt does not flicker at the edge.
 * @param radiusMeters - Landmark's entry radius.
 * @returns radius + max(15 m, half the radius).
 */
export function exitRadiusMeters(radiusMeters: number): number
{
  return radiusMeters + Math.max(EXIT_MARGIN_MIN_METERS, EXIT_MARGIN_RADIUS_FRACTION * radiusMeters);
}
/**
 * Decides when the walker enters or leaves each landmark's geofence.
 * Pure logic with no device APIs, so it is unit tested with fake fixes.
 * Entry: inside the radius on one fix with accuracy of 40 m or better.
 * Exit: beyond the exit radius on 2 consecutive fixes or for 5 seconds.
 */
export class GeofenceEvaluator
{
  private readonly inside = new Map<string, InsideRecord>();
/** @returns Ids of landmarks the walker is currently inside. */
  insideLandmarkIds(): string[]
  {
    return [...this.inside.keys()];
  }
/** Forgets all inside states, for example when tracking restarts. */
  reset(): void
  {
    this.inside.clear();
  }

  forget(landmarkId: string): void
  {
    this.inside.delete(landmarkId);
  }
/**
 * Checks one location fix against every landmark.
 * @param fix - Latest location fix (real or spoofed).
 * @param targets - Landmarks to watch, with position and radius.
 * @returns Enter and exit transitions caused by this fix, possibly empty.
 */
  evaluate(fix: LocationFix, targets: readonly GeofenceTarget[]): GeofenceTransition[]
  {
    const transitions: GeofenceTransition[] = [];
    const accurate = fix.accuracyMeters !== null && fix.accuracyMeters <= ENTRY_ACCURACY_LIMIT_METERS;
    const known = new Set<string>();
    for (const target of targets)
    {
      known.add(target.landmarkId);
      const distance = haversineDistanceMeters(fix.latitude, fix.longitude, target.latitude, target.longitude);
      const record = this.inside.get(target.landmarkId);
      if (record === undefined)
      {
        if (accurate && distance <= target.radiusMeters)
        {
          this.inside.set(target.landmarkId, { outsideFixes: 0, firstOutsideAt: null });
          transitions.push({ type: 'enter', landmarkId: target.landmarkId, at: fix.timestamp, distanceMeters: distance });
        }
        continue;
      }
      if (distance > exitRadiusMeters(target.radiusMeters))
      {
        record.outsideFixes += 1;
        record.firstOutsideAt = record.firstOutsideAt ?? fix.timestamp;
        if (record.outsideFixes >= EXIT_CONFIRM_FIXES || fix.timestamp - record.firstOutsideAt >= EXIT_CONFIRM_MS)
        {
          this.inside.delete(target.landmarkId);
          transitions.push({ type: 'exit', landmarkId: target.landmarkId, at: fix.timestamp });
        }
      }
      else
      {
        record.outsideFixes = 0;
        record.firstOutsideAt = null;
      }
    }
    for (const landmarkId of [...this.inside.keys()])
    {
      if (!known.has(landmarkId))
      {
        this.inside.delete(landmarkId);
      }
    }
    return transitions;
  }
}
