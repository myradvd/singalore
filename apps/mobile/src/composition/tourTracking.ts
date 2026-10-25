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
