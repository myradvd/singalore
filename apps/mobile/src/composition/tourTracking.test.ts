import { startTourBackgroundUpdates, stopApproachWatch } from '@/modules/location/backgroundTracking';
import { createTestServices } from '@test/support/renderWithProviders';
import { bindLateBackgroundGrant, startTourTracking, stopTourTracking } from './tourTracking';

jest.mock('@/modules/location/backgroundTracking', () => ({
  startTourBackgroundUpdates: jest.fn(async () => undefined),
  stopTourBackgroundUpdates: jest.fn(async () => undefined),
  stopApproachWatch: jest.fn(async () => undefined),
}));

const startUpdatesMock = jest.mocked(startTourBackgroundUpdates);
const stopWatchMock = jest.mocked(stopApproachWatch);

describe('startTourTracking', () =>
{
  beforeEach(() =>
  {
    startUpdatesMock.mockClear();
    stopWatchMock.mockClear();
  });

  it('always permission: stops the approach watch and starts background updates once', async () =>
  {
    const services = await createTestServices();
    await services.location.setPermission('always');
    await startTourTracking(services);
    expect(services.location.getState().mode).toBe('tour');
    expect(stopWatchMock).toHaveBeenCalledTimes(1);
    expect(startUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('foreground permission: stays foreground only and starts no background updates', async () =>
  {
    const services = await createTestServices();
    await services.location.setPermission('foreground');
    const record = jest.spyOn(services.diagnostics, 'record');
    await startTourTracking(services);
    expect(services.location.getState().mode).toBe('tour');
    expect(record).toHaveBeenCalledWith('info', 'tour_foreground_only');
    expect(startUpdatesMock).not.toHaveBeenCalled();
  });

  it('background start fails: records a warning and does not throw', async () =>
  {
    const services = await createTestServices();
    await services.location.setPermission('always');
    const record = jest.spyOn(services.diagnostics, 'record');
    startUpdatesMock.mockRejectedValueOnce(new Error('no service'));
    await startTourTracking(services);
    expect(record).toHaveBeenCalledWith('warn', 'tour_background_start_failed', 'no service');
  });
});

describe('bindLateBackgroundGrant', () =>
{
  beforeEach(() =>
  {
    startUpdatesMock.mockClear();
    stopWatchMock.mockClear();
  });

  // Creates services on a tour that started with the given permission.
  async function servicesOnTour(permission: 'foreground' | 'always')
  {
    const services = await createTestServices();
    await services.location.setPermission(permission);
    await startTourTracking(services);
    startUpdatesMock.mockClear();
    stopWatchMock.mockClear();
    bindLateBackgroundGrant(services);
    return services;
  }

  it('foreground to always during a tour: starts background updates once and keeps the played set', async () =>
  {
    const services = await servicesOnTour('foreground');
    const resetTour = jest.spyOn(services.geofence, 'resetTour');
    await services.location.setPermission('always');
    await services.location.setPermission('always');
    await services.location.restart();
    expect(stopWatchMock).toHaveBeenCalledTimes(1);
    expect(startUpdatesMock).toHaveBeenCalledTimes(1);
    expect(resetTour).not.toHaveBeenCalled();
    expect(services.location.getState().mode).toBe('tour');
  });

  it('foreground to always with no tour: starts nothing', async () =>
  {
    const services = await createTestServices();
    await services.location.setPermission('foreground');
    bindLateBackgroundGrant(services);
    await services.location.setPermission('always');
    expect(startUpdatesMock).not.toHaveBeenCalled();
  });

  it('foreground to always after the tour stopped: starts nothing', async () =>
  {
    const services = await servicesOnTour('foreground');
    await stopTourTracking(services);
    await services.location.setPermission('always');
    expect(startUpdatesMock).not.toHaveBeenCalled();
  });

  it('valid EC, no action: foreground to denied during a tour starts nothing', async () =>
  {
    const services = await servicesOnTour('foreground');
    await services.location.setPermission('denied');
    expect(startUpdatesMock).not.toHaveBeenCalled();
  });

  it('valid EC, no action: already always, status change during a tour starts nothing', async () =>
  {
    const services = await servicesOnTour('always');
    await services.location.restart();
    expect(startUpdatesMock).not.toHaveBeenCalled();
  });

  it('denied, then always during a tour: starts background updates once', async () =>
  {
    const services = await servicesOnTour('foreground');
    await services.location.setPermission('denied');
    await services.location.setPermission('always');
    expect(startUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('background start fails after a late grant: records a warning and does not throw', async () =>
  {
    const services = await servicesOnTour('foreground');
    const record = jest.spyOn(services.diagnostics, 'record');
    startUpdatesMock.mockRejectedValueOnce(new Error('no service'));
    await services.location.setPermission('always');
    await new Promise(process.nextTick);
    expect(record).toHaveBeenCalledWith('warn', 'tour_background_start_failed', 'no service');
  });
});
