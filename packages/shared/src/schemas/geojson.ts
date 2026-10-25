import { z } from 'zod';

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const LinearRing = z.array(Position).min(4).refine((ring) =>
{
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1];
}, { message: 'A linear ring must be closed' });

export const GeoJsonPolygon = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(LinearRing).min(1),
});
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygon>;
