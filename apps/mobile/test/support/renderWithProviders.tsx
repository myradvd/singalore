import { FakeMediaProbe } from '@/core/http/FakeMediaProbe';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AppServicesProvider } from '@/composition/AppServicesContext';
import type { AppServices } from '@/composition/container';
import { createMutablePlaybackStatus } from '@/composition/playbackStatus';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { ApiClient } from '@/core/http/ApiClient';
import { CatalogRepository } from '@/modules/catalog/CatalogRepository';
import { CatalogSync } from '@/modules/catalog/CatalogSync';
import { AudioController } from '@/modules/audio/AudioController';
import { AudioSessionRepository } from '@/modules/audio/AudioSessionRepository';
import { FakeAudioEngine } from '@/modules/audio/FakeAudioEngine';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { ConnectivityMonitor } from '@/modules/offline/ConnectivityMonitor';
import { DownloadedMediaResolver } from '@/modules/offline/DownloadedMediaResolver';
import { PackDetailsRepository } from '@/modules/offline/PackDetailsRepository';
import { HistoryRepository } from '@/modules/history/HistoryRepository';
import { RouteNavigator } from '@/modules/routing/RouteNavigator';
import { RoutePlanner } from '@/modules/routing/RoutePlanner';
import { SavedRepository } from '@/modules/saved/SavedRepository';
import { DownloadManager } from '@/modules/offline/DownloadManager';
import { DownloadsRepository } from '@/modules/offline/DownloadsRepository';
import type { FileTransport } from '@/modules/offline/FileTransport';
import { DebugGate } from '@/modules/debug/debugGate';
import { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';
import { LocationEngine } from '@/modules/location/LocationEngine';
import type { LocationSource } from '@/modules/location/LocationSource';
import type { PermissionService } from '@/modules/location/permissions';
import { SpoofLocationSource } from '@/modules/location/SpoofLocationSource';
import { PreferencesRepository } from '@/modules/prefs/PreferencesRepository';
import { DiagnosticsLog } from '@/modules/diagnostics/DiagnosticsLog';
import { FlowCacheRepository } from '@/modules/flow/FlowCacheRepository';
import { createMemoryDb } from './betterSqliteAdapter';

export async function createTestServices(fetchImplementation: typeof fetch = async () => new Response(null, { status: 503 })): Promise<AppServices>
{
  const clock = new ManualClock(Date.parse('2026-10-12T00:00:00Z'));
  const events = createAppEventBus();
  const db = createMemoryDb();
  await migrate(db);
  const diagnostics = new DiagnosticsLog(db, clock, events);
  const api = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation, clock, events });
  const catalogRepository = new CatalogRepository(db);
  const spoofSource = new SpoofLocationSource(clock, { setInterval: () => 0, clearInterval: () => undefined });
  const deviceSource: LocationSource = { kind: 'device', start: async () => ({ stop: () => undefined }) };
  const location = new LocationEngine({ deviceSource, spoofSource, clock, events, diagnostics, setTimer: () => 0, clearTimer: () => undefined });
  const playback = createMutablePlaybackStatus();
  const permissions: PermissionService = {
    snapshot: async () => ({ servicesEnabled: true, foreground: 'granted', background: 'denied', foregroundCanAskAgain: true }),
    requestForeground: async () => ({ servicesEnabled: true, foreground: 'granted', background: 'denied', foregroundCanAskAgain: true }),
    requestBackground: async () => ({ servicesEnabled: true, foreground: 'granted', background: 'granted', foregroundCanAskAgain: true }),
    openAppSettings: async () => undefined,
  };
  const geofence = new GeofenceEngine({
    events,
    clock,
    diagnostics,
    targets: () => [],
    settings: () => ({ geofenceTriggersEnabled: true, autoplayEnabled: false }),
    playback,
    osGeofencer: { setRegions: async () => undefined, clear: async () => undefined },
  });
  const connectivity = new ConnectivityMonitor(events, clock);
  const media = new DownloadedMediaResolver(db, { size: () => null });
  const audio = new AudioController({
    engine: new FakeAudioEngine(),
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
    preferences: () => ({ preferredVoice: null, preferredAccent: null, preferredLength: null, playbackRate: 1 }),
    media,
    connectivity,
    mediaProbe: new FakeMediaProbe(),
    setInterval: () => 0,
    clearInterval: () => undefined,
  });
  playback.set(audio);
  audio.start();
  const packDetails = new PackDetailsRepository(db, api);
  const notifier = { permission: async () => 'granted' as const, requestPermission: async () => 'granted' as const, notify: async () => true };
  const transport: FileTransport = {
    ensureDirectory: (parkId) => `file:///packs/${parkId}`,
    download: async () => ({ kind: 'done' }),
    cancelActive: async () => null,
    fileInfo: () => ({ exists: false, size: null, md5: null }),
    deleteFile: () => undefined,
    deleteDirectory: () => undefined,
    availableBytes: () => 1_000_000_000,
  };
  const downloads = new DownloadManager({
    repository: new DownloadsRepository(db),
    transport,
    connectivity,
    fetchPack: (parkId) => packDetails.fetchPack(parkId),
    setLandmarkImage: (landmarkId, localPath) => packDetails.setLandmarkImageLocalPath(landmarkId, localPath),
    wifiOnly: () => false,
    parkName: () => 'Park',
    notifier,
    clock,
    diagnostics,
  });
  return {
    config: { appVariant: 'development', apiBaseUrl: 'https://api.test', mapStyleUrl: 'https://tiles.test/style', debugToolsEnabled: true, satelliteTileUrl: null, sentryDsn: null },
    clock,
    events,
    db,
    api,
    diagnostics,
    catalogRepository,
    catalogSync: new CatalogSync(api, catalogRepository, clock, events, diagnostics),
    flowCache: new FlowCacheRepository(db, clock),
    preferences: new PreferencesRepository(db),
    permissions,
    spoofSource,
    location,
    geofence,
    notifier,
    debugGate: new DebugGate(true),
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

export function renderWithServices(services: AppServices, element: ReactElement)
{
  return render(element, { wrapper: ({ children }) => <AppServicesProvider services={services}>{children}</AppServicesProvider> });
}
