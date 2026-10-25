import { create } from 'zustand';
import type { GeofenceEngine, GeofenceState } from './GeofenceEngine';

export const useGeofenceStore = create<GeofenceState>(() => ({ prompt: null, nextUpLandmarkId: null, outOfRange: null, insideLandmarkIds: [], osRegionIds: [] }));

export function bindGeofenceStore(engine: GeofenceEngine): () => void
{
  useGeofenceStore.setState(engine.getState());
  return engine.subscribe((state) => useGeofenceStore.setState(state));
}
