import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { SavedRepository } from './SavedRepository';

describe('SavedRepository.removeLandmark', () =>
{
  // Builds a repository on an empty migrated in memory database.
  async function createSavedRepository()
  {
    const db = createMemoryDb();
    await migrate(db);
    return new SavedRepository(db, new ManualClock(Date.parse('2026-10-12T00:00:00Z')));
  }

  it('saved site: removes only that site', async () =>
  {
    const saved = await createSavedRepository();
    await saved.toggleLandmark('a');
    await saved.toggleLandmark('b');
    await saved.removeLandmark('a');
    expect(await saved.savedLandmarkIds()).toEqual(['b']);
  });

  it('absent site: on an empty list does nothing and does not throw', async () =>
  {
    const saved = await createSavedRepository();
    await expect(saved.removeLandmark('a')).resolves.toBeUndefined();
    expect(await saved.savedLandmarkIds()).toEqual([]);
  });

  it('repeated calls: a second and third removal leave the site not saved and do not throw', async () =>
  {
    const saved = await createSavedRepository();
    await saved.toggleLandmark('a');
    await saved.removeLandmark('a');
    await expect(saved.removeLandmark('a')).resolves.toBeUndefined();
    await expect(saved.removeLandmark('a')).resolves.toBeUndefined();
    expect(await saved.savedLandmarkIds()).toEqual([]);
  });
});

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
