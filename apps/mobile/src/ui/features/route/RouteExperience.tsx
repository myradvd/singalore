import { distanceBetween, type GeoPoint } from '@singalore/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppServices } from '@/composition/AppServicesContext';
import { routeTitle } from '@/composition/flowEffects';
import { totalPodcastSeconds, useCatalogStore } from '@/modules/catalog/catalogStore';
import { nextUnvisitedStop } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { shouldAutoStart } from '@/modules/routing/progress';
import { useRouteStore } from '@/modules/routing/routeStore';
import type { RouteStop } from '@/modules/routing/routeTypes';
import { AppModal } from '../../primitives/AppModal';

import { showToast } from '../../toastStore';
import { NavigationPanel } from './NavigationPanel';
import { RouteConfirmPanel } from './RouteConfirmPanel';
import { RouteEditorPanel } from './RouteEditorPanel';
import { estimateFromRoute, estimateFromStops } from './routeEstimates';
import { RouteStrip } from './RouteStrip';

export const EXIT_MODAL_COPY = {
  title: 'Save before leaving?',
  message: 'Save this route to Saved Routes and Sites so you can continue another time.',
  save: 'Save & Exit',
  discard: 'Discard & Exit',
  cancel: 'Cancel',
} as const;

export function RouteStripHost({ onOpen }: { onOpen: () => void })
{
  const flow = useFlowStore((store) => store.state);
  const landmarksById = useCatalogStore((state) => state.landmarksById);
  if (flow.screen !== 'home' || flow.itinerary.length === 0)
  {
    return null;
  }
  return (
    <RouteStrip
      title={flow.base === 'inProgress' ? 'Tour in progress' : 'Untitled Route'}
      stopNames={flow.itinerary.map((id) => landmarksById.get(id)?.name ?? 'Heritage site')}
      inProgress={flow.base === 'inProgress'}
      onOpen={onOpen}
    />
  );
}

