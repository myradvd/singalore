import { destinationPoint } from '@singalore/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { bindRouteStore } from '@/modules/routing/routeStore';
import { createFlowEffectHandler } from '@/composition/flowEffects';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { HomeScreen } from '../home/HomeScreen';
import { BackgroundRationaleScreen } from '../permission/PermissionScreen';
import { resetBackgroundRationaleOfferForTests } from './RouteExperience';
import { estimateFromStops } from './routeEstimates';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

jest.mock('@/composition/useAppBootstrap', () => ({ refreshLocationPermission: jest.fn() }));

const RAFFLES_POSITION = { lat: 1.29486, lng: 103.85441 };
const fixture = JSON.parse(readFileSync(path.join(__dirname, '../../../../test/fixtures/osrm-route.json'), 'utf8')) as { routes: { distance: number; duration: number; geometry: string }[] };
const recorded = fixture.routes[0];
const routeBody = { distanceM: recorded?.distance ?? 0, durationS: recorded?.duration ?? 0, geometryPolyline6: recorded?.geometry ?? '', provider: 'x', legs: [] };

describe('estimateFromStops', () =>
{
  it('includes podcast time in the total', () =>
  {
    const estimate = estimateFromStops(null, [{ lat: 1.29, lng: 103.85 }, { lat: 1.3, lng: 103.85 }], [60, 120], 'normal');
    expect(estimate.stops).toBe(2);
    expect(estimate.totalSeconds).toBe(estimate.walkSeconds + 180);
    expect(estimate.approximate).toBe(true);
  });
});

describe('route flow on the home screen (UC 1.5.1 to 1.5.5, A6)', () =>
{
  beforeEach(() => useFlowStore.setState({ state: INITIAL_FLOW_STATE }));

  it('builds a route, confirms it, navigates and exits with Save & Exit', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(async () => new Response(JSON.stringify(routeBody)));
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
    await renderWithServices(services, <HomeScreen userLocation={{ latitude: 1.2951, longitude: 103.8519, accuracyMeters: 5 }} />);

    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    await fireEvent.press(screen.getByTestId('summary-add-route'));
    await act(async () => dispatchFlow({ type: 'addToItinerary', landmarkId: LANDMARK_RAFFLES }));
    expect(screen.getByTestId('route-strip')).toBeTruthy();
    expect(screen.getByText('Untitled Route')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('route-strip'));
    expect(screen.getByTestId('route-editor')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('editor-down-chijmes'));
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_RAFFLES, LANDMARK_CHIJMES]);
    await fireEvent.press(screen.getByTestId('editor-restore'));
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_CHIJMES, LANDMARK_RAFFLES]);

    await fireEvent.press(screen.getByTestId('editor-continue'));
    await act(async () => undefined);
    await act(async () => undefined);
    expect(screen.getByTestId('route-confirm')).toBeTruthy();
    expect(services.routes.getState().status).toBe('ready');
    expect(screen.getByTestId('confirm-distance')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-start'));
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(screen.getByTestId('turn-card')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('nav-exit'));
    expect(screen.getByText('Save before leaving?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('exit-save'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.base).toBe('empty');
    expect((await services.saved.savedItineraries())[0]?.landmarkIds).toEqual([LANDMARK_CHIJMES, LANDMARK_RAFFLES]);
    expect((await services.history.list())[0]?.status).toBe('abandoned');
  });

  it('shows the routing error with a straight line option when the provider fails (UC 1.5.2.1)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(async () => new Response(JSON.stringify({ error: { code: 'upstream_error', message: 'x' } }), { status: 502 }));
    bindRouteStore(services.routes);
    await renderWithServices(services, <HomeScreen userLocation={{ latitude: 1.2951, longitude: 103.8519, accuracyMeters: 5 }} />);
    await act(async () => dispatchFlow({ type: 'startTourFromSite', landmarkId: LANDMARK_RAFFLES }));
    await act(async () => undefined);
    await act(async () => undefined);
    expect(screen.getByTestId('route-error').props.children).toBe('Unable to calculate route. Please try again later.');
    await fireEvent.press(screen.getByTestId('route-fallback'));
    expect(services.routes.getState().route?.approximate).toBe(true);
  });
});

