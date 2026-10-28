import { GEOFENCE_RADIUS_DEFAULT_M, type LandmarkCategory } from '@singalore/shared';
import { categoryFromOsmTags, categoryFromWikidata } from './categories';
import type { CommonsImage } from './commons';
import type { OverpassPlace } from './overpass';
import { cleanExtract, firstSentences, slugify } from './text';
import type { WikidataEntitySummary } from './wikidata';
import type { WikipediaSummary } from './wikipedia';

/** Holds a landmark assembled from open data, ready for review before publication. */
export interface LandmarkDraft
{
  slug: string;
  name: string;
  aliases: string[];
  category: LandmarkCategory;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  shortDescription: string;
  description: string;
  builtYear: number | null;
  architecturalStyle: string | null;
  wikidataId: string | null;
  osmType: 'node' | 'way' | 'relation' | null;
  osmId: number | null;
  image: CommonsImage | null;
  attribution: string;
}

export interface DraftSources
{
  wikidata: WikidataEntitySummary | null;
  wikipedia: WikipediaSummary | null;
  osm: OverpassPlace | null;
  image: CommonsImage | null;
  styleLabels: readonly string[];
  nameOverride?: string;
}

/**
 * Creates source credits required by the relevant licences.
 * Covers Wikipedia (CC BY-SA), Wikidata (CC0), OpenStreetMap (ODbL), and Commons image licences.
 * @param sources - The sources used to prepare the landmark.
 * @returns A single string containing a credit sentence for each source.
 */
export function buildAttribution(sources: DraftSources): string
{
  const parts: string[] = [];
  if (sources.wikipedia !== null)
  {
    parts.push(`Text adapted from Wikipedia article "${sources.wikipedia.title}" (${sources.wikipedia.pageUrl}), CC BY-SA 4.0.`);
  }
  if (sources.wikidata !== null)
  {
    parts.push(`Facts from Wikidata ${sources.wikidata.qid} (https://www.wikidata.org/wiki/${sources.wikidata.qid}), CC0.`);
  }
  if (sources.osm !== null)
  {
    parts.push(`Location from OpenStreetMap ${sources.osm.osmType} ${sources.osm.osmId}, (c) OpenStreetMap contributors, ODbL.`);
  }
  if (sources.image !== null)
  {
    parts.push(`Image "${sources.image.fileName}" by ${sources.image.artist}, ${sources.image.license}, via Wikimedia Commons (${sources.image.descriptionUrl}).`);
  }
  return parts.join(' ');
}

/**
 * Assembles a landmark draft from Wikidata, Wikipedia, OpenStreetMap, and Commons.
 * Wikidata takes priority over OpenStreetMap for the name and position.
 * The description uses Wikipedia's summary when available, otherwise Wikidata's description.
 * The geofence radius starts at 30 metres.
 * @param sources - Data gathered for the location.
 * @returns The draft, or null if the name, latitude, or longitude could not be found.
 */
export function buildLandmarkDraft(sources: DraftSources): LandmarkDraft | null
{
  const latitude = sources.wikidata?.latitude ?? sources.osm?.latitude ?? null;
  const longitude = sources.wikidata?.longitude ?? sources.osm?.longitude ?? null;
  const name = sources.nameOverride ?? sources.wikidata?.label ?? sources.osm?.name ?? null;
  if (latitude === null || longitude === null || name === null)
  {
    return null;
  }
  const longText = cleanExtract(sources.wikipedia?.extract ?? sources.wikidata?.description ?? '');
  const category = categoryFromWikidata(sources.wikidata?.instanceOfQids ?? [])
    ?? (sources.osm !== null ? categoryFromOsmTags(sources.osm.tags) : 'other');
  const aliasSet = new Set<string>([...(sources.wikidata?.aliases ?? [])]);
  if (sources.osm !== null && sources.osm.name !== name)
  {
    aliasSet.add(sources.osm.name);
  }
  if (sources.wikidata !== null && sources.wikidata.label !== name)
  {
    aliasSet.add(sources.wikidata.label);
  }
  aliasSet.delete(name);
  return {
    slug: slugify(name),
    name,
    aliases: [...aliasSet].slice(0, 10),
    category,
    lat: latitude,
    lng: longitude,
    geofenceRadiusM: GEOFENCE_RADIUS_DEFAULT_M,
    shortDescription: firstSentences(longText, 220),
    description: longText,
    builtYear: sources.wikidata?.inceptionYear ?? null,
    architecturalStyle: sources.styleLabels.length > 0 ? sources.styleLabels.join(', ') : null,
    wikidataId: sources.wikidata?.qid ?? sources.osm?.wikidataId ?? null,
    osmType: sources.osm?.osmType ?? null,
    osmId: sources.osm?.osmId ?? null,
    image: sources.image,
    attribution: buildAttribution(sources),
  };
}
