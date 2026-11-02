import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import type { DiagnosticsLevel } from '@/core/diagnostics';
import type { LocationFix } from '@/core/location';
import { LocationEngine, type LocationEngineState } from '@/modules/location/LocationEngine';
import type { LocationSource } from '@/modules/location/LocationSource';
import { resolvePermissionState } from '@/modules/location/permissions';
import { SERVICES_RECHECK_INTERVAL_MS, startServicesRecheck } from './servicesRecheck';

// Starts a recheck over a fixed app state and location state, and counts the refreshes.
function startWith(status: LocationEngineState['status'], sourceKind: LocationEngineState['sourceKind'] = 'device', appState = 'active')
{
  const refreshPermission = jest.fn(async () => undefined);
  const stop = startServicesRecheck({
    appState: () => appState,
    locationState: () => ({ status, sourceKind }),
    refreshPermission,
  });
  stops.push(stop);
  return { refreshPermission, stop };
}

// Builds a real location engine whose services switch and fixes the test controls.
function createLiveEngine()
{
  const logged: { level: DiagnosticsLevel; code: string }[] = [];
  const live = { servicesEnabled: true, reads: 0, emit: (_fix: LocationFix): void => undefined };
  const deviceSource: LocationSource = {
    kind: 'device',
    start: async (_mode, onFix) =>
    {
      live.emit = onFix;
      return { stop: () => undefined };
    },
  };
  const spoofSource: LocationSource = { kind: 'spoof', start: async () => ({ stop: () => undefined }) };
  const engine = new LocationEngine({
    deviceSource,
    spoofSource,
    clock: new ManualClock(0),
    events: createAppEventBus(),
    diagnostics: { record: async (level, code) =>
    {
      logged.push({ level, code });
    } },
    setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  const refreshPermission = async () =>
  {
    live.reads += 1;
    await engine.setPermission(resolvePermissionState({ servicesEnabled: live.servicesEnabled, foreground: 'granted', background: 'denied', foregroundCanAskAgain: true }));
  };
  stops.push(startServicesRecheck({ appState: () => 'active', locationState: () => engine.getState(), refreshPermission }));
  return { engine, live, logged };
}

const stops: (() => void)[] = [];

beforeEach(() =>
{
  jest.useFakeTimers();
});

afterEach(() =>
{
  stops.splice(0).forEach((stop) => stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('startServicesRecheck tick boundary (UC 1.1.1.2)', () =>
{
  it('below tick: 9999 ms while waiting gives 0 refreshes', () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal');
    jest.advanceTimersByTime(9999);
    expect(refreshPermission).toHaveBeenCalledTimes(0);
  });

  it('on tick: 10000 ms while waiting gives 1 refresh', () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal');
    jest.advanceTimersByTime(10000);
    expect(refreshPermission).toHaveBeenCalledTimes(1);
  });

  it('above tick: 10001 ms while waiting gives 1 refresh', () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal');
    jest.advanceTimersByTime(10001);
    expect(refreshPermission).toHaveBeenCalledTimes(1);
  });
});

describe('startServicesRecheck guard (UC 1.1.1.2, UC 1.3.1.1)', () =>
{
  it('services_off: 10000 ms gives 1 refresh', () =>
  {
    const { refreshPermission } = startWith('services_off');
    jest.advanceTimersByTime(SERVICES_RECHECK_INTERVAL_MS);
    expect(refreshPermission).toHaveBeenCalledTimes(1);
  });

  it.each(['ok', 'idle', 'searching', 'permission_needed'] as const)('valid EC, no action: status %s gives 0 refreshes', (status) =>
  {
    const { refreshPermission } = startWith(status);
    jest.advanceTimersByTime(SERVICES_RECHECK_INTERVAL_MS);
    expect(refreshPermission).toHaveBeenCalledTimes(0);
  });

  it('valid EC, no action: spoof source while waiting gives 0 refreshes', () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal', 'spoof');
    jest.advanceTimersByTime(SERVICES_RECHECK_INTERVAL_MS);
    expect(refreshPermission).toHaveBeenCalledTimes(0);
  });

  it('valid EC, no action: backgrounded app while waiting gives 0 refreshes', () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal', 'device', 'background');
    jest.advanceTimersByTime(SERVICES_RECHECK_INTERVAL_MS);
    expect(refreshPermission).toHaveBeenCalledTimes(0);
  });

  it('exception flow: a failed refresh is retried on the next tick', async () =>
  {
    const { refreshPermission } = startWith('waiting_for_signal');
    refreshPermission.mockRejectedValueOnce(new Error('permission read failed'));
    await jest.advanceTimersByTimeAsync(SERVICES_RECHECK_INTERVAL_MS * 2);
    expect(refreshPermission).toHaveBeenCalledTimes(2);
  });

  it('stop clears the interval: no timer left and no refresh afterwards', () =>
  {
    const { refreshPermission, stop } = startWith('waiting_for_signal');
    stop();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(SERVICES_RECHECK_INTERVAL_MS);
    expect(refreshPermission).toHaveBeenCalledTimes(0);
  });
});

describe('startServicesRecheck with a real location engine (UC 1.1.1.2, UC 1.3.1.1)', () =>
{
  it('services off: status becomes services_off within 20 s and logs one error level row', async () =>
  {
    const { engine, live, logged } = createLiveEngine();
    await engine.setPermission('foreground');
    live.servicesEnabled = false;
    await jest.advanceTimersByTimeAsync(20000);
    expect(engine.getState().status).toBe('services_off');
    expect(logged.filter((row) => row.code === 'location_services_disabled')).toEqual([{ level: 'error', code: 'location_services_disabled' }]);
  });

  it('services back on: status leaves services_off within 10 s', async () =>
  {
    const { engine, live } = createLiveEngine();
    live.servicesEnabled = false;
    await engine.setPermission('services_off');
    live.servicesEnabled = true;
    await jest.advanceTimersByTimeAsync(10000);
    expect(engine.getState().status).toBe('searching');
  });

  it('healthy: fixes every 5 s for 60 s give 0 permission reads', async () =>
  {
    const { engine, live } = createLiveEngine();
    await engine.setPermission('foreground');
    for (let elapsedMs = 0; elapsedMs < 60000; elapsedMs += 5000)
    {
      live.emit({ latitude: 1.29, longitude: 103.85, accuracyMeters: 10, source: 'device', timestamp: elapsedMs });
      await jest.advanceTimersByTimeAsync(5000);
    }
    expect(engine.getState().status).toBe('ok');
    expect(live.reads).toBe(0);
  });
});
