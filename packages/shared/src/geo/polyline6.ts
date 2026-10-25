import type { GeoPoint } from './types';

const PRECISION_FACTOR = 1e6;

export function decodePolyline6(encoded: string): GeoPoint[]
{
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length)
  {
    const latResult = decodeSignedValue(encoded, index);
    index = latResult.nextIndex;
    const lngResult = decodeSignedValue(encoded, index);
    index = lngResult.nextIndex;
    lat += latResult.value;
    lng += lngResult.value;
    points.push({ lat: lat / PRECISION_FACTOR, lng: lng / PRECISION_FACTOR });
  }
  return points;
}

function decodeSignedValue(encoded: string, startIndex: number): { value: number; nextIndex: number }
{
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;
  do
  {
    if (index >= encoded.length)
    {
      throw new Error('Malformed polyline: unexpected end of input');
    }
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result += (byte & 0x1f) * 2 ** shift;
    shift += 5;
  }
  while (byte >= 0x20);
  const value = result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  return { value, nextIndex: index };
}

export function encodePolyline6(points: readonly GeoPoint[]): string
{
  let output = '';
  let previousLat = 0;
  let previousLng = 0;
  for (const point of points)
  {
    const lat = Math.round(point.lat * PRECISION_FACTOR);
    const lng = Math.round(point.lng * PRECISION_FACTOR);
    output += encodeSignedValue(lat - previousLat);
    output += encodeSignedValue(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return output;
}

function encodeSignedValue(value: number): string
{
  let remaining = value < 0 ? -value * 2 - 1 : value * 2;
  let output = '';
  while (remaining >= 0x20)
  {
    output += String.fromCharCode((0x20 | (remaining % 32)) + 63);
    remaining = Math.floor(remaining / 32);
  }
  output += String.fromCharCode(remaining + 63);
  return output;
}
