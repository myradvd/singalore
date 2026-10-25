import type { AppEventBus, NetworkRequestRecord } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { ConnectivityProvider } from '@/core/media';

export const RECENT_WINDOW = 5;
export const FAILURE_THRESHOLD = 2;
export const SLOW_REQUEST_MS = 3000;
export const BANNER_SNOOZE_MS = 5 * 60 * 1000;

export interface ConnectivityState
{
  online: boolean | null;
  wifi: boolean;
  recentFailures: number;
  unstable: boolean;
  bannerVisible: boolean;
}

export function isBadRequest(record: NetworkRequestRecord): boolean
{
  if (record.outcome === 'timeout' || record.outcome === 'network_error')
  {
    return true;
  }
  if (record.outcome === 'http_error' && record.status !== null && record.status >= 500)
  {
    return true;
  }
  return record.latencyMs > SLOW_REQUEST_MS;
}

export class ConnectivityMonitor implements ConnectivityProvider
{
  private recent: boolean[] = [];
  private online: boolean | null = null;
  private wifi = false;
  private dismissedAt: number | null = null;
  private readonly listeners = new Set<(state: ConnectivityState) => void>();
  private state: ConnectivityState = { online: null, wifi: false, recentFailures: 0, unstable: false, bannerVisible: false };

  constructor(private readonly events: AppEventBus, private readonly clock: Clock)
  {
  }

  start(): () => void
  {
    return this.events.on('network/request', (record) => this.recordRequest(record));
  }

  isOnline(): boolean
  {
    return this.online !== false;
  }

  isOnWifi(): boolean
  {
    return this.wifi;
  }

  getState(): ConnectivityState
  {
    return this.state;
  }

  subscribe(listener: (state: ConnectivityState) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setNetwork(online: boolean | null, wifi: boolean): void
  {
    const cameBack = this.online === false && online === true;
    this.online = online;
    this.wifi = wifi;
    if (cameBack)
    {
      this.recent = [];
    }
    this.recompute();
  }

  recordRequest(record: NetworkRequestRecord): void
  {
    this.recent = [...this.recent, isBadRequest(record)].slice(-RECENT_WINDOW);
    this.recompute();
  }

  dismissBanner(): void
  {
    this.dismissedAt = this.clock.now();
    this.recompute();
  }

  private recompute(): void
  {
    const recentFailures = this.recent.filter(Boolean).length;
    const unstable = this.online === false || recentFailures >= FAILURE_THRESHOLD;
    const snoozed = this.dismissedAt !== null && this.clock.now() - this.dismissedAt < BANNER_SNOOZE_MS;
    if (!unstable)
    {
      this.dismissedAt = null;
    }
    this.state = { online: this.online, wifi: this.wifi, recentFailures, unstable, bannerVisible: unstable && !snoozed };
    for (const listener of this.listeners)
    {
      listener(this.state);
    }
  }
}
