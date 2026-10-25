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
