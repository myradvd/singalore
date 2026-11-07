import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_IMAGES_DIRECTORY, SEED_NARRATION_DIRECTORY, type AudioManifestEntry, type SeedContent } from './seed-types';

const seedEnvFile = process.env.SEED_TARGET === 'hosted' ? '.env.hosted' : '.env.local';
const env = z.object({ SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(20) })
  .parse(parseEnv(readFileSync(path.resolve(import.meta.dirname, '..', 'apps', 'cms', seedEnvFile), 'utf8')));

interface DbLandmark
{
  slug: string;
  description: string;
  short_description: string;
  image_path: string | null;
  park: { slug: string } | null;
  podcasts: { id: string }[];
}

interface DbPark
{
  slug: string;
  description: string;
  thumbnail_path: string | null;
}

function mark(value: boolean): string
{
  return value ? 'yes' : 'NO';
}

function printTable(header: string[], rows: string[][]): void
{
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)));
  const line = (cells: string[]): string => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ');
  console.log(line(header));
  for (const row of rows)
  {
    console.log(line(row));
  }
}

async function main(): Promise<void>
{
  const content = JSON.parse(readFileSync(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  const manifest = JSON.parse(readFileSync(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), 'utf8')) as AudioManifestEntry[];
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: dbParks, error: parkError } = await client.from('heritage_parks').select('slug, description, thumbnail_path');
  if (parkError !== null)
  {
    throw parkError;
  }
  const { data: dbLandmarks, error: landmarkError } = await client.from('heritage_landmarks')
    .select('slug, description, short_description, image_path, park:heritage_parks(slug), podcasts(id)');
  if (landmarkError !== null)
  {
    throw landmarkError;
  }
  const parksBySlug = new Map((dbParks as DbPark[]).map((park) => [park.slug, park]));
  const landmarksBySlug = new Map((dbLandmarks as unknown as DbLandmark[]).map((landmark) => [landmark.slug, landmark]));
  const imageExists = (file: string | null): boolean => file !== null && existsSync(path.join(SEED_IMAGES_DIRECTORY, file));

  console.log(`Seed file fetched ${content.fetchedAt}, database ${env.SUPABASE_URL}\n`);
  console.log('Parks (seed file / database)');
  printTable(['park', 'description', 'short description', 'cover image'], content.parks.map((park) =>
  {
    const db = parksBySlug.get(park.slug);
    return [
      park.slug,
      `${mark(park.description.length > 0)} / ${db === undefined ? 'missing' : mark(db.description.length > 0)}`,
      `${mark(park.shortDescription.length > 0)} / n.a.`,
      `${mark(imageExists(park.thumbnailFile))} / ${db === undefined ? 'missing' : mark(db.thumbnail_path !== null)}`,
    ];
  }));

  console.log('\nPlaces (seed file / database)');
  const placeRows = content.parks.flatMap((park) => park.landmarks.map((landmark) =>
  {
    const db = landmarksBySlug.get(landmark.slug);
    const episodes = manifest.filter((entry) => entry.landmarkSlug === landmark.slug).length;
    return [
      park.slug,
      landmark.slug,
      `${mark(landmark.description.length > 0)} / ${db === undefined ? 'missing' : mark(db.description.length > 0)}`,
      `${mark(landmark.shortDescription.length > 0)} / ${db === undefined ? 'missing' : mark(db.short_description.length > 0)}`,
      `${mark(imageExists(landmark.imageFile))} / ${db === undefined ? 'missing' : mark(db.image_path !== null)}`,
      mark(existsSync(path.join(SEED_NARRATION_DIRECTORY, `${landmark.slug}.md`))),
      `${episodes} / ${db === undefined ? 'missing' : db.podcasts.length}`,
    ];
  }));
  printTable(['park', 'place', 'description', 'short description', 'image file', 'script', 'podcasts'], placeRows);

  const seedSlugs = new Set(content.parks.flatMap((park) => park.landmarks.map((landmark) => landmark.slug)));
  const dbOnly = [...landmarksBySlug.values()].filter((landmark) => !seedSlugs.has(landmark.slug));
  const seedParkSlugs = new Set(content.parks.map((park) => park.slug));
  const dbOnlyParks = [...parksBySlug.keys()].filter((slug) => !seedParkSlugs.has(slug));
  console.log(`\nIn the database but not the seed file: ${dbOnly.map((landmark) => `${landmark.slug} (${landmark.park?.slug ?? '?'})`).join(', ') || 'none'}`);
  if (dbOnlyParks.length > 0)
  {
    console.log(`Parks in the database but not the seed file: ${dbOnlyParks.join(', ')}`);
  }

  const places = content.parks.flatMap((park) => park.landmarks);
  const count = (test: (landmark: (typeof places)[number]) => boolean): number => places.filter(test).length;
  console.log(`\nSeed file totals: ${content.parks.length} parks, ${places.length} places, `
    + `${count((landmark) => landmark.description.length > 0)} descriptions, `
    + `${count((landmark) => imageExists(landmark.imageFile))} images, `
    + `${count((landmark) => existsSync(path.join(SEED_NARRATION_DIRECTORY, `${landmark.slug}.md`)))} scripts, `
    + `${count((landmark) => manifest.some((entry) => entry.landmarkSlug === landmark.slug))} places with podcasts (${manifest.length} episodes)`);
  console.log(`Database totals: ${parksBySlug.size} parks, ${landmarksBySlug.size} places`);
}

await main();
