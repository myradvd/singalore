import Fuse, { type IFuseOptions } from 'fuse.js';
import type { CatalogLandmark, CatalogPark } from '@singalore/shared';
import type { CatalogSnapshot } from './types';

export const SEARCH_EMPTY_MESSAGE = 'No matching locations found. Try a different search.';
export const SEARCH_MINIMUM_QUERY_LENGTH = 2;

interface SearchDocument
{
  kind: 'park' | 'landmark';
  id: string;
  name: string;
  aliases: string[];
  category: string;
  parkName: string;
  district: string;
}

export interface SearchResults
{
  parks: CatalogPark[];
  landmarks: CatalogLandmark[];
}

const FUSE_OPTIONS: IFuseOptions<SearchDocument> = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.38,
  minMatchCharLength: 2,
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'aliases', weight: 0.25 },
    { name: 'parkName', weight: 0.1 },
    { name: 'district', weight: 0.08 },
    { name: 'category', weight: 0.07 },
  ],
};

export class SearchIndex
{
  private readonly fuse: Fuse<SearchDocument>;
  private readonly parksById: Map<string, CatalogPark>;
  private readonly landmarksById: Map<string, CatalogLandmark>;

  constructor(snapshot: CatalogSnapshot)
  {
    this.parksById = new Map(snapshot.parks.map((park) => [park.id, park]));
    this.landmarksById = new Map(snapshot.landmarks.map((landmark) => [landmark.id, landmark]));
    const documents: SearchDocument[] = [
      ...snapshot.parks.map((park) => ({ kind: 'park' as const, id: park.id, name: park.name, aliases: [], category: 'park', parkName: park.name, district: park.district })),
      ...snapshot.landmarks.map((landmark) =>
      {
        const park = this.parksById.get(landmark.parkId);
        return {
          kind: 'landmark' as const,
          id: landmark.id,
          name: landmark.name,
          aliases: landmark.aliases,
          category: landmark.category,
          parkName: park?.name ?? '',
          district: park?.district ?? '',
        };
      }),
    ];
    this.fuse = new Fuse(documents, FUSE_OPTIONS);
  }

  search(query: string, limit = 20): SearchResults
  {
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MINIMUM_QUERY_LENGTH)
    {
      return { parks: [], landmarks: [] };
    }
    const results: SearchResults = { parks: [], landmarks: [] };
    for (const match of this.fuse.search(trimmed, { limit }))
    {
      if (match.item.kind === 'park')
      {
        const park = this.parksById.get(match.item.id);
        if (park !== undefined)
        {
          results.parks.push(park);
        }
      }
      else
      {
        const landmark = this.landmarksById.get(match.item.id);
        if (landmark !== undefined)
        {
          results.landmarks.push(landmark);
        }
      }
    }
    return results;
  }
}
