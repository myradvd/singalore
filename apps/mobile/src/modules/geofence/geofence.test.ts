import { destinationPoint } from '@singalore/shared';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { syntheticLandmarks } from '@test/support/syntheticCatalog';
import { GeofenceEngine, type GeofenceSettings, type OsGeofencer } from './GeofenceEngine';
import { exitRadiusMeters, GeofenceEvaluator } from './GeofenceEvaluator';
import { OS_MIN_REGION_RADIUS_METERS, selectOsWindow, shouldRefreshWindow } from './osWindow';
import { decidePrompt, DISMISS_SUPPRESSION_MS, type PromptContext } from './promptPolicy';

const CENTER = { lat: 1.2951, lng: 103.8519 };
const chijmes: GeofenceTarget = { landmarkId: 'chijmes', name: 'CHIJMES', latitude: CENTER.lat, longitude: CENTER.lng, radiusMeters: 30, hasPodcast: true };
const quiet: GeofenceTarget = { landmarkId: 'quiet', name: 'Quiet', latitude: 1.3, longitude: 103.86, radiusMeters: 30, hasPodcast: false };

function fixAt(metersNorth: number, timestamp: number, accuracyMeters: number | null = 10, center = CENTER): LocationFix
{
  const point = destinationPoint(center, metersNorth >= 0 ? 0 : 180, Math.abs(metersNorth));
  return { latitude: point.lat, longitude: point.lng, accuracyMeters, timestamp, source: 'device' };
}

describe('GeofenceEvaluator (UC 1.3.1)', () =>
{
  it('enters on the first accurate fix inside the radius', () =>
  {
    const evaluator = new GeofenceEvaluator();
    expect(evaluator.evaluate(fixAt(60, 0), [chijmes])).toEqual([]);
    const transitions = evaluator.evaluate(fixAt(25, 1000), [chijmes]);
    expect(transitions).toEqual([{ type: 'enter', landmarkId: 'chijmes', at: 1000, distanceMeters: expect.closeTo(25, 0) }]);
    expect(evaluator.evaluate(fixAt(10, 2000), [chijmes])).toEqual([]);
  });

  it('ignores inaccurate fixes for entry (accuracy > 40 m or unknown)', () =>
  {
    const evaluator = new GeofenceEvaluator();
    expect(evaluator.evaluate(fixAt(5, 0, 41), [chijmes])).toEqual([]);
    expect(evaluator.evaluate(fixAt(5, 0, null), [chijmes])).toEqual([]);
    expect(evaluator.evaluate(fixAt(5, 0, 40), [chijmes])).toHaveLength(1);
  });

  it('meets the 3 s target at 1 Hz: arrival is detected on the first fix inside (NFR 1.1)', () =>
  {
    const evaluator = new GeofenceEvaluator();
    const arrivals: number[] = [];
    for (let second = 0; second <= 120; second += 1)
    {
      const metersNorth = 120 - second * 1.4;
      for (const transition of evaluator.evaluate(fixAt(metersNorth, second * 1000), [chijmes]))
      {
        arrivals.push(transition.at);
      }
    }
    const crossingSecond = Math.ceil((120 - 30) / 1.4);
    expect(arrivals[0]).toBeDefined();
    expect((arrivals[0] ?? 0) / 1000 - crossingSecond).toBeLessThanOrEqual(3);
  });

  it('uses hysteresis: exit needs radius + max(15, r/2) on two fixes', () =>
  {
    expect(exitRadiusMeters(30)).toBe(45);
    expect(exitRadiusMeters(100)).toBe(150);
    const evaluator = new GeofenceEvaluator();
    evaluator.evaluate(fixAt(0, 0), [chijmes]);
    expect(evaluator.evaluate(fixAt(40, 1000), [chijmes])).toEqual([]);
    expect(evaluator.evaluate(fixAt(50, 2000), [chijmes])).toEqual([]);
    expect(evaluator.evaluate(fixAt(50, 3000), [chijmes])).toEqual([{ type: 'exit', landmarkId: 'chijmes', at: 3000 }]);
  });

  it('exits after 5 s outside even if fixes are sparse, and resets on a fix back inside', () =>
  {
    const evaluator = new GeofenceEvaluator();
    evaluator.evaluate(fixAt(0, 0), [chijmes]);
    evaluator.evaluate(fixAt(60, 1000), [chijmes]);
    evaluator.evaluate(fixAt(20, 2000), [chijmes]);
    expect(evaluator.evaluate(fixAt(60, 3000), [chijmes])).toEqual([]);
    expect(evaluator.evaluate(fixAt(60, 8000), [chijmes])).toHaveLength(1);
  });

  it('does not flap at the boundary', () =>
  {
    const evaluator = new GeofenceEvaluator();
    const transitions = [28, 32, 29, 33, 31, 27, 34].flatMap((meters, index) => evaluator.evaluate(fixAt(meters, index * 1000), [chijmes]));
    expect(transitions.map((transition) => transition.type)).toEqual(['enter']);
  });

  it('forgets landmarks removed from the catalog', () =>
  {
    const evaluator = new GeofenceEvaluator();
    evaluator.evaluate(fixAt(0, 0), [chijmes]);
    evaluator.evaluate(fixAt(0, 1000), []);
    expect(evaluator.insideLandmarkIds()).toEqual([]);
  });

  it('evaluates 150 landmarks quickly (NFR 5.2)', () =>
  {
    const { landmarks, podcasts } = syntheticLandmarks(150);
    const withPodcast = new Set(podcasts.map((podcast) => podcast.landmarkId));
    const targets = landmarks.map((landmark) => ({ landmarkId: landmark.id, name: landmark.name, latitude: landmark.position.lat, longitude: landmark.position.lng, radiusMeters: 30, hasPodcast: withPodcast.has(landmark.id) }));
    const evaluator = new GeofenceEvaluator();
    const started = performance.now();
    for (let index = 0; index < 1000; index += 1)
    {
      evaluator.evaluate({ latitude: 1.29 + index * 0.00001, longitude: 103.85, accuracyMeters: 8, timestamp: index * 1000, source: 'device' }, targets);
    }
    expect((performance.now() - started) / 1000).toBeLessThan(2);
  });
});

