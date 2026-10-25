import * as Location from 'expo-location';
import type { LocationMode } from '@/core/location';
import { MODE_SETTINGS, type LocationSource, type LocationSourceHandle } from './LocationSource';

export function toLocationFix(location: Location.LocationObject)
{
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? null,
    timestamp: location.timestamp,
    source: 'device' as const,
  };
}

export class DeviceLocationSource implements LocationSource
{
  readonly kind = 'device' as const;

  async start(mode: LocationMode, onFix: Parameters<LocationSource['start']>[1], onError: Parameters<LocationSource['start']>[2]): Promise<LocationSourceHandle>
  {
    const settings = MODE_SETTINGS[mode];
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: settings.accuracy === 'high' ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
        distanceInterval: settings.distanceIntervalMeters,
        timeInterval: settings.timeIntervalMs,
      },
      (location) => onFix(toLocationFix(location)),
      (reason) => onError(reason),
    );
    return { stop: () => subscription.remove() };
  }
}
