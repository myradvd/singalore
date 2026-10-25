import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { ApiClient } from '@/core/http/ApiClient';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { PackDetailsRepository } from './PackDetailsRepository';

const parkId = '11111111-1111-4111-8111-111111111111';
const landmarkId = '22222222-2222-4222-8222-222222222222';
const podcastId = '44444444-4444-4444-8444-444444444444';

describe('PackDetailsRepository', () =>
{
  it('fetches a pack and stores transcripts and descriptions for offline reading', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const pack = {
      schemaVersion: 1, parkId, etag: '"p"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 10,
      landmarks: [{ landmarkId, description: 'Full history', imageUrl: null }],
      podcasts: [{ podcastId, transcript: 'Spoken words' }],
      files: [],
    };
    const api = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation: async () => new Response(JSON.stringify(pack)), clock: new ManualClock(0), events: createAppEventBus() });
    const repository = new PackDetailsRepository(db, api);
    expect(await repository.transcript(podcastId)).toBeUndefined();
    await repository.fetchPack(parkId);
    expect(await repository.transcript(podcastId)).toBe('Spoken words');
    expect(await repository.landmarkDetail(landmarkId)).toEqual({ description: 'Full history', imageUrl: null, imageLocalPath: null });
    await repository.setLandmarkImageLocalPath(landmarkId, 'file:///x.jpg');
    expect((await repository.landmarkDetail(landmarkId))?.imageLocalPath).toBe('file:///x.jpg');
  });
});
