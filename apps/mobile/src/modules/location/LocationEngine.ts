import type { AppEventBus } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { DiagnosticsRecorder } from '@/core/diagnostics';
import type { LocationFix, LocationMode, LocationPermissionState, LocationSignalStatus } from '@/core/location';
import type { LocationSource, LocationSourceHandle } from './LocationSource';
import { canTrackLocation } from './permissions';
/** With no fix for this long, the app shows "Waiting for GPS signal" and logs it. */
export const NO_FIX_TIMEOUT_MS = 10000;

export interface LocationEngineState
{
  status: LocationSignalStatus;
  permission: LocationPermissionState;
  mode: LocationMode;
  sourceKind: 'device' | 'spoof';
  lastFix: LocationFix | null;
  fixIntervalsMs: number[];
}

export interface LocationEngineDependencies
{
  deviceSource: LocationSource;
  spoofSource: LocationSource;
  clock: Clock;
  events: AppEventBus;
  diagnostics: DiagnosticsRecorder;
  setTimer: (callback: () => void, milliseconds: number) => unknown;
  clearTimer: (handle: unknown) => void;
}
/**
 * Single source of location fixes for the whole app.
 * Uses the device GPS or the debug spoof source; both reach the rest of the app the same way.
 * Mode 'browse' updates every 5 s, mode 'tour' every 1 s.
 * Emits each fix as a location/fix event.
 */
export class LocationEngine
{
  private handle: LocationSourceHandle | null = null;
  private watchdog: unknown = null;
  private reportedSignalLoss = false;
  private listeners = new Set<(state: LocationEngineState) => void>();
  private state: LocationEngineState = {
    status: 'idle',
    permission: 'undetermined',
    mode: 'browse',
    sourceKind: 'device',
    lastFix: null,
    fixIntervalsMs: [],
  };

  constructor(private readonly dependencies: LocationEngineDependencies)
  {
  }

  getState(): LocationEngineState
  {
    return this.state;
  }

  subscribe(listener: (state: LocationEngineState) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
/** Updates the location permission state and restarts tracking if it changed. */
  async setPermission(permission: LocationPermissionState): Promise<void>
  {
    const changed = permission !== this.state.permission;
    this.update({ permission });
    if (!changed)
    {
      return;
    }
    if (permission === 'services_off')
    {
      await this.dependencies.diagnostics.record('warn', 'location_services_disabled');
    }
    await this.restart();
  }
/** Switches between browse and tour accuracy, restarting the source. */
  async setMode(mode: LocationMode): Promise<void>
  {
    if (mode === this.state.mode)
    {
      return;
    }
    this.update({ mode });
    await this.restart();
  }
/** Debug mode: switches between the real GPS and the spoofed location. */
  async useSpoof(enabled: boolean): Promise<void>
  {
    const sourceKind = enabled ? 'spoof' : 'device';
    if (sourceKind === this.state.sourceKind)
    {
      return;
    }
    this.update({ sourceKind, lastFix: null, fixIntervalsMs: [] });
    await this.restart();
  }

  async stop(): Promise<void>
  {
    this.handle?.stop();
    this.handle = null;
    this.clearWatchdog();
    this.update({ status: 'idle' });
  }

  async restart(): Promise<void>
  {
    this.handle?.stop();
    this.handle = null;
    this.clearWatchdog();
    const spoofing = this.state.sourceKind === 'spoof';
    if (!spoofing && !canTrackLocation(this.state.permission))
    {
      this.update({ status: this.state.permission === 'services_off' ? 'services_off' : 'permission_needed', lastFix: null });
      return;
    }
    const source = spoofing ? this.dependencies.spoofSource : this.dependencies.deviceSource;
    this.update({ status: 'searching' });
    this.armWatchdog();
    this.handle = await source.start(this.state.mode, (fix) => this.acceptFix(fix), (code) =>
    {
      void this.dependencies.diagnostics.record('error', 'location_source_error', code);
    });
  }
/** Accepts a fix from the active source, resets the no-signal timer and broadcasts the fix. */
  acceptFix(fix: LocationFix): void
  {
    const expectedSource = this.state.sourceKind;
    if (fix.source !== expectedSource)
    {
      return;
    }
    const previous = this.state.lastFix;
    const intervals = previous === null ? this.state.fixIntervalsMs : [...this.state.fixIntervalsMs, Math.max(0, fix.timestamp - previous.timestamp)].slice(-10);
    if (this.reportedSignalLoss)
    {
      this.reportedSignalLoss = false;
      void this.dependencies.diagnostics.record('info', 'gps_signal_restored');
    }
    this.update({ lastFix: fix, status: 'ok', fixIntervalsMs: intervals });
    this.armWatchdog();
    this.dependencies.events.emit('location/fix', fix);
  }
/** @returns Average fixes per second over the last 10 fixes, for the debug overlay. */
  refreshRateHz(): number | null
  {
    const intervals = this.state.fixIntervalsMs;
    if (intervals.length === 0)
    {
      return null;
    }
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    return average === 0 ? null : 1000 / average;
  }

  private armWatchdog(): void
  {
    this.clearWatchdog();
    this.watchdog = this.dependencies.setTimer(() =>
    {
      this.update({ status: 'waiting_for_signal' });
      if (!this.reportedSignalLoss)
      {
        this.reportedSignalLoss = true;
        void this.dependencies.diagnostics.record('warn', 'gps_signal_lost', `no fix for ${NO_FIX_TIMEOUT_MS / 1000} s`);
      }
    }, NO_FIX_TIMEOUT_MS);
  }

  private clearWatchdog(): void
  {
    if (this.watchdog !== null)
    {
      this.dependencies.clearTimer(this.watchdog);
      this.watchdog = null;
    }
  }

  private update(partial: Partial<LocationEngineState>): void
  {
    const next = { ...this.state, ...partial };
    const statusChanged = next.status !== this.state.status || next.permission !== this.state.permission;
    this.state = next;
    if (statusChanged)
    {
      this.dependencies.events.emit('location/status', { status: next.status, permission: next.permission });
    }
    for (const listener of this.listeners)
    {
      listener(next);
    }
  }
}
