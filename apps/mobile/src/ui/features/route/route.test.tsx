import { destinationPoint } from '@singalore/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { GeoPoint } from '@singalore/shared';
import type { AppServices } from '@/composition/container';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { INITIAL_ROUTE_STATE } from '@/modules/routing/RouteNavigator';
import { bindRouteStore, useRouteStore } from '@/modules/routing/routeStore';
import type { PlannedRoute } from '@/modules/routing/routeTypes';
import { createFlowEffectHandler } from '@/composition/flowEffects';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_MARKET, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { useToastStore } from '@/ui/toastStore';
import { HomeScreen } from '../home/HomeScreen';
import { BackgroundRationaleScreen } from '../permission/PermissionScreen';
import { NavigationPanel, type NavigationPanelProps } from './NavigationPanel';
import { estimateFromStops } from './routeEstimates';
import { resetBackgroundRationaleOfferForTests, RouteExperience } from './RouteExperience';

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

// Builds a walking route over the given stops that runs along a known line.
function plannedRouteFor(stopIds: string[]): PlannedRoute
{
  return { stopIds, line: [{ lat: 1.29, lng: 103.85 }, { lat: 1.3, lng: 103.85 }], distanceM: 1100, providerDurationS: 800, steps: [], approximate: false, plannedAt: 0 };
}

// Waits for a route request and the writes that follow it to finish.
async function flushRouteWork(): Promise<void>
{
  await act(async () => undefined);
  await act(async () => undefined);
  await act(async () => undefined);
}

// Returns a fetch that never answers, so a route request stays in flight.
function pendingFetch(): Promise<Response>
{
  return new Promise<Response>(() => undefined);
}

// Returns the map position of a landmark in the test catalog.
function landmarkPosition(landmarkId: string): GeoPoint
{
  const landmark = useCatalogStore.getState().landmarksById.get(landmarkId);
  if (landmark === undefined)
  {
    throw new Error(`Unknown landmark ${landmarkId}`);
  }
  return landmark.position;
}

