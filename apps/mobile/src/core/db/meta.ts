import type { DbAdapter } from './DbAdapter';

// Inserts or updates one meta row on the given database or open transaction.
export async function upsertMeta(db: DbAdapter, key: string, value: string): Promise<void>
{
  await db.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', [key, value]);
}
