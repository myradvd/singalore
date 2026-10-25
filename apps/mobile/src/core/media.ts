export interface LocalMediaResolver
{
  localAudioUri(podcastId: string): Promise<string | null>;
}

export interface ConnectivityProvider
{
  isOnline(): boolean;
}

export type MediaProbeResult =
  | { kind: 'reachable'; status: number }
  | { kind: 'not_found'; status: number }
  | { kind: 'http_error'; status: number }
  | { kind: 'unreachable' };

export interface MediaProbe
{
  probe(url: string): Promise<MediaProbeResult>;
}
