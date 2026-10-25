import * as Location from 'expo-location';

export const TOUR_TASK = 'singalore-tour-location';
export const APPROACH_TASK = 'singalore-approach-location';
export const APPROACH_WATCH_MS = 3 * 60 * 1000;

export const TOUR_NOTIFICATION = {
  notificationTitle: 'Singalore tour active',
  notificationBody: 'Watching for heritage sites on your route',
  notificationColor: '#1D6A66',
};

export async function startTourBackgroundUpdates(): Promise<void>
{
  if (await Location.hasStartedLocationUpdatesAsync(TOUR_TASK))
  {
    return;
  }
  await Location.startLocationUpdatesAsync(TOUR_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 10,
    deferredUpdatesInterval: 5000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: { ...TOUR_NOTIFICATION, killServiceOnDestroy: false },
  });
}

export async function stopTourBackgroundUpdates(): Promise<void>
{
  if (await Location.hasStartedLocationUpdatesAsync(TOUR_TASK))
  {
    await Location.stopLocationUpdatesAsync(TOUR_TASK);
  }
}

export async function startApproachWatch(): Promise<void>
{
  if (await Location.hasStartedLocationUpdatesAsync(TOUR_TASK) || await Location.hasStartedLocationUpdatesAsync(APPROACH_TASK))
  {
    return;
  }
  await Location.startLocationUpdatesAsync(APPROACH_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    foregroundService: { notificationTitle: 'Singalore', notificationBody: 'Checking if you have reached a heritage site', notificationColor: '#1D6A66' },
  });
}

export async function stopApproachWatch(): Promise<void>
{
  if (await Location.hasStartedLocationUpdatesAsync(APPROACH_TASK))
  {
    await Location.stopLocationUpdatesAsync(APPROACH_TASK);
  }
}
