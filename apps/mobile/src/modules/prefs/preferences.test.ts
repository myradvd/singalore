import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { DEFAULT_PREFERENCES } from './preferencesSchema';
import { PreferencesRepository } from './PreferencesRepository';
import { getPreferences, loadPreferences, resetPreferences, updatePreferences } from './preferencesStore';

async function setup()
{
  const db = createMemoryDb();
  await migrate(db);
  return { db, repository: new PreferencesRepository(db) };
}

describe('preferences (A3, A-NFR3)', () =>
{
  it('starts from defaults: triggers on, autoplay off, Wi-Fi only downloads, new episode alerts off', async () =>
  {
    const { repository } = await setup();
    const preferences = await repository.load();
    expect(preferences).toEqual(DEFAULT_PREFERENCES);
    expect(preferences.geofenceTriggersEnabled).toBe(true);
    expect(preferences.autoplayEnabled).toBe(false);
    expect(preferences.downloadOverWifiOnly).toBe(true);
    expect(preferences.notifyNewEpisodes).toBe(false);
  });

  it('persists changes and resets to defaults', async () =>
  {
    const { repository } = await setup();
    await updatePreferences(repository, { autoplayEnabled: true, walkingPace: 'slow', recommendationCategories: ['museum'] });
    expect(getPreferences().autoplayEnabled).toBe(true);
    const reloaded = await repository.load();
    expect(reloaded).toMatchObject({ autoplayEnabled: true, walkingPace: 'slow', recommendationCategories: ['museum'] });
    await resetPreferences(repository);
    expect(await repository.load()).toEqual(DEFAULT_PREFERENCES);
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects invalid values on save', async () =>
  {
    const { repository } = await setup();
    await expect(repository.save({ walkingPace: 'sprint' as never })).rejects.toThrow();
  });

  it('falls back to defaults for corrupt, invalid or unknown rows', async () =>
  {
    const { db, repository } = await setup();
    await db.run("insert into preferences (key, value_json) values ('autoplayEnabled', 'not json')");
    await db.run("insert into preferences (key, value_json) values ('walkingPace', '\"sprint\"')");
    await db.run("insert into preferences (key, value_json) values ('removedSetting', 'true')");
    await db.run("insert into preferences (key, value_json) values ('distanceUnit', '\"imperial\"')");
    const preferences = await loadPreferences(repository);
    expect(preferences.autoplayEnabled).toBe(false);
    expect(preferences.walkingPace).toBe('normal');
    expect(preferences.distanceUnit).toBe('imperial');
    expect(preferences).not.toHaveProperty('removedSetting');
  });
});
