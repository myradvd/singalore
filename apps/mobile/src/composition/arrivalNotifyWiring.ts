import type { LocalNotifier } from '@/core/notifications';
import { arrivalNotificationText, shouldNotifyArrival } from '@/modules/geofence/backgroundArrival';
import type { ActivePrompt, GeofenceEngine } from '@/modules/geofence/GeofenceEngine';

export interface ArrivalNotifyDependencies
{
  geofence: Pick<GeofenceEngine, 'subscribe' | 'targetName'>;
  notifier: LocalNotifier;
  isAppActive: () => boolean;
}

// Sends one arrival notification for each prompt raised while the app is not active.
export function wireArrivalNotifications(dependencies: ArrivalNotifyDependencies): () => void
{
  const { geofence, notifier, isAppActive } = dependencies;
  let lastNotifiedPrompt: ActivePrompt | null = null;
  return geofence.subscribe(({ prompt }) =>
  {
    if (prompt === null || !shouldNotifyArrival(prompt, lastNotifiedPrompt, isAppActive()))
    {
      return;
    }
    lastNotifiedPrompt = prompt;
    const text = arrivalNotificationText(geofence.targetName(prompt.landmarkId));
    void notifier.notify('arrivals', text.title, text.body, { landmarkId: prompt.landmarkId });
  });
}
