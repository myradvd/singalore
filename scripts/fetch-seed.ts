import { writeFile, mkdir } from 'node:fs/promises';
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
} from '@singalore/ingest';
import { SINGAPORE_BBOX, isInsideBoundingBox } from '@singalore/shared';
import { SEED_PARKS } from './seed-spec';
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

async function main(): Promise<void>
{
  const allQids = SEED_PARKS.flatMap((park) => park.landmarks.flatMap((source) => (source.wikidataId !== undefined ? [source.wikidataId] : [])));
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
    console.warn(`Overpass lookup failed, OSM ids will be left empty for Wikidata landmarks: ${String(error)}`);
  }
  const osmById = new Map<string, OverpassPlace>();
  for (const source of SEED_PARKS.flatMap((park) => park.landmarks))
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

  const parks: SeedPark[] = [];
  for (const parkSpec of SEED_PARKS)
  {
    const landmarks: SeedLandmark[] = [];
    for (const [index, source] of parkSpec.landmarks.entries())
    {
      const wikidata = source.wikidataId !== undefined ? entities.get(source.wikidataId) ?? null : null;
      const osm = source.osm !== undefined
        ? osmById.get(`${source.osm.type}/${source.osm.id}`) ?? null
        : (source.wikidataId !== undefined ? osmByWikidata.get(source.wikidataId) ?? null : null);
      const wikipedia = wikidata?.englishWikipediaTitle !== null && wikidata?.englishWikipediaTitle !== undefined
        ? await fetchWikipediaSummary(wikidata.englishWikipediaTitle)
        : null;
      const image = wikidata?.imageFileName !== null && wikidata?.imageFileName !== undefined
        ? await fetchCommonsImage(wikidata.imageFileName, IMAGE_WIDTH)
        : null;
      const draft: LandmarkDraft | null = buildLandmarkDraft({
        wikidata,
        wikipedia,
        osm,
        image,
        styleLabels: (wikidata?.architecturalStyleQids ?? []).flatMap((qid) => styleLabels.get(qid) ?? []),
        ...(source.nameOverride !== undefined ? { nameOverride: source.nameOverride } : {}),
      });
      if (draft === null || !isInsideBoundingBox({ lat: draft.lat, lng: draft.lng }, SINGAPORE_BBOX))
      {
        throw new Error(`Could not build a landmark for ${JSON.stringify(source)}`);
      }
      let imageFile: string | null = null;
      if (draft.image !== null)
      {
        imageFile = await downloadImage(draft.image.thumbnailUrl, `${draft.slug}.${imageExtension(draft.image.mime, draft.image.thumbnailUrl)}`);
      }
      landmarks.push({ ...draft, category: source.categoryOverride ?? draft.category, sortOrder: index, imageFile });
      console.log(`  ${parkSpec.slug}: ${draft.name} (${draft.category}) ${imageFile !== null ? 'with image' : 'no image'}`);
    }
    const parkSummary = await fetchWikipediaSummary(parkSpec.wikipediaTitle);
    const boundary = bufferedHullPolygon(landmarks.map((landmark) => ({ lat: landmark.lat, lng: landmark.lng })), 60);
    const centerLat = landmarks.reduce((sum, landmark) => sum + landmark.lat, 0) / landmarks.length;
    const centerLng = landmarks.reduce((sum, landmark) => sum + landmark.lng, 0) / landmarks.length;
    const description = cleanExtract(parkSummary?.extract ?? '');
    parks.push({
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
    });
  }

  const content: SeedContent = { fetchedAt: new Date().toISOString(), parks };
  await writeFile(SEED_CONTENT_PATH, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`Wrote ${SEED_CONTENT_PATH}`);
}

await main();
