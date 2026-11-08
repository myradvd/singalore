import type { LandmarkCategory } from '@singalore/shared';

export interface SeedLandmarkSource
{
  wikidataId?: string;
  osm?: { type: 'node' | 'way' | 'relation'; id: number };
  nameOverride?: string;
  categoryOverride?: LandmarkCategory;
  geofenceRadiusM?: number;
  commonsImage?: string;
  description?: { text: string; credit: string };
}

export interface SeedParkSpec
{
  slug: string;
  name: string;
  district: string;
  wikipediaTitle: string;
  landmarks: SeedLandmarkSource[];
}

export const REMOVED_LANDMARK_SLUGS: string[] = ['tiong-bahru-park', 'giok-hong-tian-temple', 'grave-of-tan-tock-seng'];

// Episodes are not in git. The seed falls back to this public copy when a file is not on this computer.
export const SEED_AUDIO_SOURCE_URL = 'https://plaxhykpkshlyoanywtd.supabase.co/storage/v1/object/public/media/audio';

const NARRATION_CREDIT = 'Text condensed from the Singalore narration script, which draws on Roots (National Heritage Board), Nanyang Technological University, Wikipedia and other public sources.';

export const SEED_PARKS: SeedParkSpec[] = [
  {
    slug: 'tiong-bahru',
    name: 'Tiong Bahru',
    district: 'Bukit Merah',
    wikipediaTitle: 'Tiong Bahru',
    landmarks: [
      { wikidataId: 'Q7808727', nameOverride: 'Tiong Bahru Estate', categoryOverride: 'residential' },
      { wikidataId: 'Q107803795', categoryOverride: 'commercial' },
      { wikidataId: 'Q118213332', categoryOverride: 'military', commonsImage: 'Tiong Bahru Air Raid Shelter - 2023-0506.jpg' },
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
      { wikidataId: 'Q2609750', categoryOverride: 'civic', commonsImage: 'Ying Fo Fui Kun, Telok Ayer Street, October 2025.jpg' },
      { wikidataId: 'Q6202739', categoryOverride: 'transport', commonsImage: 'Jinrikisha station (13719896354).jpg' },
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
      { wikidataId: 'Q131416839', osm: { type: 'way', id: 49968763 }, categoryOverride: 'museum', geofenceRadiusM: 50, commonsImage: 'Chinese Heritage Centre, October 2025.jpg' },
      { wikidataId: 'Q107803902', osm: { type: 'node', id: 8573320299 }, nameOverride: 'Nanyang University Memorial', categoryOverride: 'civic', geofenceRadiusM: 25, commonsImage: 'Former Nanyang University Memorial, Yunnan Garden, October 2025.jpg' },
      {
        osm: { type: 'node', id: 8573367917 },
        categoryOverride: 'civic',
        geofenceRadiusM: 25,
        commonsImage: 'Former Nanyang University Arch, Yunnan Garden, October 2025.jpg',
        description: {
          text: 'This gateway with its sweeping Chinese roof is a replica of the original Nanyang University arch, which still stands across the Pan-Island Expressway at Jurong West Street 93. '
            + 'It was unveiled on 17 May 1995 in front of the former Nanyang University Library and Administration Building, because the original had ended up cut off from the campus. '
            + 'The original arch, the library building and a memorial in Yunnan Garden were gazetted together as a single national monument in 1998.',
          credit: NARRATION_CREDIT,
        },
      },
      {
        osm: { type: 'way', id: 49967616 },
        categoryOverride: 'other',
        geofenceRadiusM: 60,
        commonsImage: 'Yunnan Garden Pavilion.jpeg',
        description: {
          text: 'Yunnan Garden was once the heart of Nanyang University and today sits within the campus of Nanyang Technological University. '
            + 'Its lawns, bamboo, streams and pavilions, together with the Nanyang University Memorial, form a heritage precinct of about nine hectares. '
            + 'The rejuvenated garden opened on 13 February 2020, with more than a thousand new trees and a waterfall joining it to Nanyang Lake.',
          credit: NARRATION_CREDIT,
        },
      },
    ],
  },
];
