import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { audioChecksumProblem, durationProblem, planPodcastSync, podcastRow, type PodcastRow } from './podcast-lib';
import { REMOVED_LANDMARK_SLUGS, SEED_AUDIO_SOURCE_URL } from './seed-spec';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_IMAGES_DIRECTORY, type AudioManifestEntry, type SeedContent } from './seed-types';

// SEED_TARGET=hosted seeds the online Supabase project from apps/cms/.env.hosted instead of the local one.
const seedEnvFile = process.env.SEED_TARGET === 'hosted' ? '.env.hosted' : '.env.local';
// The file wins over the shell, so an exported SUPABASE_URL cannot send the seed to the wrong project.
const seedEnv = parseEnv(readFileSync(path.resolve(import.meta.dirname, '..', 'apps', 'cms', seedEnvFile), 'utf8'));

const Env = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(12),
});
const env = Env.parse(seedEnv);
const MEDIA_BUCKET = 'media';

function contentTypeFor(fileName: string): string
{
  if (fileName.endsWith('.png'))
  {
    return 'image/png';
  }
  if (fileName.endsWith('.m4a'))
  {
    return 'audio/mp4';
  }
  return 'image/jpeg';
}

async function upload(client: SupabaseClient, objectPath: string, bytes: Buffer, contentType: string): Promise<void>
{
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(objectPath, bytes, { contentType, upsert: true, cacheControl: '31536000' });
  if (error !== null)
  {
    throw new Error(`Upload failed for ${objectPath}: ${error.message}`);
  }
}

async function ensureAdmin(client: SupabaseClient): Promise<void>
{
  const { data: list, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError !== null)
  {
    throw listError;
  }
  let user = list.users.find((candidate) => candidate.email === env.SEED_ADMIN_EMAIL);
  if (user === undefined)
  {
    const { data, error } = await client.auth.admin.createUser({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, email_confirm: true });
    if (error !== null)
    {
      throw error;
    }
    user = data.user;
  }
  const { error } = await client.from('content_managers').upsert({ user_id: user.id, display_name: 'Local admin', role: 'admin' }, { ignoreDuplicates: true });
  if (error !== null)
  {
    throw error;
  }
}

function checkEpisodes(manifest: AudioManifestEntry[]): void
{
  for (const entry of manifest)
  {
    const problem = durationProblem(entry.durationSeconds);
    if (problem !== null)
    {
      throw new Error(`${entry.fileName}: ${problem}`);
    }
  }
}

// File names contain the content hash, so an object with the same name already holds the same audio.
async function uploadedAudioFiles(client: SupabaseClient): Promise<Set<string>>
{
  const names = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize)
  {
    const { data, error } = await client.storage.from(MEDIA_BUCKET).list('audio', { limit: pageSize, offset });
    if (error !== null)
    {
      throw new Error(`Could not list uploaded audio: ${error.message}`);
    }
    for (const file of data)
    {
      names.add(file.name);
    }
    if (data.length < pageSize)
    {
      return names;
    }
  }
}

