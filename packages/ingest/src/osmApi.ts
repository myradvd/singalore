import { z } from 'zod';
import { fetchJson, type FetchJsonOptions } from './http';
import type { OverpassPlace } from './overpass';

const OSM_API = 'https://api.openstreetmap.org/api/0.6';

const OsmElement = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
const OsmResponse = z.object({ elements: z.array(OsmElement) });

export function placeFromOsmApiResponse(raw: unknown, type: 'node' | 'way', id: number): OverpassPlace | null
{
  const response = OsmResponse.parse(raw);
  const target = response.elements.find((element) => element.type === type && element.id === id);
  if (target === undefined)
  {
    return null;
  }
  const nodes = response.elements.filter((element) => element.type === 'node' && element.lat !== undefined && element.lon !== undefined);
  const coordinateSource = type === 'node' ? [target] : nodes.filter((node) => node.id !== target.id);
  if (coordinateSource.length === 0)
  {
    return null;
  }
  const latitude = coordinateSource.reduce((sum, node) => sum + (node.lat ?? 0), 0) / coordinateSource.length;
  const longitude = coordinateSource.reduce((sum, node) => sum + (node.lon ?? 0), 0) / coordinateSource.length;
  const tags = target.tags ?? {};
  const name = tags['name:en'] ?? tags.name;
  if (name === undefined)
  {
    return null;
  }
  const wikidata = tags.wikidata;
  return {
    osmType: type,
    osmId: id,
    name,
    latitude,
    longitude,
    wikidataId: wikidata !== undefined && /^Q\d+$/.test(wikidata) ? wikidata : null,
    tags,
  };
}

export async function fetchOsmPlace(type: 'node' | 'way', id: number, options: FetchJsonOptions = {}): Promise<OverpassPlace | null>
{
  const url = type === 'node' ? `${OSM_API}/node/${id}.json` : `${OSM_API}/way/${id}/full.json`;
  return placeFromOsmApiResponse(await fetchJson(url, options), type, id);
}
