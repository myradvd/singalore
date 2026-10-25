import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { SavedRepository } from './SavedRepository';

describe('saved routes and bookmarks (A4)', () =>
{
  it('bookmarks landmarks and saves and deletes itineraries', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const saved = new SavedRepository(db, new ManualClock(Date.parse('2026-10-12T00:00:00Z')));
    expect(await saved.toggleLandmark('a')).toBe(true);
    expect(await saved.savedLandmarkIds()).toEqual(['a']);
    expect(await saved.toggleLandmark('a')).toBe(false);
    const id = await saved.saveItinerary('Civic walk', ['a', 'b']);
    expect(await saved.savedItineraries()).toEqual([{ id, title: 'Civic walk', landmarkIds: ['a', 'b'], createdAt: '2026-10-12T00:00:00.000Z' }]);
    await saved.deleteItinerary(id);
    expect(await saved.savedItineraries()).toEqual([]);
  });
});