describe('confirm panel with a route planned for other stops (UC 1.5.2.5)', () =>
{
  // Opens the confirm panel with a ready route and the given itinerary.
  async function renderConfirm(routeStopIds: string[], itinerary: string[], userPosition: GeoPoint | null, fetchImplementation: typeof fetch = pendingFetch): Promise<{ services: AppServices; view: Awaited<ReturnType<typeof renderWithServices>> }>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(fetchImplementation);
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: () => undefined, persist: () => undefined });
    await services.routes.setRoute(plannedRouteFor(routeStopIds));
    useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, base: 'draft', screen: 'routeConfirm', itinerary } });
    const view = await renderWithServices(services, <RouteExperience userPosition={userPosition} />);
    return { services, view };
  }

  it('stale no fix: route A,B and itinerary A,C disables start, hides the stats and shows the wait text', async () =>
  {
    await renderConfirm([LANDMARK_CHIJMES, LANDMARK_RAFFLES], [LANDMARK_CHIJMES, LANDMARK_MARKET], null);
    expect(screen.getByTestId('confirm-start').props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByTestId('confirm-distance')).toBeNull();
    expect(screen.getByText('Waiting for GPS signal... The route starts from your location.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-start'));
    expect(useFlowStore.getState().state.screen).toBe('routeConfirm');
  });

  it('matching: route A,B and itinerary A,B enables start and shows the stats', async () =>
  {
    await renderConfirm([LANDMARK_CHIJMES, LANDMARK_RAFFLES], [LANDMARK_CHIJMES, LANDMARK_RAFFLES], null);
    expect(screen.getByTestId('confirm-start').props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByTestId('confirm-distance')).toBeTruthy();
  });

  it('reordered: route A,B and itinerary B,A disables start', async () =>
  {
    await renderConfirm([LANDMARK_CHIJMES, LANDMARK_RAFFLES], [LANDMARK_RAFFLES, LANDMARK_CHIJMES], null);
    expect(screen.getByTestId('confirm-start').props.accessibilityState?.disabled).toBe(true);
  });

  it('removed landmark: route A and itinerary A,X with X not in the catalog enables start', async () =>
  {
    await renderConfirm([LANDMARK_CHIJMES], [LANDMARK_CHIJMES, 'landmark-not-in-catalog'], null);
    expect(screen.getByTestId('confirm-start').props.accessibilityState?.disabled).toBe(false);
  });

  it('autostart stale: within 50 m with Autodetect on and a stale route does not start navigation', async () =>
  {
    const { view } = await renderConfirm([LANDMARK_RAFFLES], [LANDMARK_CHIJMES], null);
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await view.rerender(<RouteExperience userPosition={landmarkPosition(LANDMARK_CHIJMES)} />);
    await flushRouteWork();
    expect(useFlowStore.getState().state.screen).toBe('routeConfirm');
  });

  it('autostart matching: within 50 m with Autodetect on and a matching route starts navigation', async () =>
  {
    const { view } = await renderConfirm([LANDMARK_CHIJMES], [LANDMARK_CHIJMES], null);
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await view.rerender(<RouteExperience userPosition={landmarkPosition(LANDMARK_CHIJMES)} />);
    await flushRouteWork();
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('stale planning: a request in flight keeps the calculating text', async () =>
  {
    await renderConfirm([LANDMARK_RAFFLES], [LANDMARK_CHIJMES], landmarkPosition(LANDMARK_MARKET));
    await flushRouteWork();
    expect(screen.getByText('Calculating walking route...')).toBeTruthy();
    expect(screen.queryByTestId('confirm-distance')).toBeNull();
  });

  it('stale failed: a failed request keeps the error and hides the old stats', async () =>
  {
    await renderConfirm([LANDMARK_RAFFLES], [LANDMARK_CHIJMES], landmarkPosition(LANDMARK_MARKET), async () => new Response(null, { status: 502 }));
    await flushRouteWork();
    expect(screen.getByTestId('route-error').props.children).toBe('Unable to calculate route. Please try again later.');
    expect(screen.queryByTestId('confirm-distance')).toBeNull();
    expect(screen.getByTestId('confirm-start').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('Recalculate during navigation (UC 1.5.4.3, UC 1.5.2.4)', () =>
{
  const OFF_ROUTE_POSITION: GeoPoint = { lat: 1.4, lng: 103.9 };
  const USER_POSITION: GeoPoint = { lat: 1.295, lng: 103.85 };
  const ROUTE_ERROR = 'Unable to calculate route. Please try again later.';
  const failingFetch: typeof fetch = async () => new Response(null, { status: 500 });
  const succeedingFetch: typeof fetch = async () => new Response(JSON.stringify(routeBody));

  beforeEach(() => useToastStore.setState({ toasts: [] }));

  // Feeds two far away fixes 5 seconds apart so the route raises the off route flag.
  async function raiseOffRoute(services: AppServices): Promise<void>
  {
    await act(async () =>
    {
      services.routes.handleFix(OFF_ROUTE_POSITION, 1000);
      services.routes.handleFix(OFF_ROUTE_POSITION, 6000);
    });
  }

  // Opens navigation on a tour of two stops with the off route modal showing.
  async function renderOffRoute(fetchImplementation: typeof fetch, userPosition: GeoPoint | null, visitedLandmarkIds: string[]): Promise<{ services: AppServices; view: Awaited<ReturnType<typeof renderWithServices>> }>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(fetchImplementation);
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
    const itinerary = [LANDMARK_CHIJMES, LANDMARK_RAFFLES];
    await services.routes.setRoute(plannedRouteFor(itinerary));
    services.routes.setNavigating(true);
    useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, base: 'inProgress', screen: 'navigation', itinerary, tourStartedAt: 1, visitedLandmarkIds } });
    const view = await renderWithServices(services, <RouteExperience userPosition={userPosition} />);
    await raiseOffRoute(services);
    expect(screen.getByTestId('off-route-modal')).toBeTruthy();
    return { services, view };
  }

  it('fail: API 500 shows the exact error, retry and guide, closes the modal and keeps the old route', async () =>
  {
    const { services } = await renderOffRoute(failingFetch, USER_POSITION, []);
    const oldRoute = services.routes.getState().route;
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(screen.getByTestId('route-error').props.children).toBe(ROUTE_ERROR);
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByText('Use approximate straight line guide')).toBeTruthy();
    expect(screen.queryByTestId('off-route-modal')).toBeNull();
    expect(services.routes.getState().route).toBe(oldRoute);
    expect(services.routes.getState().navigating).toBe(true);
  });

  it('fail then off route again: the modal stays hidden so the error options stay reachable', async () =>
  {
    const { services } = await renderOffRoute(failingFetch, USER_POSITION, []);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    await raiseOffRoute(services);
    expect(services.routes.getState().offRoute).toBe(true);
    expect(screen.queryByTestId('off-route-modal')).toBeNull();
    expect(screen.getByTestId('route-error')).toBeTruthy();
  });

  it('success: API 200 replaces the route with one through the remaining stops and shows no error', async () =>
  {
    const { services } = await renderOffRoute(succeedingFetch, USER_POSITION, [LANDMARK_CHIJMES]);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(services.routes.getState().route?.stopIds).toEqual([LANDMARK_RAFFLES]);
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(screen.queryByTestId('off-route-modal')).toBeNull();
    expect(services.routes.getState().navigating).toBe(true);
  });

  it('guide: pressing the guide after a failure shows the approximate text and clears the error', async () =>
  {
    await renderOffRoute(failingFetch, USER_POSITION, []);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    await fireEvent.press(screen.getByTestId('route-fallback'));
    await flushRouteWork();
    expect(screen.getByTestId('turn-instruction').props.children).toContain('Approximate guide');
    expect(screen.queryByTestId('route-error')).toBeNull();
  });

  it('try again: a retry that succeeds through the remaining stops clears the error', async () =>
  {
    const fetchMock = jest.fn(failingFetch);
    const { services } = await renderOffRoute(fetchMock, USER_POSITION, [LANDMARK_CHIJMES]);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    fetchMock.mockImplementation(succeedingFetch);
    await fireEvent.press(screen.getByTestId('route-retry'));
    await flushRouteWork();
    expect(screen.queryByTestId('route-error')).toBeNull();
    expect(services.routes.getState().route?.stopIds).toEqual([LANDMARK_RAFFLES]);
  });

  it('exception flow, no fix: Recalculate shows the GPS toast, keeps the modal and sends no request', async () =>
  {
    const fetchMock = jest.fn(succeedingFetch);
    await renderOffRoute(fetchMock, null, []);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Waiting for GPS signal...']);
    expect(screen.getByTestId('off-route-modal')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('boundary, one remaining stop: Recalculate sends one request', async () =>
  {
    const fetchMock = jest.fn(succeedingFetch);
    await renderOffRoute(fetchMock, USER_POSITION, [LANDMARK_CHIJMES]);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('boundary, zero remaining stops: Recalculate sends no request and closes the modal', async () =>
  {
    const fetchMock = jest.fn(succeedingFetch);
    await renderOffRoute(fetchMock, USER_POSITION, [LANDMARK_CHIJMES, LANDMARK_RAFFLES]);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('off-route-modal')).toBeNull();
  });

  it('planning: while a request runs the old route stays, the text shows and a new off route flag stays hidden', async () =>
  {
    const { services } = await renderOffRoute(pendingFetch, USER_POSITION, []);
    const oldRoute = services.routes.getState().route;
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await flushRouteWork();
    expect(screen.getByText('Calculating walking route...')).toBeTruthy();
    await raiseOffRoute(services);
    expect(services.routes.getState().offRoute).toBe(true);
    expect(screen.queryByTestId('off-route-modal')).toBeNull();
    expect(services.routes.getState().route).toBe(oldRoute);
  });

  it('exit during a request: a late answer leaves navigating false', async () =>
  {
    let answerRequest: (response: Response) => void = () => undefined;
    const { services } = await renderOffRoute(() => new Promise<Response>((resolve) =>
    {
      answerRequest = resolve;
    }), USER_POSITION, []);
    await fireEvent.press(screen.getByTestId('off-route-recalculate'));
    await fireEvent.press(screen.getByTestId('nav-exit'));
    await fireEvent.press(screen.getByTestId('exit-discard'));
    await flushRouteWork();
    answerRequest(new Response(JSON.stringify(routeBody)));
    await flushRouteWork();
    expect(services.routes.getState().navigating).toBe(false);
    expect(services.routes.getState().route).toBeNull();
  });
});

describe('route line wording (UC 1.5.4 step 2)', () =>
{
  const panelProps: NavigationPanelProps = { progress: null, approximate: false, unit: 'metric', remainingSeconds: null, nextStopName: null, nextStopDistanceM: null, visitedCount: 0, stopCount: 2, status: 'ready', failureMessage: null, hasFallback: false, onRetry: jest.fn(), onUseFallback: jest.fn(), onPause: jest.fn(), onExit: jest.fn(), onEditRoute: jest.fn() };

  beforeEach(() => useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, screen: 'navigation', base: 'inProgress' } }));
  afterEach(() => useRouteStore.setState(INITIAL_ROUTE_STATE));

  it('off route modal says highlighted path and keeps the three exact SRS strings (UC 1.5.4.3)', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useRouteStore.setState({ offRoute: true, status: 'ready' });
    await renderWithServices(await createTestServices(), <HomeScreen userLocation={null} />);
    expect(screen.getByText('Return to the highlighted path, or recalculate a new route from here through your remaining stops.')).toBeTruthy();
    expect(screen.getByText('You are off the route')).toBeTruthy();
    expect(screen.getByText('Return to path')).toBeTruthy();
    expect(screen.getByText('Recalculate')).toBeTruthy();
  });

  it('panel with no step and no next stop says follow the highlighted line', async () =>
  {
    await renderWithServices(await createTestServices(), <NavigationPanel {...panelProps} />);
    expect(screen.getByTestId('turn-instruction').props.children).toBe('Follow the highlighted line');
  });

  it('panel with no step and a next stop still names the stop', async () =>
  {
    await renderWithServices(await createTestServices(), <NavigationPanel {...panelProps} nextStopName="CHIJMES" />);
    expect(screen.getByTestId('turn-instruction').props.children).toBe('Continue to CHIJMES');
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

describe('notification permission at tour start (UC 1.3.2.3)', () =>
{
  const screensAtRequest: string[] = [];

  beforeEach(() =>
  {
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
    mockPush.mockClear();
    screensAtRequest.length = 0;
    resetBackgroundRationaleOfferForTests();
  });

  // Renders Home on the confirmation panel with the given notification status.
  async function renderConfirmation(status: 'undetermined' | 'granted' | 'denied', metersFromFirstStop = 500)
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices(async () => new Response(JSON.stringify(routeBody)));
    bindRouteStore(services.routes);
    configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
    await services.location.setPermission('foreground');
    jest.spyOn(services.notifier, 'permission').mockResolvedValue(status);
    const request = jest.spyOn(services.notifier, 'requestPermission').mockImplementation(async () =>
    {
      screensAtRequest.push(useFlowStore.getState().state.screen);
      return 'denied';
    });
    const point = destinationPoint(RAFFLES_POSITION, 0, metersFromFirstStop);
    await renderWithServices(services, <HomeScreen userLocation={{ latitude: point.lat, longitude: point.lng, accuracyMeters: 5 }} />);
    await act(async () => dispatchFlow({ type: 'startTourFromSite', landmarkId: LANDMARK_RAFFLES }));
    await act(async () => undefined);
    await act(async () => undefined);
    return request;
  }

  it('Start Navigation, undetermined, user refuses: requests once before the tour, tour still starts', async () =>
  {
    const request = await renderConfirmation('undetermined');
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(request).toHaveBeenCalledTimes(1);
    expect(screensAtRequest).toEqual(['routeConfirm']);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('autodetect, undetermined, user refuses: requests once before the tour, tour still starts', async () =>
  {
    const request = await renderConfirmation('undetermined', 49);
    await fireEvent(screen.getByTestId('confirm-autodetect'), 'valueChange', true);
    await act(async () => undefined);
    expect(request).toHaveBeenCalledTimes(1);
    expect(screensAtRequest).toEqual(['routeConfirm']);
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('granted: does not request, tour starts', async () =>
  {
    const request = await renderConfirmation('granted');
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(request).not.toHaveBeenCalled();
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('valid EC, no action: denied does not request, tour still starts', async () =>
  {
    const request = await renderConfirmation('denied');
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(request).not.toHaveBeenCalled();
    expect(useFlowStore.getState().state.screen).toBe('navigation');
  });

  it('Back pressed while the request is open: the tour does not start and the rationale stays closed', async () =>
  {
    const request = await renderConfirmation('undetermined');
    request.mockImplementation(async () =>
    {
      dispatchFlow({ type: 'backFromConfirmation' });
      return 'denied';
    });
    await fireEvent.press(screen.getByTestId('confirm-start'));
    await act(async () => undefined);
    expect(useFlowStore.getState().state.screen).toBe('routeEditor');
    expect(useFlowStore.getState().state.base).not.toBe('inProgress');
    expect(mockPush).not.toHaveBeenCalledWith('/background-rationale');
  });
});
