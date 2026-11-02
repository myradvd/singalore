import type { CatalogLandmark } from '@singalore/shared';
import type { GeofenceTarget } from '@/core/location';

// Maps catalog landmarks to the targets the geofence rules evaluate.
export function toGeofenceTargets(landmarks: readonly CatalogLandmark[], podcastLandmarkIds: ReadonlySet<string>): GeofenceTarget[]
{
  return landmarks.map((landmark) => ({
    landmarkId: landmark.id,
    name: landmark.name,
    latitude: landmark.position.lat,
    longitude: landmark.position.lng,
    radiusMeters: landmark.geofenceRadiusM,
    hasPodcast: podcastLandmarkIds.has(landmark.id),
  }));
}
