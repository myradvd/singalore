import path from 'node:path';
import type { GeoJsonPolygon } from '@singalore/shared';
import type { LandmarkDraft } from '@singalore/ingest';

export const SEED_DIRECTORY = path.resolve(import.meta.dirname, '..', 'supabase', 'seed');
export const SEED_CONTENT_PATH = path.join(SEED_DIRECTORY, 'seed-content.json');
export const SEED_IMAGES_DIRECTORY = path.join(SEED_DIRECTORY, 'images');
export const SEED_AUDIO_DIRECTORY = path.join(SEED_DIRECTORY, 'audio');

export interface SeedLandmark extends LandmarkDraft
{
  sortOrder: number;
  imageFile: string | null;
}

export interface SeedPark
{
  slug: string;
  name: string;
  district: string;
  description: string;
  shortDescription: string;
  centerLat: number;
  centerLng: number;
  boundary: GeoJsonPolygon | null;
  attribution: string;
  thumbnailFile: string | null;
  landmarks: SeedLandmark[];
}

export interface SeedContent
{
  fetchedAt: string;
  parks: SeedPark[];
}
