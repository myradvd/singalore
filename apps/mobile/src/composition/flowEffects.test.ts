import type { AppServices } from '@/composition/container';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { createTestServices } from '@test/support/renderWithProviders';
import { createFlowEffectHandler } from './flowEffects';

const STOP_A = 'stop-a';
const STOP_B = 'stop-b';
const STOP_C = 'stop-c';
const NOT_A_STOP = 'not-a-stop';
const COMPLETED_MESSAGE = 'You have visited every stop on this tour.';

// Builds services whose geofence engine reports the walker inside the given landmarks.
async function createServicesInside(insideLandmarkIds: string[]): Promise<{ services: AppServices; notify: jest.SpyInstance }>
{
  const services = await createTestServices();
  jest.spyOn(services.geofence, 'getState').mockReturnValue({ ...services.geofence.getState(), insideLandmarkIds });
  const notify = jest.spyOn(services.notifier, 'notify');
  configureFlowRuntime({ onEffect: createFlowEffectHandler(services), persist: () => undefined });
  return { services, notify };
}

// Starts a tour on the given route from the Route Confirmation screen.
function startTourOn(itinerary: string[]): void
{
  useFlowStore.setState({ state: { ...INITIAL_FLOW_STATE, base: 'draft', screen: 'routeConfirm', itinerary } });
  dispatchFlow({ type: 'startNavigation', at: 1000 });
}

describe('marking stops visited when a tour starts inside them (UC 1.5.4 step 6, D34)', () =>
{
  afterEach(() => useFlowStore.setState({ state: INITIAL_FLOW_STATE }));

  it('inside a stop: inside A on route A, B, C gives visited [A] and no completion', async () =>
  {
    const { notify } = await createServicesInside([STOP_A]);
    startTourOn([STOP_A, STOP_B, STOP_C]);
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([STOP_A]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('inside two stops: inside A and B on route A, B, C gives visited [A, B] and no completion', async () =>
  {
    const { notify } = await createServicesInside([STOP_A, STOP_B]);
    startTourOn([STOP_A, STOP_B, STOP_C]);
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([STOP_A, STOP_B]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('valid EC, no action: inside a landmark that is not a stop gives visited []', async () =>
  {
    await createServicesInside([NOT_A_STOP]);
    startTourOn([STOP_A, STOP_B, STOP_C]);
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([]);
  });

  it('outside: inside nothing gives visited []', async () =>
  {
    await createServicesInside([]);
    startTourOn([STOP_A, STOP_B, STOP_C]);
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([]);
  });

  it('one stop tour started inside it: visited [A], the tour completes at once and stays in progress', async () =>
  {
    const { notify } = await createServicesInside([STOP_A]);
    startTourOn([STOP_A]);
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([STOP_A]);
    expect(useFlowStore.getState().state.base).toBe('inProgress');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('route_updates', 'Tour complete', COMPLETED_MESSAGE);
  });

  it('restart outside: restored tour with visited [A] and inside nothing keeps visited [A]', async () =>
  {
    await createServicesInside([]);
    dispatchFlow({ type: 'restoreFromCache', cache: { mode: 'route_in_progress', itinerary: [STOP_A, STOP_B], visitedLandmarkIds: [STOP_A], tourStartedAt: 5 } });
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([STOP_A]);
  });

  it('restart inside a stop already visited: a finished tour does not complete a second time', async () =>
  {
    const { notify } = await createServicesInside([STOP_A]);
    dispatchFlow({ type: 'restoreFromCache', cache: { mode: 'route_in_progress', itinerary: [STOP_A], visitedLandmarkIds: [STOP_A], tourStartedAt: 5 } });
    expect(useFlowStore.getState().state.visitedLandmarkIds).toEqual([STOP_A]);
    expect(notify).not.toHaveBeenCalled();
  });
});
