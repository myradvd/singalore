import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';

export const AudioSessionRow = z.object({
  session_id: z.string(),
  podcast_id: z.string(),
  landmark_id: z.string(),
  position_ms: z.number(),
  playback_state: z.string(),
  rate: z.number(),
  source: z.enum(['local', 'stream']),
  updated_at: z.string(),
});

export interface AudioSessionRecord
{
  sessionId: string;
  podcastId: string;
  landmarkId: string;
  positionMs: number;
  playbackState: string;
  rate: number;
  source: 'local' | 'stream';
  updatedAt: string;
}

export class AudioSessionRepository
{
  constructor(private readonly db: DbAdapter)
  {
  }

  async load(): Promise<AudioSessionRecord | null>
  {
    const row = await this.db.first('select * from audio_session where id = 1');
    const parsed = AudioSessionRow.safeParse(row);
    if (!parsed.success)
    {
      return null;
    }
    const data = parsed.data;
    return { sessionId: data.session_id, podcastId: data.podcast_id, landmarkId: data.landmark_id, positionMs: data.position_ms, playbackState: data.playback_state, rate: data.rate, source: data.source, updatedAt: data.updated_at };
  }

  async save(record: AudioSessionRecord): Promise<void>
  {
    await this.db.run(
      `insert into audio_session (id, session_id, podcast_id, landmark_id, position_ms, playback_state, rate, source, updated_at)
        values (1, ?, ?, ?, ?, ?, ?, ?, ?) on conflict(id) do update set session_id = excluded.session_id, podcast_id = excluded.podcast_id,
        landmark_id = excluded.landmark_id, position_ms = excluded.position_ms, playback_state = excluded.playback_state, rate = excluded.rate,
        source = excluded.source, updated_at = excluded.updated_at`,
      [record.sessionId, record.podcastId, record.landmarkId, Math.round(record.positionMs), record.playbackState, record.rate, record.source, record.updatedAt],
    );
  }

  async clear(): Promise<void>
  {
    await this.db.run('delete from audio_session');
  }
}
