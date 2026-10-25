import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { PackState } from './packStateMachine';

const DownloadRowSchema = z.object({
  park_id: z.string(),
  state: z.enum(['not_downloaded', 'downloading', 'paused', 'downloaded', 'failed', 'update_available']),
  pack_etag: z.string().nullable(),
  total_bytes: z.number(),
  done_bytes: z.number(),
  error_code: z.string().nullable(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});

const FileRowSchema = z.object({
  park_id: z.string(),
  url: z.string(),
  kind: z.enum(['audio', 'image']),
  bytes: z.number(),
  md5: z.string().nullable(),
  sha256: z.string().nullable(),
  local_path: z.string(),
  state: z.enum(['pending', 'active', 'paused', 'done', 'failed']),
  resume_savable: z.string().nullable(),
  podcast_id: z.string().nullable(),
  landmark_id: z.string().nullable(),
});

export interface DownloadRecord
{
  parkId: string;
  state: PackState;
  packEtag: string | null;
  totalBytes: number;
  doneBytes: number;
  errorCode: string | null;
  completedAt: string | null;
}

export type DownloadFileRecord = z.infer<typeof FileRowSchema>;

export class DownloadsRepository
{
  constructor(private readonly db: DbAdapter)
  {
  }

  async all(): Promise<DownloadRecord[]>
  {
    const rows = z.array(DownloadRowSchema).parse(await this.db.all('select * from downloads'));
    return rows.map((row) => ({ parkId: row.park_id, state: row.state, packEtag: row.pack_etag, totalBytes: row.total_bytes, doneBytes: row.done_bytes, errorCode: row.error_code, completedAt: row.completed_at }));
  }

  async get(parkId: string): Promise<DownloadRecord | null>
  {
    return (await this.all()).find((record) => record.parkId === parkId) ?? null;
  }

  async upsert(record: DownloadRecord, nowIso: string): Promise<void>
  {
    await this.db.run(
      `insert into downloads (park_id, state, pack_etag, total_bytes, done_bytes, error_code, updated_at, completed_at) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(park_id) do update set state = excluded.state, pack_etag = excluded.pack_etag, total_bytes = excluded.total_bytes,
        done_bytes = excluded.done_bytes, error_code = excluded.error_code, updated_at = excluded.updated_at, completed_at = excluded.completed_at`,
      [record.parkId, record.state, record.packEtag, record.totalBytes, record.doneBytes, record.errorCode, nowIso, record.completedAt],
    );
  }

  async files(parkId: string): Promise<DownloadFileRecord[]>
  {
    return z.array(FileRowSchema).parse(await this.db.all('select * from download_files where park_id = ? order by kind, url', [parkId]));
  }

  async replaceFiles(parkId: string, files: DownloadFileRecord[]): Promise<void>
  {
    await this.db.transaction(async (transaction) =>
    {
      const existing = z.array(FileRowSchema).parse(await transaction.all('select * from download_files where park_id = ?', [parkId]));
      await transaction.run('delete from download_files where park_id = ?', [parkId]);
      for (const file of files)
      {
        const previous = existing.find((candidate) => candidate.url === file.url && candidate.md5 === file.md5 && candidate.bytes === file.bytes);
        const state = previous?.state === 'done' ? 'done' : previous?.state === 'paused' ? 'paused' : 'pending';
        await transaction.run(
          `insert into download_files (park_id, url, kind, bytes, md5, sha256, local_path, state, resume_savable, podcast_id, landmark_id)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [file.park_id, file.url, file.kind, file.bytes, file.md5, file.sha256, file.local_path, state, previous?.resume_savable ?? null, file.podcast_id, file.landmark_id],
        );
      }
    });
  }

  async updateFile(parkId: string, url: string, state: DownloadFileRecord['state'], resumeSavable: string | null): Promise<void>
  {
    await this.db.run('update download_files set state = ?, resume_savable = ? where park_id = ? and url = ?', [state, resumeSavable, parkId, url]);
  }

  async delete(parkId: string): Promise<void>
  {
    await this.db.transaction(async (transaction) =>
    {
      await transaction.run('delete from download_files where park_id = ?', [parkId]);
      await transaction.run('delete from downloads where park_id = ?', [parkId]);
    });
  }
}
