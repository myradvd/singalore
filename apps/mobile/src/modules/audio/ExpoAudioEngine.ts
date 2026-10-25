import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { IDLE_STATUS, type AudioEngine, type EngineStatus, type TrackMetadata } from './AudioEngine';

export function mapExpoStatus(status: AudioStatus, rate: number, wantsPlay: boolean): EngineStatus
{
  let state: EngineStatus['state'];
  if (status.error !== null && status.error !== undefined)
  {
    state = 'error';
  }
  else if (status.didJustFinish)
  {
    state = 'ended';
  }
  else if (!status.isLoaded)
  {
    state = 'loading';
  }
  else if (status.isBuffering && wantsPlay)
  {
    state = 'buffering';
  }
  else
  {
    state = status.playing ? 'playing' : 'paused';
  }
  return {
    state,
    positionSeconds: status.currentTime,
    durationSeconds: Number.isFinite(status.duration) ? status.duration : 0,
    rate,
    errorMessage: status.error ?? null,
  };
}

export class ExpoAudioEngine implements AudioEngine
{
  private player: AudioPlayer | null = null;
  private subscription: { remove(): void } | null = null;
  private current: EngineStatus = IDLE_STATUS;
  private readonly listeners = new Set<(status: EngineStatus) => void>();
  private rate = 1;
  private wantsPlay = false;
  private modeConfigured = false;

  async load(uri: string, metadata: TrackMetadata, startAtSeconds: number, autoPlay: boolean): Promise<void>
  {
    if (!this.modeConfigured)
    {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      this.modeConfigured = true;
    }
    this.stop();
    this.emit({ ...IDLE_STATUS, state: 'loading', rate: this.rate });
    const player = createAudioPlayer({ uri }, { updateInterval: 500 });
    this.player = player;
    this.wantsPlay = autoPlay;
    this.subscription = player.addListener('playbackStatusUpdate', (status) => this.emit(mapExpoStatus(status, this.rate, this.wantsPlay)));
    player.setPlaybackRate(this.rate);
    player.setActiveForLockScreen(true, { title: metadata.title, artist: metadata.artist, ...(metadata.artworkUrl === null ? {} : { artworkUrl: metadata.artworkUrl }) }, { showSeekBackward: true, showSeekForward: true });
    if (startAtSeconds > 0)
    {
      await player.seekTo(startAtSeconds);
    }
    if (autoPlay)
    {
      player.play();
    }
  }

  play(): void
  {
    this.wantsPlay = true;
    this.player?.play();
  }

  pause(): void
  {
    this.wantsPlay = false;
    this.player?.pause();
  }

  async seekTo(seconds: number): Promise<void>
  {
    await this.player?.seekTo(Math.max(0, seconds));
  }

  setRate(rate: number): void
  {
    this.rate = rate;
    this.player?.setPlaybackRate(rate);
    this.emit({ ...this.current, rate });
  }

  stop(): void
  {
    this.subscription?.remove();
    this.subscription = null;
    if (this.player !== null)
    {
      this.player.clearLockScreenControls();
      this.player.remove();
      this.player = null;
    }
    this.wantsPlay = false;
    this.emit({ ...IDLE_STATUS, rate: this.rate });
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

  private emit(status: EngineStatus): void
  {
    this.current = status;
    for (const listener of this.listeners)
    {
      listener(status);
    }
  }
}
