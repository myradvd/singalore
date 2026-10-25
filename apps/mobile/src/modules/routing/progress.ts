import { distanceBetween, projectOntoPolyline, type GeoPoint } from '@singalore/shared';
import type { PlannedRoute, PlannedStep } from './routeTypes';

export interface RouteProgress
{
  distanceFromLineM: number;
  alongM: number;
  remainingM: number;
  nextStep: PlannedStep | null;
  distanceToNextManeuverM: number | null;
}

export function computeProgress(route: PlannedRoute, position: GeoPoint): RouteProgress | null
{
  const projection = projectOntoPolyline(position, route.line);
  if (projection === null)
  {
    return null;
  }
  const alongM = projection.distanceAlongMeters;
  const totalM = route.line.length > 1 ? Math.max(route.distanceM, alongM) : route.distanceM;
  const nextStep = route.steps.find((step) => step.startAlongM > alongM + 5) ?? null;
  return {
    distanceFromLineM: projection.distanceFromLineMeters,
    alongM,
    remainingM: Math.max(0, totalM - alongM),
    nextStep,
    distanceToNextManeuverM: nextStep === null ? null : Math.max(0, nextStep.startAlongM - alongM),
  };
}

export const OFF_ROUTE_DISTANCE_M = 40;
export const OFF_ROUTE_DURATION_MS = 5000;

export class OffRouteDetector
{
  private offSince: number | null = null;
  private raised = false;

  update(distanceFromLineM: number, at: number): boolean
  {
    if (distanceFromLineM <= OFF_ROUTE_DISTANCE_M)
    {
      this.offSince = null;
      this.raised = false;
      return false;
    }
    this.offSince = this.offSince ?? at;
    if (!this.raised && at - this.offSince >= OFF_ROUTE_DURATION_MS)
    {
      this.raised = true;
      return true;
    }
    return false;
  }

  reset(): void
  {
    this.offSince = null;
    this.raised = false;
  }
}

export const AUTODETECT_RADIUS_M = 50;

export function shouldAutoStart(position: GeoPoint | null, firstStop: GeoPoint | null, enabled: boolean, radiusMeters = AUTODETECT_RADIUS_M): boolean
{
  return enabled && position !== null && firstStop !== null && distanceBetween(position, firstStop) <= radiusMeters;
}
