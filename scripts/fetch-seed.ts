import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import {
  buildLandmarkDraft,
  buildWikidataLookupQuery,
  bufferedHullPolygon,
  fetchCommonsImage,
  fetchOsmPlace,
  fetchWikidataEntities,
  fetchWikidataLabels,
  fetchWikipediaSummary,
  INGEST_USER_AGENT,
  queryOverpass,
  cleanExtract,
  firstSentences,
  type LandmarkDraft,
  type OverpassPlace,
  type WikidataEntitySummary,
} from '@singalore/ingest';
import { GEOFENCE_RADIUS_MAX_M, GEOFENCE_RADIUS_MIN_M, SINGAPORE_BBOX, isInsideBoundingBox } from '@singalore/shared';
import { SEED_PARKS, type SeedLandmarkSource, type SeedParkSpec } from './seed-spec';
import { SEED_IMAGES_DIRECTORY, SEED_CONTENT_PATH, type SeedContent, type SeedLandmark, type SeedPark } from './seed-types';

const IMAGE_WIDTH = 800;

async function downloadImage(url: string, fileName: string): Promise<string>
{
  await mkdir(SEED_IMAGES_DIRECTORY, { recursive: true });
  const target = path.join(SEED_IMAGES_DIRECTORY, fileName);
  const response = await fetch(url, { headers: { 'User-Agent': INGEST_USER_AGENT } });
  if (!response.ok || response.body === null)
  {
    throw new Error(`Image download failed ${response.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return fileName;
}

function imageExtension(mime: string | null, url: string): string
{
  if (mime === 'image/png' || url.toLowerCase().endsWith('.png'))
  {
    return 'png';
  }
  return 'jpg';
}

function selectParks(parkSlug: string | undefined): typeof SEED_PARKS
{
  if (parkSlug === undefined)
  {
    return SEED_PARKS;
  }
  const selected = SEED_PARKS.filter((park) => park.slug === parkSlug);
  if (selected.length === 0)
  {
    throw new Error(`Unknown park slug ${parkSlug}. Known slugs: ${SEED_PARKS.map((park) => park.slug).join(', ')}`);
  }
  return selected;
}

function mergeParks(existing: readonly SeedPark[], fetched: readonly SeedPark[]): SeedPark[]
{
  const bySlug = new Map(existing.map((park) => [park.slug, park]));
  for (const park of fetched)
  {
    bySlug.set(park.slug, park);
  }
  const order = SEED_PARKS.map((park) => park.slug);
  return [...bySlug.values()].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

interface Lookups
{
  entities: Map<string, WikidataEntitySummary>;
  osmByWikidata: Map<string, OverpassPlace>;
  osmById: Map<string, OverpassPlace>;
  styleLabels: Map<string, string>;
}

async function fetchLookups(sources: readonly SeedLandmarkSource[], overpassRequired: boolean): Promise<Lookups>
{
  const allQids = sources.flatMap((source) => (source.wikidataId !== undefined ? [source.wikidataId] : []));
  console.log(`Fetching ${allQids.length} Wikidata entities`);
  const entities = await fetchWikidataEntities(allQids);

  console.log('Looking up OpenStreetMap features');
  const osmByWikidata = new Map<string, OverpassPlace>();
  try
  {
    for (const place of await queryOverpass(buildWikidataLookupQuery(allQids, SINGAPORE_BBOX), { timeoutMs: 40000 }))
    {
      if (place.wikidataId !== null && !osmByWikidata.has(place.wikidataId))
      {
        osmByWikidata.set(place.wikidataId, place);
      }
    }
  }
  catch (error)
  {
    if (overpassRequired)
    {
      throw new Error(`Overpass lookup failed, try again so committed OSM ids are kept: ${String(error)}`);
    }
    console.warn(`Overpass lookup failed, OSM ids will be left empty for Wikidata landmarks: ${String(error)}`);
  }
  const osmById = new Map<string, OverpassPlace>();
  for (const source of sources)
  {
    if (source.osm === undefined)
    {
      continue;
    }
    if (source.osm.type === 'relation')
    {
      throw new Error('Relations are not supported by the seed fetcher');
    }
    const place = await fetchOsmPlace(source.osm.type, source.osm.id);
    if (place === null)
    {
      throw new Error(`OSM ${source.osm.type} ${source.osm.id} not found`);
    }
    osmById.set(`${place.osmType}/${place.osmId}`, place);
  }

  const styleQids = [...new Set([...entities.values()].flatMap((entity) => entity.architecturalStyleQids))];
  const styleLabels = await fetchWikidataLabels(styleQids);
  return { entities, osmByWikidata, osmById, styleLabels };
}

async function buildSeedLandmark(parkSlug: string, source: SeedLandmarkSource, index: number, lookups: Lookups): Promise<SeedLandmark>
{
  const wikidata = source.wikidataId !== undefined ? lookups.entities.get(source.wikidataId) ?? null : null;
  const osm = source.osm !== undefined
    ? lookups.osmById.get(`${source.osm.type}/${source.osm.id}`) ?? null
    : (source.wikidataId !== undefined ? lookups.osmByWikidata.get(source.wikidataId) ?? null : null);
  const wikipedia = source.description === undefined && wikidata?.englishWikipediaTitle !== null && wikidata?.englishWikipediaTitle !== undefined
    ? await fetchWikipediaSummary(wikidata.englishWikipediaTitle)
    : null;
  const imageFileName = source.commonsImage ?? wikidata?.imageFileName ?? null;
  const image = imageFileName !== null ? await fetchCommonsImage(imageFileName, IMAGE_WIDTH) : null;
  if (source.commonsImage !== undefined && image === null)
  {
    throw new Error(`Commons file ${source.commonsImage} not found`);
  }
  const draft: LandmarkDraft | null = buildLandmarkDraft({
    wikidata,
    wikipedia,
    osm,
    image,
    styleLabels: (wikidata?.architecturalStyleQids ?? []).flatMap((qid) => lookups.styleLabels.get(qid) ?? []),
    ...(source.nameOverride !== undefined ? { nameOverride: source.nameOverride } : {}),
  });
  if (draft === null || !isInsideBoundingBox({ lat: draft.lat, lng: draft.lng }, SINGAPORE_BBOX))
  {
    throw new Error(`Could not build a landmark for ${JSON.stringify(source)}`);
  }
  const geofenceRadiusM = source.geofenceRadiusM ?? draft.geofenceRadiusM;
  if (!Number.isInteger(geofenceRadiusM) || geofenceRadiusM < GEOFENCE_RADIUS_MIN_M || geofenceRadiusM > GEOFENCE_RADIUS_MAX_M)
  {
    throw new Error(`Geofence radius ${geofenceRadiusM} for ${draft.name} is outside ${GEOFENCE_RADIUS_MIN_M} to ${GEOFENCE_RADIUS_MAX_M} m`);
  }
  let imageFile: string | null = null;
  if (draft.image !== null)
  {
    imageFile = await downloadImage(draft.image.thumbnailUrl, `${draft.slug}.${imageExtension(draft.image.mime, draft.image.thumbnailUrl)}`);
  }
  const text = source.description === undefined
    ? {}
    : { description: source.description.text, shortDescription: firstSentences(source.description.text, 220), attribution: `${source.description.credit} ${draft.attribution}` };
  console.log(`  ${parkSlug}: ${draft.name} (${draft.category}) ${imageFile !== null ? 'with image' : 'no image'}`);
  return { ...draft, ...text, category: source.categoryOverride ?? draft.category, geofenceRadiusM, sortOrder: index, imageFile };
}

async function buildPark(parkSpec: SeedParkSpec, lookups: Lookups): Promise<SeedPark>
{
  const landmarks: SeedLandmark[] = [];
  for (const [index, source] of parkSpec.landmarks.entries())
  {
    landmarks.push(await buildSeedLandmark(parkSpec.slug, source, index, lookups));
  }
  const parkSummary = await fetchWikipediaSummary(parkSpec.wikipediaTitle);
  const boundary = bufferedHullPolygon(landmarks.map((landmark) => ({ lat: landmark.lat, lng: landmark.lng })), 60);
  const centerLat = landmarks.reduce((sum, landmark) => sum + landmark.lat, 0) / landmarks.length;
  const centerLng = landmarks.reduce((sum, landmark) => sum + landmark.lng, 0) / landmarks.length;
  const description = cleanExtract(parkSummary?.extract ?? '');
  return {
    slug: parkSpec.slug,
    name: parkSpec.name,
    district: parkSpec.district,
    description,
    shortDescription: firstSentences(description, 220),
    centerLat,
    centerLng,
    boundary,
    attribution: [
      parkSummary !== null ? `Text adapted from Wikipedia article "${parkSummary.title}" (${parkSummary.pageUrl}), CC BY-SA 4.0.` : '',
      'Boundary is the area around the landmarks, derived from their positions, not an official boundary.',
    ].filter((part) => part.length > 0).join(' '),
    thumbnailFile: landmarks.find((landmark) => landmark.imageFile !== null)?.imageFile ?? null,
    landmarks,
  };
}

// Refetches only the named landmarks and keeps every other landmark and all park fields as committed.
async function refetchLandmarks(existing: SeedContent, slugs: readonly string[]): Promise<SeedPark[]>
{
  const targets = SEED_PARKS.flatMap((parkSpec) => parkSpec.landmarks.flatMap((source, index) =>
  {
    const current = existing.parks.find((park) => park.slug === parkSpec.slug)?.landmarks.find((landmark) => landmark.sortOrder === index);
    return current !== undefined && slugs.includes(current.slug) ? [{ parkSlug: parkSpec.slug, source, index, slug: current.slug }] : [];
  }));
  const missing = slugs.filter((slug) => !targets.some((target) => target.slug === slug));
  if (missing.length > 0)
  {
    throw new Error(`Not in seed-content.json at their spec position: ${missing.join(', ')}`);
  }
  const lookups = await fetchLookups(targets.map((target) => target.source), true);
  const parks = structuredClone(existing.parks);
  for (const target of targets)
  {
    const park = parks.find((candidate) => candidate.slug === target.parkSlug);
    const position = park?.landmarks.findIndex((landmark) => landmark.slug === target.slug) ?? -1;
    if (park === undefined || position < 0)
    {
      throw new Error(`Lost track of ${target.slug}`);
    }
    const landmark = await buildSeedLandmark(target.parkSlug, target.source, target.index, lookups);
    if (landmark.slug !== target.slug)
    {
      throw new Error(`Spec position ${target.index} in ${target.parkSlug} now builds ${landmark.slug}, not ${target.slug}`);
    }
    park.landmarks[position] = landmark;
    park.thumbnailFile ??= park.landmarks.find((candidate) => candidate.imageFile !== null)?.imageFile ?? null;
  }
  return parks;
}

async function main(): Promise<void>
{
  const args = process.argv.slice(2);
  const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',').filter((slug) => slug.length > 0);
  const parkSlug = args.find((arg) => !arg.startsWith('--'));
  let allParks: SeedPark[];
  if (only !== undefined)
  {
    if (parkSlug !== undefined)
    {
      throw new Error('Pass either a park slug or --only, not both');
    }
    allParks = await refetchLandmarks(JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent, only);
  }
  else
  {
    const selectedParks = selectParks(parkSlug);
    const lookups = await fetchLookups(selectedParks.flatMap((park) => park.landmarks), false);
    const parks: SeedPark[] = [];
    for (const parkSpec of selectedParks)
    {
      parks.push(await buildPark(parkSpec, lookups));
    }
    allParks = parkSlug === undefined
      ? parks
      : mergeParks((JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent).parks, parks);
  }
  const content: SeedContent = { fetchedAt: new Date().toISOString(), parks: allParks };
  await writeFile(SEED_CONTENT_PATH, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`Wrote ${SEED_CONTENT_PATH}`);
}

await main();
