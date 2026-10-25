import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { systemClock } from '@/core/clock';
import { openExpoSqliteAdapter } from '@/core/db/expoSqliteAdapter';
import { migrate } from '@/core/db/migrations';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { CatalogRepository } from '@/modules/catalog/CatalogRepository';
import { arrivalNotificationText, evaluateBackgroundArrival } from '@/modules/geofence/backgroundArrival';
import { GEOFENCE_TASK } from '@/modules/geofence/ExpoOsGeofencer';
import { APPROACH_TASK, APPROACH_WATCH_MS, startApproachWatch, stopApproachWatch, TOUR_TASK } from '@/modules/location/backgroundTracking';
import { toLocationFix } from '@/modules/location/DeviceLocationSource';
import { createExpoLocalNotifier } from '@/modules/notifications/ExpoLocalNotifier';
import { PreferencesRepository } from '@/modules/prefs/PreferencesRepository';
import { DATABASE_NAME } from './databaseName';

export interface LiveBackgroundRuntime
{
  acceptBackgroundFixes(fixes: LocationFix[]): void;
}

let liveRuntime: LiveBackgroundRuntime | null = null;
let approachStartedAt: number | null = null;

export function registerLiveBackgroundRuntime(runtime: LiveBackgroundRuntime | null): void
{
  liveRuntime = runtime;
}

const NOTIFIED_PREFIX = 'bg_notified:';

async function handleHeadlessFix(fix: LocationFix, candidateLandmarkId?: string): Promise<'arrived' | 'approaching' | 'none'>
{
  const db = await openExpoSqliteAdapter(DATABASE_NAME);
  await migrate(db);
  const catalog = await new CatalogRepository(db).load();
  const preferences = await new PreferencesRepository(db).load();
  const withPodcast = new Set(catalog.podcasts.map((podcast) => podcast.landmarkId));
  const targets: GeofenceTarget[] = catalog.landmarks.map((landmark) => ({
    landmarkId: landmark.id,
    name: landmark.name,
    latitude: landmark.position.lat,
    longitude: landmark.position.lng,
    radiusMeters: landmark.geofenceRadiusM,
    hasPodcast: withPodcast.has(landmark.id),
  }));
  const notifiedRows = (await db.all('select key, value from meta where key like ?', [`${NOTIFIED_PREFIX}%`])) as { key: string; value: string }[];
  const lastNotifiedAt = new Map(notifiedRows.map((row) => [row.key.slice(NOTIFIED_PREFIX.length), Number(row.value)]));
  const now = systemClock.now();
  const result = evaluateBackgroundArrival({
    fix,
    targets,
    geofenceTriggersEnabled: preferences.geofenceTriggersEnabled,
    lastNotifiedAt,
    now,
    ...(candidateLandmarkId === undefined ? {} : { candidateLandmarkId }),
  });
  if (result.kind === 'arrived')
  {
    const notifier = createExpoLocalNotifier((category) => category !== 'arrivals' || preferences.notifyArrivals);
    const text = arrivalNotificationText(result.name);
    await notifier.notify('arrivals', text.title, text.body, { landmarkId: result.landmarkId });
    await db.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', [`${NOTIFIED_PREFIX}${result.landmarkId}`, String(now)]);
  }
  return result.kind;
}

TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(GEOFENCE_TASK, async ({ data, error }) =>
{
  if (error !== null || data.eventType !== Location.GeofencingEventType.Enter)
  {
    return;
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const fix = toLocationFix(location);
  if (liveRuntime !== null)
  {
    liveRuntime.acceptBackgroundFixes([fix]);
    return;
  }
  const outcome = await handleHeadlessFix(fix, data.region.identifier ?? undefined);
  if (outcome === 'approaching')
  {
    approachStartedAt = systemClock.now();
    await startApproachWatch();
  }
});

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TOUR_TASK, async ({ data, error }) =>
{
  if (error !== null || data.locations.length === 0)
  {
    return;
  }
  const fixes = data.locations.map(toLocationFix);
  if (liveRuntime !== null)
  {
    liveRuntime.acceptBackgroundFixes(fixes);
    return;
  }
  const latest = fixes[fixes.length - 1];
  if (latest !== undefined)
  {
    await handleHeadlessFix(latest);
  }
});

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(APPROACH_TASK, async ({ data, error }) =>
{
  const expired = approachStartedAt === null || systemClock.now() - approachStartedAt > APPROACH_WATCH_MS;
  if (error !== null || data.locations.length === 0)
  {
    if (expired)
    {
      await stopApproachWatch();
    }
    return;
  }
  const latest = data.locations.map(toLocationFix).at(-1);
  if (liveRuntime !== null && latest !== undefined)
  {
    liveRuntime.acceptBackgroundFixes([latest]);
    await stopApproachWatch();
    return;
  }
  const outcome = latest === undefined ? 'none' : await handleHeadlessFix(latest);
  if (outcome === 'arrived' || expired)
  {
    approachStartedAt = null;
    await stopApproachWatch();
  }
});