describe('decidePrompt (UC 1.3.2, 1.3.3)', () =>
{
  const base: PromptContext = {
    geofenceTriggersEnabled: true,
    autoplayEnabled: false,
    hasPodcast: true,
    audioPlaying: false,
    playingLandmarkId: null,
    playedInTour: new Set(),
    dismissedAt: new Map(),
    now: 1_000_000,
  };

  it('prompts by default and autoplays in Autoplay Mode', () =>
  {
    expect(decidePrompt('a', base)).toEqual({ action: 'prompt' });
    expect(decidePrompt('a', { ...base, autoplayEnabled: true })).toEqual({ action: 'autoplay' });
  });

  it.each([
    [{ geofenceTriggersEnabled: false }, 'triggers_off'],
    [{ hasPodcast: false }, 'no_podcast'],
    [{ playedInTour: new Set(['a']) }, 'already_played'],
    [{ playingLandmarkId: 'a', audioPlaying: true }, 'already_playing'],
    [{ dismissedAt: new Map([['a', 1_000_000 - DISMISS_SUPPRESSION_MS + 1]]) }, 'recently_dismissed'],
  ] as const)('suppresses with %o', (overrides, reason) =>
  {
    expect(decidePrompt('a', { ...base, ...overrides })).toEqual({ action: 'suppress', reason });
  });

  it('prompts again once the 10 minute dismissal expires', () =>
  {
    expect(decidePrompt('a', { ...base, dismissedAt: new Map([['a', 1_000_000 - DISMISS_SUPPRESSION_MS]]) })).toEqual({ action: 'prompt' });
  });

  it('shows Next up instead of a prompt while audio plays', () =>
  {
    expect(decidePrompt('b', { ...base, audioPlaying: true, playingLandmarkId: 'a' })).toEqual({ action: 'next_up' });
  });
});

