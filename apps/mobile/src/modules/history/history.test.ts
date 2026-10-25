import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { HistoryRepository } from './HistoryRepository';

describe('HistoryRepository', () =>
{
  it('records tour outcomes without GPS traces', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const history = new HistoryRepository(db);
    await history.record({ id: 'h1', title: 'Civic walk', landmarkIds: ['a', 'b'], startedAt: 's', endedAt: 'e', status: 'abandoned', completedLandmarkIds: ['a'] });
    expect(await history.list()).toEqual([{ id: 'h1', title: 'Civic walk', landmarkIds: ['a', 'b'], startedAt: 's', endedAt: 'e', status: 'abandoned', completedLandmarkIds: ['a'] }]);
    const tables = (await db.all('select * from tour_history')) as Record<string, unknown>[];
    expect(JSON.stringify(tables)).not.toMatch(/103\.8|1\.29/);
  });
});
