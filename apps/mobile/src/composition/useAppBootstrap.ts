import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { bindAudioStore } from '@/modules/audio/audioStore';
import { bindDownloadsStore } from '@/modules/offline/downloadsStore';
import { bindRouteStore } from '@/modules/routing/routeStore';
import { initializeCatalog, refreshCatalog, useCatalogStore } from '@/modules/catalog/catalogStore';
import type { CatalogSyncOutcome } from '@/modules/catalog/CatalogSync';
import { bindNetworkLog } from '@/modules/debug/debugStore';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { bindGeofenceStore } from '@/modules/geofence/geofenceStore';
import { bindLocationStore } from '@/modules/location/locationStore';
import { resolvePermissionState } from '@/modules/location/permissions';
import { loadPreferences } from '@/modules/prefs/preferencesStore';
import { COPY } from '@/ui/copy';
import { useMapUiStore } from '@/ui/mapCommandStore';
import { showToast } from '@/ui/toastStore';
import { wireArrivalNotifications } from './arrivalNotifyWiring';
import { registerLiveBackgroundRuntime } from './backgroundTasks';
import { bindLateBackgroundGrant } from './tourTracking';
import { createAppServices, type AppServices } from './container';
import { startServicesRecheck } from './servicesRecheck';
import { createFlowEffectHandler } from './flowEffects';
import { wirePromptAudio } from './promptAudioWiring';
import { wireTourAudioHandoff } from './tourAudioHandoff';

function reportSyncOutcome(outcome: CatalogSyncOutcome): void
{
  if (outcome.kind === 'failed_using_cache' || outcome.kind === 'failed_no_cache')
  {
    showToast(COPY.catalogFetchFailed, 'error');
  }
}

export async function refreshLocationPermission(services: AppServices): Promise<void>
{
  await services.location.setPermission(resolvePermissionState(await services.permissions.snapshot()));
}

async function checkPackUpdates(services: AppServices): Promise<void>
{
  if (!services.connectivity.isOnline())
  {
    return;
  }
  await services.downloads.checkForUpdates((parkId, knownEtag) => services.packDetails.latestPackEtag(parkId, knownEtag));
}

export type BootstrapState =
  | { status: 'starting' }
  | { status: 'ready'; services: AppServices }
  | { status: 'failed'; message: string };

export function useAppBootstrap(): BootstrapState
{
  const [state, setState] = useState<BootstrapState>({ status: 'starting' });

  useEffect(() =>
  {
    let cancelled = false;
    (async () =>
    {
      const services = await createAppServices();
      const preferences = await loadPreferences(services.preferences);
      useMapUiStore.getState().setLayers({ baseLayer: preferences.mapBaseLayer, showHeritageBoundaries: preferences.showHeritageBoundaries });
      bindNetworkLog(services.events);
      bindLocationStore(services.location);
      bindGeofenceStore(services.geofence);
      // Registered before geofence.start so it sees a queued next-up episode before the engine clears it.
      wireTourAudioHandoff({
        events: services.events,
        flow: () => useFlowStore.getState().state,
        dispatch: dispatchFlow,
        queuedLandmarkId: () => services.geofence.getState().nextUpLandmarkId,
        landmarkName: (landmarkId) => useCatalogStore.getState().landmarksById.get(landmarkId)?.name ?? 'your next stop',
        stopAudio: () => void services.audio.stopAndClear(),
        toast: (message) => showToast(message),
        notify: (title, body) => void services.notifier.notify('route_updates', title, body),
        isAppActive: () => AppState.currentState === 'active',
        now: () => services.clock.now(),
      });
      services.geofence.start();
      services.connectivity.start();
      NetInfo.addEventListener((network) => services.connectivity.setNetwork(network.isConnected, network.type === 'wifi'));
      bindAudioStore(services.audio);
      bindDownloadsStore(services.downloads, services.connectivity);
      bindRouteStore(services.routes);
      await services.routes.restore();
      services.events.on('geofence/enter', ({ landmarkId, at }) =>
      {
        if (useFlowStore.getState().state.base === 'inProgress')
        {
          dispatchFlow({ type: 'markVisited', landmarkId, at });
        }
      });
      services.routes.subscribe((route) =>
      {
        if (route.offRoute && AppState.currentState !== 'active')
        {
          void services.notifier.notify('route_updates', 'You are off the route', 'Open Singalore to return to the path or recalculate.');
        }
      });
      bindLateBackgroundGrant(services);
      services.audio.start();
      wirePromptAudio(services.geofence, services.audio);
      registerLiveBackgroundRuntime({
        acceptBackgroundFixes: (fixes) =>
        {
          for (const fix of fixes)
          {
            if (services.location.getState().sourceKind === 'device')
            {
              services.location.acceptFix(fix);
            }
          }
        },
      });
      configureFlowRuntime({
        onEffect: createFlowEffectHandler(services),
        persist: (cache) =>
        {
          void services.flowCache.save(cache).catch(() => services.diagnostics.record('error', 'flow_cache_write_failed'));
        },
      });
      dispatchFlow({ type: 'restoreFromCache', cache: await services.flowCache.load() });
      await refreshLocationPermission(services);
      if (!cancelled)
      {
        setState({ status: 'ready', services });
      }
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      const landmarkId = lastResponse?.notification.request.content.data?.landmarkId;
      if (typeof landmarkId === 'string')
      {
        services.geofence.openArrivalNotification(landmarkId);
      }
      reportSyncOutcome(await initializeCatalog(services.catalogSync));
      await services.audio.restoreSession();
      await checkPackUpdates(services);
    })().catch((error: unknown) =>
    {
      if (!cancelled)
      {
        setState({ status: 'failed', message: error instanceof Error ? error.message : 'Unknown start up error' });
      }
    });
    return () =>
    {
      cancelled = true;
    };
  }, []);

  useEffect(() =>
  {
    if (state.status !== 'ready')
    {
      return undefined;
    }
    const services = state.services;
    const stopServicesRecheck = startServicesRecheck({
      appState: () => AppState.currentState,
      locationState: () => services.location.getState(),
      refreshPermission: () => refreshLocationPermission(services),
    });
    const appStateSubscription = AppState.addEventListener('change', (next) =>
    {
      if (next === 'active')
      {
        void refreshLocationPermission(services).then(() => services.location.restart());
        void refreshCatalog(services.catalogSync).then(reportSyncOutcome);
      }
      if (next !== 'active')
      {
        void services.audio.persistNow();
      }
      if (next === 'background' && useFlowStore.getState().state.base !== 'inProgress' && services.location.getState().sourceKind === 'device')
      {
        void services.location.stop();
      }
    });
    const promptSubscription = wireArrivalNotifications({ geofence: services.geofence, notifier: services.notifier, isAppActive: () => AppState.currentState === 'active' });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) =>
    {
      const landmarkId = response.notification.request.content.data?.landmarkId;
      if (typeof landmarkId === 'string')
      {
        services.geofence.openArrivalNotification(landmarkId);
      }
    });
    return () =>
    {
      appStateSubscription.remove();
      stopServicesRecheck();
      promptSubscription();
      responseSubscription.remove();
    };
  }, [state]);

  return state;
}
