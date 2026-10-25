import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { circlePolygonRing } from '@singalore/shared';
import { useAppServices } from '@/composition/AppServicesContext';
import { useDebugStore, toggleDebugMode } from '@/modules/debug/debugStore';
import { exitRadiusMeters } from '@/modules/geofence/GeofenceEvaluator';
import { useGeofenceStore } from '@/modules/geofence/geofenceStore';
import { useLocationStore } from '@/modules/location/locationStore';
import { useAudioStore } from '@/modules/audio/audioStore';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { useRouteStore } from '@/modules/routing/routeStore';
import { RouteExperience, RouteStripHost } from '../route/RouteExperience';
import { refreshCatalog, totalPodcastSeconds, useCatalogStore } from '@/modules/catalog/catalogStore';
import { buildLandmarkPins, buildParkBoundaries, buildParkCenterMarkers } from '@/modules/catalog/mapFeatures';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { COPY } from '../../copy';
import { HeritageMap } from '../../map/HeritageMap';
import type { HeritageMapHandle, UserLocationFix } from '../../map/mapTypes';
import { zoomControlsFit } from '../../map/mapCamera';
import { useMapUiStore } from '../../mapCommandStore';
import { EmptyState } from '../../primitives/States';
import { IconButton } from '../../primitives/IconButton';
import { EASE_OUT } from '../../primitives/motion';
import { colors, fill, radii, shadows, spacing } from '../../theme/tokens';
import { showToast } from '../../toastStore';
import { LayerPicker } from '../layers/LayerPicker';
import { SearchOverlay } from '../search/SearchOverlay';
import { Sidebar } from '../sidebar/Sidebar';
import { DebugOverlay } from '../debug/DebugOverlay';
import { NextUpChip, OutOfRangeNotice, PodcastPrompt } from '../prompt/PodcastPrompt';
import { Banner } from '../../primitives/Banner';
import { GpsStatusButton, gpsStatusLabel } from './GpsStatusButton';
import { MiniPlayer } from '../player/MiniPlayer';
import { ResumeCard } from '../player/ResumeCard';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { SummaryCard } from '../summaryCard/SummaryCard';
import { BottomBar } from './BottomBar';
import { HomeHeader } from './HomeHeader';
import { MapControls } from './MapControls';
import { SearchBarButton } from './SearchBarButton';
import { ZOOM_CONTROLS_HEIGHT, ZoomControls } from './ZoomControls';

export interface HomeScreenProps
{
  userLocation?: UserLocationFix | null;
}

let permissionPromptShown = false;

export function resetPermissionPromptForTests(): void
{
  permissionPromptShown = false;
}

