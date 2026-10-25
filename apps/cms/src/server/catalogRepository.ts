import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogRows, LandmarkRow, ParkRow, PodcastRow } from './catalogBuilder';

export async function loadPublishedCatalogRows(client: SupabaseClient): Promise<CatalogRows>
{
  const [parks, landmarks, podcasts] = await Promise.all([
    client.from('heritage_parks')
      .select('id, slug, name, district, description, center_lat, center_lng, boundary, thumbnail_path, attribution')
      .eq('status', 'published'),
    client.from('heritage_landmarks')
      .select('id, park_id, slug, name, aliases, category, lat, lng, geofence_radius_m, short_description, thumbnail_path, image_bytes, built_year, architectural_style, sort_order, attribution')
      .eq('status', 'published'),
    client.from('podcasts')
      .select('id, landmark_id, title, audio_path, duration_seconds, file_size_bytes, voice, accent, length_class, transcript')
      .eq('status', 'published'),
  ]);
  for (const result of [parks, landmarks, podcasts])
  {
    if (result.error !== null)
    {
      throw new Error(`Catalog query failed: ${result.error.message}`);
    }
  }
  const podcastRows: PodcastRow[] = ((podcasts.data ?? []) as (Omit<PodcastRow, 'has_transcript'> & { transcript: string | null })[])
    .map(({ transcript, ...rest }) => ({ ...rest, has_transcript: transcript !== null && transcript.trim().length > 0 }));
  return {
    parks: (parks.data ?? []) as ParkRow[],
    landmarks: (landmarks.data ?? []) as LandmarkRow[],
    podcasts: podcastRows,
  };
}
