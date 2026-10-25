import { EventBus } from './events';
import type { LocationFix, LocationPermissionState, LocationSignalStatus } from './location';

export interface NetworkRequestRecord
{
  id: number;
  method: 'GET' | 'POST';
  path: string;
  status: number | null;
  latencyMs: number;
  outcome: 'ok' | 'not_modified' | 'http_error' | 'timeout' | 'network_error' | 'invalid_response';
  at: number;
}

export interface AppEventMap
{
  'network/request': NetworkRequestRecord;
  'catalog/updated': { parkCount: number; landmarkCount: number; podcastCount: number };
  'diagnostics/recorded': { level: 'info' | 'warn' | 'error'; code: string };
  'location/fix': LocationFix;
  'location/status': { status: LocationSignalStatus; permission: LocationPermissionState };
  'geofence/enter': { landmarkId: string; at: number; distanceMeters: number; source: 'foreground' | 'background' | 'forced' };
  'geofence/exit': { landmarkId: string; at: number };
  'audio/playLandmarkRequested': { landmarkId: string; reason: 'prompt_accepted' | 'autoplay' | 'manual' | 'queued' };
  'tour/trackingChanged': { active: boolean };
  'audio/started': { landmarkId: string; podcastId: string };
  'audio/ended': { landmarkId: string; podcastId: string };
}

export type AppEventBus = EventBus<AppEventMap>;

export function createAppEventBus(): AppEventBus
{
  return new EventBus<AppEventMap>();
}
