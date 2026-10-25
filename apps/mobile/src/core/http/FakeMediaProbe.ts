import type { MediaProbe, MediaProbeResult } from '../media';

export class FakeMediaProbe implements MediaProbe
{
  readonly probedUrls: string[] = [];

  constructor(public result: MediaProbeResult = { kind: 'reachable', status: 206 })
  {
  }

  async probe(url: string): Promise<MediaProbeResult>
  {
    this.probedUrls.push(url);
    return this.result;
  }
}
