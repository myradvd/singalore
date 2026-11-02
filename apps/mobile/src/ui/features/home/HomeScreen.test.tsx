import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { AppServices } from '@/composition/container';
import { IDLE_STATUS } from '@/modules/audio/AudioEngine';
import { bindAudioStore, useAudioStore } from '@/modules/audio/audioStore';
import { PLAYBACK_ERROR_MESSAGES } from '@/modules/audio/playbackErrors';
import { applyCatalogSnapshot, refreshCatalog, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import type { FlowEvent, FlowState } from '@/modules/flow/flowTypes';
import { useLocationStore } from '@/modules/location/locationStore';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, LANDMARK_SHELTER, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { cameraCalls, latestMapPropsRef } from '@test/mocks/maplibre';
import { COPY } from '../../copy';
import { useMapUiStore, type MapFocusRequest } from '../../mapCommandStore';
import { useToastStore } from '../../toastStore';
import { SEARCH_DEBOUNCE_MS } from '../search/SearchOverlay';
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
  useLocationStore.setState({ status: 'idle' });
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

describe('HomeScreen browse search row (UC 1.5.1.1)', () =>
{
  afterEach(() => jest.useRealTimers());

  it('browse: tapping a result row closes search and shows that site', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'Chijmes');
    await act(() =>
    {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(screen.queryByTestId('search-overlay')).toBeNull();
    expect(screen.getByTestId('summary-card')).toBeTruthy();
  });
});

describe('HomeScreen recent searches (NFR 3.2)', () =>
{
  beforeEach(() =>
  {
    applyCatalogSnapshot(catalogFixture());
    usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES });
  });
  afterEach(() =>
  {
    jest.useRealTimers();
    usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES });
  });

  // Types a query into the open search box and waits out the debounce.
  async function typeSearch(text: string): Promise<void>
  {
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('search-input'), text);
    await act(() =>
    {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    jest.useRealTimers();
  }

  // Reads what is saved in the device database for recent sites.
  async function storedRecentSites(services: Awaited<ReturnType<typeof createTestServices>>): Promise<string[]>
  {
    return (await services.preferences.load()).recentSiteIds;
  }

  it('browse: selecting a site saves it, typing alone does not, and it shows next time', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    await typeSearch('Chijmes');
    expect(await storedRecentSites(services)).toEqual([]);
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(await storedRecentSites(services)).toEqual([LANDMARK_CHIJMES]);
    await fireEvent.press(screen.getByTestId('open-search'));
    expect(screen.getByTestId('search-recent-landmark-chijmes')).toBeTruthy();
  });

  it('browse: selecting a park saves nothing', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    await typeSearch('Tiong Bahru');
    await fireEvent.press(screen.getByTestId('search-park-tiong-bahru'));
    expect(await storedRecentSites(services)).toEqual([]);
  });

  it('add to route: picks save only when added on closing, and an undone pick is not saved', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'openSearch', purpose: 'addToRoute' }));
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-chijmes'));
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-raffles-hotel'));
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-tiong-bahru-market'));
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-tiong-bahru-market'));
    expect(await storedRecentSites(services)).toEqual([]);
    await fireEvent.press(screen.getByTestId('search-add-picked'));
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_CHIJMES, LANDMARK_RAFFLES]);
    expect(await storedRecentSites(services)).toEqual([LANDMARK_RAFFLES, LANDMARK_CHIJMES]);
  });

  it('add to route: closing with no picks saves nothing', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'openSearch', purpose: 'addToRoute' }));
    await fireEvent.press(screen.getByTestId('close-search'));
    expect(await storedRecentSites(services)).toEqual([]);
  });

  it('Clear: removes them all from the screen and the device', async () =>
  {
    const services = await createTestServices();
    await services.preferences.save({ recentSiteIds: [LANDMARK_CHIJMES, LANDMARK_RAFFLES] });
    usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, recentSiteIds: [LANDMARK_CHIJMES, LANDMARK_RAFFLES] } });
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    await fireEvent.press(screen.getByTestId('search-recent-clear'));
    expect(screen.queryByText('RECENT SEARCHES')).toBeNull();
    expect(await storedRecentSites(services)).toEqual([]);
  });

  it('with a fix: Suggested starts with the site nearest the user', async () =>
  {
    const shelter = catalogFixture().landmarks.find((landmark) => landmark.id === LANDMARK_SHELTER);
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={{ latitude: shelter?.position.lat ?? 0, longitude: shelter?.position.lng ?? 0, accuracyMeters: 8 }} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    expect(screen.getAllByTestId(/^search-suggested-landmark-/)[0]?.props.testID).toBe('search-suggested-landmark-tiong-bahru-air-raid-shelter');
  });

  it('NFR 3.2: selecting a site sends nothing about it off the device', async () =>
  {
    const fetchSpy = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => new Response(null, { status: 503 }));
    const services = await createTestServices(fetchSpy);
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await fireEvent.press(screen.getByTestId('open-search'));
    await typeSearch('Chijmes');
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(await storedRecentSites(services)).toEqual([LANDMARK_CHIJMES]);
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain(LANDMARK_CHIJMES);
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

  it('failed catalog refresh with no cache: status unavailable and the empty state title', async () =>
  {
    useCatalogStore.setState({ status: 'loading', snapshot: EMPTY_CATALOG });
    const services = await createTestServices();
    await refreshCatalog(services.catalogSync);
    expect(useCatalogStore.getState().status).toBe('unavailable');
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    expect(screen.getByText('No heritage map yet')).toBeTruthy();
  });

  describe('first load notice (UC 1.2.1, design 6.4)', () =>
  {
    const NOTICE_TEXT = 'Loading heritage sites...';

    it('loading with 0 landmarks: shows the exact notice without blocking the map', async () =>
    {
      useCatalogStore.setState({ status: 'loading', snapshot: EMPTY_CATALOG });
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(COPY.catalogLoading).toBe(NOTICE_TEXT);
      expect(screen.getByText(NOTICE_TEXT)).toBeTruthy();
      expect(screen.getByTestId('catalog-loading-notice').props.pointerEvents).toBe('none');
      expect(screen.getByTestId('maplibre-map')).toBeTruthy();
      expect(screen.queryByTestId('empty-catalog')).toBeNull();
    });

    it('loading with 1 landmark: no notice', async () =>
    {
      const fixture = catalogFixture();
      useCatalogStore.setState({ status: 'loading', snapshot: { ...fixture, landmarks: fixture.landmarks.slice(0, 1) } });
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
    });

    it('loading with cached landmarks: no notice', async () =>
    {
      useCatalogStore.setState({ status: 'loading', snapshot: catalogFixture() });
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
    });

    it('ready with landmarks: no notice', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
    });

    it('ready with 0 landmarks: no notice', async () =>
    {
      applyCatalogSnapshot(EMPTY_CATALOG);
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
    });

    it('unavailable with 0 landmarks: empty state only', async () =>
    {
      useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      expect(screen.getByTestId('empty-catalog')).toBeTruthy();
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
    });
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

  it('passes the downloaded photo and full description to the summary card, and queries nothing before a selection (UC 1.4.2)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    await services.packDetails.storeDetails({ schemaVersion: 1, parkId: PARK_CIVIC, etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [{ landmarkId: LANDMARK_CHIJMES, description: 'The full downloaded history.', imageUrl: null }], podcasts: [], files: [] });
    await services.packDetails.setLandmarkImageLocalPath(LANDMARK_CHIJMES, 'file:///packs/civic/chijmes.jpg');
    const landmarkDetail = jest.spyOn(services.packDetails, 'landmarkDetail');
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    expect(landmarkDetail).not.toHaveBeenCalled();
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    expect(screen.getByTestId('summary-description').props.children).toBe('The full downloaded history.');
    expect(screen.getByTestId('summary-thumbnail').props.source[0].uri).toBe('file:///packs/civic/chijmes.jpg');
  });

  it('collapses an expanded summary card when another landmark is selected', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    const longDescription = 'A long history. '.repeat(30);
    await services.packDetails.storeDetails({ schemaVersion: 1, parkId: PARK_CIVIC, etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [{ landmarkId: LANDMARK_CHIJMES, description: longDescription, imageUrl: null }, { landmarkId: LANDMARK_SHELTER, description: longDescription, imageUrl: null }], podcasts: [], files: [] });
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    expect(screen.getByTestId('summary-description-scroll')).toBeTruthy();
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_SHELTER }));
    expect(screen.queryByTestId('summary-description-scroll')).toBeNull();
    expect(screen.getByText('Read more')).toBeTruthy();
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

  it('recenter with no fix shows the exact toast and makes 0 camera calls (UC 1.1.2.1)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    cameraCalls.length = 0;
    await fireEvent.press(screen.getByTestId('recenter'));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Waiting for GPS signal...']);
    expect(cameraCalls).toHaveLength(0);
  });

  it('recenter with an old fix after signal loss shows the exact toast and makes 0 camera calls (UC 1.1.2.1)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useLocationStore.setState({ status: 'waiting_for_signal' });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={{ latitude: 1.29, longitude: 103.85, accuracyMeters: 8 }} />);
    cameraCalls.length = 0;
    await fireEvent.press(screen.getByTestId('recenter'));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Waiting for GPS signal...']);
    expect(cameraCalls).toHaveLength(0);
  });

  it('recenter with a fix and status ok moves the camera to zoom 16 with no toast (FR 1.2.1)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useLocationStore.setState({ status: 'ok' });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={{ latitude: 1.29, longitude: 103.85, accuracyMeters: 8 }} />);
    cameraCalls.length = 0;
    await fireEvent.press(screen.getByTestId('recenter'));
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(cameraCalls).toHaveLength(1);
    expect(cameraCalls[0]).toMatchObject({ method: 'easeTo', args: [expect.objectContaining({ zoom: 16 })] });
  });

  it('shows layers, recenter and podcast preferences in order, and one press opens the audio preferences once (D10)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    const clusterButtonIds = screen.getAllByRole('button')
      .map((button) => button.props.testID as string | undefined)
      .filter((testID) => testID === 'open-layers' || testID === 'recenter' || testID === 'podcast-preferences');
    expect(clusterButtonIds).toEqual(['open-layers', 'recenter', 'podcast-preferences']);
    await fireEvent.press(screen.getByTestId('podcast-preferences'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/preferences/audio');
  });

  it('shows podcast preferences on the navigation screen exactly when the layers button is present (D10)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, screen: 'navigation', base: 'inProgress' } });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.queryByTestId('open-layers') !== null).toBe(true);
    expect(screen.queryByTestId('podcast-preferences') !== null).toBe(screen.queryByTestId('open-layers') !== null);
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

  describe('hardware back press', () =>
  {
    const realDispatch = useFlowStore.getState().dispatch;
    const removeSubscription = jest.fn();
    let backListeners: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    let addListenerSpy: jest.SpiedFunction<typeof BackHandler.addEventListener>;
    let dispatchSpy: jest.Mock<void, [FlowEvent]>;

    beforeEach(() =>
    {
      backListeners = [];
      removeSubscription.mockClear();
      addListenerSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, listener) =>
      {
        backListeners.push(listener);
        return { remove: removeSubscription };
      });
      dispatchSpy = jest.fn(realDispatch);
      useFlowStore.setState({ dispatch: dispatchSpy });
    });

    afterEach(() =>
    {
      addListenerSpy.mockRestore();
      useFlowStore.setState({ dispatch: realDispatch });
    });

    // Renders Home, moves the flow to the given state, then clears the dispatch history.
    async function renderHomeWithFlow(flowChanges: Partial<FlowState>)
    {
      applyCatalogSnapshot(catalogFixture());
      const view = await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
      await act(async () => useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, ...flowChanges } }));
      dispatchSpy.mockClear();
      return view;
    }

    // Fires the listener Home registered and returns what the listener answered.
    async function pressHardwareBack()
    {
      expect(backListeners).toHaveLength(1);
      let handled: boolean | null | undefined;
      await act(async () =>
      {
        handled = backListeners[0]?.({ type: 'hardwareBackPress', timeStamp: 0 });
      });
      return handled;
    }

    it('search on top closes search and consumes the press', async () =>
    {
      await renderHomeWithFlow({ overlays: ['search'] });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeSearch' }]]);
    });

    it('sidebar on top closes the sidebar and consumes the press', async () =>
    {
      await renderHomeWithFlow({ overlays: ['sidebar'] });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeSidebar' }]]);
    });

    it('expanded map closes the expanded map and consumes the press', async () =>
    {
      await renderHomeWithFlow({ screen: 'expandedMap' });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeExpandedMap' }]]);
    });

    it('selected landmark clears the selection and consumes the press', async () =>
    {
      await renderHomeWithFlow({ selectedLandmarkId: LANDMARK_CHIJMES });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'selectLandmark', landmarkId: null }]]);
    });

    it('plain home dispatches nothing and leaves the press to the system', async () =>
    {
      await renderHomeWithFlow({});
      expect(await pressHardwareBack()).toBe(false);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('only the top overlay closes when two overlays are stacked', async () =>
    {
      await renderHomeWithFlow({ overlays: ['search', 'sidebar'] });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeSidebar' }]]);
    });

    it('an overlay wins over an expanded map and a selection', async () =>
    {
      await renderHomeWithFlow({ overlays: ['search'], screen: 'expandedMap', selectedLandmarkId: LANDMARK_CHIJMES });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeSearch' }]]);
    });

    it('an expanded map wins over a selection', async () =>
    {
      await renderHomeWithFlow({ screen: 'expandedMap', selectedLandmarkId: LANDMARK_CHIJMES });
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'closeExpandedMap' }]]);
    });

    it('stays active after Home pushes another screen (pins current behaviour)', async () =>
    {
      await renderHomeWithFlow({ selectedLandmarkId: LANDMARK_CHIJMES });
      await fireEvent.press(screen.getByTestId('bottom-explore'));
      expect(mockPush).toHaveBeenCalledWith('/explore');
      expect(removeSubscription).not.toHaveBeenCalled();
      expect(await pressHardwareBack()).toBe(true);
      expect(dispatchSpy.mock.calls).toEqual([[{ type: 'selectLandmark', landmarkId: null }]]);
    });

    it('removes its listener when Home unmounts', async () =>
    {
      const view = await renderHomeWithFlow({});
      expect(removeSubscription).not.toHaveBeenCalled();
      await view.unmount();
      expect(removeSubscription).toHaveBeenCalledTimes(1);
    });
  });

  it('consumes a pending "See on map" request from Explore', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useMapUiStore.getState().requestFocus({ kind: 'park', parkId: PARK_CIVIC });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(useMapUiStore.getState().pendingFocus).toBeNull();
    expect(cameraCalls.some((call) => call.method === 'fitBounds')).toBe(true);
  });

  describe('map focus', () =>
  {
    const realConsumeFocus = useMapUiStore.getState().consumeFocus;
    let consumeFocusSpy: jest.Mock<MapFocusRequest | null, []>;

    beforeEach(() =>
    {
      consumeFocusSpy = jest.fn(realConsumeFocus);
      useMapUiStore.setState({ pendingFocus: null, consumeFocus: consumeFocusSpy });
    });

    afterEach(() =>
    {
      useMapUiStore.setState({ pendingFocus: null, consumeFocus: realConsumeFocus });
    });

    // Renders Home with a landmark already selected so a cleared selection can be seen.
    async function renderHomeWithSelection()
    {
      useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, selectedLandmarkId: LANDMARK_SHELTER } });
      await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    }

    it('known landmark selects it and centres at zoom 16.5', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      useMapUiStore.getState().requestFocus({ kind: 'landmark', landmarkId: LANDMARK_CHIJMES });
      await renderHomeWithSelection();
      expect(useMapUiStore.getState().pendingFocus).toBeNull();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBe(LANDMARK_CHIJMES);
      expect(cameraCalls).toHaveLength(1);
      expect(cameraCalls[0]).toMatchObject({ method: 'easeTo', args: [{ center: [103.85193, 1.29516], zoom: 16.5 }] });
    });

    it('unknown landmark keeps the selection and makes no camera call', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      useMapUiStore.getState().requestFocus({ kind: 'landmark', landmarkId: 'no-such-landmark' });
      await renderHomeWithSelection();
      expect(useMapUiStore.getState().pendingFocus).toBeNull();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBe(LANDMARK_SHELTER);
      expect(cameraCalls).toEqual([]);
    });

    it('park with sites clears the selection and fits all of its sites', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      useMapUiStore.getState().requestFocus({ kind: 'park', parkId: PARK_CIVIC });
      await renderHomeWithSelection();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBeNull();
      expect(cameraCalls).toHaveLength(1);
      expect(cameraCalls[0]).toMatchObject({ method: 'fitBounds', args: [[103.85193, 1.29486, 103.85441, 1.29516], {}] });
    });

    it('park with no sites clears the selection and centres at zoom 15.5', async () =>
    {
      const fixture = catalogFixture();
      applyCatalogSnapshot({ ...fixture, landmarks: fixture.landmarks.filter((landmark) => landmark.parkId !== PARK_CIVIC) });
      useMapUiStore.getState().requestFocus({ kind: 'park', parkId: PARK_CIVIC });
      await renderHomeWithSelection();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBeNull();
      expect(cameraCalls).toHaveLength(1);
      expect(cameraCalls[0]).toMatchObject({ method: 'easeTo', args: [{ center: [103.851, 1.2925], zoom: 15.5 }] });
    });

    it('unknown park clears the selection and makes no camera call', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      useMapUiStore.getState().requestFocus({ kind: 'park', parkId: 'no-such-park' });
      await renderHomeWithSelection();
      expect(useMapUiStore.getState().pendingFocus).toBeNull();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBeNull();
      expect(cameraCalls).toEqual([]);
    });

    it('pending focus waits for a ready catalog and is consumed once', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      useCatalogStore.setState({ status: 'loading' });
      useMapUiStore.getState().requestFocus({ kind: 'landmark', landmarkId: LANDMARK_CHIJMES });
      await renderHomeWithSelection();
      expect(consumeFocusSpy).not.toHaveBeenCalled();
      expect(useMapUiStore.getState().pendingFocus).toEqual({ kind: 'landmark', landmarkId: LANDMARK_CHIJMES });
      expect(cameraCalls).toEqual([]);
      await act(async () => applyCatalogSnapshot(catalogFixture()));
      expect(consumeFocusSpy).toHaveBeenCalledTimes(1);
      expect(useMapUiStore.getState().pendingFocus).toBeNull();
      expect(cameraCalls).toHaveLength(1);
      await act(async () => applyCatalogSnapshot(catalogFixture('"v2"')));
      expect(consumeFocusSpy).toHaveBeenCalledTimes(1);
      expect(cameraCalls).toHaveLength(1);
    });

    it('no pending focus on a ready catalog does not call consumeFocus', async () =>
    {
      applyCatalogSnapshot(catalogFixture());
      await renderHomeWithSelection();
      expect(useMapUiStore.getState().pendingFocus).toBeNull();
      expect(consumeFocusSpy).not.toHaveBeenCalled();
      expect(useFlowStore.getState().state.selectedLandmarkId).toBe(LANDMARK_SHELTER);
      expect(cameraCalls).toEqual([]);
    });
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
