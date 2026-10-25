import type { FlowEffect } from '@/modules/flow/flowTypes';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { showToast } from '@/ui/toastStore';
import type { AppServices } from './container';
import { startTourTracking, stopTourTracking } from './tourTracking';

export function routeTitle(landmarkIds: readonly string[]): string
{
  const names = landmarkIds.map((id) => useCatalogStore.getState().landmarksById.get(id)?.name ?? 'Heritage site');
  if (names.length === 0)
  {
    return 'Untitled Route';
  }
  return names.length === 1 ? (names[0] ?? 'Untitled Route') : `${names[0]} and ${names.length - 1} more`;
}

export function createFlowEffectHandler(services: AppServices): (effect: FlowEffect) => void
{
  return (effect) =>
  {
    switch (effect.type)
    {
      case 'toast':
        showToast(effect.message);
        return;
      case 'startTourTracking':
        services.routes.setNavigating(true);
        void startTourTracking(services);
        return;
      case 'stopTourTracking':
        void services.routes.clear();
        void stopTourTracking(services);
        return;
      case 'saveItinerary':
        void services.saved.saveItinerary(routeTitle(effect.landmarkIds), effect.landmarkIds).then(() => showToast('Route saved to Saved Routes and Sites.'));
        return;
      case 'recordHistory':
        void services.history.record({
          id: `tour-${effect.startedAt}`,
          title: routeTitle(effect.landmarkIds),
          landmarkIds: effect.landmarkIds,
          startedAt: new Date(effect.startedAt).toISOString(),
          endedAt: new Date(effect.endedAt).toISOString(),
          status: effect.status,
          completedLandmarkIds: effect.visitedLandmarkIds,
        });
        return;
      case 'tourCompleted':
        showToast('You have visited every stop on this tour.');
        void services.notifier.notify('route_updates', 'Tour complete', 'You have visited every stop on this tour.');
        return;
    }
  };
}
