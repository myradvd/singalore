import { z } from 'zod';
import type { Clock } from '@/core/clock';
import type { DbAdapter } from '@/core/db/DbAdapter';
import type { FlowCachePayload } from './flowTypes';

const FlowCacheRow = z.object({ mode: z.enum(['empty', 'route_editor', 'route_in_progress']), payload_json: z.string() });
const Payload = z.object({
  itinerary: z.array(z.string()),
  visitedLandmarkIds: z.array(z.string()),
  tourStartedAt: z.number().nullable(),
});

export class FlowCacheRepository
{
  constructor(private readonly db: DbAdapter, private readonly clock: Clock)
  {
  }

  async load(): Promise<FlowCachePayload | null>
  {
    const row = await this.db.first('select mode, payload_json from flow_cache where id = 1');
    if (row === null)
    {
      return null;
    }
    const parsedRow = FlowCacheRow.safeParse(row);
    if (!parsedRow.success)
    {
      return null;
    }
    let raw: unknown;
    try
    {
      raw = JSON.parse(parsedRow.data.payload_json);
    }
    catch
    {
      return null;
    }
    const payload = Payload.safeParse(raw);
    return payload.success ? { mode: parsedRow.data.mode, ...payload.data } : null;
  }

  async save(cache: FlowCachePayload): Promise<void>
  {
    const { mode, ...payload } = cache;
    await this.db.run(
      `insert into flow_cache (id, mode, payload_json, updated_at) values (1, ?, ?, ?)
        on conflict(id) do update set mode = excluded.mode, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
      [mode, JSON.stringify(payload), new Date(this.clock.now()).toISOString()],
    );
  }
}
