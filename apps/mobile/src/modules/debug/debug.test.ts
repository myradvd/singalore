import { createAppEventBus } from '@/core/appEvents';
import { DEBUG_GATE_TAPS, DEBUG_GATE_WINDOW_MS, DebugGate } from './debugGate';
import { addPathPoint, bindNetworkLog, NETWORK_LOG_LIMIT, toggleDebugMode, useDebugStore } from './debugStore';

describe('DebugGate (UC 1.6.1)', () =>
{
  it('opens after 7 quick taps and not before', () =>
  {
    const gate = new DebugGate(true);
    const results = Array.from({ length: DEBUG_GATE_TAPS }, (_, index) => gate.registerTap(index * 200));
    expect(results.slice(0, -1).every((result) => !result)).toBe(true);
    expect(results.at(-1)).toBe(true);
  });

  it('forgets slow taps', () =>
  {
    const gate = new DebugGate(true);
    for (let index = 0; index < DEBUG_GATE_TAPS - 1; index += 1)
    {
      gate.registerTap(index * 100);
    }
    expect(gate.registerTap(DEBUG_GATE_WINDOW_MS + 1000)).toBe(false);
  });

  it('never opens when the build flag is off', () =>
  {
    const gate = new DebugGate(false);
    expect(Array.from({ length: 20 }, (_, index) => gate.registerTap(index)).some(Boolean)).toBe(false);
  });

  it('toggles on and off and clears tools when turned off (UC 1.6.1.1)', () =>
  {
    useDebugStore.setState({ enabled: false });
    expect(toggleDebugMode()).toBe(true);
    useDebugStore.setState({ showGeofenceRings: true });
    expect(toggleDebugMode()).toBe(false);
    expect(useDebugStore.getState().showGeofenceRings).toBe(false);
  });
});

describe('network log (UC 1.6.5)', () =>
{
  it('keeps the newest 50 requests from the API client', () =>
  {
    const events = createAppEventBus();
    useDebugStore.setState({ networkLog: [] });
    const unbind = bindNetworkLog(events);
    for (let id = 1; id <= NETWORK_LOG_LIMIT + 5; id += 1)
    {
      events.emit('network/request', { id, method: 'GET', path: '/api/v1/catalog', status: 200, latencyMs: 120, outcome: 'ok', at: id });
    }
    unbind();
    const log = useDebugStore.getState().networkLog;
    expect(log).toHaveLength(NETWORK_LOG_LIMIT);
    expect(log[0]?.id).toBe(NETWORK_LOG_LIMIT + 5);
  });

  it('records path points for playback', () =>
  {
    useDebugStore.setState({ path: [] });
    addPathPoint({ lat: 1, lng: 2 });
    addPathPoint({ lat: 1.1, lng: 2 });
    expect(useDebugStore.getState().path).toHaveLength(2);
  });
});
