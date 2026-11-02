import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot, refreshCatalog, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { useLocationStore } from '@/modules/location/locationStore';
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
  useLocationStore.setState({ status: 'idle' });
  cameraCalls.length = 0;
  mockPush.mockClear();
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
