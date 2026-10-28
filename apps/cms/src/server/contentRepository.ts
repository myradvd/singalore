import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LANDMARK_CATEGORIES } from '@singalore/shared';
import { z } from 'zod';
import type { AudioAnalysis } from './audioAnalysis';
import { databaseErrorMessage, type LandmarkForm, type PodcastForm } from './contentForms';

export const MEDIA_BUCKET = 'media';

const Status = z.enum(['draft', 'published']);
export type ContentStatus = z.infer<typeof Status>;

export const ParkSummary = z.object({ id: z.uuid(), name: z.string(), status: Status });
export type ParkSummary = z.infer<typeof ParkSummary>;

export const LandmarkSummary = z.object({ id: z.uuid(), park_id: z.uuid(), name: z.string(), status: Status, updated_at: z.string() });
export type LandmarkSummary = z.infer<typeof LandmarkSummary>;

export const LandmarkRecord = z.object({
  id: z.uuid(),
  park_id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  category: z.enum(LANDMARK_CATEGORIES),
  lat: z.number(),
  lng: z.number(),
  geofence_radius_m: z.number().int(),
  short_description: z.string(),
  description: z.string(),
  built_year: z.number().int().nullable(),
  architectural_style: z.string().nullable(),
  status: Status,
});
export type LandmarkRecord = z.infer<typeof LandmarkRecord>;

export const PodcastRecord = z.object({
  id: z.uuid(),
  landmark_id: z.uuid(),
  title: z.string(),
  audio_path: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  file_size_bytes: z.number().int().nullable(),
  voice: z.string().nullable(),
  accent: z.string().nullable(),
  transcript: z.string().nullable(),
  status: Status,
});
export type PodcastRecord = z.infer<typeof PodcastRecord>;

/** Represents an error with a message that is safe to display in the CMS. */
export class ContentError extends Error
{
}

type AuditEntity = 'park' | 'landmark' | 'podcast';
type AuditAction = 'create' | 'update' | 'publish' | 'unpublish';

function check<Value>(result: { data: Value; error: { code?: string; message: string } | null }): Value
{
  if (result.error !== null)
  {
    throw new ContentError(databaseErrorMessage(result.error));
  }
  return result.data;
}

function landmarkColumns(form: LandmarkForm)
{
  return {
    park_id: form.parkId,
    slug: form.slug,
    name: form.name,
    category: form.category,
    lat: form.lat,
    lng: form.lng,
    geofence_radius_m: form.geofenceRadiusM,
    short_description: form.shortDescription,
    description: form.description,
    built_year: form.builtYear,
    architectural_style: form.architecturalStyle,
  };
}

const LANDMARK_SELECT = 'id, park_id, slug, name, category, lat, lng, geofence_radius_m, short_description, description, built_year, architectural_style, status';
const PODCAST_SELECT = 'id, landmark_id, title, audio_path, duration_seconds, file_size_bytes, voice, accent, transcript, status';

/**
 * Manages landmark and podcast data for the CMS.
 * Writes an audit record whenever content is created, edited, or its status changes,
 * so each change can be traced to the content manager who made it.
 */
export class ContentRepository
{
  /**
   * @param client - Supabase client configured with the server-only service role key.
   * @param userId - ID of the signed-in manager whose actions will be logged.
   */
  constructor(private readonly client: SupabaseClient, private readonly userId: string)
  {
  }

  private async audit(entity: AuditEntity, entityId: string, action: AuditAction): Promise<void>
  {
    check(await this.client.from('content_audit').insert({ user_id: this.userId, entity, entity_id: entityId, action }));
  }

  /** Supplies the landmark editor with a list of parks and their current statuses. */
  async parks(): Promise<ParkSummary[]>
  {
    return z.array(ParkSummary).parse(check(await this.client.from('heritage_parks').select('id, name, status').order('name')));
  }

  /** Loads the landmarks listed on the CMS dashboard. */
  async landmarks(): Promise<LandmarkSummary[]>
  {
    return z.array(LandmarkSummary).parse(check(await this.client.from('heritage_landmarks').select('id, park_id, name, status, updated_at').order('name')));
  }

  /**
   * Looks up a landmark by ID for editing.
   * @param id - ID of the landmark to find.
   * @returns The matching landmark, or null if no record exists.
   */
  async landmark(id: string): Promise<LandmarkRecord | null>
  {
    const row = check(await this.client.from('heritage_landmarks').select(LANDMARK_SELECT).eq('id', id).maybeSingle());
    return row === null ? null : LandmarkRecord.parse(row);
  }

  /**
   * Lists a landmark's podcasts in creation order.
   * @param landmarkId - ID of the landmark whose podcasts to retrieve.
   */
  async podcastsFor(landmarkId: string): Promise<PodcastRecord[]>
  {
    return z.array(PodcastRecord).parse(check(await this.client.from('podcasts').select(PODCAST_SELECT).eq('landmark_id', landmarkId).order('created_at')));
  }

