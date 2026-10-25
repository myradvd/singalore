import type { GeoPoint } from '@singalore/shared';
import { create } from 'zustand';
import type { AppEventBus, NetworkRequestRecord } from '@/core/appEvents';

export const NETWORK_LOG_LIMIT = 50;
export const PATH_SPEEDS_MPS = [1.4, 3, 8, 20] as const;

export interface DebugState
{
  enabled: boolean;
  spoofActive: boolean;
  spoofPlacementArmed: boolean;
  showOverlay: boolean;
  showGeofenceRings: boolean;
  recordingPath: boolean;
  path: GeoPoint[];
  pathSpeedMps: number;
  playingPath: boolean;
  networkLog: NetworkRequestRecord[];
}

export const useDebugStore = create<DebugState>(() => ({
  enabled: false,
  spoofActive: false,
  spoofPlacementArmed: false,
  showOverlay: true,
  showGeofenceRings: false,
  recordingPath: false,
  path: [],
  pathSpeedMps: PATH_SPEEDS_MPS[0],
  playingPath: false,
  networkLog: [],
}));

export function toggleDebugMode(): boolean
{
  const enabled = !useDebugStore.getState().enabled;
  useDebugStore.setState(enabled ? { enabled } : { enabled, showGeofenceRings: false, recordingPath: false, spoofPlacementArmed: false });
  return enabled;
}

export function appendNetworkRecord(record: NetworkRequestRecord): void
{
  useDebugStore.setState((state) => ({ networkLog: [record, ...state.networkLog].slice(0, NETWORK_LOG_LIMIT) }));
}

export function bindNetworkLog(events: AppEventBus): () => void
{
  return events.on('network/request', appendNetworkRecord);
}

export function addPathPoint(point: GeoPoint): void
{
  useDebugStore.setState((state) => ({ path: [...state.path, point] }));
}
