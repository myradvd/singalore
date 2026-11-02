import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { DEFAULT_PREFERENCES } from './preferencesSchema';
import { PreferencesRepository } from './PreferencesRepository';
import { getPreferences, usePreferencesStore } from './preferencesStore';
import { clearRecentSites, MAX_STORED_RECENT_SITES, recordRecentSites, withRecentSites } from './recentSites';

function siteIds(count: number): string[]
{
  return Array.from({ length: count }, (_, position) => `site-${position + 1}`);
}

async function setup()
{
  usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES });
  const db = createMemoryDb();
  await migrate(db);
  return { db, repository: new PreferencesRepository(db) };
}

describe('withRecentSites', () =>
{
  it('zero added: an empty batch leaves the list unchanged', () =>
  {
    expect(withRecentSites(['a'], [])).toEqual(['a']);
  });

  it('newest first: an added site goes in front', () =>
  {
    expect(withRecentSites(['a'], ['b'])).toEqual(['b', 'a']);
  });

  it('no duplicates: selecting a stored site again moves it to the front', () =>
  {
    expect(withRecentSites(['a', 'b', 'c'], ['c'])).toEqual(['c', 'a', 'b']);
  });

  it('batch: the last site in a batch counts as newest', () =>
  {
    expect(withRecentSites([], ['a', 'b'])).toEqual(['b', 'a']);
  });

  it('batch with a repeat: the same site twice is stored once', () =>
  {
    expect(withRecentSites([], ['a', 'a'])).toEqual(['a']);
  });

  it('above the limit already: 21 held plus 1 new keeps 20', () =>
  {
    const result = withRecentSites(siteIds(21), ['new']);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe('new');
  });
});

describe('recordRecentSites stored limit', () =>
{
  it('the limit is 20', () =>
  {
    expect(MAX_STORED_RECENT_SITES).toBe(20);
  });

  it.each([
    ['just below the limit', 19, 19],
    ['on the limit', 20, 20],
    ['just above the limit', 21, 20],
  ])('%s: %i selected sites store %i, newest first', async (_name, selectedCount, storedCount) =>
  {
    const { repository } = await setup();
    for (const siteId of siteIds(selectedCount))
    {
      await recordRecentSites(repository, [siteId]);
    }
    const stored = (await repository.load()).recentSiteIds;
    expect(stored).toHaveLength(storedCount);
    expect(stored[0]).toBe(`site-${selectedCount}`);
    expect(stored.includes('site-1')).toBe(selectedCount <= 20);
  });
});

describe('recent sites storage', () =>
{
  it('starts empty on a new device', async () =>
  {
    const { repository } = await setup();
    expect((await repository.load()).recentSiteIds).toEqual([]);
  });

  it('record updates the store and survives a reload', async () =>
  {
    const { repository } = await setup();
    await recordRecentSites(repository, ['a']);
    expect(getPreferences().recentSiteIds).toEqual(['a']);
    expect((await repository.load()).recentSiteIds).toEqual(['a']);
  });

  it('zero added: recording nothing writes nothing', async () =>
  {
    const { db, repository } = await setup();
    await recordRecentSites(repository, []);
    expect(await db.all('select key from preferences')).toEqual([]);
  });

  it('clear removes them all from the store and the database', async () =>
  {
    const { repository } = await setup();
    await recordRecentSites(repository, ['a', 'b']);
    await clearRecentSites(repository);
    expect(getPreferences().recentSiteIds).toEqual([]);
    expect((await repository.load()).recentSiteIds).toEqual([]);
  });

  it('invalid EC: a corrupt stored value falls back to empty', async () =>
  {
    const { db, repository } = await setup();
    await db.run("insert into preferences (key, value_json) values ('recentSiteIds', '[1, 2]')");
    expect((await repository.load()).recentSiteIds).toEqual([]);
  });
});
