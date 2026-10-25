export const APP_NAME = 'SINGALORE';
export const APP_DISPLAY_NAME = 'Singalore';

export const LANDMARK_CATEGORIES = [
  'religious',
  'residential',
  'civic',
  'commercial',
  'transport',
  'museum',
  'military',
  'other',
] as const;
export type LandmarkCategory = (typeof LANDMARK_CATEGORIES)[number];

export const PODCAST_LENGTH_CLASSES = ['short', 'standard', 'long'] as const;
export type PodcastLengthClass = (typeof PODCAST_LENGTH_CLASSES)[number];

export interface BoundingBox
{
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export const SINGAPORE_BBOX: BoundingBox = { minLat: 1.15, minLng: 103.59, maxLat: 1.48, maxLng: 104.1 };
export const SINGAPORE_BBOX_WITH_MARGIN: BoundingBox = { minLat: 1.1, minLng: 103.5, maxLat: 1.53, maxLng: 104.15 };
export const SINGAPORE_CENTER = { lat: 1.2905, lng: 103.8465 };

export const MAX_ROUTE_COORDINATES = 12;
export const GEOFENCE_RADIUS_MIN_M = 15;
export const GEOFENCE_RADIUS_MAX_M = 100;
export const GEOFENCE_RADIUS_DEFAULT_M = 30;
export const AUDIO_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac'] as const;
