import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_SHELTER, PODCAST_CHIJMES_GB, PODCAST_CHIJMES_US } from '@test/support/catalogFixture';
import { AudioController, SESSION_SAVE_INTERVAL_MS } from './AudioController';
import { AudioSessionRepository } from './AudioSessionRepository';
import { FakeAudioEngine } from './FakeAudioEngine';
import { availableVariantOptions, pickPodcast } from './pickPodcast';
import { PLAYBACK_ERROR_MESSAGES } from './playbackErrors';
import { chooseAudioSource, OFFLINE_AUDIO_UNAVAILABLE } from './sourceChoice';
import { FakeMediaProbe } from '@/core/http/FakeMediaProbe';
import type { MediaProbeResult } from '@/core/media';

const catalog = catalogFixture();
const noPreference = { preferredVoice: null, preferredAccent: null, preferredLength: null };

describe('pickPodcast', () =>
{
  const chijmes = catalog.podcasts.filter((podcast) => podcast.landmarkId === LANDMARK_CHIJMES);

  it('returns null without podcasts and the first without preferences', () =>
  {
    expect(pickPodcast([], noPreference)).toBeNull();
    expect(pickPodcast(chijmes, noPreference)?.id).toBe(PODCAST_CHIJMES_GB);
  });

  it('prefers accent, then voice, then length', () =>
  {
    expect(pickPodcast(chijmes, { ...noPreference, preferredAccent: 'American' })?.id).toBe(PODCAST_CHIJMES_US);
    expect(pickPodcast(chijmes, { ...noPreference, preferredVoice: 'Female' })?.id).toBe(PODCAST_CHIJMES_US);
    expect(pickPodcast(chijmes, { preferredVoice: 'Female', preferredAccent: 'British', preferredLength: null })?.id).toBe(PODCAST_CHIJMES_GB);
  });

  it('lists only the variants the catalog offers', () =>
  {
    expect(availableVariantOptions(catalog.podcasts)).toEqual({ voices: ['Female', 'Male'], accents: ['American', 'British'], lengths: ['short', 'standard'] });
  });
});

describe('chooseAudioSource (UC 1.4.2)', () =>
{
  it('prefers a verified local file, then streams, then fails offline', () =>
  {
    expect(chooseAudioSource('file:///a.m4a', 'https://x/a.m4a', false)).toEqual({ kind: 'local', uri: 'file:///a.m4a' });
    expect(chooseAudioSource(null, 'https://x/a.m4a', true)).toEqual({ kind: 'stream', uri: 'https://x/a.m4a' });
    expect(chooseAudioSource(null, 'https://x/a.m4a', false)).toEqual({ kind: 'unavailable', message: OFFLINE_AUDIO_UNAVAILABLE });
  });
});

async function setup(options: { online?: boolean; local?: Record<string, string>; probe?: MediaProbeResult } = {})
{
  const diagnostics: string[] = [];
  const mediaProbe = new FakeMediaProbe(options.probe);
  const probed = mediaProbe.probedUrls;
  const db = createMemoryDb();
  await migrate(db);
  const engine = new FakeAudioEngine();
  const events = createAppEventBus();
  const started: string[] = [];
  const ended: string[] = [];
  events.on('audio/started', (event) => started.push(event.landmarkId));
  events.on('audio/ended', (event) => ended.push(event.landmarkId));
  const intervals: (() => void)[] = [];
  const sessions = new AudioSessionRepository(db);
  const controller = new AudioController({
    engine,
    sessions,
    events,
    clock: new ManualClock(Date.parse('2026-10-12T01:00:00Z')),
    diagnostics: { record: async (_level, code, detail) =>
    {
      diagnostics.push(`${code} ${detail ?? ''}`);
    } },
    catalog: {
      podcastsForLandmark: (landmarkId) => catalog.podcasts.filter((podcast) => podcast.landmarkId === landmarkId),
      podcastById: (podcastId) => catalog.podcasts.find((podcast) => podcast.id === podcastId) ?? null,
      landmarkInfo: (landmarkId) =>
      {
        const landmark = catalog.landmarks.find((candidate) => candidate.id === landmarkId);
        return landmark === undefined ? null : { name: landmark.name, thumbnailUrl: landmark.thumbnailUrl };
      },
    },
    preferences: () => ({ ...noPreference, playbackRate: 1.25 }),
    media: { localAudioUri: async (podcastId) => options.local?.[podcastId] ?? null },
    connectivity: { isOnline: () => options.online ?? true },
    mediaProbe,
    setInterval: (callback) =>
    {
      intervals.push(callback);
      return intervals.length;
    },
    clearInterval: () => undefined,
  });
  controller.start();
  return { controller, engine, events, sessions, started, ended, intervals, diagnostics, probed };
}

