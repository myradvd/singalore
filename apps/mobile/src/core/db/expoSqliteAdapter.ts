import * as SQLite from 'expo-sqlite';
import type { DbAdapter, RunResult, SqlValue } from './DbAdapter';

type Executor = Pick<SQLite.SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'>;

function wrap(executor: Executor, transaction: DbAdapter['transaction']): DbAdapter
{
  return {
    exec: async (sql) =>
    {
      await executor.execAsync(sql);
    },
    run: async (sql, params: readonly SqlValue[] = []): Promise<RunResult> =>
    {
      const result = await executor.runAsync(sql, [...params]);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    all: async (sql, params: readonly SqlValue[] = []) => executor.getAllAsync(sql, [...params]),
    first: async (sql, params: readonly SqlValue[] = []) => executor.getFirstAsync(sql, [...params]),
    transaction,
  };
}

export async function openExpoSqliteAdapter(databaseName: string): Promise<DbAdapter>
{
  const database = await SQLite.openDatabaseAsync(databaseName);
  await database.execAsync('pragma journal_mode = wal;');
  const nestedTransactionError = async (): Promise<void> =>
  {
    throw new Error('Nested transactions are not supported');
  };
  return wrap(database, async (work) =>
  {
    await database.withExclusiveTransactionAsync(async (transaction) =>
    {
      await work(wrap(transaction, nestedTransactionError));
    });
  });
}
