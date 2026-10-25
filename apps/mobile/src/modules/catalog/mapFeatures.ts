import type { CatalogLandmark, CatalogPark } from '@singalore/shared';

export interface LandmarkPinProperties
{
  landmarkId: string;
  name: string;
  category: string;
  hasPodcast: boolean;
  inItinerary: boolean;
  selected: boolean;
  itineraryIndex: number;
}

export interface ParkFeatureProperties
{
  parkId: string;
  name: string;
}

export function buildLandmarkPins(
  landmarks: readonly CatalogLandmark[],
  podcastLandmarkIds: ReadonlySet<string>,
  itineraryIds: readonly string[],
  selectedLandmarkId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Point, LandmarkPinProperties>
{
  return {
    type: 'FeatureCollection',
    features: landmarks.map((landmark) => ({
      type: 'Feature',
      id: landmark.id,
      properties: {
        landmarkId: landmark.id,
        name: landmark.name,
        category: landmark.category,
        hasPodcast: podcastLandmarkIds.has(landmark.id),
        inItinerary: itineraryIds.includes(landmark.id),
        selected: landmark.id === selectedLandmarkId,
        itineraryIndex: itineraryIds.indexOf(landmark.id) + 1,
      },
      geometry: { type: 'Point', coordinates: [landmark.position.lng, landmark.position.lat] },
    })),
  };
}

export function buildParkBoundaries(parks: readonly CatalogPark[]): GeoJSON.FeatureCollection<GeoJSON.Polygon, ParkFeatureProperties>
{
  return {
    type: 'FeatureCollection',
    features: parks.flatMap((park) => (park.boundary === null
      ? []
      : [{
        type: 'Feature' as const,
        id: park.id,
        properties: { parkId: park.id, name: park.name },
        geometry: { type: 'Polygon' as const, coordinates: park.boundary.coordinates },
      }])),
  };
}

export function buildParkCenterMarkers(parks: readonly CatalogPark[]): GeoJSON.FeatureCollection<GeoJSON.Point, ParkFeatureProperties>
{
  return {
    type: 'FeatureCollection',
    features: parks.filter((park) => park.boundary === null).map((park) => ({
      type: 'Feature',
      id: park.id,
      properties: { parkId: park.id, name: park.name },
      geometry: { type: 'Point', coordinates: [park.center.lng, park.center.lat] },
    })),
  };
}
