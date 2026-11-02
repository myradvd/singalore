import type { LocationEngineState } from '@/modules/location/LocationEngine';

export const SERVICES_RECHECK_INTERVAL_MS = 10000;

export interface ServicesRecheckDependencies
{
  appState: () => string;
  locationState: () => Pick<LocationEngineState, 'status' | 'sourceKind'>;
  refreshPermission: () => Promise<void>;
}

// Rereads the location permission every 10 s while the app lacks a healthy device signal, and returns the stop function.
export function startServicesRecheck(dependencies: ServicesRecheckDependencies): () => void
{
  const interval = setInterval(() =>
  {
    const { status, sourceKind } = dependencies.locationState();
    if (dependencies.appState() === 'active' && sourceKind === 'device' && (status === 'waiting_for_signal' || status === 'services_off'))
    {
      // A failed read changes nothing, and the next tick tries again.
      void dependencies.refreshPermission().catch(() => undefined);
    }
  }, SERVICES_RECHECK_INTERVAL_MS);
  return () => clearInterval(interval);
}
