import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { LATEST_SCHEMA_VERSION, migrate, readSchemaVersion, type Migration } from './migrations';

describe('migrate', () =>
{
  it('creates the full schema on a fresh database and records the version', async () =>
  {
    const db = createMemoryDb();
    expect(await readSchemaVersion(db)).toBe(0);
    expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
    const tables = (await db.all("select name from sqlite_master where type = 'table' order by name")) as { name: string }[];
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'meta', 'parks', 'landmarks', 'podcasts', 'landmark_detail', 'podcast_detail', 'downloads', 'download_files',
      'audio_session', 'flow_cache', 'preferences', 'itineraries', 'saved_items', 'tour_history', 'diagnostics_log',
    ]));
  });

  it('is idempotent', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('applies only newer migrations, in order', async () =>
  {
    const db = createMemoryDb();
    const migrations: Migration[] = [
      { version: 2, statements: ['create table second (id integer)'] },
      { version: 1, statements: ['create table first (id integer)'] },
    ];
    await migrate(db, [migrations[1] as Migration]);
    expect(await readSchemaVersion(db)).toBe(1);
    expect(await migrate(db, migrations)).toBe(2);
    expect(await db.first("select name from sqlite_master where name = 'second'")).toEqual({ name: 'second' });
  });

  it('rolls back a failing migration and keeps the previous version', async () =>
  {
    const db = createMemoryDb();
    await expect(migrate(db, [{ version: 1, statements: ['create table ok (id integer)', 'this is not sql'] }])).rejects.toThrow();
    expect(await readSchemaVersion(db)).toBe(0);
    expect(await db.first("select name from sqlite_master where name = 'ok'")).toBeNull();
  });

  it('has no table that stores user coordinates', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const columns = (await db.all(
      "select m.name as tableName, p.name as columnName from sqlite_master m join pragma_table_info(m.name) p where m.type = 'table'",
    )) as { tableName: string; columnName: string }[];
    const coordinateColumns = columns.filter((column) => /^(lat|lng|latitude|longitude)$|_lat$|_lng$/.test(column.columnName));
    expect(coordinateColumns.every((column) => ['landmarks', 'parks'].includes(column.tableName))).toBe(true);
  });

  it('keeps the diagnostics log as a 500 row ring buffer', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    for (let index = 0; index < 520; index += 1)
    {
      await db.run('insert into diagnostics_log (at, level, code) values (?, ?, ?)', ['2026-10-12T00:00:00Z', 'info', `code_${index}`]);
    }
    expect(await db.first('select count(*) as total from diagnostics_log')).toEqual({ total: 500 });
    expect(await db.first('select min(code) as oldest from diagnostics_log where code = ?', ['code_19'])).toEqual({ oldest: null });
  });
});