describe('AudioController (UC 1.3.3, 1.3.4)', () =>
{
  it('plays a landmark requested by the geofence engine, at the preferred rate, with lock screen metadata', async () =>
  {
    const { events, engine, started, controller } = await setup();
    events.emit('audio/playLandmarkRequested', { landmarkId: LANDMARK_CHIJMES, reason: 'autoplay' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(engine.loads[0]).toMatchObject({ uri: 'https://cdn.test/media/audio/chijmes-gb.m4a', autoPlay: true, metadata: { title: 'CHIJMES: a short history' } });
    expect(engine.status().rate).toBe(1.25);
    expect(started).toEqual([LANDMARK_CHIJMES]);
    expect(controller.isPlaying()).toBe(true);
    expect(controller.currentLandmarkId()).toBe(LANDMARK_CHIJMES);
  });

  it('does nothing for landmarks without a podcast', async () =>
  {
    const { controller, engine } = await setup();
    expect(await controller.playLandmark(LANDMARK_SHELTER)).toBe(false);
    expect(engine.loads).toHaveLength(0);
  });

  it('prepares on prompt and starts without reloading on Listen (NFR 1.2)', async () =>
  {
    const { controller, engine } = await setup();
    await controller.prepare(LANDMARK_CHIJMES);
    expect(engine.loads).toHaveLength(1);
    expect(engine.status().state).toBe('paused');
    await controller.playLandmark(LANDMARK_CHIJMES);
    expect(engine.loads).toHaveLength(1);
    expect(engine.status().state).toBe('playing');
  });

  it('pauses, resumes, skips 10 s both ways within bounds and seeks', async () =>
  {
    const { controller, engine } = await setup();
    await controller.playLandmark(LANDMARK_CHIJMES);
    controller.togglePlay();
    expect(engine.status().state).toBe('paused');
    controller.togglePlay();
    expect(engine.status().state).toBe('playing');
    await controller.skip(1);
    expect(engine.status().positionSeconds).toBe(10);
    await controller.skip(-1);
    await controller.skip(-1);
    expect(engine.status().positionSeconds).toBe(0);
    await controller.seekTo(115);
    await controller.skip(1);
    expect(engine.status().positionSeconds).toBe(120);
  });

  it('plays the local file when downloaded and reports the offline error otherwise (UC 1.4.2.1)', async () =>
  {
    const local = await setup({ online: false, local: { [PODCAST_CHIJMES_GB]: 'file:///packs/chijmes-gb.m4a' } });
    await local.controller.playLandmark(LANDMARK_CHIJMES);
    expect(local.engine.loads[0]?.uri).toBe('file:///packs/chijmes-gb.m4a');
    expect(local.controller.getState().track?.source).toBe('local');

    const offline = await setup({ online: false });
    expect(await offline.controller.playLandmark(LANDMARK_CHIJMES)).toBe(false);
    expect(offline.controller.getState().lastError).toBe(OFFLINE_AUDIO_UNAVAILABLE);
  });

  it('reports a corrupt local file without probing the network', async () =>
  {
    const { controller, engine, probed } = await setup({ local: { [PODCAST_CHIJMES_GB]: 'file:///broken.m4a' } });
    engine.failNextLoad = true;
    await controller.playLandmark(LANDMARK_CHIJMES);
    await new Promise((resolve) => setImmediate(resolve));
    expect(controller.getState().lastError).toBe(PLAYBACK_ERROR_MESSAGES.local_file_unplayable);
    expect(probed).toEqual([]);
  });

  it('says there is no audio when a site has no podcast', async () =>
  {
    const { controller, engine } = await setup();
    expect(await controller.playLandmark(LANDMARK_SHELTER)).toBe(false);
    expect(controller.getState().lastError).toBe(PLAYBACK_ERROR_MESSAGES.no_audio);
    expect(engine.loads).toEqual([]);
  });

  it.each([
    [{ kind: 'not_found', status: 404 } as const, PLAYBACK_ERROR_MESSAGES.file_not_found],
    [{ kind: 'unreachable' } as const, PLAYBACK_ERROR_MESSAGES.network_unreachable],
    [{ kind: 'http_error', status: 503 } as const, PLAYBACK_ERROR_MESSAGES.server_error],
    [{ kind: 'reachable', status: 206 } as const, PLAYBACK_ERROR_MESSAGES.unplayable],
  ])('names the stream failure for probe %j and logs the URL only in diagnostics', async (probe, message) =>
  {
    const { controller, engine, diagnostics, probed } = await setup({ probe });
    engine.failNextLoad = true;
    await controller.playLandmark(LANDMARK_CHIJMES);
    await new Promise((resolve) => setImmediate(resolve));
    expect(probed).toEqual(['https://cdn.test/media/audio/chijmes-gb.m4a']);
    expect(controller.getState().lastError).toBe(message);
    expect(controller.getState().lastError).not.toContain('https://');
    expect(diagnostics.some((line) => line.startsWith('audio_playback_error') && line.includes('https://cdn.test/media/audio/chijmes-gb.m4a'))).toBe(true);
  });

  it('emits ended once and clears the saved session', async () =>
  {
    const { controller, engine, ended, sessions } = await setup();
    await controller.playLandmark(LANDMARK_CHIJMES);
    await controller.persistNow();
    expect(await sessions.load()).not.toBeNull();
    engine.finish();
    engine.finish();
    await new Promise((resolve) => setImmediate(resolve));
    expect(ended).toEqual([LANDMARK_CHIJMES]);
    expect(await sessions.load()).toBeNull();
  });
});

describe('audio session persistence (NFR 2.3)', () =>
{
  it('saves every 5 s while playing and restores to a paused resume offer', async () =>
  {
    const first = await setup();
    await first.controller.playLandmark(LANDMARK_CHIJMES);
    expect(first.intervals).toHaveLength(1);
    expect(SESSION_SAVE_INTERVAL_MS).toBe(5000);
    first.engine.advance(42);
    first.intervals[0]?.();
    await new Promise((resolve) => setImmediate(resolve));
    const saved = await first.sessions.load();
    expect(saved).toMatchObject({ podcastId: PODCAST_CHIJMES_GB, landmarkId: LANDMARK_CHIJMES, positionMs: 42000, playbackState: 'playing', source: 'stream' });

    const relaunched = await setup();
    await relaunched.sessions.save(saved ?? (() =>
    {
      throw new Error('no session');
    })());
    await relaunched.controller.restoreSession();
    expect(relaunched.engine.loads).toHaveLength(0);
    expect(relaunched.controller.getState().resumeOffer).toMatchObject({ landmarkName: 'CHIJMES', positionMs: 42000 });
    await relaunched.controller.resumeOffered();
    expect(relaunched.engine.loads[0]).toMatchObject({ startAtSeconds: 42, autoPlay: true });
  });

  it('dismissing the resume offer clears the session, and stale sessions are dropped', async () =>
  {
    const { controller, sessions } = await setup();
    await sessions.save({ sessionId: 's', podcastId: PODCAST_CHIJMES_GB, landmarkId: LANDMARK_CHIJMES, positionMs: 1000, playbackState: 'paused', rate: 1, source: 'stream', updatedAt: 'x' });
    await controller.restoreSession();
    await controller.dismissResumeOffer();
    expect(await sessions.load()).toBeNull();
    await sessions.save({ sessionId: 's', podcastId: 'gone', landmarkId: 'gone', positionMs: 1, playbackState: 'paused', rate: 1, source: 'stream', updatedAt: 'x' });
    await controller.restoreSession();
    expect(controller.getState().resumeOffer).toBeNull();
    expect(await sessions.load()).toBeNull();
  });
});
