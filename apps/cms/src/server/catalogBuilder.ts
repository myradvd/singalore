import { createHash } from 'node:crypto';
import { firstSentences } from '@singalore/ingest';
import {
  CatalogResponse,
  GeoJsonPolygon,
  type CatalogLandmark,
  type CatalogPark,
  type CatalogPodcast,
} from '@singalore/shared';

export interface ParkRow
{
  id: string;
  slug: string;
  name: string;
  district: string;
  description: string;
  center_lat: number;
  center_lng: number;
  boundary: unknown;
  thumbnail_path: string | null;
  attribution: string;
}

export interface LandmarkRow
{
  id: string;
  park_id: string;
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  short_description: string;
  thumbnail_path: string | null;
  image_bytes: number | null;
  built_year: number | null;
  architectural_style: string | null;
  sort_order: number;
  attribution: string;
}

export interface PodcastRow
{
  id: string;
  landmark_id: string;
  title: string;
  audio_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  voice: string | null;
  accent: string | null;
  length_class: string | null;
  has_transcript: boolean;
}

/** Published database rows read by catalogRepository, before conversion to the API shape. */
export interface CatalogRows
{
  parks: ParkRow[];
  landmarks: LandmarkRow[];
  podcasts: PodcastRow[];
}
/**
 * Turns a Storage object path into a public media URL.
 * @param base - Public media base URL (Supabase Storage CDN).
 * @param objectPath - Path inside the media bucket, or null.
 * @returns Full URL with each path segment encoded, or null if there is no file.
 */

export function mediaUrl(base: string, objectPath: string | null): string | null
{
  if (objectPath === null || objectPath.length === 0)
  {
    return null;
  }
  return `${base}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}
/**
 * Computes an ETag for an API response so clients can skip unchanged downloads (HTTP 304).
 * @param content - Response content without timestamps.
 * @returns Quoted first 32 hex characters of the SHA-256 of the JSON.
 */

export function computeEtag(content: unknown): string
{
  return `"${createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 32)}"`;
}
/**
 * Builds the GET /api/v1/catalog response from published rows.
 * Drops landmarks whose park is missing and podcasts whose landmark is missing,
 * sorts everything for a stable ETag, and totals each park's download size.
 * @param rows - Published parks, landmarks and podcasts.
 * @param mediaBase - Public media base URL.
 * @param generatedAt - Time stamped into the response.
 * @returns A validated CatalogResponse.
 */

export function buildCatalog(rows: CatalogRows, mediaBase: string, generatedAt: Date): CatalogResponse
{
  const parkIds = new Set(rows.parks.map((park) => park.id));
  const landmarks: CatalogLandmark[] = rows.landmarks
    .filter((landmark) => parkIds.has(landmark.park_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((landmark) => ({
      id: landmark.id,
      parkId: landmark.park_id,
      slug: landmark.slug,
      name: landmark.name,
      aliases: landmark.aliases,
      category: landmark.category as CatalogLandmark['category'],
      position: { lat: landmark.lat, lng: landmark.lng },
      geofenceRadiusM: landmark.geofence_radius_m,
      shortDescription: landmark.short_description,
      thumbnailUrl: mediaUrl(mediaBase, landmark.thumbnail_path),
      builtYear: landmark.built_year,
      architecturalStyle: landmark.architectural_style,
      sortOrder: landmark.sort_order,
      attribution: landmark.attribution,
    }));
  const landmarkIds = new Set(landmarks.map((landmark) => landmark.id));
  const podcasts: CatalogPodcast[] = rows.podcasts
    .filter((podcast) => landmarkIds.has(podcast.landmark_id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((podcast) => ({
      id: podcast.id,
      landmarkId: podcast.landmark_id,
      title: podcast.title,
      audioUrl: mediaUrl(mediaBase, podcast.audio_path) ?? '',
      durationSeconds: podcast.duration_seconds,
      fileSizeBytes: podcast.file_size_bytes,
      voice: podcast.voice,
      accent: podcast.accent,
      lengthClass: podcast.length_class as CatalogPodcast['lengthClass'],
      hasTranscript: podcast.has_transcript,
    }));
  const parks: CatalogPark[] = rows.parks
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((park) =>
    {
      const parkLandmarks = rows.landmarks.filter((landmark) => landmark.park_id === park.id && landmarkIds.has(landmark.id));
      const parkLandmarkIds = new Set(parkLandmarks.map((landmark) => landmark.id));
      const audioBytes = rows.podcasts
        .filter((podcast) => parkLandmarkIds.has(podcast.landmark_id))
        .reduce((sum, podcast) => sum + podcast.file_size_bytes, 0);
      const imageBytes = parkLandmarks.reduce((sum, landmark) => sum + (landmark.image_bytes ?? 0), 0);
      const boundary = GeoJsonPolygon.safeParse(park.boundary);
      return {
        id: park.id,
        slug: park.slug,
        name: park.name,
        district: park.district,
        shortDescription: firstSentences(park.description, 220),
        center: { lat: park.center_lat, lng: park.center_lng },
        boundary: boundary.success ? boundary.data : null,
        thumbnailUrl: mediaUrl(mediaBase, park.thumbnail_path),
        landmarkCount: parkLandmarks.length,
        packBytes: audioBytes + imageBytes,
        attribution: park.attribution,
      };
    });
  const content = { parks, landmarks, podcasts };
  return CatalogResponse.parse({
    schemaVersion: 1,
    etag: computeEtag(content),
    generatedAt: generatedAt.toISOString(),
    ...content,
  });
}
