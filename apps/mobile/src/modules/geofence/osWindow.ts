import { haversineDistanceMeters } from '@singalore/shared';
import type { GeofenceTarget } from '@/core/location';

export const OS_WINDOW_SIZE = 15;
export const OS_MIN_REGION_RADIUS_METERS = 100;
export const OS_WINDOW_REFRESH_DISTANCE_METERS = 150;

export interface OsRegion
{
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export function selectOsWindow(targets: readonly GeofenceTarget[], latitude: number, longitude: number, size = OS_WINDOW_SIZE): OsRegion[]
{
  return targets
    .filter((target) => target.hasPodcast)
    .map((target) => ({ target, distance: haversineDistanceMeters(latitude, longitude, target.latitude, target.longitude) }))
    .sort((a, b) => a.distance - b.distance || a.target.landmarkId.localeCompare(b.target.landmarkId))
    .slice(0, size)
    .map(({ target }) => ({
      identifier: target.landmarkId,
      latitude: target.latitude,
      longitude: target.longitude,
      radius: Math.max(target.radiusMeters, OS_MIN_REGION_RADIUS_METERS),
    }));
}

export function shouldRefreshWindow(lastCenter: { latitude: number; longitude: number } | null, latitude: number, longitude: number): boolean
{
  if (lastCenter === null)
  {
    return true;
  }
  return haversineDistanceMeters(lastCenter.latitude, lastCenter.longitude, latitude, longitude) > OS_WINDOW_REFRESH_DISTANCE_METERS;
}

export function sameRegions(a: readonly OsRegion[], b: readonly OsRegion[]): boolean
{
  return a.length === b.length && a.every((region, index) => region.identifier === b[index]?.identifier);
}
