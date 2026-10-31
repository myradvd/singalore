import type { LandmarkCategory } from '@singalore/shared';

export interface SeedLandmarkSource
{
  wikidataId?: string;
  osm?: { type: 'node' | 'way' | 'relation'; id: number };
  nameOverride?: string;
  categoryOverride?: LandmarkCategory;
  geofenceRadiusM?: number;
}

export interface SeedParkSpec
{
  slug: string;
  name: string;
  district: string;
  wikipediaTitle: string;
  landmarks: SeedLandmarkSource[];
}

export const SEED_PARKS: SeedParkSpec[] = [
  {
    slug: 'tiong-bahru',
    name: 'Tiong Bahru',
    district: 'Bukit Merah',
    wikipediaTitle: 'Tiong Bahru',
    landmarks: [
      { wikidataId: 'Q7808727', nameOverride: 'Tiong Bahru Estate', categoryOverride: 'residential' },
      { wikidataId: 'Q107803795', categoryOverride: 'commercial' },
      { wikidataId: 'Q118213332', categoryOverride: 'military' },
      { wikidataId: 'Q7808728' },
      { osm: { type: 'way', id: 260459557 } },
      { osm: { type: 'node', id: 12389540382 } },
    ],
  },
  {
    slug: 'civic-district',
    name: 'Civic District',
    district: 'Downtown Core',
    wikipediaTitle: 'Civic District',
    landmarks: [
      { wikidataId: 'Q1072593', categoryOverride: 'religious' },
      { wikidataId: 'Q557635' },
      { wikidataId: 'Q632689' },
      { wikidataId: 'Q1538837' },
      { wikidataId: 'Q13360293', categoryOverride: 'civic' },
      { wikidataId: 'Q168806' },
      { wikidataId: 'Q633033' },
      { wikidataId: 'Q6970475' },
    ],
  },
  {
    slug: 'telok-ayer-tanjong-pagar',
    name: 'Telok Ayer and Tanjong Pagar',
    district: 'Downtown Core',
    wikipediaTitle: 'Telok Ayer Street',
    landmarks: [
      { wikidataId: 'Q2158122' },
      { wikidataId: 'Q4022275' },
      { wikidataId: 'Q14179982', nameOverride: 'Nagore Durgha' },
      { wikidataId: 'Q7697793' },
      { wikidataId: 'Q4845494', categoryOverride: 'religious' },
      { wikidataId: 'Q2609750', categoryOverride: 'civic' },
      { wikidataId: 'Q6202739', categoryOverride: 'transport' },
      { wikidataId: 'Q1096333' },
    ],
  },
  {
    slug: 'nanyang-technological-university',
    name: 'Nanyang Technological University',
    district: 'Western Water Catchment',
    wikipediaTitle: 'Nanyang Technological University',
    landmarks: [
      { wikidataId: 'Q54321647', osm: { type: 'way', id: 389084380 }, nameOverride: 'UOB Innovation Hub', categoryOverride: 'civic', geofenceRadiusM: 50 },
      { wikidataId: 'Q131416839', osm: { type: 'way', id: 49968763 }, categoryOverride: 'museum', geofenceRadiusM: 50 },
      { wikidataId: 'Q107803902', osm: { type: 'node', id: 8573320299 }, nameOverride: 'Nanyang University Memorial', categoryOverride: 'civic', geofenceRadiusM: 25 },
      { osm: { type: 'node', id: 8573367917 }, categoryOverride: 'civic', geofenceRadiusM: 25 },
      { osm: { type: 'way', id: 49967616 }, categoryOverride: 'other', geofenceRadiusM: 60 },
    ],
  },
];