describe('OS geofence window', () =>
{
  it('registers the nearest 15 landmarks with podcasts at a 100 m minimum radius', () =>
  {
    const { landmarks, podcasts } = syntheticLandmarks(150);
    const withPodcast = new Set(podcasts.map((podcast) => podcast.landmarkId));
    const targets = landmarks.map((landmark) => ({ landmarkId: landmark.id, name: landmark.name, latitude: landmark.position.lat, longitude: landmark.position.lng, radiusMeters: 30, hasPodcast: withPodcast.has(landmark.id) }));
    const regions = selectOsWindow(targets, 1.29, 103.85);
    expect(regions).toHaveLength(15);
    expect(regions.every((region) => withPodcast.has(region.identifier))).toBe(true);
    expect(regions.every((region) => region.radius === OS_MIN_REGION_RADIUS_METERS)).toBe(true);
    expect(regions[0]?.identifier).toBe(landmarks[0]?.id);
    expect(selectOsWindow([{ ...chijmes, radiusMeters: 120 }], 1.29, 103.85)[0]?.radius).toBe(120);
    expect(selectOsWindow([quiet], 1.29, 103.85)).toEqual([]);
  });

  it('refreshes after moving more than 150 m', () =>
  {
    expect(shouldRefreshWindow(null, 1.29, 103.85)).toBe(true);
    const moved = destinationPoint({ lat: 1.29, lng: 103.85 }, 0, 140);
    expect(shouldRefreshWindow({ latitude: 1.29, longitude: 103.85 }, moved.lat, moved.lng)).toBe(false);
    const far = destinationPoint({ lat: 1.29, lng: 103.85 }, 0, 160);
    expect(shouldRefreshWindow({ latitude: 1.29, longitude: 103.85 }, far.lat, far.lng)).toBe(true);
  });
});

function createEngine(settings: Partial<GeofenceSettings> = {})
{
  const clock = new ManualClock(0);
  const events = createAppEventBus();
  const playRequests: { landmarkId: string; reason: string }[] = [];
  const enters: string[] = [];
  events.on('audio/playLandmarkRequested', (request) => playRequests.push(request));
  events.on('geofence/enter', (event) => enters.push(`${event.landmarkId}:${event.source}`));
  const playback = { playing: false, landmarkId: null as string | null };
  const registered: string[][] = [];
  const osGeofencer: OsGeofencer = {
    setRegions: async (regions) =>
    {
      registered.push(regions.map((region) => region.identifier));
    },
    clear: async () =>
    {
      registered.push([]);
    },
  };
  const currentSettings: GeofenceSettings = { geofenceTriggersEnabled: true, autoplayEnabled: false, ...settings };
  const engine = new GeofenceEngine({
    events,
    clock,
    diagnostics: { record: async () => undefined },
    targets: () => [chijmes, quiet, { ...chijmes, landmarkId: 'raffles', latitude: destinationPoint(CENTER, 90, 250).lat, longitude: destinationPoint(CENTER, 90, 250).lng }],
    settings: () => currentSettings,
    playback: { isPlaying: () => playback.playing, currentLandmarkId: () => playback.landmarkId },
    osGeofencer,
  });
  engine.start();
  return { engine, events, clock, playRequests, enters, playback, registered, settings: currentSettings };
}

