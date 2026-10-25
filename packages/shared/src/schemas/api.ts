import { z } from 'zod';
import {
  GEOFENCE_RADIUS_MAX_M,
  GEOFENCE_RADIUS_MIN_M,
  LANDMARK_CATEGORIES,
  MAX_ROUTE_COORDINATES,
  PODCAST_LENGTH_CLASSES,
  SINGAPORE_BBOX_WITH_MARGIN,
} from '../constants';
import { isInsideBoundingBox } from '../geo/bbox';
import { GeoJsonPolygon } from './geojson';

export const Uuid = z.uuid();

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

export const Category = z.enum(LANDMARK_CATEGORIES);
export const LengthClass = z.enum(PODCAST_LENGTH_CLASSES);

export const API_ERROR_CODES = [
  'invalid_request',
  'out_of_region',
  'too_many_coordinates',
  'rate_limited',
  'upstream_timeout',
  'upstream_error',
  'not_found',
  'internal',
] as const;
export const ApiErrorCode = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiError = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof ApiError>;

export const Health = z.object({
  status: z.literal('ok'),
  serverTime: z.iso.datetime(),
  version: z.string(),
});
export type Health = z.infer<typeof Health>;

export const CatalogPark = z.object({
  id: Uuid,
  slug: z.string(),
  name: z.string(),
  district: z.string(),
  shortDescription: z.string(),
  center: LatLng,
  boundary: GeoJsonPolygon.nullable(),
  thumbnailUrl: z.url().nullable(),
  landmarkCount: z.int().nonnegative(),
  packBytes: z.int().nonnegative(),
  attribution: z.string(),
});
export type CatalogPark = z.infer<typeof CatalogPark>;

export const CatalogLandmark = z.object({
  id: Uuid,
  parkId: Uuid,
  slug: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  category: Category,
  position: LatLng,
  geofenceRadiusM: z.int().min(GEOFENCE_RADIUS_MIN_M).max(GEOFENCE_RADIUS_MAX_M),
  shortDescription: z.string(),
  thumbnailUrl: z.url().nullable(),
  builtYear: z.int().nullable(),
  architecturalStyle: z.string().nullable(),
  sortOrder: z.int(),
  attribution: z.string(),
});
export type CatalogLandmark = z.infer<typeof CatalogLandmark>;

export const CatalogPodcast = z.object({
  id: Uuid,
  landmarkId: Uuid,
  title: z.string(),
  audioUrl: z.url(),
  durationSeconds: z.int().positive(),
  fileSizeBytes: z.int().positive(),
  voice: z.string().nullable(),
  accent: z.string().nullable(),
  lengthClass: LengthClass.nullable(),
  hasTranscript: z.boolean(),
});
export type CatalogPodcast = z.infer<typeof CatalogPodcast>;

export const CatalogResponse = z.object({
  schemaVersion: z.literal(1),
  etag: z.string(),
  generatedAt: z.iso.datetime(),
  parks: z.array(CatalogPark),
  landmarks: z.array(CatalogLandmark),
  podcasts: z.array(CatalogPodcast),
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const Md5Hex = z.string().regex(/^[0-9a-f]{32}$/);

export const PackFile = z.object({
  kind: z.enum(['audio', 'image']),
  url: z.url(),
  bytes: z.int().positive(),
  sha256: Sha256Hex.nullable(),
  md5: Md5Hex.nullable(),
  podcastId: Uuid.nullable(),
  landmarkId: Uuid.nullable(),
});
export type PackFile = z.infer<typeof PackFile>;

export const PackLandmarkDetail = z.object({
  landmarkId: Uuid,
  description: z.string(),
  imageUrl: z.url().nullable(),
});
export type PackLandmarkDetail = z.infer<typeof PackLandmarkDetail>;

export const PackPodcastDetail = z.object({
  podcastId: Uuid,
  transcript: z.string().nullable(),
});
export type PackPodcastDetail = z.infer<typeof PackPodcastDetail>;

export const PackResponse = z.object({
  schemaVersion: z.literal(1),
  parkId: Uuid,
  etag: z.string(),
  generatedAt: z.iso.datetime(),
  totalBytes: z.int().nonnegative(),
  landmarks: z.array(PackLandmarkDetail),
  podcasts: z.array(PackPodcastDetail),
  files: z.array(PackFile),
});
export type PackResponse = z.infer<typeof PackResponse>;

const RouteCoordinates = z.array(LatLng)
  .min(2)
  .max(MAX_ROUTE_COORDINATES)
  .refine(
    (points) => points.every((point) => isInsideBoundingBox(point, SINGAPORE_BBOX_WITH_MARGIN)),
    { message: 'out_of_region' },
  );

export const RouteRequest = z.object({ coordinates: RouteCoordinates });
export type RouteRequest = z.infer<typeof RouteRequest>;

export const Maneuver = z.object({
  type: z.string(),
  modifier: z.string().optional(),
  location: LatLng,
  bearingBefore: z.number(),
  bearingAfter: z.number(),
  exit: z.int().optional(),
});
export type Maneuver = z.infer<typeof Maneuver>;

export const RouteStep = z.object({
  distanceM: z.number().nonnegative(),
  durationS: z.number().nonnegative(),
  name: z.string(),
  maneuver: Maneuver,
});
export type RouteStep = z.infer<typeof RouteStep>;

export const RouteLeg = z.object({
  distanceM: z.number().nonnegative(),
  durationS: z.number().nonnegative(),
  steps: z.array(RouteStep),
});
export type RouteLeg = z.infer<typeof RouteLeg>;

export const RouteResponse = z.object({
  distanceM: z.number().nonnegative(),
  durationS: z.number().nonnegative(),
  geometryPolyline6: z.string(),
  legs: z.array(RouteLeg),
  provider: z.string(),
});
export type RouteResponse = z.infer<typeof RouteResponse>;

export const TableRequest = z.object({ coordinates: RouteCoordinates });
export type TableRequest = z.infer<typeof TableRequest>;

export const TableResponse = z.object({
  durationsS: z.array(z.array(z.number().nonnegative().nullable())),
  provider: z.string(),
});
export type TableResponse = z.infer<typeof TableResponse>;

export const API_PATHS = {
  health: '/api/v1/health',
  catalog: '/api/v1/catalog',
  pack: (parkId: string) => `/api/v1/parks/${encodeURIComponent(parkId)}/pack`,
  route: '/api/v1/route',
  routeTable: '/api/v1/route/table',
} as const;

export const COORDINATE_BEARING_PATHS: readonly string[] = [API_PATHS.route, API_PATHS.routeTable];
