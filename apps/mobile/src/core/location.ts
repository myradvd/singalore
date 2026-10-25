export interface LocationFix
{
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: number;
  source: 'device' | 'spoof';
}

export type LocationPermissionState = 'undetermined' | 'foreground' | 'always' | 'denied' | 'services_off';

export type LocationMode = 'browse' | 'tour';

export type LocationSignalStatus = 'idle' | 'searching' | 'ok' | 'waiting_for_signal' | 'permission_needed' | 'services_off';

export interface GeofenceTarget
{
  landmarkId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  hasPodcast: boolean;
}

export interface PlaybackStatusProvider
{
  isPlaying(): boolean;
  currentLandmarkId(): string | null;
}
