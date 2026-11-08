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

  it('deleting a park drops only that park\'s descriptions and transcripts', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const otherPark = '55555555-5555-4555-8555-555555555555';
    const otherLandmark = '66666666-6666-4666-8666-666666666666';
    const otherPodcast = '77777777-7777-4777-8777-777777777777';
    const landmarkRow = 'insert into landmarks (id, park_id, slug, name, aliases_json, category, lat, lng, geofence_radius_m, short_description, sort_order, attribution) values (?, ?, ?, ?, \'[]\', \'civic\', 1.3, 103.8, 30, \'\', 0, \'test\')';
    const podcastRow = 'insert into podcasts (id, landmark_id, title, audio_url, duration_seconds, file_size_bytes, has_transcript) values (?, ?, \'t\', \'https://cdn.test/a.m4a\', 300, 1, 1)';
    await db.run(landmarkRow, [landmarkId, parkId, 'a', 'A']);
    await db.run(landmarkRow, [otherLandmark, otherPark, 'b', 'B']);
    await db.run(podcastRow, [podcastId, landmarkId]);
    await db.run(podcastRow, [otherPodcast, otherLandmark]);
    const api = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation: async () => new Response(null, { status: 503 }), clock: new ManualClock(0), events: createAppEventBus() });
    const repository = new PackDetailsRepository(db, api);
    const detail = (id: string, description: string) => ({ landmarkId: id, description, imageUrl: null });
    await repository.storeDetails({ schemaVersion: 1, parkId, etag: '"p"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [detail(landmarkId, 'A text'), detail(otherLandmark, 'B text')], podcasts: [{ podcastId, transcript: 'A words' }, { podcastId: otherPodcast, transcript: 'B words' }], files: [] });
    await repository.deleteForPark(parkId);
    expect(await repository.landmarkDetail(landmarkId)).toBeNull();
    expect(await repository.transcript(podcastId)).toBeUndefined();
    expect((await repository.landmarkDetail(otherLandmark))?.description).toBe('B text');
    expect(await repository.transcript(otherPodcast)).toBe('B words');
  });
});
