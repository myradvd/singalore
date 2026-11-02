import { act, fireEvent, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { GeoPoint } from '@singalore/shared';
import type { AppServices } from '@/composition/container';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { bindRouteStore } from '@/modules/routing/routeStore';
import type { PlannedRoute } from '@/modules/routing/routeTypes';
import { createFlowEffectHandler } from '@/composition/flowEffects';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_MARKET, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { HomeScreen } from '../home/HomeScreen';
import { RouteExperience } from './RouteExperience';
import { estimateFromStops } from './routeEstimates';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

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
