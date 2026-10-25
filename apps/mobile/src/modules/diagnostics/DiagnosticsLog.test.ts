import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { DiagnosticsLog } from './DiagnosticsLog';

describe('DiagnosticsLog', () =>
{
  it('records entries newest first without positions and emits an event', async () =>
  {
    const db = createMemoryDb();
    await migrate(db);
    const events = createAppEventBus();
    const seen: string[] = [];
    events.on('diagnostics/recorded', (entry) => seen.push(entry.code));
    const log = new DiagnosticsLog(db, new ManualClock(Date.parse('2026-10-12T01:00:00Z')), events);
    await log.record('warn', 'gps_signal_lost', 'last fix 1.295123, 103.852011 was 12 s ago');
    await log.record('error', 'api_timeout');
    const entries = await log.list();
    expect(entries.map((entry) => entry.code)).toEqual(['api_timeout', 'gps_signal_lost']);
    expect(entries[1]?.detail).toBe('last fix [redacted] was 12 s ago');
    expect(entries[1]?.at).toBe('2026-10-12T01:00:00.000Z');
    expect(seen).toEqual(['gps_signal_lost', 'api_timeout']);
    await log.clear();
    expect(await log.list()).toEqual([]);
  });
});
