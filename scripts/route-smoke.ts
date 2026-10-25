import { decodePolyline6, pathLengthMeters } from '@singalore/shared';
import { z } from 'zod';

const ROUTING_BASE_URL = process.env.ROUTING_BASE_URL ?? 'https://routing.openstreetmap.de/routed-foot';
const TANJONG_PAGAR = { lat: 1.27646, lng: 103.84571 };
const MARINA_BAY = { lat: 1.28333, lng: 103.86074 };

const OsrmRouteSummary = z.object({
  code: z.string(),
  routes: z.array(z.object({ distance: z.number(), duration: z.number(), geometry: z.string(), legs: z.array(z.object({ steps: z.array(z.unknown()) })) })),
});

async function main(): Promise<void>
{
  const coordinates = [TANJONG_PAGAR, MARINA_BAY].map((point) => `${point.lng},${point.lat}`).join(';');
  const url = `${ROUTING_BASE_URL}/route/v1/foot/${coordinates}?overview=full&geometries=polyline6&steps=true`;
  const started = Date.now();
  const response = await fetch(url, { headers: { 'User-Agent': 'Singalore/0.1 route smoke test' }, signal: AbortSignal.timeout(15000) });
  const body = OsrmRouteSummary.parse(await response.json());
  const route = body.routes[0];
  if (body.code !== 'Ok' || route === undefined)
  {
    throw new Error(`Routing provider answered ${body.code}`);
  }
  const line = decodePolyline6(route.geometry);
  console.log(`provider ${new URL(ROUTING_BASE_URL).host} status ${response.status} in ${Date.now() - started} ms`);
  console.log(`distance ${Math.round(route.distance)} m, duration ${Math.round(route.duration)} s, ${route.legs[0]?.steps.length ?? 0} steps`);
  console.log(`decoded ${line.length} points, polyline length ${Math.round(pathLengthMeters(line))} m`);
}

void main().catch((error: unknown) =>
{
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
