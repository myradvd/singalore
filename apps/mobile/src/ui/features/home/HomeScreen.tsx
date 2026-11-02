import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { circlePolygonRing } from '@singalore/shared';
import { useAppServices } from '@/composition/AppServicesContext';
import { useDebugStore, toggleDebugMode } from '@/modules/debug/debugStore';
import { exitRadiusMeters } from '@/modules/geofence/GeofenceEvaluator';
import { useGeofenceStore } from '@/modules/geofence/geofenceStore';
import { useLocationStore } from '@/modules/location/locationStore';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { clearRecentSites, recordRecentSites } from '@/modules/prefs/recentSites';
import { useAudioStore } from '@/modules/audio/audioStore';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { useRouteStore } from '@/modules/routing/routeStore';
import { RouteExperience, RouteStripHost } from '../route/RouteExperience';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
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
import { retryCatalogSync } from '../../retryCatalogSync';
import { showToast } from '../../toastStore';
import { LayerPicker } from '../layers/LayerPicker';
import { SearchOverlay } from '../search/SearchOverlay';
import { Sidebar } from '../sidebar/Sidebar';
import { DebugOverlay } from '../debug/DebugOverlay';
import { NextUpChip, OutOfRangeNotice, PodcastPrompt } from '../prompt/PodcastPrompt';
import { Banner } from '../../primitives/Banner';
import { GpsStatusButton, gpsStatusLabel } from './GpsStatusButton';
import { shownEpisodeSeconds } from '../player/playerLabels';
import { ResumeCard } from '../player/ResumeCard';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { SummaryCard } from '../summaryCard/SummaryCard';
import { useLandmarkDetail } from '../summaryCard/useLandmarkDetail';
import { BottomBar } from './BottomBar';
import { useHomeBackHandler } from './homeBack';
import { HomeHeader } from './HomeHeader';
import { MapControls } from './MapControls';
import { useMapFocus } from './useMapFocus';
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

/**
 * Main screen (boundary class Map in the design).
 * Hosts the heritage map with pins and park boundaries, the search bar, GPS status,
 * site summary card, podcast prompt, mini player and route editor strip.
 * Stays mounted while other screens open on top, so the map keeps its state.
 */
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
  const locationState = useLocationStore();
  const geofence = useGeofenceStore();
  const debug = useDebugStore();
  const audioError = useAudioStore((state) => state.lastError);
  const resumeOffer = useAudioStore((state) => state.resumeOffer);
  const noAudioTrack = useAudioStore((state) => state.track === null);
  const preferences = usePreferencesStore((state) => state.preferences);
  const bannerVisible = useDownloadsStore((state) => state.connectivity.bannerVisible);
  const plannedRoute = useRouteStore((state) => state.route);
  const reducedMotion = useReducedMotion();
  const [savedLandmarkIds, setSavedLandmarkIds] = useState<string[]>([]);
  const recentLandmarkIds = usePreferencesStore((state) => state.preferences.recentSiteIds);

  useFocusEffect(useCallback(() =>
  {
    void services.saved.savedLandmarkIds().then(setSavedLandmarkIds);
  }, [services]));

  useEffect(() =>
  {
    if (audioError !== null)
    {
      showToast(audioError, 'error');
      services.audio.clearError();
    }
  }, [audioError, services]);
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

  const { focusLandmark, focusPark } = useMapFocus(mapRef);

  useHomeBackHandler();

  const recenter = () =>
  {
    if (userLocation === null || locationState.status === 'waiting_for_signal')
    {
      showToast(COPY.waitingForGps);
      return;
    }
    mapRef.current?.centerOn(userLocation.latitude, userLocation.longitude, 16);
  };

  const selected = flow.selectedLandmarkId === null ? undefined : catalog.landmarksById.get(flow.selectedLandmarkId);
  const selectedDetail = useLandmarkDetail(selected?.id ?? null);
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
  // Runs a recent sites write and logs a failure, because a failed write must not interrupt the user.
  const logRecentSitesFailure = (write: Promise<void>) =>
  {
    void write.catch((error: unknown) => services.diagnostics.record('warn', 'recent_sites_write_failed', error instanceof Error ? error.message : 'unknown'));
  };
  const topOverlay = flow.overlays[flow.overlays.length - 1];
  const headerHeight = insets.top + 112;
  const showEmptyCatalog = catalog.status === 'unavailable' && catalog.snapshot.landmarks.length === 0;
  const showCatalogLoading = catalog.status === 'loading' && catalog.snapshot.landmarks.length === 0;
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
          onPodcastPreferencesPress={() => router.push('/preferences/audio')}
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
        {showCatalogLoading && (
          <View testID="catalog-loading-notice" pointerEvents="none">
            <Banner icon="map-search-outline" tone="info" message={COPY.catalogLoading} />
          </View>
        )}
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
            podcastSeconds={shownEpisodeSeconds(catalog, geofence.prompt.landmarkId, preferences)}
            onListen={() => services.geofence.acceptPrompt()}
            onDismiss={() => services.geofence.dismissPrompt()}
          />
        )}
      </View>

      {showEmptyCatalog && (
        <View style={[styles.emptyCatalog, { top: headerHeight }]}>
          <EmptyState
            testID="empty-catalog"
            icon="cloud-off-outline"
            title={COPY.emptyCatalogTitle}
            message={COPY.emptyCatalogMessage}
            actionLabel={COPY.emptyCatalogRetry}
            onAction={() => retryCatalogSync(services.catalogSync)}
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
                key={selected.id}
                landmark={selected}
                parkName={catalog.parksById.get(selected.parkId)?.name ?? null}
                podcastSeconds={shownEpisodeSeconds(catalog, selected.id, preferences)}
                description={selectedDetail.description}
                imageUri={selectedDetail.imageUri}
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
          {resumeOffer !== null && noAudioTrack && (
            <ResumeCard
              title={resumeOffer.title}
              landmarkName={resumeOffer.landmarkName}
              positionMs={resumeOffer.positionMs}
              onResume={() => void services.audio.resumeOffered()}
              onDismiss={() => void services.audio.dismissResumeOffer()}
            />
          )}
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
        />
      )}

      {topOverlay === 'search' && (
        <SearchOverlay
          index={catalog.searchIndex}
          parksById={catalog.parksById}
          purpose={flow.searchPurpose}
          itineraryIds={flow.itinerary}
          landmarksById={catalog.landmarksById}
          recentLandmarkIds={recentLandmarkIds}
          userPosition={userPosition}
          onClearRecent={() => logRecentSitesFailure(clearRecentSites(services.preferences))}
          onClose={(addLandmarkIds) =>
          {
            dispatchFlow({ type: 'closeSearch', addLandmarkIds });
            const itinerary = useFlowStore.getState().state.itinerary;
            logRecentSitesFailure(recordRecentSites(services.preferences, addLandmarkIds.filter((landmarkId) => itinerary.includes(landmarkId))));
          }}
          onSelectLandmark={(landmarkId) =>
          {
            logRecentSitesFailure(recordRecentSites(services.preferences, [landmarkId]));
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
