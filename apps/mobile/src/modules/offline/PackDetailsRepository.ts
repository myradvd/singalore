import { API_PATHS, PackResponse } from '@singalore/shared';
import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { ApiClient } from '@/core/http/ApiClient';

const TranscriptRow = z.object({ transcript: z.string().nullable() });
const DescriptionRow = z.object({ description: z.string(), image_url: z.string().nullable(), image_local_path: z.string().nullable() });

export class PackDetailsRepository
{
  constructor(private readonly db: DbAdapter, private readonly api: ApiClient)
  {
  }

  async transcript(podcastId: string): Promise<string | null | undefined>
  {
    const row = await this.db.first('select transcript from podcast_detail where podcast_id = ?', [podcastId]);
    return row === null ? undefined : TranscriptRow.parse(row).transcript;
  }

  async landmarkDetail(landmarkId: string): Promise<{ description: string; imageUrl: string | null; imageLocalPath: string | null } | null>
  {
    const row = await this.db.first('select description, image_url, image_local_path from landmark_detail where landmark_id = ?', [landmarkId]);
    if (row === null)
    {
      return null;
    }
    const parsed = DescriptionRow.parse(row);
    return { description: parsed.description, imageUrl: parsed.image_url, imageLocalPath: parsed.image_local_path };
  }

  async fetchPack(parkId: string): Promise<PackResponse>
  {
    const result = await this.api.get(API_PATHS.pack(parkId), PackResponse, { timeoutMs: 15000 });
    if (result.status !== 'ok')
    {
      throw new Error('Pack request returned not modified without a cached pack');
    }
    await this.storeDetails(result.data);
    return result.data;
  }

  async storeDetails(pack: PackResponse): Promise<void>
  {
    await this.db.transaction(async (transaction) =>
    {
      for (const landmark of pack.landmarks)
      {
        await transaction.run(
          `insert into landmark_detail (landmark_id, description, image_url) values (?, ?, ?)
            on conflict(landmark_id) do update set description = excluded.description, image_url = excluded.image_url`,
          [landmark.landmarkId, landmark.description, landmark.imageUrl],
        );
      }
      for (const podcast of pack.podcasts)
      {
        await transaction.run(
          'insert into podcast_detail (podcast_id, transcript) values (?, ?) on conflict(podcast_id) do update set transcript = excluded.transcript',
          [podcast.podcastId, podcast.transcript],
        );
      }
    });
  }

  async setLandmarkImageLocalPath(landmarkId: string, localPath: string | null): Promise<void>
  {
    await this.db.run('update landmark_detail set image_local_path = ? where landmark_id = ?', [localPath, landmarkId]);
  }
}
