import { z } from 'zod';
import { mediaBaseUrl, serverEnv } from '@/server/env';
import { apiError, snapshotResponse } from '@/server/http';
import { buildPack, type PackLandmarkRow, type PackPodcastRow } from '@/server/packBuilder';
import { supabaseAdmin } from '@/server/supabaseAdmin';

export async function GET(request: Request, context: RouteContext<'/api/v1/parks/[id]/pack'>): Promise<Response>
{
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
  {
    return apiError('invalid_request', 'Park id must be a UUID.', 400);
  }
  try
  {
    const client = supabaseAdmin();
    const park = await client.from('heritage_parks').select('id').eq('id', id).eq('status', 'published').maybeSingle();
    if (park.error !== null)
    {
      throw new Error(park.error.message);
    }
    if (park.data === null)
    {
      return apiError('not_found', 'This heritage park is not published.', 404);
    }
    const landmarks = await client.from('heritage_landmarks').select('id, description, image_path, image_bytes').eq('park_id', id).eq('status', 'published');
    if (landmarks.error !== null)
    {
      throw new Error(landmarks.error.message);
    }
    const landmarkIds = (landmarks.data ?? []).map((landmark) => landmark.id as string);
    const podcasts = landmarkIds.length === 0
      ? { data: [], error: null }
      : await client.from('podcasts').select('id, landmark_id, audio_path, file_size_bytes, checksum_sha256, checksum_md5, transcript').in('landmark_id', landmarkIds).eq('status', 'published');
    if (podcasts.error !== null)
    {
      throw new Error(podcasts.error.message);
    }
    const pack = buildPack(id, (landmarks.data ?? []) as PackLandmarkRow[], (podcasts.data ?? []) as PackPodcastRow[], mediaBaseUrl(serverEnv()), new Date());
    return snapshotResponse(request, pack.etag, pack);
  }
  catch (error)
  {
    console.error('pack_failed', error instanceof Error ? error.message : 'unknown');
    return apiError('internal', 'The park pack is temporarily unavailable.', 503);
  }
}
