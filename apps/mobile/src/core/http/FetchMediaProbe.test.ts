import { FetchMediaProbe, classifyProbeStatus } from './FetchMediaProbe';

describe('FetchMediaProbe', () =>
{
  it('classifies HTTP statuses', () =>
  {
    expect(classifyProbeStatus(206)).toEqual({ kind: 'reachable', status: 206 });
    expect(classifyProbeStatus(404)).toEqual({ kind: 'not_found', status: 404 });
    expect(classifyProbeStatus(400)).toEqual({ kind: 'not_found', status: 400 });
    expect(classifyProbeStatus(500)).toEqual({ kind: 'http_error', status: 500 });
  });

  it('asks for one byte and reports thrown requests as unreachable', async () =>
  {
    const requests: RequestInit[] = [];
    const ok = new FetchMediaProbe(async (_url, init) =>
    {
      requests.push(init ?? {});
      return new Response(null, { status: 206 });
    });
    expect(await ok.probe('https://cdn.test/a.m4a')).toEqual({ kind: 'reachable', status: 206 });
    expect(requests[0]?.headers).toEqual({ Range: 'bytes=0-0' });
    const down = new FetchMediaProbe(async () =>
    {
      throw new TypeError('Network request failed');
    });
    expect(await down.probe('https://cdn.test/a.m4a')).toEqual({ kind: 'unreachable' });
  });
});
