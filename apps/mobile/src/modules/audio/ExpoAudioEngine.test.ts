import type { TrackMetadata } from './AudioEngine';
import { ExpoAudioEngine } from './ExpoAudioEngine';

const mockCreateAudioPlayer = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
  setAudioModeAsync: async () => undefined,
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
  };
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
