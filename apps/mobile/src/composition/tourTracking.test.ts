import { startTourBackgroundUpdates, stopApproachWatch } from '@/modules/location/backgroundTracking';
import { createTestServices } from '@test/support/renderWithProviders';
import { startTourTracking } from './tourTracking';

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
