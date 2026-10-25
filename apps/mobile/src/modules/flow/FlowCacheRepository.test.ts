import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { FlowCacheRepository } from './FlowCacheRepository';

describe('FlowCacheRepository', () =>
{
  it('returns null before anything is saved and round trips a payload', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const repository = new FlowCacheRepository(db, new ManualClock(0));
    expect(await repository.load()).toBeNull();
    await repository.save({ mode: 'route_in_progress', itinerary: ['a', 'b'], visitedLandmarkIds: ['a'], tourStartedAt: 12 });
    expect(await repository.load()).toEqual({ mode: 'route_in_progress', itinerary: ['a', 'b'], visitedLandmarkIds: ['a'], tourStartedAt: 12 });
    await repository.save({ mode: 'empty', itinerary: [], visitedLandmarkIds: [], tourStartedAt: null });
    expect((await repository.load())?.mode).toBe('empty');
  });

  it('treats a corrupt row as no cache', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    await db.run("insert into flow_cache (id, mode, payload_json, updated_at) values (1, 'route_editor', '{broken', 'x')");
    expect(await new FlowCacheRepository(db, new ManualClock(0)).load()).toBeNull();
  });
});
