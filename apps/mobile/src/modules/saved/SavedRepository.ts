import { z } from 'zod';
import type { Clock } from '@/core/clock';
import type { DbAdapter } from '@/core/db/DbAdapter';

const SavedRow = z.object({ id: z.string(), item_type: z.enum(['landmark', 'itinerary']), reference_id: z.string(), saved_at: z.string() });
const ItineraryRow = z.object({ id: z.string(), title: z.string(), landmark_ids_json: z.string(), created_at: z.string() });

export interface SavedItinerary
{
  id: string;
  title: string;
  landmarkIds: string[];
  createdAt: string;
}

function parseIds(json: string): string[]
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

/** Saved Routes and Sites: bookmarked landmarks and saved itineraries, stored on the device. */
export class SavedRepository
{
  private counter = 0;

  constructor(private readonly db: DbAdapter, private readonly clock: Clock)
  {
  }

  private newId(prefix: string): string
  {
    this.counter += 1;
    return `${prefix}-${this.clock.now().toString(36)}-${this.counter}`;
  }

  async savedLandmarkIds(): Promise<string[]>
  {
    const rows = z.array(SavedRow).parse(await this.db.all("select * from saved_items where item_type = 'landmark' order by saved_at desc"));
    return rows.map((row) => row.reference_id);
  }

    /** Bookmarks a landmark, or removes the bookmark if it exists. @returns True if now saved. */
  async toggleLandmark(landmarkId: string): Promise<boolean>
  {
    const existing = await this.db.first("select id from saved_items where item_type = 'landmark' and reference_id = ?", [landmarkId]);
    if (existing !== null)
    {
      await this.db.run("delete from saved_items where item_type = 'landmark' and reference_id = ?", [landmarkId]);
      return false;
    }
    await this.db.run('insert into saved_items (id, item_type, reference_id, saved_at) values (?, ?, ?, ?)', [this.newId('saved'), 'landmark', landmarkId, new Date(this.clock.now()).toISOString()]);
    return true;
  }

    /** Saves a route ("Save and Exit"). @returns The new itinerary's id. */
  async saveItinerary(title: string, landmarkIds: string[]): Promise<string>
  {
    const id = this.newId('route');
    const now = new Date(this.clock.now()).toISOString();
    await this.db.transaction(async (transaction) =>
    {
      await transaction.run('insert into itineraries (id, title, landmark_ids_json, is_draft, created_at, updated_at) values (?, ?, ?, 0, ?, ?)', [id, title, JSON.stringify(landmarkIds), now, now]);
      await transaction.run('insert into saved_items (id, item_type, reference_id, saved_at) values (?, ?, ?, ?)', [this.newId('saved'), 'itinerary', id, now]);
    });
    return id;
  }

    /** @returns Saved routes, newest first. */
  async savedItineraries(): Promise<SavedItinerary[]>
  {
    const rows = z.array(ItineraryRow).parse(await this.db.all(
      "select i.id, i.title, i.landmark_ids_json, i.created_at from itineraries i join saved_items s on s.reference_id = i.id and s.item_type = 'itinerary' order by s.saved_at desc",
    ));
    return rows.map((row) => ({ id: row.id, title: row.title, landmarkIds: parseIds(row.landmark_ids_json), createdAt: row.created_at }));
  }

    /** Deletes a saved route. */
  async deleteItinerary(id: string): Promise<void>
  {
    await this.db.transaction(async (transaction) =>
    {
      await transaction.run("delete from saved_items where item_type = 'itinerary' and reference_id = ?", [id]);
      await transaction.run('delete from itineraries where id = ?', [id]);
    });
  }
}
