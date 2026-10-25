import type { PackResponse } from '@singalore/shared';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { DownloadedMediaResolver } from './DownloadedMediaResolver';
import { DOWNLOAD_MESSAGES, DownloadManager, STORAGE_MARGIN_BYTES } from './DownloadManager';
import { DownloadsRepository } from './DownloadsRepository';
import type { FileTransport, TransferResult } from './FileTransport';
import { isOfflineReady, nextPackState } from './packStateMachine';

const parkId = '11111111-1111-4111-8111-111111111111';
const podcastId = '44444444-4444-4444-8444-444444444444';
const landmarkId = '22222222-2222-4222-8222-222222222222';
const MD5 = 'a'.repeat(32);

function pack(etag = '"p1"'): PackResponse
{
  return {
    schemaVersion: 1,
    parkId,
    etag,
    generatedAt: '2026-10-12T00:00:00.000Z',
    totalBytes: 1500,
    landmarks: [{ landmarkId, description: 'Long', imageUrl: 'https://cdn.test/images/a.jpg' }],
    podcasts: [{ podcastId, transcript: 'Words' }],
    files: [
      { kind: 'audio', url: 'https://cdn.test/audio/a.m4a', bytes: 1000, sha256: 'b'.repeat(64), md5: MD5, podcastId, landmarkId },
      { kind: 'image', url: 'https://cdn.test/images/a.jpg', bytes: 500, sha256: null, md5: null, podcastId: null, landmarkId },
    ],
  };
}

class FakeTransport implements FileTransport
{
  files = new Map<string, { size: number; md5: string | null }>();
  free = 1_000_000_000;
  script: ((url: string, resumeData: string | null) => TransferResult | 'corrupt')[] = [];
  calls: { url: string; resumeData: string | null }[] = [];
  deletedDirectories: string[] = [];

  ensureDirectory(id: string): string
  {
    return `file:///packs/${id}`;
  }

  async download(url: string, localPath: string, resumeData: string | null, onProgress: (bytes: number) => void): Promise<TransferResult>
  {
    this.calls.push({ url, resumeData });
    const step = this.script.shift();
    const outcome = step === undefined ? { kind: 'done' as const } : step(url, resumeData);
    const expected = pack().files.find((file) => file.url === url);
    if (outcome === 'corrupt')
    {
      this.files.set(localPath, { size: expected?.bytes ?? 0, md5: 'f'.repeat(32) });
      return { kind: 'done' };
    }
    if (outcome.kind === 'done')
    {
      onProgress(expected?.bytes ?? 0);
      this.files.set(localPath, { size: expected?.bytes ?? 0, md5: expected?.md5 ?? null });
    }
    return outcome;
  }

  async cancelActive(): Promise<string | null>
  {
    return null;
  }

  fileInfo(localPath: string): { exists: boolean; size: number | null; md5: string | null }
  {
    const file = this.files.get(localPath);
    return file === undefined ? { exists: false, size: null, md5: null } : { exists: true, size: file.size, md5: file.md5 };
  }

  deleteFile(localPath: string): void
  {
    this.files.delete(localPath);
  }

  deleteDirectory(id: string): void
  {
    this.deletedDirectories.push(id);
    for (const key of [...this.files.keys()].filter((path) => path.includes(id)))
    {
      this.files.delete(key);
    }
  }

  availableBytes(): number
  {
    return this.free;
  }
}

async function setup(options: { online?: boolean; wifi?: boolean; wifiOnly?: boolean } = {})
{
  const db = createMemoryDb();
  await migrate(db);
  const repository = new DownloadsRepository(db);
  const transport = new FakeTransport();
  const notifications: string[] = [];
  const images = new Map<string, string | null>();
  let currentPack = pack();
  const network = { online: options.online ?? true, wifi: options.wifi ?? true };
  const manager = new DownloadManager({
    repository,
    transport,
    connectivity: { isOnline: () => network.online, isOnWifi: () => network.wifi },
    fetchPack: async () => currentPack,
    setLandmarkImage: async (id, path) =>
    {
      images.set(id, path);
    },
    wifiOnly: () => options.wifiOnly ?? true,
    parkName: () => 'Civic District',
    notifier: { permission: async () => 'granted', requestPermission: async () => 'granted', notify: async (_category, _title, body) =>
    {
      notifications.push(body);
      return true;
    } },
    clock: new ManualClock(0),
    diagnostics: { record: async () => undefined },
  });
  const resolver = new DownloadedMediaResolver(db, { size: (path) => transport.files.get(path)?.size ?? null });
  return { manager, repository, transport, notifications, images, resolver, network, setPack: (next: PackResponse) =>
  {
    currentPack = next;
  } };
}

