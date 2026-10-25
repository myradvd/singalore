import type { LocationPermissionState } from '@/core/location';

export interface RawPermissionSnapshot
{
  servicesEnabled: boolean;
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
  foregroundCanAskAgain: boolean;
}

export function resolvePermissionState(snapshot: RawPermissionSnapshot): LocationPermissionState
{
  if (!snapshot.servicesEnabled)
  {
    return 'services_off';
  }
  if (snapshot.foreground === 'granted')
  {
    return snapshot.background === 'granted' ? 'always' : 'foreground';
  }
  if (snapshot.foreground === 'denied' && !snapshot.foregroundCanAskAgain)
  {
    return 'denied';
  }
  return snapshot.foreground === 'denied' ? 'denied' : 'undetermined';
}

export function canTrackLocation(state: LocationPermissionState): boolean
{
  return state === 'foreground' || state === 'always';
}

export interface PermissionService
{
  snapshot(): Promise<RawPermissionSnapshot>;
  requestForeground(): Promise<RawPermissionSnapshot>;
  requestBackground(): Promise<RawPermissionSnapshot>;
  openAppSettings(): Promise<void>;
}
