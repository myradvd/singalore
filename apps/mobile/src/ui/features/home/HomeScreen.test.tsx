import { act, fireEvent, screen } from '@testing-library/react-native';
import type { AppServices } from '@/composition/container';
import { IDLE_STATUS } from '@/modules/audio/AudioEngine';
import { bindAudioStore, useAudioStore } from '@/modules/audio/audioStore';
import { PLAYBACK_ERROR_MESSAGES } from '@/modules/audio/playbackErrors';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_SHELTER, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { cameraCalls, latestMapPropsRef } from '@test/mocks/maplibre';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { useToastStore } from '../../toastStore';
import { HomeScreen } from './HomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

beforeEach(() =>
{
  useFlowStore.setState({ state: INITIAL_FLOW_STATE });
  useToastStore.setState({ toasts: [] });
  useAudioStore.setState({ track: null, status: IDLE_STATUS, resumeOffer: null, lastError: null });
  cameraCalls.length = 0;
  mockPush.mockClear();
});

// Renders Home with a real audio controller bound to the audio store.
async function renderHomeWithAudio(): Promise<AppServices>
{
  applyCatalogSnapshot(catalogFixture());
  const services = await createTestServices();
  bindAudioStore(services.audio);
  await renderWithServices(services, <HomeScreen userLocation={null} />);
  return services;
}

// Reads the width of the mini player progress bar.
function miniPlayerProgressWidth(): unknown
{
  const progressBar = screen.getByTestId('mini-player').children[0];
  const fill = typeof progressBar === 'string' ? undefined : progressBar?.children[0];
  return typeof fill === 'string' ? undefined : fill?.props.style[1].width;
}

describe('HomeScreen audio', () =>
{
  const resumeOffer = { sessionId: 's1', podcastId: 'p1', landmarkId: LANDMARK_CHIJMES, positionMs: 30000, playbackState: 'paused' as const, rate: 1, source: 'stream' as const, updatedAt: '2026-10-12T00:00:00Z', title: 'Offered episode', landmarkName: 'CHIJMES' };

  it('no track: shows no mini player', async () =>
  {
    await renderHomeWithAudio();
    expect(screen.queryByTestId('mini-player')).toBeNull();
  });

  it('track starts: shows the mini player', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    expect(screen.getByTestId('mini-player')).toBeTruthy();
  });

  it('position at half the duration: progress bar width is 50%', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    await act(async () => services.audio.seekTo(60));
    expect(miniPlayerProgressWidth()).toBe('50%');
  });

  it('toggle pressed while playing: pauses and offers Play', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    await fireEvent.press(screen.getByLabelText('Pause'));
    expect(services.audio.getState().status.state).toBe('paused');
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('mini player text pressed: opens the player screen', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    await fireEvent.press(screen.getByTestId('mini-open'));
    expect(mockPush).toHaveBeenCalledWith('/player');
  });

  it('close pressed: clears the track and hides the mini player', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    await fireEvent.press(screen.getByTestId('mini-close'));
    expect(services.audio.getState().track).toBeNull();
    expect(screen.queryByTestId('mini-player')).toBeNull();
  });

  it('10 position updates: the map does not render again and the mini player updates 10 times', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    const mapPropsBefore = latestMapPropsRef.current;
    const widths: unknown[] = [];
    for (let second = 1; second <= 10; second += 1)
    {
      await act(async () => services.audio.seekTo(second * 6));
      widths.push(miniPlayerProgressWidth());
    }
    expect(latestMapPropsRef.current === mapPropsBefore).toBe(true);
    expect(new Set(widths).size).toBe(10);
    expect(widths.at(-1)).toBe('50%');
  });

  it('pause pressed: the map does not render again', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    const mapPropsBefore = latestMapPropsRef.current;
    await fireEvent.press(screen.getByLabelText('Pause'));
    expect(latestMapPropsRef.current === mapPropsBefore).toBe(true);
  });

  it('track goes from null to set: Home renders again', async () =>
  {
    const services = await renderHomeWithAudio();
    const mapPropsBefore = latestMapPropsRef.current;
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    expect(latestMapPropsRef.current === mapPropsBefore).toBe(false);
  });

  it('resume offer with no track: shows the resume card', async () =>
  {
    await renderHomeWithAudio();
    await act(async () => useAudioStore.setState({ resumeOffer }));
    expect(screen.getByTestId('resume-card')).toBeTruthy();
  });

  it('resume offer with a track: hides the resume card', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => useAudioStore.setState({ resumeOffer }));
    await act(async () => void await services.audio.playLandmark(LANDMARK_CHIJMES));
    await act(async () => useAudioStore.setState({ resumeOffer }));
    expect(screen.queryByTestId('resume-card')).toBeNull();
    expect(screen.getByTestId('mini-player')).toBeTruthy();
  });

  it('no resume offer and no track: shows no resume card', async () =>
  {
    await renderHomeWithAudio();
    expect(screen.queryByTestId('resume-card')).toBeNull();
  });

  it('audio error: shows one toast and clears the error', async () =>
  {
    const services = await renderHomeWithAudio();
    await act(async () => void await services.audio.playLandmark('landmark-without-podcast'));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([PLAYBACK_ERROR_MESSAGES.no_audio]);
    expect(services.audio.getState().lastError).toBeNull();
  });
});

