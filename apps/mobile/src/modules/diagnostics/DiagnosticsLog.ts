import { z } from 'zod';
import type { AppEventBus } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { DiagnosticsLevel, DiagnosticsRecorder } from '@/core/diagnostics';
import { redactCoordinates } from '@/core/redact';


export const DiagnosticsEntrySchema = z.object({
  id: z.number(),
  at: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  code: z.string(),
  detail: z.string().nullable(),
});
export type DiagnosticsEntry = z.infer<typeof DiagnosticsEntrySchema>;

export class DiagnosticsLog implements DiagnosticsRecorder
{
  constructor(private readonly db: DbAdapter, private readonly clock: Clock, private readonly events: AppEventBus)
  {
  }

  async record(level: DiagnosticsLevel, code: string, detail?: string): Promise<void>
  {
    const safeDetail = detail === undefined ? null : redactCoordinates(detail).slice(0, 500);
    await this.db.run('insert into diagnostics_log (at, level, code, detail) values (?, ?, ?, ?)', [
      new Date(this.clock.now()).toISOString(),
      level,
      code,
      safeDetail,
    ]);
    this.events.emit('diagnostics/recorded', { level, code });
  }

  async list(limit = 200): Promise<DiagnosticsEntry[]>
  {
    const rows = await this.db.all('select id, at, level, code, detail from diagnostics_log order by id desc limit ?', [limit]);
    return z.array(DiagnosticsEntrySchema).parse(rows);
  }

  async clear(): Promise<void>
  {
    await this.db.run('delete from diagnostics_log');
  }
}
