import Database from 'better-sqlite3';
import type { DbAdapter, SqlValue } from '@/core/db/DbAdapter';

export function createMemoryDb(): DbAdapter
{
  const database = new Database(':memory:');
  let inTransaction = false;
  const adapter: DbAdapter = {
    exec: async (sql) =>
    {
      database.exec(sql);
    },
    run: async (sql, params: readonly SqlValue[] = []) =>
    {
      const result = database.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    all: async (sql, params: readonly SqlValue[] = []) => database.prepare(sql).all(...params),
    first: async (sql, params: readonly SqlValue[] = []) =>
    {
      const statement = database.prepare(sql);
      return statement.reader ? (statement.get(...params) ?? null) : null;
    },
    transaction: async (work) =>
    {
      if (inTransaction)
      {
        throw new Error('Nested transactions are not supported');
      }
      inTransaction = true;
      database.exec('begin');
      try
      {
        await work(adapter);
        database.exec('commit');
      }
      catch (error)
      {
        database.exec('rollback');
        throw error;
      }
      finally
      {
        inTransaction = false;
      }
    },
  };
  return adapter;
}