async function episodeBytes(entry: AudioManifestEntry): Promise<Buffer>
{
  const localPath = path.join(SEED_AUDIO_DIRECTORY, entry.fileName);
  let bytes: Buffer;
  if (existsSync(localPath))
  {
    bytes = await readFile(localPath);
  }
  else
  {
    const response = await fetch(`${SEED_AUDIO_SOURCE_URL}/${encodeURIComponent(entry.fileName)}`);
    if (!response.ok)
    {
      throw new Error(`${entry.fileName} is not on this computer or in the audio source (${response.status}). Run npm run seed:audio to generate it.`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const problem = audioChecksumProblem(bytes, entry);
  if (problem !== null)
  {
    throw new Error(`${entry.fileName}: ${problem}`);
  }
  return bytes;
}

async function main(): Promise<void>
{
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const content = JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  const manifest = JSON.parse(await readFile(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), 'utf8')) as AudioManifestEntry[];

  checkEpisodes(manifest);
  console.log(`Seeding ${env.SUPABASE_URL} from apps/cms/${seedEnvFile}`);
  await ensureAdmin(client);
  const uploaded = await uploadedAudioFiles(client);

  const { data: removed, error: removeError } = await client.from('heritage_landmarks').delete().in('slug', REMOVED_LANDMARK_SLUGS).select('slug');
  if (removeError !== null)
  {
    throw removeError;
  }
  console.log(`Removed ${removed.length} retired landmarks`);

  for (const park of content.parks)
  {
    let parkThumbnailPath: string | null = null;
    let parkThumbnailBytes: number | null = null;
    if (park.thumbnailFile !== null)
    {
      parkThumbnailPath = `images/parks/${park.slug}${path.extname(park.thumbnailFile)}`;
      const bytes = await readFile(path.join(SEED_IMAGES_DIRECTORY, park.thumbnailFile));
      parkThumbnailBytes = bytes.byteLength;
      await upload(client, parkThumbnailPath, bytes, contentTypeFor(park.thumbnailFile));
    }
    const { data: parkRow, error: parkError } = await client.from('heritage_parks').upsert({
      slug: park.slug,
      name: park.name,
      district: park.district,
      description: park.description,
      center_lat: park.centerLat,
      center_lng: park.centerLng,
      boundary: park.boundary,
      thumbnail_path: parkThumbnailPath,
      thumbnail_bytes: parkThumbnailBytes,
      attribution: park.attribution,
      status: 'published',
    }, { onConflict: 'slug' }).select('id').single();
    if (parkError !== null)
    {
      throw parkError;
    }

    for (const landmark of park.landmarks)
    {
      let imagePath: string | null = null;
      let imageBytes: number | null = null;
      if (landmark.imageFile !== null)
      {
        imagePath = `images/landmarks/${landmark.imageFile}`;
        const bytes = await readFile(path.join(SEED_IMAGES_DIRECTORY, landmark.imageFile));
        imageBytes = bytes.byteLength;
        await upload(client, imagePath, bytes, contentTypeFor(landmark.imageFile));
      }
      const { data: landmarkRow, error: landmarkError } = await client.from('heritage_landmarks').upsert({
        park_id: parkRow.id,
        slug: landmark.slug,
        name: landmark.name,
        aliases: landmark.aliases,
        category: landmark.category,
        lat: landmark.lat,
        lng: landmark.lng,
        geofence_radius_m: landmark.geofenceRadiusM,
        short_description: landmark.shortDescription,
        description: landmark.description,
        thumbnail_path: imagePath,
        image_path: imagePath,
        image_bytes: imageBytes,
        built_year: landmark.builtYear,
        architectural_style: landmark.architecturalStyle,
        wikidata_id: landmark.wikidataId,
        osm_type: landmark.osmType,
        osm_id: landmark.osmId,
        attribution: landmark.attribution,
        sort_order: landmark.sortOrder,
        status: 'published',
      }, { onConflict: 'slug' }).select('id').single();
      if (landmarkError !== null)
      {
        throw landmarkError;
      }

      const rows: PodcastRow[] = [];
      for (const entry of manifest.filter((candidate) => candidate.landmarkSlug === landmark.slug))
      {
        const row = podcastRow(entry);
        if (!uploaded.has(entry.fileName))
        {
          await upload(client, row.audio_path, await episodeBytes(entry), 'audio/mp4');
        }
        rows.push(row);
      }

      const { data: existing, error: existingError } = await client.from('podcasts').select('id, audio_path, voice, accent').eq('landmark_id', landmarkRow.id);
      if (existingError !== null)
      {
        throw existingError;
      }
      const plan = planPodcastSync(landmark.slug, existing, rows);
      for (const { id, row } of plan.writes)
      {
        const { error: podcastError } = id === null
          ? await client.from('podcasts').insert({ landmark_id: landmarkRow.id, ...row })
          : await client.from('podcasts').update(row).eq('id', id);
        if (podcastError !== null)
        {
          throw podcastError;
        }
      }
      if (plan.deleteIds.length > 0)
      {
        const { error: deleteError } = await client.from('podcasts').delete().in('id', plan.deleteIds);
        if (deleteError !== null)
        {
          throw deleteError;
        }
      }
    }
    console.log(`Seeded ${park.name}: ${park.landmarks.length} landmarks`);
  }
}

await main();
