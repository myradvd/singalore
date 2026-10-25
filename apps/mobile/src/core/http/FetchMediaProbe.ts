import type { MediaProbe, MediaProbeResult } from '../media';

export function classifyProbeStatus(status: number): MediaProbeResult
{
  if (status >= 200 && status < 400)
  {
    return { kind: 'reachable', status };
  }
  if (status === 404 || status === 410 || status === 400)
  {
    return { kind: 'not_found', status };
  }
  return { kind: 'http_error', status };
}

export class FetchMediaProbe implements MediaProbe
{
  constructor(private readonly fetchImplementation: typeof fetch, private readonly timeoutMs = 5000)
  {
  }

  async probe(url: string): Promise<MediaProbeResult>
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try
    {
      const response = await this.fetchImplementation(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: controller.signal });
      return classifyProbeStatus(response.status);
    }
    catch
    {
      return { kind: 'unreachable' };
    }
    finally
    {
      clearTimeout(timer);
    }
  }
}