export function HomeScreen(props: HomeScreenProps)
{
  const services = useAppServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<HeritageMapHandle>(null);
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [mapRotated, setMapRotated] = useState(false);
  const [screenHeight, setScreenHeight] = useState<number | null>(null);
  const [controlsSpan, setControlsSpan] = useState<{ top: number; height: number } | null>(null);
  const [cardHostTop, setCardHostTop] = useState<number | null>(null);
  const catalog = useCatalogStore();
  const flow = useFlowStore((store) => store.state);
  const layers = useMapUiStore((store) => store.layers);
  const setLayers = useMapUiStore((store) => store.setLayers);
  const pendingFocus = useMapUiStore((store) => store.pendingFocus);
  const locationState = useLocationStore();
  const geofence = useGeofenceStore();
  const debug = useDebugStore();
  const audio = useAudioStore();
  const bannerVisible = useDownloadsStore((state) => state.connectivity.bannerVisible);
  const plannedRoute = useRouteStore((state) => state.route);
  const reducedMotion = useReducedMotion();
  const [savedLandmarkIds, setSavedLandmarkIds] = useState<string[]>([]);

  useFocusEffect(useCallback(() =>
  {
    void services.saved.savedLandmarkIds().then(setSavedLandmarkIds);
  }, [services]));

  useEffect(() =>
  {
    if (audio.lastError !== null)
    {
      showToast(audio.lastError, 'error');
      services.audio.clearError();
    }
  }, [audio.lastError, services]);
  const storeLocation = useMemo<UserLocationFix | null>(() => (locationState.lastFix === null
    ? null
    : { latitude: locationState.lastFix.latitude, longitude: locationState.lastFix.longitude, accuracyMeters: locationState.lastFix.accuracyMeters }), [locationState.lastFix]);
  const userLocation = props.userLocation === undefined ? storeLocation : props.userLocation;

  useEffect(() =>
  {
    if (!permissionPromptShown && locationState.permission === 'undetermined')
    {
      permissionPromptShown = true;
      router.push('/permission');
    }
  }, [locationState.permission, router]);

  const geofenceRings = useMemo(() =>
  {
    if (!debug.enabled || !debug.showGeofenceRings)
    {
      return null;
    }
    return {
      type: 'FeatureCollection' as const,
      features: catalog.snapshot.landmarks.flatMap((landmark) => [landmark.geofenceRadiusM, exitRadiusMeters(landmark.geofenceRadiusM)].map((radius) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [circlePolygonRing(landmark.position, radius, 36)] },
      }))),
    };
  }, [debug.enabled, debug.showGeofenceRings, catalog.snapshot.landmarks]);

  const onWordmarkPress = () =>
  {
    if (services.debugGate.registerTap(services.clock.now()))
    {
      showToast(toggleDebugMode() ? 'Developer Mode Enabled.' : 'Developer Mode Disabled.');
    }
  };

  const onGpsStatusPress = () =>
  {
    if (locationState.status === 'permission_needed' || locationState.status === 'services_off')
    {
      router.push('/permission');
      return;
    }
    showToast(gpsStatusLabel(locationState.status));
  };

  const onLongPress = (latitude: number, longitude: number) =>
  {
    if (debug.enabled && debug.spoofActive)
    {
      services.spoofSource.setPosition({ lat: latitude, lng: longitude });
    }
  };

  const pins = useMemo(
    () => buildLandmarkPins(catalog.snapshot.landmarks, catalog.podcastLandmarkIds, flow.itinerary, flow.selectedLandmarkId),
    [catalog.snapshot.landmarks, catalog.podcastLandmarkIds, flow.itinerary, flow.selectedLandmarkId],
  );
  const boundaries = useMemo(() => buildParkBoundaries(catalog.snapshot.parks), [catalog.snapshot.parks]);
  const parkMarkers = useMemo(() => buildParkCenterMarkers(catalog.snapshot.parks), [catalog.snapshot.parks]);

  const focusLandmark = useCallback((landmarkId: string) =>
  {
    const landmark = catalog.landmarksById.get(landmarkId);
    if (landmark === undefined)
    {
      return;
    }
    dispatchFlow({ type: 'selectLandmark', landmarkId });
    mapRef.current?.centerOn(landmark.position.lat, landmark.position.lng, 16.5);
  }, [catalog.landmarksById]);

  const focusPark = useCallback((parkId: string) =>
  {
    const parkLandmarks = catalog.snapshot.landmarks.filter((landmark) => landmark.parkId === parkId);
    const park = catalog.parksById.get(parkId);
    dispatchFlow({ type: 'selectLandmark', landmarkId: null });
    if (parkLandmarks.length > 0)
    {
      mapRef.current?.fitTo(parkLandmarks.map((landmark) => ({ latitude: landmark.position.lat, longitude: landmark.position.lng })));
    }
    else if (park !== undefined)
    {
      mapRef.current?.centerOn(park.center.lat, park.center.lng, 15.5);
    }
  }, [catalog.snapshot.landmarks, catalog.parksById]);

  useEffect(() =>
  {
    if (pendingFocus === null || catalog.status !== 'ready')
    {
      return;
    }
    const request = useMapUiStore.getState().consumeFocus();
    if (request?.kind === 'landmark')
    {
      focusLandmark(request.landmarkId);
    }
    else if (request?.kind === 'park')
    {
      focusPark(request.parkId);
    }
  }, [pendingFocus, catalog.status, focusLandmark, focusPark]);

  useEffect(() =>
  {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
    {
      const state = useFlowStore.getState().state;
      const top = state.overlays[state.overlays.length - 1];
      if (top === 'search')
      {
        dispatchFlow({ type: 'closeSearch' });
        return true;
      }
      if (top === 'sidebar')
      {
        dispatchFlow({ type: 'closeSidebar' });
        return true;
      }
      if (state.screen === 'expandedMap')
      {
        dispatchFlow({ type: 'closeExpandedMap' });
        return true;
      }
      if (state.selectedLandmarkId !== null)
      {
        dispatchFlow({ type: 'selectLandmark', landmarkId: null });
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  const recenter = () =>
  {
    if (userLocation === null)
    {
      showToast(COPY.waitingForGps);
      return;
    }
    mapRef.current?.centerOn(userLocation.latitude, userLocation.longitude, 16);
  };

  const selected = flow.selectedLandmarkId === null ? undefined : catalog.landmarksById.get(flow.selectedLandmarkId);
  const expanded = flow.screen === 'expandedMap';
  const showRoute = plannedRoute !== null && (flow.base === 'inProgress' || flow.screen === 'routeConfirm');
  const routeLine = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(() => (!showRoute || plannedRoute === null
    ? null
    : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plannedRoute.line.map((point) => [point.lng, point.lat]) } }] }), [showRoute, plannedRoute]);
  const homeChrome = flow.screen === 'home';
  const userPosition = userLocation === null ? null : { lat: userLocation.latitude, lng: userLocation.longitude };

  const openFromSidebar = (path: '/explore' | '/saved' | '/history' | '/downloads' | '/preferences' | '/help') =>
  {
    dispatchFlow({ type: 'closeSidebar' });
    router.push(path);
  };

  const toggleBookmark = async (landmarkId: string) =>
  {
    const saved = await services.saved.toggleLandmark(landmarkId);
    setSavedLandmarkIds(await services.saved.savedLandmarkIds());
    showToast(saved ? 'Saved to Saved Routes and Sites.' : 'Removed from saved sites.');
  };
  const topOverlay = flow.overlays[flow.overlays.length - 1];
  const headerHeight = insets.top + 112;
  const showEmptyCatalog = catalog.status === 'unavailable' && catalog.snapshot.landmarks.length === 0;
  const zoomTop = controlsSpan === null ? null : controlsSpan.top + controlsSpan.height + spacing.sm;
  const zoomObstacleTop = homeChrome ? cardHostTop : screenHeight === null ? null : screenHeight - insets.bottom - spacing.lg;
  const showZoom = (homeChrome || expanded) && zoomTop !== null && zoomObstacleTop !== null
    && zoomControlsFit(zoomTop, ZOOM_CONTROLS_HEIGHT, zoomObstacleTop, spacing.sm);
  const onControlsLayout = (event: LayoutChangeEvent) =>
  {
    const { y, height } = event.nativeEvent.layout;
    setControlsSpan((previous) => (previous?.top === y && previous.height === height ? previous : { top: y, height }));
  };

  return (
    <View testID="home-screen" style={styles.screen} onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      <HeritageMap
        ref={mapRef}
        styleUrl={services.config.mapStyleUrl}
        satelliteTileUrl={services.config.satelliteTileUrl}
        layers={layers}
        pins={pins}
        boundaries={boundaries}
        parkMarkers={parkMarkers}
        userLocation={userLocation}
        onLandmarkPress={focusLandmark}
        onMapPress={() => dispatchFlow({ type: 'selectLandmark', landmarkId: null })}
        onLongPress={onLongPress}
        onRotationChange={setMapRotated}
        debugGeofences={geofenceRings}
        routeLine={routeLine}
        topInset={expanded ? insets.top : headerHeight}
        bottomInset={expanded ? insets.bottom : 96}
      />

      {homeChrome && (
        <View style={[styles.top, { paddingTop: insets.top }]} pointerEvents="box-none">
          <HomeHeader
            onMenuPress={() => dispatchFlow({ type: 'openSidebar' })}
            onWordmarkPress={onWordmarkPress}
            trailing={<GpsStatusButton status={locationState.status} onPress={onGpsStatusPress} />}
          />
          <SearchBarButton onPress={() => dispatchFlow({ type: 'openSearch', purpose: 'browse' })} />
        </View>
      )}

      <View style={[styles.controls, { top: (expanded ? insets.top : headerHeight) + spacing.lg }]} pointerEvents="box-none" onLayout={onControlsLayout} testID="map-controls-column">
        <MapControls
          onLayersPress={() => setLayerPickerOpen(true)}
          onRecenterPress={recenter}
          showCompass={mapRotated}
          onCompassPress={() => mapRef.current?.resetNorth()}
        />
        {debug.enabled && <IconButton testID="open-debug" icon="bug-outline" accessibilityLabel="Developer tools" onPress={() => router.push('/debug')} style={styles.debugButton} />}
      </View>

      {showZoom && zoomTop !== null && (
        <View style={[styles.zoom, { top: zoomTop }]} pointerEvents="box-none">
          <ZoomControls onZoomIn={() => mapRef.current?.zoomStep('in')} onZoomOut={() => mapRef.current?.zoomStep('out')} />
        </View>
      )}

      <View style={[styles.notices, { top: (expanded ? insets.top : headerHeight) + spacing.sm }]} pointerEvents="box-none">
        {bannerVisible && (
          <Banner
            testID="connectivity-banner"
            icon="wifi-strength-alert-outline"
            message="Your internet is unstable"
            actions={[
              { label: 'Go to downloads?', onPress: () => router.push('/downloads') },
              { label: 'Ignore', onPress: () => services.connectivity.dismissBanner() },
            ]}
          />
        )}
        {debug.enabled && debug.spoofActive && (
          <Banner
            testID="spoof-banner"
            icon="map-marker-alert"
            message="Simulated location active"
            actions={[{ label: 'Restore real location', onPress: () =>
            {
              useDebugStore.setState({ spoofActive: false, spoofPlacementArmed: false });
              void services.location.useSpoof(false);
            } }]}
          />
        )}
        {debug.enabled && debug.showOverlay && (
          <DebugOverlay
            fix={locationState.lastFix}
            refreshRateHz={locationState.refreshRateHz}
            sourceKind={locationState.sourceKind}
            insideNames={geofence.insideLandmarkIds.map((id) => catalog.landmarksById.get(id)?.name ?? id)}
          />
        )}
        {geofence.outOfRange !== null && (
          <OutOfRangeNotice landmarkName={catalog.landmarksById.get(geofence.outOfRange.landmarkId)?.name ?? 'this site'} onDismiss={() => services.geofence.dismissOutOfRange()} />
        )}
        {geofence.nextUpLandmarkId !== null && <NextUpChip landmarkName={catalog.landmarksById.get(geofence.nextUpLandmarkId)?.name ?? 'next site'} />}
        {geofence.prompt !== null && (
          <PodcastPrompt
            landmarkName={catalog.landmarksById.get(geofence.prompt.landmarkId)?.name ?? 'a heritage site'}
            podcastSeconds={totalPodcastSeconds(catalog, geofence.prompt.landmarkId)}
            onListen={() => services.geofence.acceptPrompt()}
            onDismiss={() => services.geofence.dismissPrompt()}
          />
        )}
      </View>

      {showEmptyCatalog && (
        <View style={styles.emptyCatalog}>
          <EmptyState
            testID="empty-catalog"
            icon="cloud-off-outline"
            title={COPY.emptyCatalogTitle}
            message={COPY.emptyCatalogMessage}
            actionLabel={COPY.emptyCatalogRetry}
            onAction={() => void refreshCatalog(services.catalogSync).then((outcome) =>
            {
              if (outcome.kind === 'failed_no_cache')
              {
                showToast(COPY.catalogFetchFailed, 'error');
              }
            })}
          />
        </View>
      )}

      {(homeChrome || flow.screen === 'navigation') && (
        <View
          testID="card-host"
          style={[styles.cardHost, { bottom: insets.bottom + (homeChrome ? 104 : 180) }]}
          pointerEvents="box-none"
          onLayout={(event) => setCardHostTop(event.nativeEvent.layout.y)}
        >
          {homeChrome && <RouteStripHost onOpen={() => dispatchFlow({ type: 'openRouteEditor' })} />}
          {selected !== undefined && homeChrome && (
            <Animated.View
              entering={reducedMotion ? FadeIn.duration(200) : FadeInDown.duration(220).easing(EASE_OUT)}
              exiting={reducedMotion ? FadeOut.duration(150) : FadeOutDown.duration(160).easing(EASE_OUT)}
            >
              <SummaryCard
                landmark={selected}
                parkName={catalog.parksById.get(selected.parkId)?.name ?? null}
                podcastSeconds={totalPodcastSeconds(catalog, selected.id)}
                description={null}
                onClose={() => dispatchFlow({ type: 'selectLandmark', landmarkId: null })}
                headerActions={(
                  <>
                    {debug.enabled && <IconButton testID="debug-force-prompt" icon="bell-ring-outline" accessibilityLabel="Force podcast prompt" onPress={() => services.geofence.forcePrompt(selected.id)} variant="plain" />}
                    <IconButton
                      testID="summary-bookmark"
                      icon={savedLandmarkIds.includes(selected.id) ? 'bookmark' : 'bookmark-outline'}
                      accessibilityLabel={savedLandmarkIds.includes(selected.id) ? `Remove ${selected.name} from saved sites` : `Save ${selected.name}`}
                      selected={savedLandmarkIds.includes(selected.id)}
                      onPress={() => void toggleBookmark(selected.id)}
                      variant="plain"
                    />
                  </>
                )}
                actions={(
                  <>
                    {catalog.podcastLandmarkIds.has(selected.id)
                      ? <PrimaryButton testID="summary-listen" label="Listen" icon="headphones" pressScale onPress={() => void services.audio.playLandmark(selected.id)} />
                      : <SecondaryButton testID="summary-listen-unavailable" label={COPY.noPodcastShort} icon="headphones-off" accessibilityHint="Listen is unavailable for this site" disabled onPress={() => undefined} />}
                    <SecondaryButton testID="summary-add-route" label="Route" icon="plus" pressScale onPress={() => dispatchFlow({ type: 'addToItinerary', landmarkId: selected.id })} />
                    <SecondaryButton testID="summary-start-tour" label="Start Tour" icon="walk" pressScale onPress={() => dispatchFlow({ type: 'startTourFromSite', landmarkId: selected.id })} />
                  </>
                )}
              />
            </Animated.View>
          )}
          {audio.resumeOffer !== null && audio.track === null && (
            <ResumeCard
              title={audio.resumeOffer.title}
              landmarkName={audio.resumeOffer.landmarkName}
              positionMs={audio.resumeOffer.positionMs}
              onResume={() => void services.audio.resumeOffered()}
              onDismiss={() => void services.audio.dismissResumeOffer()}
            />
          )}
          <MiniPlayer audio={audio} onTogglePlay={() => services.audio.togglePlay()} onOpen={() => router.push('/player')} onClose={() => void services.audio.stopAndClear()} />
        </View>
      )}

      <RouteExperience userPosition={userPosition} />

      {expanded ? (
        <View style={[styles.compress, { bottom: insets.bottom + spacing.lg }]}>
          <IconButton testID="compress-map" icon="arrow-collapse" accessibilityLabel="Show the full home view" onPress={() => dispatchFlow({ type: 'closeExpandedMap' })} variant="accent" size="player" />
        </View>
      ) : homeChrome && (
        <View style={styles.bottom}>
          <BottomBar
            bottomInset={insets.bottom}
            centerIcon={flow.base === 'inProgress' ? 'navigation-variant' : 'arrow-expand'}
            centerLabel={flow.base === 'inProgress' ? 'Resume navigation' : 'Expand the map'}
            onCenterPress={() => dispatchFlow({ type: flow.base === 'inProgress' ? 'resumeNavigation' : 'openExpandedMap' })}
            right={{ icon: 'compass-outline', label: 'Explore', onPress: () => router.push('/explore'), testID: 'bottom-explore' }}
          />
        </View>
      )}

      {topOverlay === 'sidebar' && (
        <Sidebar
          onClose={() => dispatchFlow({ type: 'closeSidebar' })}
          primary={[
            { key: 'home', label: 'Home', icon: 'home-outline', onPress: () => dispatchFlow({ type: 'closeSidebar' }) },
            { key: 'explore', label: 'Explore', icon: 'compass-outline', onPress: () => openFromSidebar('/explore') },
            { key: 'saved', label: 'Saved Routes and Sites', icon: 'bookmark-outline', onPress: () => openFromSidebar('/saved') },
            { key: 'history', label: 'Tour History', icon: 'history', onPress: () => openFromSidebar('/history') },
            { key: 'downloads', label: 'Manage Downloads', icon: 'download', onPress: () => openFromSidebar('/downloads') },
          ]}
          secondary={[
            { key: 'preferences', label: 'Tour Preferences', icon: 'cog-outline', onPress: () => openFromSidebar('/preferences') },
            { key: 'help', label: 'Help Centre', icon: 'help-circle-outline', onPress: () => openFromSidebar('/help') },
          ]}
          footer={[]}
        />
      )}

      {topOverlay === 'search' && (
        <SearchOverlay
          index={catalog.searchIndex}
          parksById={catalog.parksById}
          purpose={flow.searchPurpose}
          itineraryIds={flow.itinerary}
          onClose={(addLandmarkIds) => dispatchFlow({ type: 'closeSearch', addLandmarkIds })}
          onSelectLandmark={(landmarkId) =>
          {
            dispatchFlow({ type: 'closeSearch' });
            focusLandmark(landmarkId);
          }}
          onSelectPark={(parkId) =>
          {
            dispatchFlow({ type: 'closeSearch' });
            focusPark(parkId);
          }}
        />
      )}

      <LayerPicker
        visible={layerPickerOpen}
        layers={layers}
        satelliteAvailable={services.config.satelliteTileUrl !== null}
        onChange={setLayers}
        onClose={() => setLayerPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.chrome, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, ...shadows.card },
  controls: { position: 'absolute', right: spacing.lg },
  zoom: { position: 'absolute', right: spacing.lg },
  debugButton: { marginTop: spacing.sm },
  notices: { position: 'absolute', left: spacing.lg, right: 72, gap: spacing.sm },
  cardHost: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  compress: { position: 'absolute', alignSelf: 'center' },
  emptyCatalog: { ...fill, justifyContent: 'center', backgroundColor: colors.chrome },
});
