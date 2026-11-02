import { destinationPoint } from '@singalore/shared';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { AudioController } from '@/modules/audio/AudioController';
import { AudioSessionRepository } from '@/modules/audio/AudioSessionRepository';
import { FakeAudioEngine } from '@/modules/audio/FakeAudioEngine';
import { FakeMediaProbe } from '@/core/http/FakeMediaProbe';
import { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { wirePromptAudio } from './promptAudioWiring';

const catalog = catalogFixture();
const CENTER = { lat: 1.2951, lng: 103.8519 };
const FAR_CENTER = { lat: 1.31, lng: 103.87 };
const targets: GeofenceTarget[] = [
  { landmarkId: LANDMARK_CHIJMES, name: 'CHIJMES', latitude: CENTER.lat, longitude: CENTER.lng, radiusMeters: 30, hasPodcast: true },
  { landmarkId: LANDMARK_RAFFLES, name: 'Raffles', latitude: FAR_CENTER.lat, longitude: FAR_CENTER.lng, radiusMeters: 30, hasPodcast: true },
];

// Builds a device fix a given distance north of a site centre.
function fixAt(metersNorth: number, timestamp: number, center = CENTER): LocationFix
{
  const point = destinationPoint(center, 0, metersNorth);
  return { latitude: point.lat, longitude: point.lng, accuracyMeters: 10, timestamp, source: 'device' };
}

// Lets the pending prepare and save promises finish.
async function settle(): Promise<void>
{
  await new Promise((resolve) => setImmediate(resolve));
}

// Builds the real audio controller and geofence engine joined by the real wiring.
async function setupRealPair()
{
  const db = createMemoryDb();
  await migrate(db);
  const events = createAppEventBus();
  const clock = new ManualClock(Date.parse('2026-10-12T01:00:00Z'));
  const engine = new FakeAudioEngine();
  const sessions = new AudioSessionRepository(db);
  const diagnostics = { record: async () => undefined };
  const audio = new AudioController({
    engine,
    sessions,
    events,
    clock,
    diagnostics,
    catalog: {
      podcastsForLandmark: (landmarkId) => catalog.podcasts.filter((podcast) => podcast.landmarkId === landmarkId),
      podcastById: (podcastId) => catalog.podcasts.find((podcast) => podcast.id === podcastId) ?? null,
      landmarkInfo: (landmarkId) =>
      {
        const landmark = catalog.landmarks.find((candidate) => candidate.id === landmarkId);
        return landmark === undefined ? null : { name: landmark.name, thumbnailUrl: landmark.thumbnailUrl };
      },
    },
    preferences: () => ({ preferredVoice: null, preferredAccent: null, preferredLength: null, playbackRate: 1 }),
    media: { localAudioUri: async () => null },
    connectivity: { isOnline: () => true },
    mediaProbe: new FakeMediaProbe(),
    setInterval: () => 1,
    clearInterval: () => undefined,
  });
  const geofence = new GeofenceEngine({
    events,
    clock,
    diagnostics,
    targets: () => targets,
    settings: () => ({ geofenceTriggersEnabled: true, autoplayEnabled: false }),
    playback: audio,
    osGeofencer: { setRegions: async () => undefined, clear: async () => undefined },
  });
  audio.start();
  geofence.start();
  return { audio, geofence, engine, events, sessions };
}

describe('prompt audio wiring characterisation', () =>
{
  it('calls prepare with the landmark id when a prompt is set', async () =>
  {
    const { audio, geofence, events } = await setupRealPair();
    const prepare = jest.spyOn(audio, 'prepare');
    wirePromptAudio(geofence, audio);
    events.emit('location/fix', fixAt(5, 1000));
    expect(prepare).toHaveBeenCalledWith(LANDMARK_CHIJMES);
    await settle();
  });

  it('does not call prepare when the prompt is null', async () =>
  {
    const { audio, geofence, events } = await setupRealPair();
    const prepare = jest.spyOn(audio, 'prepare');
    wirePromptAudio(geofence, audio);
    events.emit('location/fix', fixAt(500, 1000));
    expect(geofence.getState().prompt).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
    await settle();
  });
});
