import type { TrackMetadata } from './AudioEngine';
import { ExpoAudioEngine } from './ExpoAudioEngine';

const mockCreateAudioPlayer = jest.fn();
const mockSetAudioMode = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...args),
}));

const FIRST: TrackMetadata = { title: 'First', artist: 'Singalore', artworkUrl: null };
const SECOND: TrackMetadata = { title: 'Second', artist: 'Singalore', artworkUrl: 'https://cdn.test/second.jpg' };

// Builds a stand in for the expo-audio player that records calls.
function createMockPlayer()
{
  return {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setPlaybackRate: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
  };
}

// Returns a promise plus the function that finishes it.
function deferred()
{
  let finish: () => void = () => undefined;
  const promise = new Promise<undefined>((resolve) =>
  {
    finish = () => resolve(undefined);
  });
  return { promise, finish: () => finish() };
}

// Makes the next created player the returned mock.
function nextPlayer()
{
  const player = createMockPlayer();
  mockCreateAudioPlayer.mockReturnValueOnce(player);
  return player;
}

describe('ExpoAudioEngine lock screen controls', () =>
{
  beforeEach(() =>
  {
    mockCreateAudioPlayer.mockReset();
  });

  it('a load without autoplay does not activate the controls or play', async () =>
  {
    const player = nextPlayer();
    await new ExpoAudioEngine().load('file:///a.m4a', FIRST, 0, false);
    expect(player.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('a load with autoplay activates the controls once, with the metadata, and plays', async () =>
  {
    const player = nextPlayer();
    await new ExpoAudioEngine().load('file:///a.m4a', FIRST, 0, true);
    expect(player.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(player.setActiveForLockScreen).toHaveBeenCalledWith(true, { title: 'First', artist: 'Singalore' }, { showSeekBackward: true, showSeekForward: true });
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('the first play after a load without autoplay activates the controls before playing', async () =>
  {
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, false);
    engine.play();
    expect(player.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(player.setActiveForLockScreen.mock.invocationCallOrder[0]).toBeLessThan(player.play.mock.invocationCallOrder[0] ?? 0);
  });

  it('a second play does not activate the controls again', async () =>
  {
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, false);
    engine.play();
    engine.pause();
    engine.play();
    expect(player.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('play after an autoplay load does not activate the controls again', async () =>
  {
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, true);
    engine.play();
    expect(player.setActiveForLockScreen).toHaveBeenCalledTimes(1);
  });

  it('play with no player loaded does nothing (valid EC, no action)', () =>
  {
    expect(() => new ExpoAudioEngine().play()).not.toThrow();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('play after a stop activates nothing on the removed player', async () =>
  {
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, false);
    engine.stop();
    engine.play();
    expect(player.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('a new load replaces the waiting metadata, so play shows the new track', async () =>
  {
    const first = nextPlayer();
    const second = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, false);
    await engine.load('file:///b.m4a', SECOND, 0, false);
    engine.play();
    expect(first.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(second.setActiveForLockScreen).toHaveBeenCalledWith(true, { title: 'Second', artist: 'Singalore', artworkUrl: 'https://cdn.test/second.jpg' }, { showSeekBackward: true, showSeekForward: true });
  });
});

describe('ExpoAudioEngine stop and replace release the native player', () =>
{
  beforeEach(() =>
  {
    mockCreateAudioPlayer.mockReset();
    mockSetAudioMode.mockReset();
    mockSetAudioMode.mockImplementation(async () => undefined);
  });

  it('stop pauses, clears controls, removes, then releases the player', async () =>
  {
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, true);
    engine.stop();
    const order = [player.pause, player.clearLockScreenControls, player.remove, player.release].map((fn) => fn.mock.invocationCallOrder[0] ?? 0);
    expect(order.every((value) => value > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('a load replacing a player releases the old one', async () =>
  {
    const first = nextPlayer();
    nextPlayer();
    const engine = new ExpoAudioEngine();
    await engine.load('file:///a.m4a', FIRST, 0, false);
    await engine.load('file:///b.m4a', SECOND, 0, false);
    expect(first.release).toHaveBeenCalledTimes(1);
  });

  it('stop with no player does nothing', () =>
  {
    expect(() => new ExpoAudioEngine().stop()).not.toThrow();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('stop during the audio mode wait creates no player and plays nothing', async () =>
  {
    const mode = deferred();
    mockSetAudioMode.mockImplementationOnce(() => mode.promise);
    const engine = new ExpoAudioEngine();
    const pending = engine.load('file:///a.m4a', FIRST, 0, true);
    engine.stop();
    mode.finish();
    await pending;
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('the older of two concurrent loads does not win', async () =>
  {
    const waitOlder = deferred();
    const waitNewer = deferred();
    const waits = [waitOlder, waitNewer];
    mockSetAudioMode.mockImplementationOnce(() => waitOlder.promise).mockImplementationOnce(() => waitNewer.promise);
    const player = nextPlayer();
    const engine = new ExpoAudioEngine();
    const older = engine.load('file:///a.m4a', FIRST, 0, true);
    const newer = engine.load('file:///b.m4a', SECOND, 0, true);
    waits.forEach((wait) => wait.finish());
    await Promise.all([older, newer]);
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(mockCreateAudioPlayer.mock.calls[0]?.[0]).toEqual({ uri: 'file:///b.m4a' });
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('stop while seeking does not play afterwards', async () =>
  {
    const player = nextPlayer();
    const seek = deferred();
    player.seekTo.mockImplementationOnce(() => seek.promise);
    const engine = new ExpoAudioEngine();
    const pending = engine.load('file:///a.m4a', FIRST, 30, true);
    await Promise.resolve();
    await Promise.resolve();
    engine.stop();
    seek.finish();
    await pending;
    expect(player.play).not.toHaveBeenCalled();
  });
});
