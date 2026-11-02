import { startTourBackgroundUpdates, stopApproachWatch, stopTourBackgroundUpdates } from '@/modules/location/backgroundTracking';
import type { AppServices } from './container';

export async function startTourTracking(services: AppServices): Promise<void>
{
  services.geofence.resetTour();
  await services.location.setMode('tour');
  services.events.emit('tour/trackingChanged', { active: true });
  if (services.location.getState().permission !== 'always')
  {
    await services.diagnostics.record('info', 'tour_foreground_only');
    return;
  }
  await startTourBackgroundTracking(services);
}

// Starts background location for a tour and records a warning if it fails.
export async function startTourBackgroundTracking(services: AppServices): Promise<void>
{
  try
  {
    await stopApproachWatch();
    await startTourBackgroundUpdates();
  }
  catch (error)
  {
    await services.diagnostics.record('warn', 'tour_background_start_failed', error instanceof Error ? error.message : 'unknown');
  }
}

// Starts background location when permission becomes always during a tour.
export function bindLateBackgroundGrant(services: AppServices): () => void
{
  let previousPermission = services.location.getState().permission;
  return services.location.subscribe((state) =>
  {
    const becameAlways = state.permission === 'always' && previousPermission !== 'always';
    previousPermission = state.permission;
    if (becameAlways && state.mode === 'tour')
    {
      void startTourBackgroundTracking(services);
    }
  });
}

export async function stopTourTracking(services: AppServices): Promise<void>
{
  services.geofence.resetTour();
  await services.location.setMode('browse');
  services.events.emit('tour/trackingChanged', { active: false });
  try
  {
    await stopTourBackgroundUpdates();
  }
  catch (error)
  {
    await services.diagnostics.record('warn', 'tour_background_stop_failed', error instanceof Error ? error.message : 'unknown');
  }
}
