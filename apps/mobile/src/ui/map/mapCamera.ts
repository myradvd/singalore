export const MAP_MIN_ZOOM = 10;
export const MAP_MAX_ZOOM = 19;
export const INITIAL_ZOOM = 13.5;
export const ZOOM_STEP = 1;
export const ZOOM_ANIMATION_MS = 250;
export const NORTH_RESET_ANIMATION_MS = 300;

const BEARING_TOLERANCE_DEGREES = 0.5;

export function normalizeBearing(bearing: number): number
{
  const wrapped = ((bearing % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function isRotatedFromNorth(bearing: number): boolean
{
  return Math.abs(normalizeBearing(bearing)) > BEARING_TOLERANCE_DEGREES;
}

export function zoomControlsFit(zoomTop: number, zoomHeight: number, obstacleTop: number, gap: number): boolean
{
  return zoomTop + zoomHeight + gap <= obstacleTop;
}

export function steppedZoom(currentZoom: number, direction: 'in' | 'out'): number
{
  const target = currentZoom + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP);
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, target));
}
