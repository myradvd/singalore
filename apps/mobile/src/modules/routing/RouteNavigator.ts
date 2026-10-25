import type { GeoPoint } from '@singalore/shared';
import { z } from 'zod';
import type { AppEventBus } from '@/core/appEvents';
import type { DbAdapter } from '@/core/db/DbAdapter';
import { computeProgress, OffRouteDetector, type RouteProgress } from './progress';
import type { PlanResult, RoutePlanner } from './RoutePlanner';
import type { PlannedRoute, RouteStop } from './routeTypes';

export interface RouteState
{
  status: 'idle' | 'planning' | 'ready' | 'failed';
  route: PlannedRoute | null;
  fallback: PlannedRoute | null;
  failureMessage: string | null;
  progress: RouteProgress | null;
  offRoute: boolean;
  navigating: boolean;
}

const CACHE_KEY = 'planned_route';
const GeoPointSchema = z.object({ lat: z.number(), lng: z.number() });
const PlannedRouteSchema = z.object({
  stopIds: z.array(z.string()),
  line: z.array(GeoPointSchema),
  distanceM: z.number(),
  providerDurationS: z.number(),
  approximate: z.boolean(),
  plannedAt: z.number(),
  steps: z.array(z.object({
    legIndex: z.number(),
    distanceM: z.number(),
    durationS: z.number(),
    name: z.string(),
    startAlongM: z.number(),
    maneuver: z.object({ type: z.string(), modifier: z.string().optional(), location: GeoPointSchema, bearingBefore: z.number(), bearingAfter: z.number(), exit: z.number().optional() }),
  })),
});

export const INITIAL_ROUTE_STATE: RouteState = { status: 'idle', route: null, fallback: null, failureMessage: null, progress: null, offRoute: false, navigating: false };

export class RouteNavigator
{
  private state: RouteState = INITIAL_ROUTE_STATE;
  private readonly listeners = new Set<(state: RouteState) => void>();
  private readonly offRoute = new OffRouteDetector();
  private unsubscribe: (() => void) | null = null;
  private planVersion = 0;

  constructor(private readonly planner: RoutePlanner, private readonly events: AppEventBus, private readonly db: DbAdapter)
  {
  }

  getState(): RouteState
  {
    return this.state;
  }

  subscribe(listener: (state: RouteState) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async plan(origin: GeoPoint, stops: RouteStop[], autoOrder: boolean): Promise<PlanResult>
  {
    const version = ++this.planVersion;
    this.update({ status: 'planning', failureMessage: null, fallback: null });
    const result = await this.planner.plan(origin, stops, { autoOrder });
    if (version !== this.planVersion)
    {
      return result;
    }
    if (result.kind === 'planned')
    {
      await this.setRoute(result.route);
    }
    else
    {
      this.update({ status: 'failed', failureMessage: result.message, fallback: result.fallback });
    }
    return result;
  }

  async orderStops(origin: GeoPoint, stops: RouteStop[]): Promise<RouteStop[]>
  {
    return this.planner.orderStops(origin, stops);
  }

  async useFallback(): Promise<void>
  {
    if (this.state.fallback !== null)
    {
      await this.setRoute(this.state.fallback);
    }
  }

  async setRoute(route: PlannedRoute): Promise<void>
  {
    this.offRoute.reset();
    this.update({ status: 'ready', route, fallback: null, failureMessage: null, offRoute: false, progress: null });
    await this.db.run('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', [CACHE_KEY, JSON.stringify(route)]);
  }

  async restore(): Promise<void>
  {
    const row = await this.db.first('select value from meta where key = ?', [CACHE_KEY]);
    if (row === null || typeof row !== 'object' || !('value' in row) || typeof row.value !== 'string')
    {
      return;
    }
    try
    {
      const parsed = PlannedRouteSchema.safeParse(JSON.parse(row.value));
      if (parsed.success)
      {
        this.update({ status: 'ready', route: parsed.data });
      }
    }
    catch
    {
      await this.clear();
    }
  }

  async clear(): Promise<void>
  {
    this.planVersion += 1;
    this.setNavigating(false);
    this.update(INITIAL_ROUTE_STATE);
    await this.db.run('delete from meta where key = ?', [CACHE_KEY]);
  }

  setNavigating(active: boolean): void
  {
    if (active && this.unsubscribe === null)
    {
      this.unsubscribe = this.events.on('location/fix', (fix) => this.handleFix({ lat: fix.latitude, lng: fix.longitude }, fix.timestamp));
    }
    if (!active && this.unsubscribe !== null)
    {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.offRoute.reset();
    this.update({ navigating: active, offRoute: false });
  }

  returnToPath(): void
  {
    this.offRoute.reset();
    this.update({ offRoute: false });
  }

  handleFix(position: GeoPoint, at: number): void
  {
    const route = this.state.route;
    if (route === null)
    {
      return;
    }
    const progress = computeProgress(route, position);
    if (progress === null)
    {
      return;
    }
    const raised = !route.approximate && this.offRoute.update(progress.distanceFromLineM, at);
    this.update({ progress, offRoute: this.state.offRoute || raised });
  }

  private update(partial: Partial<RouteState>): void
  {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners)
    {
      listener(this.state);
    }
  }
}
