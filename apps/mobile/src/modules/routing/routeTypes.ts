import type { GeoPoint, Maneuver } from '@singalore/shared';

export interface RouteStop
{
  landmarkId: string;
  position: GeoPoint;
}

export interface PlannedStep
{
  legIndex: number;
  distanceM: number;
  durationS: number;
  name: string;
  maneuver: Maneuver;
  startAlongM: number;
}

export interface PlannedRoute
{
  stopIds: string[];
  line: GeoPoint[];
  distanceM: number;
  providerDurationS: number;
  steps: PlannedStep[];
  approximate: boolean;
  plannedAt: number;
}