describe('packStateMachine', () =>
{
  it('allows only valid transitions', () =>
  {
    expect(nextPackState('not_downloaded', 'start')).toBe('downloading');
    expect(nextPackState('downloading', 'interrupt')).toBe('paused');
    expect(nextPackState('paused', 'resume')).toBe('downloading');
    expect(nextPackState('downloading', 'complete')).toBe('downloaded');
    expect(nextPackState('downloaded', 'update_found')).toBe('update_available');
    expect(nextPackState('update_available', 'start')).toBe('downloading');
    expect(nextPackState('not_downloaded', 'complete')).toBeNull();
    expect(isOfflineReady('update_available')).toBe(true);
    expect(isOfflineReady('paused')).toBe(false);
  });
});

describe('DownloadManager (UC 1.4.1)', () =>
{
  it('downloads every file, verifies it, stores image paths and notifies on completion', async () =>
  {
    const { manager, repository, notifications, images, resolver } = await setup();
    expect(await manager.download(parkId)).toEqual({ kind: 'downloaded' });
    const record = await repository.get(parkId);
    expect(record).toMatchObject({ state: 'downloaded', doneBytes: 1500, totalBytes: 1500, packEtag: '"p1"' });
    expect(images.get(landmarkId)).toBe('file:///packs/11111111-1111-4111-8111-111111111111/image-22222222-2222-4222-8222-222222222222.jpg');
    expect(notifications).toEqual(['Civic District is ready to use offline.']);
    expect(await resolver.localAudioUri(podcastId)).toBe('file:///packs/11111111-1111-4111-8111-111111111111/audio-44444444-4444-4444-8444-444444444444.m4a');
    expect(await manager.totalStoredBytes()).toBe(1500);
  });

  it('refuses to start offline or on mobile data when Wi-Fi only is set', async () =>
  {
    expect(await (await setup({ online: false })).manager.download(parkId)).toEqual({ kind: 'blocked', message: DOWNLOAD_MESSAGES.offline });
    expect(await (await setup({ wifi: false })).manager.download(parkId)).toEqual({ kind: 'blocked', message: DOWNLOAD_MESSAGES.wifiOnly });
    expect((await (await setup({ wifi: false, wifiOnly: false })).manager.download(parkId)).kind).toBe('downloaded');
  });

  it('cancels and asks to free space when storage is short (UC 1.4.1.2)', async () =>
  {
    const { manager, transport, repository } = await setup();
    transport.free = 1500 + STORAGE_MARGIN_BYTES - 2 * 1024 * 1024;
    const outcome = await manager.download(parkId);
    expect(outcome).toEqual({ kind: 'blocked', message: 'Not enough storage. Free up 2 MB and try again.' });
    expect(transport.calls).toHaveLength(0);
    expect((await repository.get(parkId))?.errorCode).toBe('insufficient_storage');
  });

  it('pauses on a dropped connection and resumes from where it stopped (UC 1.4.1.1)', async () =>
  {
    const { manager, repository, transport } = await setup();
    transport.script = [() => ({ kind: 'interrupted', resumeData: '{"url":"x"}' })];
    expect(await manager.download(parkId)).toEqual({ kind: 'paused', message: DOWNLOAD_MESSAGES.interrupted });
    expect((await repository.get(parkId))?.state).toBe('paused');
    expect(await manager.download(parkId)).toEqual({ kind: 'downloaded' });
    expect(transport.calls[1]).toEqual({ url: 'https://cdn.test/audio/a.m4a', resumeData: '{"url":"x"}' });
  });

  it('retries a corrupt file once, then fails with the checksum message', async () =>
  {
    const retried = await setup();
    retried.transport.script = [() => 'corrupt'];
    expect(await retried.manager.download(parkId)).toEqual({ kind: 'downloaded' });

    const broken = await setup();
    broken.transport.script = [() => 'corrupt', () => 'corrupt'];
    expect(await broken.manager.download(parkId)).toEqual({ kind: 'failed', message: DOWNLOAD_MESSAGES.checksum });
    expect((await broken.repository.get(parkId))?.state).toBe('failed');
    expect(await broken.resolver.localAudioUri(podcastId)).toBeNull();
  });

  it('flags an update when the pack changes, skips unchanged files on re-download, and deletes', async () =>
  {
    const { manager, repository, transport, images, setPack } = await setup();
    await manager.download(parkId);
    await manager.checkForUpdates(async () => '"p1"');
    expect((await repository.get(parkId))?.state).toBe('downloaded');
    await manager.checkForUpdates(async () => '"p2"');
    expect((await repository.get(parkId))?.state).toBe('update_available');
    setPack(pack('"p2"'));
    const callsBefore = transport.calls.length;
    expect(await manager.download(parkId)).toEqual({ kind: 'downloaded' });
    expect(transport.calls.length).toBe(callsBefore);
    await manager.remove(parkId);
    expect(await repository.get(parkId)).toBeNull();
    expect(images.get(landmarkId)).toBeNull();
    expect(transport.deletedDirectories).toEqual([parkId]);
  });

  it('does not use a local file whose size no longer matches', async () =>
  {
    const { manager, transport, resolver } = await setup();
    await manager.download(parkId);
    for (const [path, file] of transport.files)
    {
      transport.files.set(path, { ...file, size: 1 });
    }
    expect(await resolver.localAudioUri(podcastId)).toBeNull();
  });
});
