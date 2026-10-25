import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import type { LocationFix } from '@/core/location';
import { LocationEngine, NO_FIX_TIMEOUT_MS } from './LocationEngine';
import { MODE_SETTINGS, type LocationSource } from './LocationSource';
import { canTrackLocation, resolvePermissionState } from './permissions';
import { interpolatePath, SpoofLocationSource, type Scheduler } from './SpoofLocationSource';

class FakeScheduler implements Scheduler
{
  private nextId = 1;
  readonly intervals = new Map<number, { callback: () => void; every: number }>();

  setInterval(callback: () => void, milliseconds: number): unknown
  {
    const id = this.nextId++;
    this.intervals.set(id, { callback, every: milliseconds });
    return id;
  }

  clearInterval(handle: unknown): void
  {
    this.intervals.delete(handle as number);
  }

  tick(): void
  {
    for (const interval of [...this.intervals.values()])
    {
      interval.callback();
    }
  }
}

class FakeDeviceSource implements LocationSource
{
  readonly kind = 'device' as const;
  listener: ((fix: LocationFix) => void) | null = null;
  starts: string[] = [];
  stops = 0;

  async start(mode: 'browse' | 'tour', onFix: (fix: LocationFix) => void)
  {
    this.starts.push(mode);
    this.listener = onFix;
    return { stop: () =>
    {
      this.stops += 1;
      this.listener = null;
    } };
  }

  emit(fix: Partial<LocationFix> & { timestamp: number })
  {
    this.listener?.({ latitude: 1.29, longitude: 103.85, accuracyMeters: 10, source: 'device', ...fix });
  }
}

function createEngine()
{
  const clock = new ManualClock(0);
  const events = createAppEventBus();
  const fixes: LocationFix[] = [];
  const statuses: string[] = [];
  events.on('location/fix', (fix) => fixes.push(fix));
  events.on('location/status', (status) => statuses.push(status.status));
  const timers: { callback: () => void; at: number }[] = [];
  const diagnostics: string[] = [];
  const device = new FakeDeviceSource();
  const scheduler = new FakeScheduler();
  const spoof = new SpoofLocationSource(clock, scheduler);
  const engine = new LocationEngine({
    deviceSource: device,
    spoofSource: spoof,
    clock,
    events,
    diagnostics: { record: async (_level, code) =>
    {
      diagnostics.push(code);
    } },
    setTimer: (callback, milliseconds) =>
    {
      const timer = { callback, at: clock.now() + milliseconds };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) =>
    {
      const index = timers.indexOf(handle as (typeof timers)[number]);
      if (index >= 0)
      {
        timers.splice(index, 1);
      }
    },
  });
  const advance = (milliseconds: number) =>
  {
    clock.advance(milliseconds);
    for (const timer of [...timers])
    {
      if (timer.at <= clock.now())
      {
        timers.splice(timers.indexOf(timer), 1);
        timer.callback();
      }
    }
  };
  return { engine, device, spoof, scheduler, clock, fixes, statuses, diagnostics, advance };
}

describe('resolvePermissionState', () =>
{
  it.each([
    [{ servicesEnabled: false, foreground: 'granted', background: 'granted', foregroundCanAskAgain: true }, 'services_off'],
    [{ servicesEnabled: true, foreground: 'granted', background: 'granted', foregroundCanAskAgain: true }, 'always'],
    [{ servicesEnabled: true, foreground: 'granted', background: 'denied', foregroundCanAskAgain: true }, 'foreground'],
    [{ servicesEnabled: true, foreground: 'denied', background: 'denied', foregroundCanAskAgain: false }, 'denied'],
    [{ servicesEnabled: true, foreground: 'undetermined', background: 'undetermined', foregroundCanAskAgain: true }, 'undetermined'],
  ] as const)('%o -> %s', (snapshot, expected) =>
  {
    expect(resolvePermissionState(snapshot)).toBe(expected);
  });

  it('only tracks with a granted permission', () =>
  {
    expect(canTrackLocation('always')).toBe(true);
    expect(canTrackLocation('foreground')).toBe(true);
    expect(canTrackLocation('denied')).toBe(false);
    expect(canTrackLocation('services_off')).toBe(false);
  });
});

