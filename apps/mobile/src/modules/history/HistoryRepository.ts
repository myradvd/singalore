import { z } from 'zod';
import type { DbAdapter } from '@/core/db/DbAdapter';

const Row = z.object({
  id: z.string(),
  title: z.string(),
  landmark_ids_json: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  completion_status: z.enum(['completed', 'abandoned']),
  completed_landmark_ids_json: z.string(),
});

/** One finished tour: stops, start and end time, completed or abandoned, and which stops were visited. No GPS trace is stored. */
export interface TourHistoryEntry
{
  id: string;
  title: string;
  landmarkIds: string[];
  startedAt: string;
  endedAt: string;
  status: 'completed' | 'abandoned';
  completedLandmarkIds: string[];
}

function ids(json: string): string[]
{
  try
  {
    return z.array(z.string()).parse(JSON.parse(json));
  }
  catch
  {
    return [];
  }
}

/** Tour History stored on the device. */
export class HistoryRepository
{
  constructor(private readonly db: DbAdapter)
  {
  }

    /** Saves a tour when navigation ends. */
  async record(entry: TourHistoryEntry): Promise<void>
  {
    await this.db.run(
      `insert into tour_history (id, itinerary_id, landmark_ids_json, title, started_at, ended_at, completion_status, completed_landmark_ids_json)
        values (?, null, ?, ?, ?, ?, ?, ?)`,
      [entry.id, JSON.stringify(entry.landmarkIds), entry.title, entry.startedAt, entry.endedAt, entry.status, JSON.stringify(entry.completedLandmarkIds)],
    );
  }

    /** @returns All past tours, most recent first. */
  async list(): Promise<TourHistoryEntry[]>
  {
    const rows = z.array(Row).parse(await this.db.all('select id, title, landmark_ids_json, started_at, ended_at, completion_status, completed_landmark_ids_json from tour_history order by ended_at desc'));
    return rows.map((row) => ({ id: row.id, title: row.title, landmarkIds: ids(row.landmark_ids_json), startedAt: row.started_at, endedAt: row.ended_at, status: row.completion_status, completedLandmarkIds: ids(row.completed_landmark_ids_json) }));
  }
}