export function RouteExperience({ userPosition }: { userPosition: GeoPoint | null })
{
  const services = useAppServices();
  const flow = useFlowStore((store) => store.state);
  const catalog = useCatalogStore();
  const route = useRouteStore();
  const preferences = usePreferencesStore((state) => state.preferences);
  const [autodetect, setAutodetect] = useState(false);
  const [autoOrdering, setAutoOrdering] = useState(false);
  const plannedFor = useRef<string | null>(null);

  const stops = useMemo(() => flow.itinerary.flatMap((id) =>
  {
    const landmark = catalog.landmarksById.get(id);
    return landmark === undefined ? [] : [landmark];
  }), [flow.itinerary, catalog.landmarksById]);
  const routeStops: RouteStop[] = stops.map((stop) => ({ landmarkId: stop.id, position: stop.position }));
  const podcastSeconds = stops.map((stop) => totalPodcastSeconds(catalog, stop.id) ?? 0);

  useEffect(() =>
  {
    if (flow.screen !== 'routeConfirm')
    {
      plannedFor.current = null;
      return;
    }
    const key = flow.itinerary.join(',');
    if (userPosition === null || plannedFor.current === key || flow.itinerary.length === 0)
    {
      return;
    }
    plannedFor.current = key;
    void services.routes.plan(userPosition, routeStops, false);
  }, [flow.screen, flow.itinerary, userPosition, services, routeStops]);

  useEffect(() =>
  {
    if (flow.screen === 'routeConfirm' && route.status === 'ready' && shouldAutoStart(userPosition, stops[0]?.position ?? null, autodetect))
    {
      dispatchFlow({ type: 'startNavigation', at: services.clock.now() });
    }
  }, [flow.screen, route.status, userPosition, stops, autodetect, services]);

  const autoOrder = async () =>
  {
    const origin = userPosition ?? stops[0]?.position ?? null;
    if (origin === null)
    {
      return;
    }
    setAutoOrdering(true);
    try
    {
      const ordered = await services.routes.orderStops(origin, routeStops);
      dispatchFlow({ type: 'applyOrder', landmarkIds: ordered.map((stop) => stop.landmarkId) });
    }
    catch
    {
      showToast('Unable to calculate route. Please try again later.', 'error');
    }
    finally
    {
      setAutoOrdering(false);
    }
  };

  const recalculate = () =>
  {
    if (userPosition === null)
    {
      showToast('Waiting for GPS signal...');
      return;
    }
    const remaining = routeStops.filter((stop) => !flow.visitedLandmarkIds.includes(stop.landmarkId));
    void services.routes.plan(userPosition, remaining, false).then(() => services.routes.setNavigating(true));
  };

  const nextStopId = nextUnvisitedStop(flow);
  const nextStop = nextStopId === null ? undefined : catalog.landmarksById.get(nextStopId);
  const routeEstimate = route.route === null ? null : estimateFromRoute(route.route.distanceM, route.route.providerDurationS, stops.length, podcastSeconds, preferences.walkingPace, route.route.approximate);
  const secondsPerMeter = routeEstimate === null || routeEstimate.distanceM === 0 ? null : routeEstimate.walkSeconds / routeEstimate.distanceM;

  return (
    <>
      {flow.screen === 'routeEditor' && (
        <RouteEditorPanel
          title={flow.base === 'inProgress' ? 'Edit your tour' : 'Untitled Route'}
          stops={stops}
          estimate={estimateFromStops(userPosition, stops.map((stop) => stop.position), podcastSeconds, preferences.walkingPace)}
          unit={preferences.distanceUnit}
          canRestore={flow.restorePoint !== null}
          autoOrdering={autoOrdering}
          onMinimize={() => dispatchFlow({ type: 'minimizeRouteEditor' })}
          onClose={() => dispatchFlow({ type: 'requestCloseRouteEditor' })}
          onClearAll={() => dispatchFlow({ type: 'clearAll' })}
          onRestore={() => dispatchFlow({ type: 'restoreItinerary' })}
          onMove={(fromIndex, toIndex) => dispatchFlow({ type: 'reorderItinerary', fromIndex, toIndex })}
          onRemove={(landmarkId) => dispatchFlow({ type: 'removeFromItinerary', landmarkId })}
          onAddSite={() => dispatchFlow({ type: 'openSearch', purpose: 'addToRoute' })}
          onAutoOrder={() => void autoOrder()}
          onSaveAndContinue={() => dispatchFlow({ type: 'saveAndContinue' })}
        />
      )}
      {flow.screen === 'routeConfirm' && (
        <RouteConfirmPanel
          status={route.status}
          estimate={routeEstimate}
          unit={preferences.distanceUnit}
          failureMessage={route.failureMessage}
          hasFallback={route.fallback !== null}
          waitingForGps={userPosition === null}
          autodetect={autodetect}
          onAutodetectChange={setAutodetect}
          onStart={() => dispatchFlow({ type: 'startNavigation', at: services.clock.now() })}
          onBack={() => dispatchFlow({ type: 'backFromConfirmation' })}
          onRetry={() =>
          {
            plannedFor.current = null;
            if (userPosition !== null)
            {
              void services.routes.plan(userPosition, routeStops, false);
            }
          }}
          onUseFallback={() => void services.routes.useFallback()}
        />
      )}
      {flow.screen === 'navigation' && (
        <NavigationPanel
          progress={route.progress}
          approximate={route.route?.approximate ?? false}
          unit={preferences.distanceUnit}
          remainingSeconds={route.progress === null || secondsPerMeter === null ? null : route.progress.remainingM * secondsPerMeter}
          nextStopName={nextStop?.name ?? null}
          nextStopDistanceM={nextStop === undefined || userPosition === null ? null : distanceBetween(userPosition, nextStop.position)}
          visitedCount={flow.visitedLandmarkIds.length}
          stopCount={flow.itinerary.length}
          onPause={() => dispatchFlow({ type: 'pauseNavigation' })}
          onExit={() => dispatchFlow({ type: 'requestExitNavigation' })}
          onEditRoute={() => dispatchFlow({ type: 'openRouteEditor' })}
        />
      )}
      <AppModal
        testID="exit-modal"
        visible={flow.modal?.kind === 'confirmExit'}
        title={EXIT_MODAL_COPY.title}
        message={EXIT_MODAL_COPY.message}
        onRequestClose={() => dispatchFlow({ type: 'chooseExit', choice: 'cancel', at: services.clock.now() })}
        actions={[
          { label: EXIT_MODAL_COPY.save, kind: 'primary', testID: 'exit-save', onPress: () => dispatchFlow({ type: 'chooseExit', choice: 'save', at: services.clock.now() }) },
          { label: EXIT_MODAL_COPY.discard, kind: 'danger', testID: 'exit-discard', onPress: () => dispatchFlow({ type: 'chooseExit', choice: 'discard', at: services.clock.now() }) },
          { label: EXIT_MODAL_COPY.cancel, kind: 'secondary', testID: 'exit-cancel', onPress: () => dispatchFlow({ type: 'chooseExit', choice: 'cancel', at: services.clock.now() }) },
        ]}
      />
      <AppModal
        testID="start-tour-modal"
        visible={flow.modal?.kind === 'confirmStartTour'}
        title="Start a new tour?"
        message={`Your current route (${routeTitle(flow.itinerary)}) will be discarded.`}
        onRequestClose={() => dispatchFlow({ type: 'cancelStartTour' })}
        actions={[
          { label: 'Start new tour', kind: 'primary', testID: 'start-tour-confirm', onPress: () => dispatchFlow({ type: 'confirmStartTour', at: services.clock.now() }) },
          { label: 'Cancel', kind: 'secondary', testID: 'start-tour-cancel', onPress: () => dispatchFlow({ type: 'cancelStartTour' }) },
        ]}
      />
      <AppModal
        testID="off-route-modal"
        visible={route.offRoute && flow.screen === 'navigation'}
        title="You are off the route"
        message="Return to the gold path, or recalculate a new route from here through your remaining stops."
        onRequestClose={() => services.routes.returnToPath()}
        actions={[
          { label: 'Return to path', kind: 'secondary', testID: 'off-route-return', onPress: () => services.routes.returnToPath() },
          { label: 'Recalculate', kind: 'primary', testID: 'off-route-recalculate', onPress: recalculate },
        ]}
      />
    </>
  );
}

