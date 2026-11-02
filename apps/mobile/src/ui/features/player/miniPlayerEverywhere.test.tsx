import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { AppServices } from '@/composition/container';
import { IDLE_STATUS } from '@/modules/audio/AudioEngine';
import { bindAudioStore, useAudioStore } from '@/modules/audio/audioStore';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { catalogFixture, LANDMARK_CHIJMES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { WithMiniPlayer } from './MiniPlayer';

const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

beforeEach(() =>
{
  mockPathname = '/';
  mockPush.mockClear();
  useFlowStore.setState({ state: INITIAL_FLOW_STATE });
  useAudioStore.setState({ track: null, status: IDLE_STATUS, resumeOffer: null, lastError: null });
});

// Renders a stand-in screen inside the shared frame with audio playing.
async function renderFrameWithPlayingAudio(): Promise<AppServices>
{
  applyCatalogSnapshot(catalogFixture());
  const services = await createTestServices();
  bindAudioStore(services.audio);
  await renderWithServices(services, <WithMiniPlayer><Text>screen body</Text></WithMiniPlayer>);
  await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
  return services;
}

describe('mini player on every screen (D42)', () =>
{
  it.each(['/', '/saved', '/history', '/preferences', '/preferences/audio', '/explore', '/explore/park-1', '/downloads', '/help', '/transcript'])('audio playing on %s: the mini player and the screen body show', async (path) =>
  {
    mockPathname = path;
    await renderFrameWithPlayingAudio();
    expect(screen.getByTestId('mini-player')).toBeTruthy();
    expect(screen.getByText('screen body')).toBeTruthy();
  });

  it('audio playing on the full player: no mini player', async () =>
  {
    mockPathname = '/player';
    await renderFrameWithPlayingAudio();
    expect(screen.queryByTestId('mini-player')).toBeNull();
  });

  it('leaving the full player for Saved: the mini player appears', async () =>
  {
    mockPathname = '/player';
    const services = await renderFrameWithPlayingAudio();
    expect(screen.queryByTestId('mini-player')).toBeNull();
    mockPathname = '/saved';
    await renderWithServices(services, <WithMiniPlayer><Text>screen body</Text></WithMiniPlayer>);
    expect(screen.getByTestId('mini-player')).toBeTruthy();
  });

  it('audio paused: the mini player stays with a Play control', async () =>
  {
    mockPathname = '/history';
    const services = await renderFrameWithPlayingAudio();
    await fireEvent.press(screen.getByLabelText('Pause'));
    expect(services.audio.getState().status.state).toBe('paused');
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('no audio: no mini player', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindAudioStore(services.audio);
    await renderWithServices(services, <WithMiniPlayer><Text>screen body</Text></WithMiniPlayer>);
    expect(screen.queryByTestId('mini-player')).toBeNull();
  });

  it.each(['routeEditor', 'routeConfirm', 'expandedMap'] as const)('flow screen %s with audio playing: the mini player shows', async (flowScreen) =>
  {
    await renderFrameWithPlayingAudio();
    await act(async () => useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, screen: flowScreen } }));
    expect(screen.getByTestId('mini-player')).toBeTruthy();
  });

  it('after Exit ends a tour with audio playing: the mini player is still there', async () =>
  {
    const services = await renderFrameWithPlayingAudio();
    await act(async () => useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, base: 'inProgress', screen: 'navigation', itinerary: [LANDMARK_CHIJMES], modal: { kind: 'confirmExit', origin: 'navigation' } } }));
    await act(async () => dispatchFlow({ type: 'chooseExit', choice: 'discard', at: 0 }));
    expect(services.audio.getState().track).not.toBeNull();
    expect(screen.getByTestId('mini-player')).toBeTruthy();
  });

  it('open and stop controls: open pushes the full player, stop clears the track', async () =>
  {
    mockPathname = '/saved';
    const services = await renderFrameWithPlayingAudio();
    await fireEvent.press(screen.getByTestId('mini-open'));
    expect(mockPush).toHaveBeenCalledWith('/player');
    await fireEvent.press(screen.getByTestId('mini-close'));
    expect(services.audio.getState().track).toBeNull();
    expect(screen.queryByTestId('mini-player')).toBeNull();
  });
});
