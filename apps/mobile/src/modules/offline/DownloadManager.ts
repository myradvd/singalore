import type { PackResponse } from '@singalore/shared';
import type { Clock } from '@/core/clock';
import type { DiagnosticsRecorder } from '@/core/diagnostics';
import type { LocalNotifier } from '@/core/notifications';
import type { ConnectivityMonitor } from './ConnectivityMonitor';
import type { DownloadFileRecord, DownloadRecord, DownloadsRepository } from './DownloadsRepository';
import type { FileTransport } from './FileTransport';
import { nextPackState, type PackEvent, type PackState } from './packStateMachine';

export const DOWNLOAD_MESSAGES = {
  interrupted: 'Download interrupted. Please check your connection.',
  offline: 'You are offline. Connect to Wi-Fi or mobile data to download.',
  wifiOnly: 'Downloads are set to Wi-Fi only. Connect to Wi-Fi or change this in Preferences.',
  checksum: 'A file did not download correctly. Please try again.',
  failed: 'The download failed. Please try again.',
} as const;

export const STORAGE_MARGIN_BYTES = 20 * 1024 * 1024;

export function insufficientStorageMessage(neededBytes: number): string
{
  return `Not enough storage. Free up ${Math.ceil(neededBytes / (1024 * 1024))} MB and try again.`;
}

export type DownloadOutcome =
  | { kind: 'downloaded' }
  | { kind: 'paused'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string };

export interface DownloadManagerDependencies
{
  repository: DownloadsRepository;
  transport: FileTransport;
  connectivity: Pick<ConnectivityMonitor, 'isOnline' | 'isOnWifi'>;
  fetchPack: (parkId: string) => Promise<PackResponse>;
  setLandmarkImage: (landmarkId: string, localPath: string | null) => Promise<void>;
  wifiOnly: () => boolean;
  parkName: (parkId: string) => string;
  notifier: LocalNotifier;
  clock: Clock;
  diagnostics: DiagnosticsRecorder;
}

function fileName(file: { kind: 'audio' | 'image'; podcastId: string | null; landmarkId: string | null; url: string }): string
{
  const extension = file.url.split('?')[0]?.split('.').pop() ?? (file.kind === 'audio' ? 'm4a' : 'jpg');
  return `${file.kind}-${file.podcastId ?? file.landmarkId ?? 'file'}.${extension}`;
}

export class DownloadManager
{
  private readonly listeners = new Set<(records: DownloadRecord[]) => void>();
  private active: string | null = null;
  private pauseRequested = false;
  private progressBytes = new Map<string, number>();

  constructor(private readonly dependencies: DownloadManagerDependencies)
  {
  }

