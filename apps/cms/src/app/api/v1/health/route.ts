import { serverEnv } from '@/server/env';

export async function GET(): Promise<Response>
{
  return Response.json(
    { status: 'ok', serverTime: new Date().toISOString(), version: serverEnv().APP_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
