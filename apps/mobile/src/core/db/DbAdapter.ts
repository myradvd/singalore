export type SqlValue = string | number | null;

export interface RunResult
{
  changes: number;
  lastInsertRowId: number;
}

export interface DbAdapter
{
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all(sql: string, params?: readonly SqlValue[]): Promise<unknown[]>;
  first(sql: string, params?: readonly SqlValue[]): Promise<unknown | null>;
  transaction(work: (transaction: DbAdapter) => Promise<void>): Promise<void>;
}
