export const DISTANCE_UNITS = ['metric', 'imperial'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export function formatDistance(meters: number, unit: DistanceUnit): string
{
  const safeMeters = Math.max(0, meters);
  if (unit === 'imperial')
  {
    const miles = safeMeters / METERS_PER_MILE;
    if (miles < 0.1)
    {
      return `${Math.round((safeMeters * FEET_PER_METER) / 10) * 10} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }
  if (safeMeters < 1000)
  {
    return `${Math.round(safeMeters / 10) * 10} m`;
  }
  return `${(safeMeters / 1000).toFixed(1)} km`;
}

export function formatDurationShort(totalSeconds: number): string
{
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60)
  {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

export function formatEpisodeLength(totalSeconds: number): string | null
{
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0)
  {
    return null;
  }
  if (totalSeconds < 59.5)
  {
    return `${Math.max(1, Math.round(totalSeconds))} s`;
  }
  return formatDurationShort(totalSeconds);
}

export function formatClock(totalSeconds: number): string
{
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDurationLong(totalSeconds: number): string
{
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0)
  {
    return `${seconds} sec`;
  }
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} sec`;
}
