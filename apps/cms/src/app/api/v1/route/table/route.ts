import { handleRouting } from '@/server/routeHandlers';
import { routingRuntime } from '@/server/routingRuntime';

export async function POST(request: Request): Promise<Response>
{
  const { provider, limiter, log } = routingRuntime();
  return handleRouting(request, 'table', provider, limiter, log);
}
