import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, isRotatedFromNorth, normalizeBearing, steppedZoom, zoomControlsFit } from './mapCamera';

describe('map camera helpers', () =>
{
  it('normalizes bearings into the range -180 to 180', () =>
  {
    expect(normalizeBearing(0)).toBe(0);
    expect(normalizeBearing(359)).toBe(-1);
    expect(normalizeBearing(-270)).toBe(90);
    expect(normalizeBearing(720)).toBe(0);
  });

  it('treats tiny bearings as north up', () =>
  {
    expect(isRotatedFromNorth(0)).toBe(false);
    expect(isRotatedFromNorth(0.3)).toBe(false);
    expect(isRotatedFromNorth(359.8)).toBe(false);
    expect(isRotatedFromNorth(12)).toBe(true);
    expect(isRotatedFromNorth(180)).toBe(true);
  });

  it('fits zoom controls only when they clear the obstacle below with a gap', () =>
  {
    expect(zoomControlsFit(300, 97, 420, 8)).toBe(true);
    expect(zoomControlsFit(300, 97, 404, 8)).toBe(false);
  });

  it('steps zoom by one level within the allowed range', () =>
  {
    expect(steppedZoom(13.5, 'in')).toBe(14.5);
    expect(steppedZoom(13.5, 'out')).toBe(12.5);
    expect(steppedZoom(MAP_MAX_ZOOM - 0.4, 'in')).toBe(MAP_MAX_ZOOM);
    expect(steppedZoom(MAP_MIN_ZOOM + 0.2, 'out')).toBe(MAP_MIN_ZOOM);
  });
});