describe('GeofenceEngine', () =>
{
  it('drives a prompt from location fixes, and accepting requests playback', () =>
  {
    const { engine, events, playRequests, enters } = createEngine();
    events.emit('location/fix', fixAt(5, 1000));
    expect(enters).toEqual(['chijmes:foreground']);
    expect(engine.getState().prompt).toMatchObject({ landmarkId: 'chijmes', forced: false });
    engine.acceptPrompt();
    expect(playRequests).toEqual([{ landmarkId: 'chijmes', reason: 'prompt_accepted' }]);
    expect(engine.getState().prompt).toBeNull();
  });

  it('autoplays without a prompt in Autoplay Mode (UC 1.3.3)', () =>
  {
    const { engine, events, playRequests } = createEngine({ autoplayEnabled: true });
    events.emit('location/fix', fixAt(5, 1000));
    expect(engine.getState().prompt).toBeNull();
    expect(playRequests).toEqual([{ landmarkId: 'chijmes', reason: 'autoplay' }]);
  });

  it('dismissal suppresses until the walker exits and re-enters (UC 1.3.2.1)', () =>
  {
    const { engine, events } = createEngine();
    events.emit('location/fix', fixAt(5, 1000));
    engine.dismissPrompt();
    events.emit('location/fix', fixAt(80, 2000));
    events.emit('location/fix', fixAt(80, 3000));
    events.emit('location/fix', fixAt(5, 4000));
    expect(engine.getState().prompt?.landmarkId).toBe('chijmes');
  });

  it('never prompts for a landmark already played in this tour', () =>
  {
    const { engine, events } = createEngine();
    events.emit('audio/started', { landmarkId: 'chijmes', podcastId: 'p1' });
    events.emit('audio/ended', { landmarkId: 'chijmes', podcastId: 'p1' });
    events.emit('location/fix', fixAt(5, 1000));
    expect(engine.getState().prompt).toBeNull();
    engine.resetTour();
    events.emit('location/fix', fixAt(80, 2000));
    events.emit('location/fix', fixAt(80, 3000));
    events.emit('location/fix', fixAt(5, 4000));
    expect(engine.getState().prompt?.landmarkId).toBe('chijmes');
  });

  it('shows an out of range notice but never touches playback on exit (UC 1.3.5)', () =>
  {
    const { engine, events, playback, playRequests } = createEngine();
    events.emit('location/fix', fixAt(5, 1000));
    engine.acceptPrompt();
    playback.playing = true;
    playback.landmarkId = 'chijmes';
    events.emit('audio/started', { landmarkId: 'chijmes', podcastId: 'p1' });
    events.emit('location/fix', fixAt(80, 2000));
    events.emit('location/fix', fixAt(80, 3000));
    expect(engine.getState().outOfRange).toEqual({ landmarkId: 'chijmes', at: 3000 });
    expect(playRequests).toHaveLength(1);
    engine.dismissOutOfRange();
    expect(engine.getState().outOfRange).toBeNull();
  });

  it('queues Next up while playing and plays it when the current episode ends in Autoplay Mode', () =>
  {
    const { engine, events, playback, playRequests, settings } = createEngine({ autoplayEnabled: true });
    playback.playing = true;
    playback.landmarkId = 'other';
    events.emit('location/fix', fixAt(5, 1000));
    expect(engine.getState().nextUpLandmarkId).toBe('chijmes');
    expect(playRequests).toEqual([]);
    playback.playing = false;
    events.emit('audio/ended', { landmarkId: 'other', podcastId: 'p0' });
    expect(playRequests).toEqual([{ landmarkId: 'chijmes', reason: 'queued' }]);
    settings.autoplayEnabled = false;
  });

  it('turns Next up into a prompt when autoplay is off, and drops it if the walker left', () =>
  {
    const first = createEngine();
    first.playback.playing = true;
    first.playback.landmarkId = 'other';
    first.events.emit('location/fix', fixAt(5, 1000));
    first.playback.playing = false;
    first.events.emit('audio/ended', { landmarkId: 'other', podcastId: 'p0' });
    expect(first.engine.getState().prompt?.landmarkId).toBe('chijmes');

    const second = createEngine({ autoplayEnabled: true });
    second.playback.playing = true;
    second.playback.landmarkId = 'other';
    second.events.emit('location/fix', fixAt(5, 1000));
    second.events.emit('location/fix', fixAt(80, 2000));
    second.events.emit('location/fix', fixAt(80, 3000));
    expect(second.engine.getState().nextUpLandmarkId).toBeNull();
  });

  it('never prompts for landmarks without a podcast (UC 1.3.2.2)', () =>
  {
    const { engine, events } = createEngine();
    events.emit('location/fix', { latitude: quiet.latitude, longitude: quiet.longitude, accuracyMeters: 5, timestamp: 1, source: 'device' });
    expect(engine.getState().insideLandmarkIds).toContain('quiet');
    expect(engine.getState().prompt).toBeNull();
  });

  it('force trigger and force clear bypass proximity (UC 1.6.4)', () =>
  {
    const { engine, enters } = createEngine();
    engine.forcePrompt('quiet');
    expect(engine.getState().prompt).toMatchObject({ landmarkId: 'quiet', forced: true });
    expect(enters).toEqual(['quiet:forced']);
    engine.clearPrompt();
    expect(engine.getState().prompt).toBeNull();
  });

  it('registers the OS window when triggers are on and clears it when they are off (A2)', async () =>
  {
    const { events, registered, settings } = createEngine();
    events.emit('location/fix', fixAt(500, 1000));
    await Promise.resolve();
    expect(registered.at(-1)).toEqual(['chijmes', 'raffles']);
    settings.geofenceTriggersEnabled = false;
    events.emit('location/fix', fixAt(500, 2000));
    await Promise.resolve();
    await Promise.resolve();
    expect(registered.at(-1)).toEqual([]);
  });

  it('suppresses prompts entirely when geofence triggers are off', () =>
  {
    const { engine, events, playRequests } = createEngine({ geofenceTriggersEnabled: false, autoplayEnabled: true });
    events.emit('location/fix', fixAt(5, 1000));
    expect(engine.getState().prompt).toBeNull();
    expect(playRequests).toEqual([]);
  });
});
