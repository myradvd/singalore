import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { systemClock } from '@/core/clock';
import type { DbAdapter } from '@/core/db/DbAdapter';
import { migrate } from '@/core/db/migrations';
import { CatalogRepository } from '@/modules/catalog/CatalogRepository';
import { DISMISS_SUPPRESSION_MS } from '@/modules/geofence/promptPolicy';
import { TOUR_TASK } from '@/modules/location/backgroundTracking';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { LANDMARK_CHIJMES, catalogFixture } from '@test/support/catalogFixture';
import './backgroundTasks';

let mockDb: DbAdapter;

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn(async () => false) }));
jest.mock('@/core/db/expoSqliteAdapter', () => ({ openExpoSqliteAdapter: jest.fn(async () => mockDb) }));
jest.mock('@/modules/notifications/ExpoLocalNotifier', () => ({ createExpoLocalNotifier: () => ({ notify: jest.fn(async () => undefined) }) }));

const NOTIFIED_KEY = `bg_notified:${LANDMARK_CHIJMES}`;
const FIRST_ARRIVAL_AT = 1_000_000;

// Runs the tour task with no live runtime for one accurate fix at CHIJMES at the given time.
async function runHeadlessFixAtChijmes(now: number): Promise<void>
{
  jest.spyOn(systemClock, 'now').mockReturnValue(now);
  const taskCall = jest.mocked(TaskManager.defineTask).mock.calls.find(([name]) => name === TOUR_TASK);
  const tourTask = taskCall?.[1] as unknown as (body: { data: { locations: LocationObject[] }; error: null }) => Promise<void>;
  const location: LocationObject = {
    coords: { latitude: 1.29516, longitude: 103.85193, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: now,
  };
  await tourTask({ data: { locations: [location] }, error: null });
}

describe('headless arrival meta write', () =>
{
  beforeEach(async () =>
  {
    mockDb = createMemoryDb();
    await migrate(mockDb);
    await new CatalogRepository(mockDb).replaceAll(catalogFixture(), '2026-10-12T00:00:00.000Z');
  });

  afterEach(() =>
  {
    jest.restoreAllMocks();
  });

  it('first arrival at a landmark inserts one notified row holding the time', async () =>
  {
    await runHeadlessFixAtChijmes(FIRST_ARRIVAL_AT);
    const rows = await mockDb.all('select key, value from meta where key = ?', [NOTIFIED_KEY]);
    expect(rows).toEqual([{ key: NOTIFIED_KEY, value: String(FIRST_ARRIVAL_AT) }]);
  });

  it('second arrival after the suppression window keeps one row with the new time', async () =>
  {
    const secondArrivalAt = FIRST_ARRIVAL_AT + DISMISS_SUPPRESSION_MS;
    await runHeadlessFixAtChijmes(FIRST_ARRIVAL_AT);
    await runHeadlessFixAtChijmes(secondArrivalAt);
    const rows = await mockDb.all('select key, value from meta where key = ?', [NOTIFIED_KEY]);
    expect(rows).toEqual([{ key: NOTIFIED_KEY, value: String(secondArrivalAt) }]);
  });
});
