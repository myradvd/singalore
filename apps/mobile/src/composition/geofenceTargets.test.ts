import type { CatalogResponse } from '@singalore/shared';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { DbAdapter } from '@/core/db/DbAdapter';
import { migrate } from '@/core/db/migrations';
import { CatalogRepository } from '@/modules/catalog/CatalogRepository';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { evaluateBackgroundArrival } from '@/modules/geofence/backgroundArrival';
import { TOUR_TASK } from '@/modules/location/backgroundTracking';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { LANDMARK_CHIJMES, LANDMARK_SHELTER, catalogFixture } from '@test/support/catalogFixture';
import { geofenceTargetsFromCatalog } from './container';
import './backgroundTasks';

let mockDb: DbAdapter;

jest.mock('@/modules/audio/ExpoAudioEngine', () => ({}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn(async () => false) }));
jest.mock('@/core/db/expoSqliteAdapter', () => ({ openExpoSqliteAdapter: jest.fn(async () => mockDb) }));
jest.mock('@/modules/geofence/backgroundArrival', () =>
{
  const actual = jest.requireActual<typeof import('@/modules/geofence/backgroundArrival')>('@/modules/geofence/backgroundArrival');
  return { ...actual, evaluateBackgroundArrival: jest.fn(actual.evaluateBackgroundArrival) };
});

const CHIJMES_TARGET_WITH_PODCAST = {
  landmarkId: LANDMARK_CHIJMES,
  name: 'CHIJMES',
  latitude: 1.29516,
  longitude: 103.85193,
  radiusMeters: 30,
  hasPodcast: true,
};

const SHELTER_TARGET_WITHOUT_PODCAST = {
  landmarkId: LANDMARK_SHELTER,
  name: 'Tiong Bahru Air Raid Shelter',
  latitude: 1.28451,
  longitude: 103.83112,
  radiusMeters: 30,
  hasPodcast: false,
};

// Builds a catalog holding CHIJMES with its podcasts and the shelter without one.
function twoLandmarkCatalog(): CatalogResponse
{
  const catalog = catalogFixture();
  return {
    ...catalog,
    landmarks: catalog.landmarks.filter((landmark) => landmark.id === LANDMARK_CHIJMES || landmark.id === LANDMARK_SHELTER),
    podcasts: catalog.podcasts.filter((podcast) => podcast.landmarkId === LANDMARK_CHIJMES),
  };
}

// Builds a catalog with no landmarks and no podcasts.
function emptyCatalog(): CatalogResponse
{
  return { ...catalogFixture(), landmarks: [], podcasts: [] };
}

// Returns the targets the foreground path gives the geofence engine for a catalog.
function foregroundTargets(catalog: CatalogResponse)
{
  applyCatalogSnapshot({ parks: catalog.parks, landmarks: catalog.landmarks, podcasts: catalog.podcasts });
  return geofenceTargetsFromCatalog();
}

// Runs the tour task with no live runtime and returns the targets the headless path evaluated.
async function headlessTargets(catalog: CatalogResponse)
{
  mockDb = createMemoryDb();
  await migrate(mockDb);
  await new CatalogRepository(mockDb).replaceAll(catalog, '2026-10-12T00:00:00.000Z');
  const taskCall = jest.mocked(TaskManager.defineTask).mock.calls.find(([name]) => name === TOUR_TASK);
  const tourTask = taskCall?.[1] as unknown as (body: { data: { locations: LocationObject[] }; error: null }) => Promise<void>;
  const location: LocationObject = {
    coords: { latitude: 1.4, longitude: 103.9, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: 1000,
  };
  jest.mocked(evaluateBackgroundArrival).mockClear();
  await tourTask({ data: { locations: [location] }, error: null });
  const firstCall = jest.mocked(evaluateBackgroundArrival).mock.calls[0];
  return firstCall?.[0].targets;
}

describe('geofence targets from the foreground catalog store', () =>
{
  it('landmark with a podcast (valid EC) gives hasPodcast true and all 6 fields', () =>
  {
    const targets = foregroundTargets(twoLandmarkCatalog());
    expect(targets[0]).toEqual(CHIJMES_TARGET_WITH_PODCAST);
  });

  it('landmark without a podcast (valid EC) gives hasPodcast false', () =>
  {
    const targets = foregroundTargets(twoLandmarkCatalog());
    expect(targets[1]).toEqual(SHELTER_TARGET_WITHOUT_PODCAST);
  });

  it('catalog with no landmarks (zero iterations) gives an empty list', () =>
  {
    expect(foregroundTargets(emptyCatalog())).toEqual([]);
  });

  it('same snapshot read twice gives the same cached list', () =>
  {
    const targets = foregroundTargets(twoLandmarkCatalog());
    expect(geofenceTargetsFromCatalog()).toBe(targets);
  });
});

describe('geofence targets on the headless background path', () =>
{
  it('two landmarks give the same exact targets as the foreground path', async () =>
  {
    const targets = await headlessTargets(twoLandmarkCatalog());
    expect(targets).toEqual([CHIJMES_TARGET_WITH_PODCAST, SHELTER_TARGET_WITHOUT_PODCAST]);
  });

  it('catalog with no landmarks (zero iterations) gives an empty list', async () =>
  {
    expect(await headlessTargets(emptyCatalog())).toEqual([]);
  });
});
