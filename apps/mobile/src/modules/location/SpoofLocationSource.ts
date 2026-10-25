import { destinationPoint, distanceBetween, type GeoPoint } from '@singalore/shared';
import type { Clock } from '@/core/clock';
import type { LocationFix, LocationMode } from '@/core/location';
import type { LocationSource, LocationSourceHandle } from './LocationSource';

export interface Scheduler
{
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export function interpolatePath(path: readonly GeoPoint[], travelledMeters: number): { point: GeoPoint; finished: boolean }
{
  const first = path[0];
  if (first === undefined)
  {
    throw new Error('Path is empty');
  }
  let remaining = travelledMeters;
  for (let index = 1; index < path.length; index += 1)
  {
    const start = path[index - 1] as GeoPoint;
    const end = path[index] as GeoPoint;
    const segment = distanceBetween(start, end);
    if (remaining <= segment)
    {
      const fraction = segment === 0 ? 0 : remaining / segment;
      return { point: { lat: start.lat + (end.lat - start.lat) * fraction, lng: start.lng + (end.lng - start.lng) * fraction }, finished: false };
    }
    remaining -= segment;
  }
  return { point: path[path.length - 1] as GeoPoint, finished: true };
}

export class SpoofLocationSource implements LocationSource
{
  readonly kind = 'spoof' as const;
  private position: GeoPoint | null = null;
  private listener: ((fix: LocationFix) => void) | null = null;
  private emitTimer: unknown = null;
  private playbackTimer: unknown = null;
  private accuracyMeters = 5;

  constructor(private readonly clock: Clock, private readonly scheduler: Scheduler = realScheduler)
  {
  }

  async start(_mode: LocationMode, onFix: (fix: LocationFix) => void): Promise<LocationSourceHandle>
  {
    this.listener = onFix;
    this.emitTimer = this.scheduler.setInterval(() => this.emitCurrent(), 1000);
    this.emitCurrent();
    return {
      stop: () =>
      {
        this.listener = null;
        this.scheduler.clearInterval(this.emitTimer);
        this.stopPlayback();
      },
    };
  }

  currentPosition(): GeoPoint | null
  {
    return this.position;
  }

  setAccuracy(meters: number): void
  {
    this.accuracyMeters = meters;
  }

  setPosition(point: GeoPoint): void
  {
    this.stopPlayback();
    this.position = point;
    this.emitCurrent();
  }

  nudge(bearingDegrees: number, meters: number): void
  {
    if (this.position !== null)
    {
      this.setPosition(destinationPoint(this.position, bearingDegrees, meters));
    }
  }

  playPath(path: readonly GeoPoint[], metersPerSecond: number, onFinished?: () => void): void
  {
    if (path.length === 0)
    {
      return;
    }
    this.stopPlayback();
    const startedAt = this.clock.now();
    this.position = path[0] ?? null;
    this.emitCurrent();
    this.playbackTimer = this.scheduler.setInterval(() =>
    {
      const travelled = ((this.clock.now() - startedAt) / 1000) * metersPerSecond;
      const step = interpolatePath(path, travelled);
      this.position = step.point;
      this.emitCurrent();
      if (step.finished)
      {
        this.stopPlayback();
        onFinished?.();
      }
    }, 1000);
  }

  isPlaying(): boolean
  {
    return this.playbackTimer !== null;
  }

  stopPlayback(): void
  {
    if (this.playbackTimer !== null)
    {
      this.scheduler.clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private emitCurrent(): void
  {
    if (this.position === null || this.listener === null)
    {
      return;
    }
    this.listener({
      latitude: this.position.lat,
      longitude: this.position.lng,
      accuracyMeters: this.accuracyMeters,
      timestamp: this.clock.now(),
      source: 'spoof',
    });
  }
}
