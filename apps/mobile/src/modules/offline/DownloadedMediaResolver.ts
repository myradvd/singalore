import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { LocalMediaResolver } from '@/core/media';

export interface FileProbe
{
  size(localPath: string): number | null;
}

const Row = z.object({ local_path: z.string(), bytes: z.number() });

export class DownloadedMediaResolver implements LocalMediaResolver
{
  constructor(private readonly db: DbAdapter, private readonly probe: FileProbe)
  {
  }

  async localAudioUri(podcastId: string): Promise<string | null>
  {
    const row = await this.db.first("select local_path, bytes from download_files where podcast_id = ? and kind = 'audio' and state = 'done' limit 1", [podcastId]);
    if (row === null)
    {
      return null;
    }
    const parsed = Row.parse(row);
    return this.probe.size(parsed.local_path) === parsed.bytes ? parsed.local_path : null;
  }
}
