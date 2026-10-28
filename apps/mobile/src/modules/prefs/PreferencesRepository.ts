import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';
import { DEFAULT_PREFERENCES, PreferenceShapes, type PreferenceKey, type Preferences } from './preferencesSchema';

const Row = z.object({ key: z.string(), value_json: z.string() });

function isPreferenceKey(key: string): key is PreferenceKey
{
  return Object.prototype.hasOwnProperty.call(PreferenceShapes, key);
}

/** Stores the walker's preferences in SQLite as key/value pairs, validated with zod (PreferenceManager in the design). */
export class PreferencesRepository
{
  constructor(private readonly db: DbAdapter)
  {
  }

    /** @returns All preferences. Missing or invalid values fall back to the defaults. */
  async load(): Promise<Preferences>
  {
    const rows = z.array(Row).parse(await this.db.all('select key, value_json from preferences'));
    const result: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
    for (const row of rows)
    {
      if (!isPreferenceKey(row.key))
      {
        continue;
      }
      let raw: unknown;
      try
      {
        raw = JSON.parse(row.value_json);
      }
      catch
      {
        continue;
      }
      const parsed = PreferenceShapes[row.key].safeParse(raw);
      if (parsed.success)
      {
        result[row.key] = parsed.data;
      }
    }
    return result as Preferences;
  }

    /** Validates and saves the changed preferences in one transaction. @throws If a value is invalid. */
  async save(changes: Partial<Preferences>): Promise<void>
  {
    const entries: [PreferenceKey, unknown][] = [];
    for (const key of Object.keys(changes))
    {
      if (isPreferenceKey(key))
      {
        const value: unknown = changes[key];
        PreferenceShapes[key].parse(value);
        entries.push([key, value]);
      }
    }
    await this.db.transaction(async (transaction) =>
    {
      for (const [key, value] of entries)
      {
        await transaction.run(
          'insert into preferences (key, value_json) values (?, ?) on conflict(key) do update set value_json = excluded.value_json',
          [key, JSON.stringify(value)],
        );
      }
    });
  }

    /** Reset to defaults: deletes all saved preferences. */
  async reset(): Promise<void>
  {
    await this.db.run('delete from preferences');
  }
}
