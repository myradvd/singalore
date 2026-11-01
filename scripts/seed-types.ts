import path from 'node:path';
import type { GeoJsonPolygon } from '@singalore/shared';
import type { LandmarkDraft } from '@singalore/ingest';

export const SEED_DIRECTORY = path.resolve(import.meta.dirname, '..', 'supabase', 'seed');
export const SEED_CONTENT_PATH = path.join(SEED_DIRECTORY, 'seed-content.json');
export const SEED_IMAGES_DIRECTORY = path.join(SEED_DIRECTORY, 'images');
export const SEED_AUDIO_DIRECTORY = path.join(SEED_DIRECTORY, 'audio');
export const SEED_SCRIPTS_DIRECTORY = path.join(SEED_DIRECTORY, 'scripts');
export const SEED_PRONUNCIATIONS_PATH = path.resolve(import.meta.dirname, 'tts', 'pronunciations.json');

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

export interface AudioManifestEntry
{
  landmarkSlug: string;
  fileName: string;
  title: string;
  transcript: string;
  voice: string;
  accent: string;
  sourceHash: string;
  durationSeconds: number;
  fileSizeBytes: number;
  sha256: string;
  md5: string;
}