describe('HomeScreen', () =>
{
  it('renders the map shell with search, controls and Explore', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.getByTestId('maplibre-map')).toBeTruthy();
    expect(screen.getByTestId('open-search')).toBeTruthy();
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('bottom-explore'));
    expect(mockPush).toHaveBeenCalledWith('/explore');
  });

  it('shows the empty state when there is no catalog and no connection', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.getByTestId('empty-catalog')).toBeTruthy();
    await fireEvent.press(screen.getByText(COPY.emptyCatalogRetry));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(COPY.catalogFetchFailed);
  });

  it('shows the summary card for the selected landmark and closes it', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.queryByTestId('summary-card')).toBeNull();
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    expect(screen.getByTestId('summary-card')).toBeTruthy();
    expect(screen.getByText('CHIJMES')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('close-summary'));
    expect(screen.queryByTestId('summary-card')).toBeNull();
  });

  it('recenter warns while waiting for GPS and centres when a fix exists (UC 1.1.2)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    const view = await renderWithServices(services, <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('recenter'));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([COPY.waitingForGps]);
    await view.rerender(<HomeScreen userLocation={{ latitude: 1.29, longitude: 103.85, accuracyMeters: 8 }} />);
    await fireEvent.press(screen.getByTestId('recenter'));
    expect(cameraCalls.at(-1)).toMatchObject({ method: 'easeTo' });
  });

  it('disables Listen with a short reason when a site has no podcast', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_SHELTER }));
    expect(screen.queryByTestId('summary-listen')).toBeNull();
    expect(screen.getByTestId('summary-listen-unavailable').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText(COPY.noPodcastShort)).toBeTruthy();
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    expect(screen.getByTestId('summary-listen')).toBeTruthy();
  });

  it('keeps the map north up and shows the compass only while rotated', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(latestMapPropsRef.current?.touchRotate).toBe(false);
    expect(latestMapPropsRef.current?.touchPitch).toBe(false);
    expect(screen.queryByTestId('reset-north')).toBeNull();
    await act(async () => latestMapPropsRef.current?.onRegionDidChange?.({ nativeEvent: { zoom: 14, bearing: 35 } }));
    await fireEvent.press(screen.getByTestId('reset-north'));
    expect(cameraCalls.at(-1)).toMatchObject({ method: 'setStop', args: [{ bearing: 0, pitch: 0 }] });
    await act(async () => latestMapPropsRef.current?.onRegionDidChange?.({ nativeEvent: { zoom: 14, bearing: 0 } }));
    expect(screen.queryByTestId('reset-north')).toBeNull();
  });

  it('shows zoom buttons that step the camera, and hides them when the card would cover them', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.queryByTestId('zoom-controls')).toBeNull();
    const layout = (y: number, height: number) => ({ nativeEvent: { layout: { x: 0, y, width: 48, height } } });
    await fireEvent(screen.getByTestId('home-screen'), 'layout', layout(0, 900));
    await fireEvent(screen.getByTestId('map-controls-column'), 'layout', layout(150, 104));
    await fireEvent(screen.getByTestId('card-host'), 'layout', layout(300, 0));
    expect(screen.queryByTestId('zoom-controls')).toBeNull();
    await fireEvent(screen.getByTestId('card-host'), 'layout', layout(800, 0));
    const zoomIn = screen.getByLabelText('Zoom in');
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    await fireEvent.press(zoomIn);
    expect(cameraCalls.at(-1)).toMatchObject({ method: 'zoomTo', args: [14.5, { duration: 250 }] });
    await fireEvent.press(screen.getByTestId('zoom-out'));
    expect(cameraCalls.at(-1)).toMatchObject({ method: 'zoomTo', args: [13.5, { duration: 250 }] });
  });

  it('opens the sidebar and search overlays and expands the map', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-sidebar'));
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('close-sidebar'));
    expect(screen.queryByTestId('sidebar')).toBeNull();
    await fireEvent.press(screen.getByTestId('open-search'));
    expect(screen.getByTestId('search-overlay')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('close-search'));
    await fireEvent.press(screen.getByTestId('center-map-button'));
    expect(screen.queryByTestId('open-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('compress-map'));
    expect(screen.getByTestId('open-search')).toBeTruthy();
  });

  it('consumes a pending "See on map" request from Explore', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useMapUiStore.getState().requestFocus({ kind: 'park', parkId: PARK_CIVIC });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(useMapUiStore.getState().pendingFocus).toBeNull();
    expect(cameraCalls.some((call) => call.method === 'fitBounds')).toBe(true);
  });

  it('toggles heritage boundaries in the layer picker', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-layers'));
    expect(screen.getByTestId('layer-picker')).toBeTruthy();
    expect(screen.queryByTestId('layer-satellite')).toBeNull();
    await fireEvent(screen.getByTestId('layer-boundaries'), 'valueChange', false);
    expect(useMapUiStore.getState().layers.showHeritageBoundaries).toBe(false);
  });
});
