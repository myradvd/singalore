export type PlaybackState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface EngineStatus
{
  state: PlaybackState;
  positionSeconds: number;
  durationSeconds: number;
  rate: number;
  errorMessage: string | null;
}

export interface TrackMetadata
{
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface AudioEngine
{
  load(uri: string, metadata: TrackMetadata, startAtSeconds: number, autoPlay: boolean): Promise<void>;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setRate(rate: number): void;
  stop(): void;
  status(): EngineStatus;
  subscribe(listener: (status: EngineStatus) => void): () => void;
}

export const IDLE_STATUS: EngineStatus = { state: 'idle', positionSeconds: 0, durationSeconds: 0, rate: 1, errorMessage: null };
export const SKIP_SECONDS = 10;
