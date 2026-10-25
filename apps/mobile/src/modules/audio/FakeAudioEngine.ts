import { IDLE_STATUS, type AudioEngine, type EngineStatus, type TrackMetadata } from './AudioEngine';

export class FakeAudioEngine implements AudioEngine
{
  loads: { uri: string; startAtSeconds: number; autoPlay: boolean; metadata: TrackMetadata }[] = [];
  private current: EngineStatus = IDLE_STATUS;
  private readonly listeners = new Set<(status: EngineStatus) => void>();
  failNextLoad = false;

  async load(uri: string, metadata: TrackMetadata, startAtSeconds: number, autoPlay: boolean): Promise<void>
  {
    this.loads.push({ uri, startAtSeconds, autoPlay, metadata });
    if (this.failNextLoad)
    {
      this.failNextLoad = false;
      this.emit({ ...this.current, state: 'error', errorMessage: 'load failed' });
      return;
    }
    this.emit({ state: autoPlay ? 'playing' : 'paused', positionSeconds: startAtSeconds, durationSeconds: 120, rate: this.current.rate, errorMessage: null });
  }

  play(): void
  {
    this.emit({ ...this.current, state: 'playing' });
  }

  pause(): void
  {
    this.emit({ ...this.current, state: 'paused' });
  }

  async seekTo(seconds: number): Promise<void>
  {
    this.emit({ ...this.current, positionSeconds: Math.max(0, Math.min(seconds, this.current.durationSeconds)) });
  }

  setRate(rate: number): void
  {
    this.emit({ ...this.current, rate });
  }

  stop(): void
  {
    this.emit({ ...IDLE_STATUS, rate: this.current.rate });
  }

  status(): EngineStatus
  {
    return this.current;
  }

  subscribe(listener: (status: EngineStatus) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  advance(seconds: number): void
  {
    this.emit({ ...this.current, positionSeconds: this.current.positionSeconds + seconds });
  }

  finish(): void
  {
    this.emit({ ...this.current, state: 'ended', positionSeconds: this.current.durationSeconds });
  }

  buffer(): void
  {
    this.emit({ ...this.current, state: 'buffering' });
  }

  private emit(status: EngineStatus): void
  {
    this.current = status;
    for (const listener of this.listeners)
    {
      listener(status);
    }
  }
}
