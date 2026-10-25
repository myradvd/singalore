import { CatalogLandmark, CatalogPark, CatalogPodcast, GeoJsonPolygon, type CatalogResponse } from '@singalore/shared';
import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { CatalogSnapshot } from './types';

const ParkRow = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  district: z.string(),
  short_description: z.string(),
  center_lat: z.number(),
  center_lng: z.number(),
  boundary_json: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  landmark_count: z.number(),
  pack_bytes: z.number(),
  attribution: z.string(),
});
const LandmarkRow = z.object({
  id: z.string(),
  park_id: z.string(),
  slug: z.string(),
  name: z.string(),
  aliases_json: z.string(),
  category: z.string(),
  lat: z.number(),
  lng: z.number(),
  geofence_radius_m: z.number(),
  short_description: z.string(),
  thumbnail_url: z.string().nullable(),
  built_year: z.number().nullable(),
  architectural_style: z.string().nullable(),
  sort_order: z.number(),
  attribution: z.string(),
});
const PodcastRow = z.object({
  id: z.string(),
  landmark_id: z.string(),
  title: z.string(),
  audio_url: z.string(),
  duration_seconds: z.number(),
  file_size_bytes: z.number(),
  voice: z.string().nullable(),
  accent: z.string().nullable(),
  length_class: z.string().nullable(),
  has_transcript: z.number(),
});
const MetaRow = z.object({ value: z.string() });

function parseJsonSafely(text: string | null): unknown
{
  if (text === null)
  {
    return null;
  }
  try
  {
    return JSON.parse(text);
  }
  catch
  {
    return null;
  }
}

export class CatalogRepository
{
  constructor(private readonly db: DbAdapter)
  {
  }

  async getMeta(key: string): Promise<string | null>
  {
    const row = await this.db.first('select value from meta where key = ?', [key]);
    return row === null ? null : MetaRow.parse(row).value;
  }

  async setMeta(key: string, value: string): Promise<void>
  {
    await this.db.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', [key, value]);
  }

  async replaceAll(catalog: CatalogResponse, syncedAtIso: string): Promise<void>
  {
    await this.db.transaction(async (transaction) =>
    {
      await transaction.run('delete from podcasts');
      await transaction.run('delete from landmarks');
      await transaction.run('delete from parks');
      for (const park of catalog.parks)
      {
        await transaction.run(
          `insert into parks (id, slug, name, district, short_description, center_lat, center_lng, boundary_json, thumbnail_url,
            landmark_count, pack_bytes, attribution) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [park.id, park.slug, park.name, park.district, park.shortDescription, park.center.lat, park.center.lng,
            park.boundary === null ? null : JSON.stringify(park.boundary), park.thumbnailUrl, park.landmarkCount, park.packBytes, park.attribution],
        );
      }
      for (const landmark of catalog.landmarks)
      {
        await transaction.run(
          `insert into landmarks (id, park_id, slug, name, aliases_json, category, lat, lng, geofence_radius_m, short_description,
            thumbnail_url, built_year, architectural_style, sort_order, attribution) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [landmark.id, landmark.parkId, landmark.slug, landmark.name, JSON.stringify(landmark.aliases), landmark.category,
            landmark.position.lat, landmark.position.lng, landmark.geofenceRadiusM, landmark.shortDescription, landmark.thumbnailUrl,
            landmark.builtYear, landmark.architecturalStyle, landmark.sortOrder, landmark.attribution],
        );
      }
      for (const podcast of catalog.podcasts)
      {
        await transaction.run(
          `insert into podcasts (id, landmark_id, title, audio_url, duration_seconds, file_size_bytes, voice, accent, length_class,
            has_transcript) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [podcast.id, podcast.landmarkId, podcast.title, podcast.audioUrl, podcast.durationSeconds, podcast.fileSizeBytes,
            podcast.voice, podcast.accent, podcast.lengthClass, podcast.hasTranscript ? 1 : 0],
        );
      }
      await transaction.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', ['catalog_etag', catalog.etag]);
      await transaction.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', ['catalog_synced_at', syncedAtIso]);
    });
  }

  async load(): Promise<CatalogSnapshot>
  {
    const [parkRows, landmarkRows, podcastRows] = await Promise.all([
      this.db.all('select * from parks order by name'),
      this.db.all('select * from landmarks order by park_id, sort_order, name'),
      this.db.all('select * from podcasts order by landmark_id, id'),
    ]);
    const parks = z.array(ParkRow).parse(parkRows).map((row) =>
    {
      const boundary = GeoJsonPolygon.safeParse(parseJsonSafely(row.boundary_json));
      return CatalogPark.parse({
        id: row.id,
        slug: row.slug,
        name: row.name,
        district: row.district,
        shortDescription: row.short_description,
        center: { lat: row.center_lat, lng: row.center_lng },
        boundary: boundary.success ? boundary.data : null,
        thumbnailUrl: row.thumbnail_url,
        landmarkCount: row.landmark_count,
        packBytes: row.pack_bytes,
        attribution: row.attribution,
      });
    });
    const landmarks = z.array(LandmarkRow).parse(landmarkRows).map((row) => CatalogLandmark.parse({
      id: row.id,
      parkId: row.park_id,
      slug: row.slug,
      name: row.name,
      aliases: z.array(z.string()).catch([]).parse(parseJsonSafely(row.aliases_json)),
      category: row.category,
      position: { lat: row.lat, lng: row.lng },
      geofenceRadiusM: row.geofence_radius_m,
      shortDescription: row.short_description,
      thumbnailUrl: row.thumbnail_url,
      builtYear: row.built_year,
      architecturalStyle: row.architectural_style,
      sortOrder: row.sort_order,
      attribution: row.attribution,
    }));
    const podcasts = z.array(PodcastRow).parse(podcastRows).map((row) => CatalogPodcast.parse({
      id: row.id,
      landmarkId: row.landmark_id,
      title: row.title,
      audioUrl: row.audio_url,
      durationSeconds: row.duration_seconds,
      fileSizeBytes: row.file_size_bytes,
      voice: row.voice,
      accent: row.accent,
      lengthClass: row.length_class,
      hasTranscript: row.has_transcript === 1,
    }));
    return { parks, landmarks, podcasts };
  }
}
