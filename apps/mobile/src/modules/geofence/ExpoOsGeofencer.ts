import * as Location from 'expo-location';
import type { OsGeofencer } from './GeofenceEngine';
import type { OsRegion } from './osWindow';

export const GEOFENCE_TASK = 'singalore-geofence';

export function createExpoOsGeofencer(canUseBackground: () => boolean): OsGeofencer
{
  return {
    setRegions: async (regions: OsRegion[]) =>
    {
      if (regions.length === 0 || !canUseBackground())
      {
        if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
        {
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
        }
        return;
      }
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions.map((region) => ({
        identifier: region.identifier,
        latitude: region.latitude,
        longitude: region.longitude,
        radius: region.radius,
        notifyOnEnter: true,
        notifyOnExit: false,
      })));
    },
    clear: async () =>
    {
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
      {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }
    },
  };
}
