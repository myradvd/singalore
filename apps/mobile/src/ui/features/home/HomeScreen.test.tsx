import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, LANDMARK_SHELTER, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { cameraCalls, latestMapPropsRef } from '@test/mocks/maplibre';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
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
  cameraCalls.length = 0;
  mockPush.mockClear();
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
