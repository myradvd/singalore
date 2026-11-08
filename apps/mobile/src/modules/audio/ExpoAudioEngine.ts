import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { IDLE_STATUS, type AudioEngine, type EngineStatus, type TrackMetadata } from './AudioEngine';

export function mapExpoStatus(status: AudioStatus, rate: number, wantsPlay: boolean, finished = false): EngineStatus
{
  let state: EngineStatus['state'];
  const durationSeconds = Number.isFinite(status.duration) ? status.duration : 0;
  if (status.error !== null && status.error !== undefined)
  {
    state = 'error';
  }
  else if (status.didJustFinish || (finished && !status.playing))
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
    positionSeconds: state === 'ended' && durationSeconds > 0 ? durationSeconds : status.currentTime,
    durationSeconds,
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
  private lockScreenMetadata: TrackMetadata | null = null;
  private latestLoadRequest = 0;
  // didJustFinish arrives on one update only, so the engine remembers the finish until the walker plays or seeks again.
  private finished = false;

  async load(uri: string, metadata: TrackMetadata, startAtSeconds: number, autoPlay: boolean): Promise<void>
  {
    this.latestLoadRequest += 1;
    const request = this.latestLoadRequest;
    if (!this.modeConfigured)
    {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      this.modeConfigured = true;
    }
    if (request !== this.latestLoadRequest)
    {
      return;
    }
    this.releasePlayer();
    this.emit({ ...IDLE_STATUS, state: 'loading', rate: this.rate });
    const player = createAudioPlayer({ uri }, { updateInterval: 500 });
    this.player = player;
    this.wantsPlay = autoPlay;
    this.subscription = player.addListener('playbackStatusUpdate', (status) => this.handlePlayerStatus(status));
    player.setPlaybackRate(this.rate);
    this.lockScreenMetadata = metadata;
    if (autoPlay)
    {
      this.activateLockScreen();
    }
    if (startAtSeconds > 0)
    {
      await player.seekTo(startAtSeconds);
    }
    if (autoPlay && this.player === player)
    {
      player.play();
    }
  }

  play(): void
  {
    this.finished = false;
    this.wantsPlay = true;
    this.activateLockScreen();
    this.player?.play();
  }

  pause(): void
  {
    this.wantsPlay = false;
    this.player?.pause();
  }

  async seekTo(seconds: number): Promise<void>
  {
    const duration = this.current.durationSeconds;
    if (duration <= 0 || seconds < duration)
    {
      this.finished = false;
    }
    await this.player?.seekTo(Math.max(0, seconds));
  }

  setRate(rate: number): void
  {
    this.rate = rate;
    this.player?.setPlaybackRate(rate);
    this.emit({ ...this.current, rate });
  }

  // Stops playback, cancels any load still waiting, and frees the native player.
  stop(): void
  {
    this.latestLoadRequest += 1;
    this.releasePlayer();
  }

  // Pauses, removes and releases the current player, because remove alone leaves native audio playing.
  private releasePlayer(): void
  {
    this.subscription?.remove();
    this.subscription = null;
    if (this.player !== null)
    {
      const player = this.player;
      this.player = null;
      player.pause();
      player.clearLockScreenControls();
      player.remove();
      player.release();
    }
    this.wantsPlay = false;
    this.finished = false;
    this.lockScreenMetadata = null;
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

  // Shows the lock screen controls once, when the track first plays, because their Play action bypasses the app.
  private activateLockScreen(): void
  {
    const metadata = this.lockScreenMetadata;
    if (metadata !== null)
    {
      this.lockScreenMetadata = null;
      this.player?.setActiveForLockScreen(true, { title: metadata.title, artist: metadata.artist, ...(metadata.artworkUrl === null ? {} : { artworkUrl: metadata.artworkUrl }) }, { showSeekBackward: true, showSeekForward: true });
    }
  }

  // Maps a native status update, keeping the track ended after didJustFinish until playback restarts.
  private handlePlayerStatus(status: AudioStatus): void
  {
    if (status.didJustFinish)
    {
      this.finished = true;
    }
    this.emit(mapExpoStatus(status, this.rate, this.wantsPlay, this.finished));
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
