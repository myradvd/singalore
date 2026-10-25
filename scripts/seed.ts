import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseBuffer } from 'music-metadata';
import { z } from 'zod';
import type { AudioManifestEntry } from './demo-audio';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_IMAGES_DIRECTORY, type SeedContent } from './seed-types';

process.loadEnvFile(path.resolve(import.meta.dirname, '..', 'apps', 'cms', '.env.local'));

const Env = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(12),
});
const env = Env.parse(process.env);
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
  else
  {
    const { error } = await client.auth.admin.updateUserById(user.id, { password: env.SEED_ADMIN_PASSWORD });
    if (error !== null)
    {
      throw error;
    }
  }
  const { error } = await client.from('content_managers').upsert({ user_id: user.id, display_name: 'Local admin', role: 'admin' });
  if (error !== null)
  {
    throw error;
  }
}

async function main(): Promise<void>
{
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const content = JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  const manifest = JSON.parse(await readFile(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), 'utf8')) as AudioManifestEntry[];

  await ensureAdmin(client);

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

      const { error: deleteError } = await client.from('podcasts').delete().eq('landmark_id', landmarkRow.id);
      if (deleteError !== null)
      {
        throw deleteError;
      }
      for (const entry of manifest.filter((candidate) => candidate.landmarkSlug === landmark.slug))
      {
        const bytes = await readFile(path.join(SEED_AUDIO_DIRECTORY, entry.fileName));
        const metadata = await parseBuffer(bytes, { mimeType: 'audio/mp4' }, { duration: true });
        const durationSeconds = Math.max(1, Math.round(metadata.format.duration ?? 0));
        const audioPath = `audio/${entry.fileName}`;
        await upload(client, audioPath, bytes, 'audio/mp4');
        const { error: podcastError } = await client.from('podcasts').insert({
          landmark_id: landmarkRow.id,
          title: `${landmark.name}: a short history`,
          audio_path: audioPath,
          duration_seconds: durationSeconds,
          file_size_bytes: bytes.byteLength,
          checksum_sha256: createHash('sha256').update(bytes).digest('hex'),
          checksum_md5: createHash('md5').update(bytes).digest('hex'),
          transcript: entry.transcript,
          voice: entry.voice,
          accent: entry.accent,
          length_class: durationSeconds < 60 ? 'short' : durationSeconds < 300 ? 'standard' : 'long',
          status: 'published',
        });
        if (podcastError !== null)
        {
          throw podcastError;
        }
      }
    }
    console.log(`Seeded ${park.name}: ${park.landmarks.length} landmarks`);
  }
}

await main();