describe('tour start paths (UC 1.5.3, UC 1.5.4)', () =>
{
  beforeEach(() =>
  {
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
    mockPush.mockClear();
    mockBack.mockClear();
  });

  // Renders Home with a planned route on the confirmation panel for one stop.
  async function renderConfirmation(userLocation: { latitude: number; longitude: number; accuracyMeters: number })
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(async () => new Response(JSON.stringify(routeBody)));
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
    await services.location.setPermission('foreground');
    await renderWithServices(services, <HomeScreen userLocation={userLocation} />);
    await act(async () => dispatchFlow({ type: 'startTourFromSite', landmarkId: LANDMARK_RAFFLES }));
    await act(async () => undefined);
    await act(async () => undefined);
    expect(services.routes.getState().status).toBe('ready');
    return services;
  }

  // Builds a fix the given distance north of the first stop.
  function fixMetersFromFirstStop(meters: number)
  {
    const point = destinationPoint(RAFFLES_POSITION, 0, meters);
    return { latitude: point.lat, longitude: point.lng, accuracyMeters: 5 };
  }

  it('Start Navigation pressed: tour starts and navigation opens', async () =>
  {
    await renderConfirmation(fixMetersFromFirstStop(500));
    expect(useFlowStore.getState().state.screen).toBe('routeConfirm');
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(useFlowStore.getState().state.base).toBe('inProgress');
  });

  it('autodetect on, 49 m from the first stop: tour starts by itself', async () =>
  {
    await renderConfirmation(fixMetersFromFirstStop(49));
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('autodetect on, 51 m from the first stop: tour does not start', async () =>
  {
    await renderConfirmation(fixMetersFromFirstStop(51));
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('routeConfirm');
  });

  it('autodetect off, 49 m from the first stop: tour does not start', async () =>
  {
    await renderConfirmation(fixMetersFromFirstStop(49));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('routeConfirm');
  });
});

describe('background rationale at tour start (UC 1.3.2.3)', () =>
{
  beforeEach(() =>
  {
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
    mockPush.mockClear();
    mockBack.mockClear();
    resetBackgroundRationaleOfferForTests();
  });

  // Renders Home on the confirmation panel for one stop with the given permission.
  async function renderConfirmation(permission: 'foreground' | 'always', metersFromFirstStop: number)
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(async () => new Response(JSON.stringify(routeBody)));
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
    await services.location.setPermission(permission);
    const point = destinationPoint(RAFFLES_POSITION, 0, metersFromFirstStop);
    await renderWithServices(services, <HomeScreen userLocation={{ latitude: point.lat, longitude: point.lng, accuracyMeters: 5 }} />);
    await openConfirmation();
    return services;
  }

  // Opens the confirmation panel for one stop and waits for the planned route.
  async function openConfirmation()
  {
    await act(async () => dispatchFlow({ type: 'startTourFromSite', landmarkId: LANDMARK_RAFFLES }));
    await act(async () => undefined);
    await act(async () => undefined);
  }

  // Counts how many times the rationale screen was opened.
  function rationalePushCount()
  {
    return mockPush.mock.calls.filter(([target]) => target === '/background-rationale').length;
  }

  it('Start Navigation, foreground permission: tour starts and the rationale opens once', async () =>
  {
    await renderConfirmation('foreground', 500);
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(rationalePushCount()).toBe(1);
  });

  it('autodetect, foreground permission: tour starts and the rationale opens once', async () =>
  {
    await renderConfirmation('foreground', 49);
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(rationalePushCount()).toBe(1);
  });

  it('second tour in the same run: the rationale does not open again', async () =>
  {
    await renderConfirmation('foreground', 500);
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    await fireEvent.press(screen.getByTestId('nav-exit'));
    await fireEvent.press(screen.getByTestId('exit-discard'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.base).toBe('empty');
    await openConfirmation();
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(rationalePushCount()).toBe(1);
  });

  it('valid EC, no action: always permission starts the tour without the rationale', async () =>
  {
    await renderConfirmation('always', 500);
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
    expect(rationalePushCount()).toBe(0);
  });
});

describe('background rationale screen returns to the running tour (UC 1.3.2.3)', () =>
{
  const TOUR_STATE = { ...INITIAL_FLOW_STATE, base: 'inProgress' as const, screen: 'navigation' as const, itinerary: [LANDMARK_RAFFLES, LANDMARK_CHIJMES], visitedLandmarkIds: [LANDMARK_RAFFLES], tourStartedAt: 1000 };

  beforeEach(() =>
  {
    useFlowStore.setState({ state: TOUR_STATE });
    mockBack.mockClear();
  });

  // Renders the rationale screen over a running tour, with spies on the played set reset.
  async function renderRationale()
  {
    const services = await createTestServices();
    await services.location.setPermission('foreground');
    await renderWithServices(services, <BackgroundRationaleScreen />);
    return { services, resetTour: jest.spyOn(services.geofence, 'resetTour') };
  }

  // Checks the user went back once and the tour and played set are as they were.
  function expectTourKept(resetTour: jest.SpyInstance)
  {
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(useFlowStore.getState().state).toEqual(TOUR_STATE);
    expect(resetTour).not.toHaveBeenCalled();
  }

  it('Allow, permission granted: permission becomes always, goes back, settings stay closed', async () =>
  {
    const { services, resetTour } = await renderRationale();
    const openSettings = jest.spyOn(services.permissions, 'openAppSettings');
    await fireEvent.press(screen.getByTestId('background-allow'));
    await act(async () => undefined);
    expect(services.location.getState().permission).toBe('always');
    expect(openSettings).not.toHaveBeenCalled();
    expectTourKept(resetTour);
  });

  it('Allow, permission not granted: opens settings, permission stays foreground, goes back', async () =>
  {
    const { services, resetTour } = await renderRationale();
    jest.spyOn(services.permissions, 'requestBackground').mockResolvedValue({ servicesEnabled: true, foreground: 'granted', background: 'denied', foregroundCanAskAgain: true });
    const openSettings = jest.spyOn(services.permissions, 'openAppSettings');
    await fireEvent.press(screen.getByTestId('background-allow'));
    await act(async () => undefined);
    expect(services.location.getState().permission).toBe('foreground');
    expect(openSettings).toHaveBeenCalledTimes(1);
    expectTourKept(resetTour);
  });

  it('Only while using the app: requests nothing and goes back', async () =>
  {
    const { services, resetTour } = await renderRationale();
    const requestBackground = jest.spyOn(services.permissions, 'requestBackground');
    await fireEvent.press(screen.getByTestId('background-later'));
    await act(async () => undefined);
    expect(requestBackground).not.toHaveBeenCalled();
    expectTourKept(resetTour);
  });
});