  subscribe(listener: (records: DownloadRecord[]) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async records(): Promise<DownloadRecord[]>
  {
    return this.dependencies.repository.all();
  }

  liveProgress(parkId: string): number
  {
    return this.progressBytes.get(parkId) ?? 0;
  }

  async download(parkId: string): Promise<DownloadOutcome>
  {
    const { connectivity, wifiOnly } = this.dependencies;
    if (this.active !== null)
    {
      return { kind: 'blocked', message: 'Another download is in progress.' };
    }
    if (!connectivity.isOnline())
    {
      return { kind: 'blocked', message: DOWNLOAD_MESSAGES.offline };
    }
    if (wifiOnly() && !connectivity.isOnWifi())
    {
      return { kind: 'blocked', message: DOWNLOAD_MESSAGES.wifiOnly };
    }
    this.active = parkId;
    this.pauseRequested = false;
    try
    {
      return await this.run(parkId);
    }
    finally
    {
      this.active = null;
      await this.publish();
    }
  }

  async pause(parkId: string): Promise<void>
  {
    if (this.active !== parkId)
    {
      return;
    }
    this.pauseRequested = true;
    await this.dependencies.transport.cancelActive();
  }

  async remove(parkId: string): Promise<void>
  {
    if (this.active === parkId)
    {
      await this.pause(parkId);
    }
    const files = await this.dependencies.repository.files(parkId);
    for (const file of files.filter((candidate) => candidate.kind === 'image' && candidate.landmark_id !== null))
    {
      await this.dependencies.setLandmarkImage(file.landmark_id ?? '', null);
    }
    this.dependencies.transport.deleteDirectory(parkId);
    await this.dependencies.repository.delete(parkId);
    this.progressBytes.delete(parkId);
    await this.publish();
  }

  async checkForUpdates(fetchEtag: (parkId: string) => Promise<string | null>): Promise<void>
  {
    for (const record of await this.dependencies.repository.all())
    {
      if (record.state !== 'downloaded')
      {
        continue;
      }
      const latest = await fetchEtag(record.parkId).catch(() => null);
      if (latest !== null && latest !== record.packEtag)
      {
        await this.transition(record, 'update_found', {});
      }
    }
    await this.publish();
  }

  async totalStoredBytes(): Promise<number>
  {
    return (await this.dependencies.repository.all()).filter((record) => record.state === 'downloaded' || record.state === 'update_available').reduce((sum, record) => sum + record.totalBytes, 0);
  }

  private async run(parkId: string): Promise<DownloadOutcome>
  {
    const { repository, transport } = this.dependencies;
    const existing = await repository.get(parkId) ?? { parkId, state: 'not_downloaded' as PackState, packEtag: null, totalBytes: 0, doneBytes: 0, errorCode: null, completedAt: null };
    let pack: PackResponse;
    try
    {
      pack = await this.dependencies.fetchPack(parkId);
    }
    catch
    {
      return { kind: 'blocked', message: DOWNLOAD_MESSAGES.interrupted };
    }
    const directory = transport.ensureDirectory(parkId);
    const files: DownloadFileRecord[] = pack.files.map((file) => ({
      park_id: parkId,
      url: file.url,
      kind: file.kind,
      bytes: file.bytes,
      md5: file.md5,
      sha256: file.sha256,
      local_path: `${directory.replace(/\/+$/, '')}/${fileName(file)}`,
      state: 'pending',
      resume_savable: null,
      podcast_id: file.podcastId,
      landmark_id: file.landmarkId,
    }));
    await repository.replaceFiles(parkId, files);
    const stored = await repository.files(parkId);
    const remainingBytes = stored.filter((file) => file.state !== 'done').reduce((sum, file) => sum + file.bytes, 0);
    if (transport.availableBytes() < remainingBytes + STORAGE_MARGIN_BYTES)
    {
      const message = insufficientStorageMessage(remainingBytes + STORAGE_MARGIN_BYTES - transport.availableBytes());
      await repository.upsert({ ...existing, state: existing.state === 'downloaded' ? 'downloaded' : 'failed', errorCode: 'insufficient_storage' }, this.nowIso());
      await this.dependencies.diagnostics.record('warn', 'download_insufficient_storage');
      return { kind: 'blocked', message };
    }
    let record = await this.transition({ ...existing, packEtag: pack.etag, totalBytes: pack.totalBytes }, 'start', { errorCode: null });
    let doneBytes = stored.filter((file) => file.state === 'done').reduce((sum, file) => sum + file.bytes, 0);
    this.progressBytes.set(parkId, doneBytes);
    await this.publish();
    for (const file of stored.filter((candidate) => candidate.state !== 'done'))
    {
      const result = await this.fetchFileWithRetry(file, doneBytes);
      if (result === 'interrupted')
      {
        record = await this.transition(record, this.pauseRequested ? 'pause' : 'interrupt', { doneBytes, errorCode: this.pauseRequested ? null : 'interrupted' });
        return { kind: 'paused', message: this.pauseRequested ? 'Download paused.' : DOWNLOAD_MESSAGES.interrupted };
      }
      if (result !== 'done')
      {
        record = await this.transition(record, 'fail', { doneBytes, errorCode: result });
        await this.dependencies.diagnostics.record('error', `download_${result}`);
        return { kind: 'failed', message: result === 'checksum_mismatch' ? DOWNLOAD_MESSAGES.checksum : DOWNLOAD_MESSAGES.failed };
      }
      doneBytes += file.bytes;
      this.progressBytes.set(parkId, doneBytes);
      if (file.kind === 'image' && file.landmark_id !== null)
      {
        await this.dependencies.setLandmarkImage(file.landmark_id, file.local_path);
      }
      record = { ...record, doneBytes };
      await this.dependencies.repository.upsert(record, this.nowIso());
      await this.publish();
    }
    await this.transition(record, 'complete', { doneBytes: pack.totalBytes, completedAt: this.nowIso(), errorCode: null });
    await this.dependencies.notifier.notify('downloads', 'Download complete', `${this.dependencies.parkName(parkId)} is ready to use offline.`, { parkId });
    return { kind: 'downloaded' };
  }

  private async fetchFileWithRetry(file: DownloadFileRecord, doneBytesBefore: number): Promise<'done' | 'interrupted' | 'checksum_mismatch' | 'failed'>
  {
    const { transport, repository } = this.dependencies;
    let resumeData = file.resume_savable;
    for (let attempt = 0; attempt < 2; attempt += 1)
    {
      await repository.updateFile(file.park_id, file.url, 'active', resumeData);
      const result = await transport.download(file.url, file.local_path, resumeData, (written) =>
      {
        this.progressBytes.set(file.park_id, doneBytesBefore + written);
        for (const listener of this.listeners)
        {
          void this.dependencies.repository.all().then(listener);
        }
      });
      if (result.kind === 'interrupted')
      {
        await repository.updateFile(file.park_id, file.url, 'paused', result.resumeData);
        return 'interrupted';
      }
      if (result.kind === 'failed')
      {
        await repository.updateFile(file.park_id, file.url, 'failed', null);
        if (!this.dependencies.connectivity.isOnline())
        {
          return 'interrupted';
        }
        resumeData = null;
        continue;
      }
      const info = transport.fileInfo(file.local_path, file.kind === 'audio' && file.md5 !== null);
      const sizeOk = info.exists && info.size === file.bytes;
      const md5Ok = file.kind !== 'audio' || file.md5 === null || info.md5 === file.md5;
      if (sizeOk && md5Ok)
      {
        await repository.updateFile(file.park_id, file.url, 'done', null);
        return 'done';
      }
      transport.deleteFile(file.local_path);
      await repository.updateFile(file.park_id, file.url, 'failed', null);
      resumeData = null;
      if (attempt === 1)
      {
        return 'checksum_mismatch';
      }
    }
    return 'failed';
  }

  private async transition(record: DownloadRecord, event: PackEvent, changes: Partial<DownloadRecord>): Promise<DownloadRecord>
  {
    const state = nextPackState(record.state, event) ?? record.state;
    const next = { ...record, ...changes, state };
    await this.dependencies.repository.upsert(next, this.nowIso());
    await this.publish();
    return next;
  }

  private nowIso(): string
  {
    return new Date(this.dependencies.clock.now()).toISOString();
  }

  private async publish(): Promise<void>
  {
    if (this.listeners.size === 0)
    {
      return;
    }
    const records = await this.dependencies.repository.all();
    for (const listener of this.listeners)
    {
      listener(records);
    }
  }
}
