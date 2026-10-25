import { z } from 'zod';
import type { BoundingBox } from '@singalore/shared';
import { fetchJson, type FetchJsonOptions } from './http';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

const Element = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
const OverpassResponse = z.object({ elements: z.array(z.unknown()) });

export interface OverpassPlace
{
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  latitude: number;
  longitude: number;
  wikidataId: string | null;
  tags: Record<string, string>;
}

function bboxClause(box: BoundingBox): string
{
  return `(${box.minLat},${box.minLng},${box.maxLat},${box.maxLng})`;
}

export function buildHeritageQuery(box: BoundingBox): string
{
  const clause = bboxClause(box);
  return [
    '[out:json][timeout:60];',
    '(',
    `  nwr["historic"]["name"]${clause};`,
    `  nwr["heritage"]["name"]${clause};`,
    `  nwr["tourism"="museum"]["name"]${clause};`,
    `  nwr["building"~"^(temple|mosque|church|cathedral|shrine)$"]["name"]${clause};`,
    `  nwr["amenity"="place_of_worship"]["name"]["wikidata"]${clause};`,
    ');',
    'out tags center;',
  ].join('\n');
}

export function buildWikidataLookupQuery(qids: readonly string[], box: BoundingBox): string
{
  const pattern = qids.map((qid) => qid.replace(/[^Q0-9]/g, '')).join('|');
  return `[out:json][timeout:60];nwr["wikidata"~"^(${pattern})$"]${bboxClause(box)};out tags center;`;
}

export function parseOverpassResponse(raw: unknown): OverpassPlace[]
{
  const response = OverpassResponse.parse(raw);
  const places: OverpassPlace[] = [];
  for (const candidate of response.elements)
  {
    const parsed = Element.safeParse(candidate);
    if (!parsed.success)
    {
      continue;
    }
    const element = parsed.data;
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const name = tags['name:en'] ?? tags.name;
    if (latitude === undefined || longitude === undefined || name === undefined || name.trim().length === 0)
    {
      continue;
    }
    const wikidata = tags.wikidata;
    places.push({
      osmType: element.type,
      osmId: element.id,
      name: name.trim(),
      latitude,
      longitude,
      wikidataId: wikidata !== undefined && /^Q\d+$/.test(wikidata) ? wikidata : null,
      tags,
    });
  }
  return places;
}

export async function queryOverpass(query: string, options: FetchJsonOptions & { endpoints?: readonly string[] } = {}): Promise<OverpassPlace[]>
{
  const endpoints = options.endpoints ?? OVERPASS_ENDPOINTS;
  let lastError: unknown = null;
  for (const endpoint of endpoints)
  {
    try
    {
      const raw = await fetchJson(endpoint, {
        ...options,
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: options.timeoutMs ?? 70000,
        retries: options.retries ?? 1,
      });
      return parseOverpassResponse(raw);
    }
    catch (error)
    {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed');
}
