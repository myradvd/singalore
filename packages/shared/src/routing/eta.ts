export const WALKING_PACES = ['slow', 'normal', 'fast'] as const;
export type WalkingPace = (typeof WALKING_PACES)[number];

export const PACE_FACTORS: Record<WalkingPace, number> = {
  slow: 1.25,
  normal: 1.0,
  fast: 0.85,
};

export function adjustedWalkSeconds(providerDurationSeconds: number, pace: WalkingPace): number
{
  return Math.round(providerDurationSeconds * PACE_FACTORS[pace]);
}

export function straightLineWalkSeconds(distanceMeters: number, pace: WalkingPace): number
{
  const standardMetersPerSecond = 4.5 / 3.6;
  return adjustedWalkSeconds(distanceMeters / standardMetersPerSecond, pace);
}

export function totalTourSeconds(walkSeconds: number, podcastDurationsSeconds: readonly number[]): number
{
  return walkSeconds + podcastDurationsSeconds.reduce((sum, value) => sum + value, 0);
}