describe('LocationEngine', () =>
{
  it('does not start without permission and reports permission_needed', async () =>
  {
    const { engine, device } = createEngine();
    await engine.restart();
    expect(device.starts).toEqual([]);
    expect(engine.getState().status).toBe('permission_needed');
  });

  it('starts in browse mode and switches to tour mode', async () =>
  {
    const { engine, device } = createEngine();
    await engine.setPermission('foreground');
    expect(device.starts).toEqual(['browse']);
    await engine.setMode('tour');
    expect(device.starts).toEqual(['browse', 'tour']);
    expect(device.stops).toBe(1);
  });

  it('emits fixes, keeps only the latest in memory and measures the refresh rate', async () =>
  {
    const { engine, device, fixes } = createEngine();
    await engine.setPermission('always');
    device.emit({ timestamp: 1000 });
    device.emit({ timestamp: 2000, latitude: 1.3 });
    device.emit({ timestamp: 3000, latitude: 1.31 });
    expect(fixes).toHaveLength(3);
    expect(engine.getState().lastFix?.latitude).toBe(1.31);
    expect(engine.getState().status).toBe('ok');
    expect(engine.refreshRateHz()).toBeCloseTo(1);
  });

  it('raises waiting_for_signal after 10 s without a fix and logs it once (NFR 6.2, UC 1.1.2.1)', async () =>
  {
    const { engine, device, advance, diagnostics, statuses } = createEngine();
    await engine.setPermission('foreground');
    advance(NO_FIX_TIMEOUT_MS - 1);
    expect(engine.getState().status).toBe('searching');
    advance(1);
    expect(engine.getState().status).toBe('waiting_for_signal');
    advance(NO_FIX_TIMEOUT_MS);
    expect(diagnostics.filter((code) => code === 'gps_signal_lost')).toHaveLength(1);
    device.emit({ timestamp: 30000 });
    expect(engine.getState().status).toBe('ok');
    expect(diagnostics).toContain('gps_signal_restored');
    expect(statuses).toEqual(expect.arrayContaining(['searching', 'waiting_for_signal', 'ok']));
  });

  it('suspends and logs when location services are switched off (UC 1.3.1.1)', async () =>
  {
    const { engine, device, diagnostics } = createEngine();
    await engine.setPermission('foreground');
    await engine.setPermission('services_off');
    expect(engine.getState().status).toBe('services_off');
    expect(device.stops).toBe(1);
    expect(diagnostics).toContain('location_services_disabled');
  });

  it('routes spoofed fixes through the same path and ignores the device while spoofing (UC 1.6.3)', async () =>
  {
    const { engine, device, spoof, fixes } = createEngine();
    await engine.setPermission('foreground');
    await engine.useSpoof(true);
    spoof.setPosition({ lat: 1.2951, lng: 103.8519 });
    device.emit({ timestamp: 5 });
    expect(fixes.map((fix) => fix.source)).toEqual(['spoof']);
    expect(engine.getState().lastFix?.latitude).toBe(1.2951);
    await engine.useSpoof(false);
    expect(engine.getState().lastFix).toBeNull();
    device.emit({ timestamp: 6 });
    expect(fixes.at(-1)?.source).toBe('device');
  });

  it('spoofing works even without location permission', async () =>
  {
    const { engine, spoof, fixes } = createEngine();
    await engine.useSpoof(true);
    spoof.setPosition({ lat: 1.29, lng: 103.85 });
    expect(fixes).toHaveLength(1);
  });
});

describe('SpoofLocationSource path playback', () =>
{
  it('interpolates along a path and reports the end', () =>
  {
    const path = [{ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.801 }];
    const halfway = interpolatePath(path, 55.6);
    expect(halfway.finished).toBe(false);
    expect(halfway.point.lng).toBeCloseTo(103.8005, 4);
    expect(interpolatePath(path, 10000)).toEqual({ point: path[1], finished: true });
    expect(() => interpolatePath([], 1)).toThrow();
  });

  it('walks the path at the chosen speed on each tick', async () =>
  {
    const { engine, spoof, scheduler, clock, fixes } = createEngine();
    await engine.useSpoof(true);
    const finished = jest.fn();
    spoof.playPath([{ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.8002 }], 10, finished);
    expect(spoof.isPlaying()).toBe(true);
    clock.advance(1000);
    scheduler.tick();
    clock.advance(2000);
    scheduler.tick();
    expect(finished).toHaveBeenCalledTimes(1);
    expect(spoof.isPlaying()).toBe(false);
    expect(fixes.at(-1)?.longitude).toBeCloseTo(103.8002, 6);
  });
});

describe('MODE_SETTINGS', () =>
{
  it.each(['browse', 'tour'] as const)('keeps a stationary device reporting before the no-fix watchdog fires (%s)', (mode) =>
  {
    const settings = MODE_SETTINGS[mode];
    expect(settings.distanceIntervalMeters).toBe(0);
    expect(settings.timeIntervalMs).toBeLessThan(NO_FIX_TIMEOUT_MS);
  });
});
