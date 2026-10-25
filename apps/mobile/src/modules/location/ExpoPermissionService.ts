import * as Location from 'expo-location';
import { Linking } from 'react-native';
import type { PermissionService, RawPermissionSnapshot } from './permissions';

function normalize(status: string): 'granted' | 'denied' | 'undetermined'
{
  if (status === 'granted')
  {
    return 'granted';
  }
  return status === 'denied' ? 'denied' : 'undetermined';
}

async function readSnapshot(): Promise<RawPermissionSnapshot>
{
  const [servicesEnabled, foreground, background] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    servicesEnabled,
    foreground: normalize(foreground.status),
    background: normalize(background.status),
    foregroundCanAskAgain: foreground.canAskAgain,
  };
}

export const expoPermissionService: PermissionService = {
  snapshot: readSnapshot,
  requestForeground: async () =>
  {
    await Location.requestForegroundPermissionsAsync();
    return readSnapshot();
  },
  requestBackground: async () =>
  {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status === 'granted')
    {
      await Location.requestBackgroundPermissionsAsync();
    }
    return readSnapshot();
  },
  openAppSettings: async () =>
  {
    await Linking.openSettings();
  },
};