  /**
   * Finds a podcast by ID for editing.
   * @param id - ID of the podcast to find.
   * @returns The matching podcast, or null if it doesn't exist.
   */
  async podcast(id: string): Promise<PodcastRecord | null>
  {
    const row = check(await this.client.from('podcasts').select(PODCAST_SELECT).eq('id', id).maybeSingle());
    return row === null ? null : PodcastRecord.parse(row);
  }

  /**
   * Creates a landmark in draft status and logs the creation.
   * @param form - The validated fields submitted for the landmark.
   * @returns The ID of the created landmark.
   */
  async createLandmark(form: LandmarkForm): Promise<string>
  {
    const row = z.object({ id: z.uuid() }).parse(check(await this.client.from('heritage_landmarks').insert({ ...landmarkColumns(form), status: 'draft' }).select('id').single()));
    await this.audit('landmark', row.id, 'create');
    return row.id;
  }

  /**
   * Saves changes to a landmark and records them in the audit log.
   * @param id - ID of the landmark to update.
   * @param form - The validated fields to save.
   */
  async updateLandmark(id: string, form: LandmarkForm): Promise<void>
  {
    check(await this.client.from('heritage_landmarks').update(landmarkColumns(form)).eq('id', id));
    await this.audit('landmark', id, 'update');
  }

  /**
   * Changes a landmark's publication status.
   * A database trigger prevents publication while its park is unpublished.
   * Apps receive the updated content at their next catalog sync.
   * @param id - ID of the landmark to update.
   * @param status - The new publication status.
   */
  async setLandmarkStatus(id: string, status: ContentStatus): Promise<void>
  {
    check(await this.client.from('heritage_landmarks').update({ status }).eq('id', id));
    await this.audit('landmark', id, status === 'published' ? 'publish' : 'unpublish');
  }

  private async uploadAudio(podcastId: string, bytes: Uint8Array, mimeType: string, analysis: AudioAnalysis): Promise<Record<string, unknown>>
  {
    const audioPath = `audio/${podcastId}-${analysis.sha256.slice(0, 12)}.${analysis.extension}`;
    const upload = await this.client.storage.from(MEDIA_BUCKET).upload(audioPath, bytes, { contentType: mimeType, upsert: true, cacheControl: '31536000' });
    if (upload.error !== null)
    {
      throw new ContentError('The audio upload failed. Please try again.');
    }
    return {
      audio_path: audioPath,
      duration_seconds: analysis.durationSeconds,
      file_size_bytes: analysis.fileSizeBytes,
      checksum_sha256: analysis.sha256,
      checksum_md5: analysis.md5,
      length_class: analysis.lengthClass,
    };
  }

  /**
   * Creates a podcast draft and uploads its audio to Storage when supplied.
   * Saves the duration, file size, and checksums produced by server-side audio analysis.
   * @param form - The validated podcast details.
   * @param audio - The uploaded file and its analysis results, or null if audio will be added later.
   * @returns The ID of the created podcast.
   */
  async createPodcast(form: PodcastForm, audio: { bytes: Uint8Array; mimeType: string; analysis: AudioAnalysis } | null): Promise<string>
  {
    const row = z.object({ id: z.uuid() }).parse(check(await this.client.from('podcasts').insert({
      landmark_id: form.landmarkId,
      title: form.title,
      voice: form.voice,
      accent: form.accent,
      transcript: form.transcript,
      status: 'draft',
    }).select('id').single()));
    if (audio !== null)
    {
      check(await this.client.from('podcasts').update(await this.uploadAudio(row.id, audio.bytes, audio.mimeType, audio.analysis)).eq('id', row.id));
    }
    await this.audit('podcast', row.id, 'create');
    return row.id;
  }

  /**
   * Saves podcast edits and replaces the audio when a new file is supplied.
   * @param id - ID of the podcast to update.
   * @param form - The validated podcast details to save.
   * @param audio - The replacement audio and its analysis results, or null if no new file was uploaded.
   */
  async updatePodcast(id: string, form: PodcastForm, audio: { bytes: Uint8Array; mimeType: string; analysis: AudioAnalysis } | null): Promise<void>
  {
    const audioColumns = audio === null ? {} : await this.uploadAudio(id, audio.bytes, audio.mimeType, audio.analysis);
    check(await this.client.from('podcasts').update({ title: form.title, voice: form.voice, accent: form.accent, transcript: form.transcript, ...audioColumns }).eq('id', id));
    await this.audit('podcast', id, 'update');
  }

  /**
   * Changes a podcast's publication status.
   * A database trigger blocks publication until audio, duration, file size, and checksum are available.
   * @param id - ID of the podcast to update.
   * @param status - The new publication status.
   */
  async setPodcastStatus(id: string, status: ContentStatus): Promise<void>
  {
    check(await this.client.from('podcasts').update({ status }).eq('id', id));
    await this.audit('podcast', id, status === 'published' ? 'publish' : 'unpublish');
  }
}
