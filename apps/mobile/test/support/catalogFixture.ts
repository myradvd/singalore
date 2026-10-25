import type { CatalogLandmark, CatalogPark, CatalogPodcast, CatalogResponse } from '@singalore/shared';

export const PARK_CIVIC = '0b5a2f10-0000-4000-8000-000000000001';
export const PARK_TIONG_BAHRU = '0b5a2f10-0000-4000-8000-000000000002';
export const LANDMARK_CHIJMES = '1c6b3a20-0000-4000-8000-000000000001';
export const LANDMARK_RAFFLES = '1c6b3a20-0000-4000-8000-000000000002';
export const LANDMARK_MARKET = '1c6b3a20-0000-4000-8000-000000000003';
export const LANDMARK_SHELTER = '1c6b3a20-0000-4000-8000-000000000004';
export const PODCAST_CHIJMES_GB = '2d7c4b30-0000-4000-8000-000000000001';
export const PODCAST_CHIJMES_US = '2d7c4b30-0000-4000-8000-000000000002';
export const PODCAST_RAFFLES = '2d7c4b30-0000-4000-8000-000000000003';
export const PODCAST_MARKET = '2d7c4b30-0000-4000-8000-000000000004';

const parks: CatalogPark[] = [
  {
    id: PARK_CIVIC,
    slug: 'civic-district',
    name: 'Civic District',
    district: 'Downtown Core',
    shortDescription: 'The Civic District is a district located near the Singapore River.',
    center: { lat: 1.2925, lng: 103.851 },
    boundary: { type: 'Polygon', coordinates: [[[103.848, 1.289], [103.856, 1.289], [103.856, 1.297], [103.848, 1.297], [103.848, 1.289]]] },
    thumbnailUrl: 'https://cdn.test/media/images/parks/civic-district.jpg',
    landmarkCount: 2,
    packBytes: 500000,
    attribution: 'Wikipedia',
  },
  {
    id: PARK_TIONG_BAHRU,
    slug: 'tiong-bahru',
    name: 'Tiong Bahru',
    district: 'Bukit Merah',
    shortDescription: 'Tiong Bahru is a housing estate.',
    center: { lat: 1.2855, lng: 103.8315 },
    boundary: null,
    thumbnailUrl: null,
    landmarkCount: 2,
    packBytes: 200000,
    attribution: 'Wikipedia',
  },
];

const landmarks: CatalogLandmark[] = [
  {
    id: LANDMARK_CHIJMES,
    parkId: PARK_CIVIC,
    slug: 'chijmes',
    name: 'CHIJMES',
    aliases: ['Convent of the Holy Infant Jesus'],
    category: 'religious',
    position: { lat: 1.29516, lng: 103.85193 },
    geofenceRadiusM: 30,
    shortDescription: 'CHIJMES is a historic building complex that began life as a Catholic convent.',
    thumbnailUrl: 'https://cdn.test/media/images/landmarks/chijmes.jpg',
    builtYear: 1904,
    architecturalStyle: 'Gothic Revival',
    sortOrder: 0,
    attribution: 'Wikidata Q1072593',
  },
  {
    id: LANDMARK_RAFFLES,
    parkId: PARK_CIVIC,
    slug: 'raffles-hotel',
    name: 'Raffles Hotel',
    aliases: ['Raffles Singapore'],
    category: 'commercial',
    position: { lat: 1.29486, lng: 103.85441 },
    geofenceRadiusM: 40,
    shortDescription: 'Raffles Hotel is a historic luxury hotel.',
    thumbnailUrl: null,
    builtYear: 1887,
    architecturalStyle: null,
    sortOrder: 1,
    attribution: 'Wikidata Q1538837',
  },
  {
    id: LANDMARK_MARKET,
    parkId: PARK_TIONG_BAHRU,
    slug: 'tiong-bahru-market',
    name: 'Tiong Bahru Market',
    aliases: [],
    category: 'commercial',
    position: { lat: 1.28513, lng: 103.83273 },
    geofenceRadiusM: 30,
    shortDescription: 'Market at the corner of Lim Liak Street and Seng Poh Road.',
    thumbnailUrl: null,
    builtYear: null,
    architecturalStyle: null,
    sortOrder: 0,
    attribution: 'Wikidata Q107803795',
  },
  {
    id: LANDMARK_SHELTER,
    parkId: PARK_TIONG_BAHRU,
    slug: 'tiong-bahru-air-raid-shelter',
    name: 'Tiong Bahru Air Raid Shelter',
    aliases: [],
    category: 'military',
    position: { lat: 1.28451, lng: 103.83112 },
    geofenceRadiusM: 30,
    shortDescription: '',
    thumbnailUrl: null,
    builtYear: null,
    architecturalStyle: null,
    sortOrder: 1,
    attribution: 'Wikidata Q118213332',
  },
];

const podcasts: CatalogPodcast[] = [
  { id: PODCAST_CHIJMES_GB, landmarkId: LANDMARK_CHIJMES, title: 'CHIJMES: a short history', audioUrl: 'https://cdn.test/media/audio/chijmes-gb.m4a', durationSeconds: 24, fileSizeBytes: 120000, voice: 'Male', accent: 'British', lengthClass: 'short', hasTranscript: true },
  { id: PODCAST_CHIJMES_US, landmarkId: LANDMARK_CHIJMES, title: 'CHIJMES: a short history', audioUrl: 'https://cdn.test/media/audio/chijmes-us.m4a', durationSeconds: 26, fileSizeBytes: 130000, voice: 'Female', accent: 'American', lengthClass: 'short', hasTranscript: true },
  { id: PODCAST_RAFFLES, landmarkId: LANDMARK_RAFFLES, title: 'Raffles Hotel: a short history', audioUrl: 'https://cdn.test/media/audio/raffles-hotel-gb.m4a', durationSeconds: 180, fileSizeBytes: 250000, voice: 'Male', accent: 'British', lengthClass: 'standard', hasTranscript: false },
  { id: PODCAST_MARKET, landmarkId: LANDMARK_MARKET, title: 'Tiong Bahru Market: a short history', audioUrl: 'https://cdn.test/media/audio/tiong-bahru-market-gb.m4a', durationSeconds: 20, fileSizeBytes: 90000, voice: 'Male', accent: 'British', lengthClass: 'short', hasTranscript: true },
];

export function catalogFixture(etag = '"v1"'): CatalogResponse
{
  return {
    schemaVersion: 1,
    etag,
    generatedAt: '2026-10-12T00:00:00.000Z',
    parks: structuredClone(parks),
    landmarks: structuredClone(landmarks),
    podcasts: structuredClone(podcasts),
  };
}
