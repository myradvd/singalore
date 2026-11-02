import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import type { FlowEvent, FlowState } from '@/modules/flow/flowTypes';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_SHELTER, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { cameraCalls, latestMapPropsRef } from '@test/mocks/maplibre';
import { COPY } from '../../copy';
import { useMapUiStore, type MapFocusRequest } from '../../mapCommandStore';
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
