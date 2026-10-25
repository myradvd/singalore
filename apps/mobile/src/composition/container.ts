import type { GeofenceTarget } from '@/core/location';
import Constants from 'expo-constants';
import { createAppEventBus, type AppEventBus } from '@/core/appEvents';
import { systemClock, type Clock } from '@/core/clock';
import { parseAppConfig, type AppConfig } from '@/core/config';
import type { DbAdapter } from '@/core/db/DbAdapter';
import { openExpoSqliteAdapter } from '@/core/db/expoSqliteAdapter';
import { migrate } from '@/core/db/migrations';
import { FetchMediaProbe } from '@/core/http/FetchMediaProbe';
import { ApiClient } from '@/core/http/ApiClient';
import type { LocalNotifier } from '@/core/notifications';
import { AudioController } from '@/modules/audio/AudioController';
import { AudioSessionRepository } from '@/modules/audio/AudioSessionRepository';
import { ExpoAudioEngine } from '@/modules/audio/ExpoAudioEngine';
import { CatalogRepository } from '@/modules/catalog/CatalogRepository';
import { CatalogSync } from '@/modules/catalog/CatalogSync';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { DebugGate } from '@/modules/debug/debugGate';
import { DiagnosticsLog } from '@/modules/diagnostics/DiagnosticsLog';
import { FlowCacheRepository } from '@/modules/flow/FlowCacheRepository';
import { HistoryRepository } from '@/modules/history/HistoryRepository';
import { RouteNavigator } from '@/modules/routing/RouteNavigator';
import { RoutePlanner } from '@/modules/routing/RoutePlanner';
import { SavedRepository } from '@/modules/saved/SavedRepository';
import { createExpoOsGeofencer } from '@/modules/geofence/ExpoOsGeofencer';
import { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';
import { DeviceLocationSource } from '@/modules/location/DeviceLocationSource';
import { expoPermissionService } from '@/modules/location/ExpoPermissionService';
import { LocationEngine } from '@/modules/location/LocationEngine';
import type { PermissionService } from '@/modules/location/permissions';
import { SpoofLocationSource } from '@/modules/location/SpoofLocationSource';
import { createExpoLocalNotifier } from '@/modules/notifications/ExpoLocalNotifier';
import { ConnectivityMonitor } from '@/modules/offline/ConnectivityMonitor';
import { DownloadedMediaResolver } from '@/modules/offline/DownloadedMediaResolver';
import { DownloadManager } from '@/modules/offline/DownloadManager';
import { DownloadsRepository } from '@/modules/offline/DownloadsRepository';
import { ExpoFileTransport } from '@/modules/offline/ExpoFileTransport';
import { expoFileProbe } from '@/modules/offline/expoFileProbe';
import { PackDetailsRepository } from '@/modules/offline/PackDetailsRepository';
import { PreferencesRepository } from '@/modules/prefs/PreferencesRepository';
import { getPreferences } from '@/modules/prefs/preferencesStore';
import { DATABASE_NAME } from './databaseName';
import { createMutablePlaybackStatus, type MutablePlaybackStatus } from './playbackStatus';

export interface AppServices
{
  config: AppConfig;
  clock: Clock;
  events: AppEventBus;
  db: DbAdapter;
  api: ApiClient;
  diagnostics: DiagnosticsLog;
  catalogRepository: CatalogRepository;
  catalogSync: CatalogSync;
  flowCache: FlowCacheRepository;
  preferences: PreferencesRepository;
  permissions: PermissionService;
  spoofSource: SpoofLocationSource;
  location: LocationEngine;
  geofence: GeofenceEngine;
  notifier: LocalNotifier;
  debugGate: DebugGate;
  playback: MutablePlaybackStatus;
  audio: AudioController;
  connectivity: ConnectivityMonitor;
  packDetails: PackDetailsRepository;
  media: DownloadedMediaResolver;
  downloads: DownloadManager;
  routes: RouteNavigator;
  saved: SavedRepository;
  history: HistoryRepository;
}

let cachedTargets: { snapshot: unknown; targets: GeofenceTarget[] } | null = null;

export function geofenceTargetsFromCatalog(): GeofenceTarget[]
{
  const state = useCatalogStore.getState();
  if (cachedTargets !== null && cachedTargets.snapshot === state.snapshot)
  {
    return cachedTargets.targets;
  }
  const targets = state.snapshot.landmarks.map((landmark) => ({
    landmarkId: landmark.id,
    name: landmark.name,
    latitude: landmark.position.lat,
    longitude: landmark.position.lng,
    radiusMeters: landmark.geofenceRadiusM,
    hasPodcast: state.podcastLandmarkIds.has(landmark.id),
  }));
  cachedTargets = { snapshot: state.snapshot, targets };
  return targets;
}

export function effectiveApiBaseUrl(config: AppConfig): string
{
  const override = config.debugToolsEnabled ? getPreferences().apiBaseUrlOverride : null;
  return override ?? config.apiBaseUrl;
}

export async function createAppServices(): Promise<AppServices>
{
  const config = parseAppConfig(Constants.expoConfig?.extra);
  const clock = systemClock;
  const events = createAppEventBus();
  const db = await openExpoSqliteAdapter(DATABASE_NAME);
  await migrate(db);
  const diagnostics = new DiagnosticsLog(db, clock, events);
  const api = new ApiClient({ baseUrl: () => effectiveApiBaseUrl(config), fetchImplementation: fetch, clock, events });
  const catalogRepository = new CatalogRepository(db);
  const catalogSync = new CatalogSync(api, catalogRepository, clock, events, diagnostics);
  const spoofSource = new SpoofLocationSource(clock);
  const location = new LocationEngine({
    deviceSource: new DeviceLocationSource(),
    spoofSource,
    clock,
    events,
    diagnostics,
    setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  const playback = createMutablePlaybackStatus();
  const geofence = new GeofenceEngine({
    events,
    clock,
    diagnostics,
    targets: geofenceTargetsFromCatalog,
    settings: () =>
    {
      const preferences = getPreferences();
      return { geofenceTriggersEnabled: preferences.geofenceTriggersEnabled, autoplayEnabled: preferences.autoplayEnabled };
    },
    playback,
    osGeofencer: createExpoOsGeofencer(() => location.getState().permission === 'always'),
  });
  const notifier = createExpoLocalNotifier((category) =>
  {
    const preferences = getPreferences();
    switch (category)
    {
      case 'arrivals':
        return preferences.notifyArrivals;
      case 'downloads':
        return preferences.notifyDownloads;
      case 'route_updates':
        return preferences.notifyRouteUpdates;
    }
  });
  const connectivity = new ConnectivityMonitor(events, clock);
  const media = new DownloadedMediaResolver(db, expoFileProbe);
  const audio = new AudioController({
    engine: new ExpoAudioEngine(),
    sessions: new AudioSessionRepository(db),
    events,
    clock,
    diagnostics,
    catalog: {
      podcastsForLandmark: (landmarkId) => useCatalogStore.getState().podcastsByLandmarkId.get(landmarkId) ?? [],
      podcastById: (podcastId) => useCatalogStore.getState().snapshot.podcasts.find((podcast) => podcast.id === podcastId) ?? null,
      landmarkInfo: (landmarkId) =>
      {
        const landmark = useCatalogStore.getState().landmarksById.get(landmarkId);
        return landmark === undefined ? null : { name: landmark.name, thumbnailUrl: landmark.thumbnailUrl };
      },
    },
    preferences: () => getPreferences(),
    media,
    connectivity,
    mediaProbe: new FetchMediaProbe(fetch),
    setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  });
  playback.set(audio);
  const packDetails = new PackDetailsRepository(db, api);
  const downloads = new DownloadManager({
    repository: new DownloadsRepository(db),
    transport: new ExpoFileTransport(),
    connectivity,
    fetchPack: (parkId) => packDetails.fetchPack(parkId),
    setLandmarkImage: (landmarkId, localPath) => packDetails.setLandmarkImageLocalPath(landmarkId, localPath),
    wifiOnly: () => getPreferences().downloadOverWifiOnly,
    parkName: (parkId) => useCatalogStore.getState().parksById.get(parkId)?.name ?? 'Your heritage park',
    notifier,
    clock,
    diagnostics,
  });
  return {
    config,
    clock,
    events,
    db,
    api,
    diagnostics,
    catalogRepository,
    catalogSync,
    flowCache: new FlowCacheRepository(db, clock),
    preferences: new PreferencesRepository(db),
    permissions: expoPermissionService,
    spoofSource,
    location,
    geofence,
    notifier,
    debugGate: new DebugGate(config.debugToolsEnabled),
    playback,
    audio,
    connectivity,
    packDetails,
    media,
    downloads,
    routes: new RouteNavigator(new RoutePlanner(api, clock), events, db),
    saved: new SavedRepository(db, clock),
    history: new HistoryRepository(db),
  };
}
