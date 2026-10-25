import { create } from 'zustand';
import type { LocationEngine, LocationEngineState } from './LocationEngine';

export const useLocationStore = create<LocationEngineState & { refreshRateHz: number | null }>(() => ({
  status: 'idle',
  permission: 'undetermined',
  mode: 'browse',
  sourceKind: 'device',
  lastFix: null,
  fixIntervalsMs: [],
  refreshRateHz: null,
}));

export function bindLocationStore(engine: LocationEngine): () => void
{
  const sync = (state: LocationEngineState) => useLocationStore.setState({ ...state, refreshRateHz: engine.refreshRateHz() });
  sync(engine.getState());
  return engine.subscribe(sync);
}
