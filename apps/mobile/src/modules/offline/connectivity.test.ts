import { createAppEventBus, type NetworkRequestRecord } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { BANNER_SNOOZE_MS, ConnectivityMonitor, isBadRequest } from './ConnectivityMonitor';

const request = (overrides: Partial<NetworkRequestRecord>): NetworkRequestRecord => ({ id: 1, method: 'GET', path: '/api/v1/catalog', status: 200, latencyMs: 200, outcome: 'ok', at: 0, ...overrides });

describe('ConnectivityMonitor (A7, UC 1.4.1.1)', () =>
{
  it('classifies failed, server error and slow requests as bad', () =>
  {
    expect(isBadRequest(request({}))).toBe(false);
    expect(isBadRequest(request({ outcome: 'timeout', status: null }))).toBe(true);
    expect(isBadRequest(request({ outcome: 'network_error', status: null }))).toBe(true);
    expect(isBadRequest(request({ outcome: 'http_error', status: 503 }))).toBe(true);
    expect(isBadRequest(request({ outcome: 'http_error', status: 404 }))).toBe(false);
    expect(isBadRequest(request({ latencyMs: 3001 }))).toBe(true);
  });

  it('shows the banner when offline or after 2 of the last 5 calls were bad', () =>
  {
    const events = createAppEventBus();
    const monitor = new ConnectivityMonitor(events, new ManualClock(0));
    monitor.start();
    monitor.setNetwork(true, true);
    expect(monitor.getState().bannerVisible).toBe(false);
    events.emit('network/request', request({ outcome: 'timeout', status: null }));
    expect(monitor.getState().unstable).toBe(false);
    events.emit('network/request', request({ latencyMs: 5000 }));
    expect(monitor.getState().bannerVisible).toBe(true);
    for (let index = 0; index < 5; index += 1)
    {
      events.emit('network/request', request({}));
    }
    expect(monitor.getState().unstable).toBe(false);
    monitor.setNetwork(false, false);
    expect(monitor.getState().bannerVisible).toBe(true);
    expect(monitor.isOnline()).toBe(false);
  });

  it('can be dismissed for 5 minutes (Ignore)', () =>
  {
    const clock = new ManualClock(0);
    const monitor = new ConnectivityMonitor(createAppEventBus(), clock);
    monitor.setNetwork(false, false);
    monitor.dismissBanner();
    expect(monitor.getState().bannerVisible).toBe(false);
    clock.advance(BANNER_SNOOZE_MS);
    monitor.setNetwork(false, false);
    expect(monitor.getState().bannerVisible).toBe(true);
  });

  it('treats unknown network state as online', () =>
  {
    const monitor = new ConnectivityMonitor(createAppEventBus(), new ManualClock(0));
    expect(monitor.isOnline()).toBe(true);
  });
});
