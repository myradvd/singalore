import type { CatalogLandmark, CatalogPark, CatalogPodcast } from '@singalore/shared';

export interface CatalogSnapshot
{
  parks: CatalogPark[];
  landmarks: CatalogLandmark[];
  podcasts: CatalogPodcast[];
}

export const EMPTY_CATALOG: CatalogSnapshot = { parks: [], landmarks: [], podcasts: [] };
