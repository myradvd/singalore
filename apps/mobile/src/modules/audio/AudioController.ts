import type { CatalogPodcast } from '@singalore/shared';
import type { AppEventBus } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { DiagnosticsRecorder } from '@/core/diagnostics';
import type { ConnectivityProvider, LocalMediaResolver, MediaProbe } from '@/core/media';
import { IDLE_STATUS, SKIP_SECONDS, type AudioEngine, type EngineStatus } from './AudioEngine';
import type { AudioSessionRecord, AudioSessionRepository } from './AudioSessionRepository';
import { PLAYBACK_ERROR_MESSAGES, classifyStreamFailure, type PlaybackFailureKind } from './playbackErrors';
import { pickPodcast, type PodcastPreferences } from './pickPodcast';
import { chooseAudioSource } from './sourceChoice';

export const SESSION_SAVE_INTERVAL_MS = 5000;

export interface CurrentTrack
{
  podcastId: string;
  landmarkId: string;
  title: string;
  landmarkName: string;
  source: 'local' | 'stream';
}

export interface AudioControllerState
{
  track: CurrentTrack | null;
  status: EngineStatus;
  resumeOffer: (AudioSessionRecord & { title: string; landmarkName: string }) | null;
  lastError: string | null;
}

export interface AudioCatalogAccess
{
  podcastsForLandmark(landmarkId: string): CatalogPodcast[];
  podcastById(podcastId: string): CatalogPodcast | null;
  landmarkInfo(landmarkId: string): { name: string; thumbnailUrl: string | null } | null;
}

export interface AudioControllerDependencies
{
  engine: AudioEngine;
  sessions: AudioSessionRepository;
  events: AppEventBus;
  clock: Clock;
  diagnostics: DiagnosticsRecorder;
  catalog: AudioCatalogAccess;
  preferences: () => PodcastPreferences & { playbackRate: number };
  media: LocalMediaResolver;
  connectivity: ConnectivityProvider;
  mediaProbe: MediaProbe;
  setInterval: (callback: () => void, milliseconds: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export class AudioController
{
  private state: AudioControllerState = { track: null, status: IDLE_STATUS, resumeOffer: null, lastError: null };
  private readonly listeners = new Set<(state: AudioControllerState) => void>();
  private saveTimer: unknown = null;
  private startedTrackId: string | null = null;
  private sessionId = '';
  private currentUri: string | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor(private readonly dependencies: AudioControllerDependencies)
  {
  }

  start(): void
  {
    this.unsubscribers = [
      this.dependencies.engine.subscribe((status) => this.handleStatus(status)),
      this.dependencies.events.on('audio/playLandmarkRequested', ({ landmarkId }) => void this.playLandmark(landmarkId)),
    ];
  }

  stopListening(): void
  {
    for (const unsubscribe of this.unsubscribers)
    {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  getState(): AudioControllerState
  {
    return this.state;
  }

  subscribe(listener: (state: AudioControllerState) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isPlaying(): boolean
  {
    return ['playing', 'buffering', 'loading'].includes(this.state.status.state) && this.state.track !== null;
  }

  currentLandmarkId(): string | null
  {
    return this.state.track?.landmarkId ?? null;
  }

  async prepare(landmarkId: string): Promise<void>
  {
    if (this.isPlaying() || this.state.track?.landmarkId === landmarkId)
    {
      return;
    }
    const podcast = pickPodcast(this.dependencies.catalog.podcastsForLandmark(landmarkId), this.dependencies.preferences());
    if (podcast !== null)
    {
      await this.loadPodcast(podcast, 0, false);
    }
  }

  async playLandmark(landmarkId: string): Promise<boolean>
  {
    const podcast = pickPodcast(this.dependencies.catalog.podcastsForLandmark(landmarkId), this.dependencies.preferences());
    if (podcast === null)
    {
      this.update({ lastError: PLAYBACK_ERROR_MESSAGES.no_audio });
      await this.dependencies.diagnostics.record('warn', 'audio_no_podcast', `landmark ${landmarkId}`);
      return false;
    }
    if (this.state.track?.podcastId === podcast.id && this.state.status.state !== 'idle' && this.state.status.state !== 'error')
    {
      this.dependencies.engine.play();
      return true;
    }
    return this.loadPodcast(podcast, 0, true);
  }

  async playPodcast(podcastId: string, startAtSeconds = 0): Promise<boolean>
  {
    const podcast = this.dependencies.catalog.podcastById(podcastId);
    return podcast === null ? false : this.loadPodcast(podcast, startAtSeconds, true);
  }

  togglePlay(): void
  {
    if (this.state.track === null)
    {
      return;
    }
    if (this.state.status.state === 'playing' || this.state.status.state === 'buffering')
    {
      this.dependencies.engine.pause();
    }
    else if (this.state.status.state === 'ended')
    {
      void this.dependencies.engine.seekTo(0).then(() => this.dependencies.engine.play());
    }
    else
    {
      this.dependencies.engine.play();
    }
  }

  async skip(direction: 1 | -1): Promise<void>
  {
    const status = this.dependencies.engine.status();
    const target = Math.max(0, Math.min(status.positionSeconds + direction * SKIP_SECONDS, status.durationSeconds || Number.MAX_SAFE_INTEGER));
    await this.dependencies.engine.seekTo(target);
  }

  async seekTo(seconds: number): Promise<void>
  {
    await this.dependencies.engine.seekTo(seconds);
  }

  setRate(rate: number): void
  {
    this.dependencies.engine.setRate(rate);
  }

  async stopAndClear(): Promise<void>
  {
    this.dependencies.engine.stop();
    this.update({ track: null, status: IDLE_STATUS });
    this.startedTrackId = null;
    this.clearSaveTimer();
    await this.dependencies.sessions.clear();
  }

  async restoreSession(): Promise<void>
  {
    const record = await this.dependencies.sessions.load();
    if (record === null)
    {
      return;
    }
    const podcast = this.dependencies.catalog.podcastById(record.podcastId);
    const landmark = this.dependencies.catalog.landmarkInfo(record.landmarkId);
    if (podcast === null || landmark === null)
    {
      await this.dependencies.sessions.clear();
      return;
    }
    this.update({ resumeOffer: { ...record, title: podcast.title, landmarkName: landmark.name } });
  }

  async resumeOffered(): Promise<void>
  {
    const offer = this.state.resumeOffer;
    if (offer === null)
    {
      return;
    }
    this.update({ resumeOffer: null });
    await this.playPodcast(offer.podcastId, offer.positionMs / 1000);
  }

  async dismissResumeOffer(): Promise<void>
  {
    this.update({ resumeOffer: null });
    await this.dependencies.sessions.clear();
  }

  clearError(): void
  {
    this.update({ lastError: null });
  }

  async persistNow(): Promise<void>
  {
    const track = this.state.track;
    const status = this.state.status;
    if (track === null || status.state === 'idle' || status.state === 'loading' || status.state === 'error')
    {
      return;
    }
    if (status.state === 'ended')
    {
      await this.dependencies.sessions.clear();
      return;
    }
    await this.dependencies.sessions.save({
      sessionId: this.sessionId,
      podcastId: track.podcastId,
      landmarkId: track.landmarkId,
      positionMs: status.positionSeconds * 1000,
      playbackState: status.state,
      rate: status.rate,
      source: track.source,
      updatedAt: new Date(this.dependencies.clock.now()).toISOString(),
    });
  }

  private async loadPodcast(podcast: CatalogPodcast, startAtSeconds: number, autoPlay: boolean): Promise<boolean>
  {
    const localUri = await this.dependencies.media.localAudioUri(podcast.id);
    const choice = chooseAudioSource(localUri, podcast.audioUrl, this.dependencies.connectivity.isOnline());
    if (choice.kind === 'unavailable')
    {
      this.update({ lastError: choice.message });
      await this.dependencies.diagnostics.record('warn', 'audio_unavailable_offline');
      return false;
    }
    const landmark = this.dependencies.catalog.landmarkInfo(podcast.landmarkId);
    const landmarkName = landmark?.name ?? '';
    this.sessionId = `${podcast.id}-${this.dependencies.clock.now()}`;
    this.startedTrackId = null;
    this.currentUri = choice.uri;
    this.update({ track: { podcastId: podcast.id, landmarkId: podcast.landmarkId, title: podcast.title, landmarkName, source: choice.kind }, lastError: null, resumeOffer: null });
    this.dependencies.engine.setRate(this.dependencies.preferences().playbackRate);
    await this.dependencies.engine.load(choice.uri, { title: podcast.title, artist: `Singalore  ·  ${landmarkName}`, artworkUrl: landmark?.thumbnailUrl ?? null }, startAtSeconds, autoPlay);
    return true;
  }

  private async reportPlaybackFailure(source: CurrentTrack['source'], engineMessage: string | null): Promise<void>
  {
    const sessionId = this.sessionId;
    const uri = this.currentUri ?? 'unknown';
    let kind: PlaybackFailureKind = 'local_file_unplayable';
    let probeDetail = 'local file';
    if (source === 'stream')
    {
      const probe = await this.dependencies.mediaProbe.probe(uri);
      kind = classifyStreamFailure(probe);
      probeDetail = probe.kind === 'unreachable' ? 'probe unreachable' : `probe ${probe.kind} ${probe.status}`;
    }
    await this.dependencies.diagnostics.record('error', 'audio_playback_error', `${kind}; ${probeDetail}; ${uri}; engine: ${engineMessage ?? 'unknown'}`);
    if (sessionId === this.sessionId)
    {
      this.update({ lastError: PLAYBACK_ERROR_MESSAGES[kind] });
    }
  }

  private handleStatus(status: EngineStatus): void
  {
    const previous = this.state.status.state;
    this.update({ status });
    const track = this.state.track;
    if (track === null)
    {
      return;
    }
    if (status.state === 'playing' && this.startedTrackId !== this.sessionId)
    {
      this.startedTrackId = this.sessionId;
      this.dependencies.events.emit('audio/started', { landmarkId: track.landmarkId, podcastId: track.podcastId });
    }
    if (status.state === 'error' && previous !== 'error')
    {
      void this.reportPlaybackFailure(track.source, status.errorMessage);
    }
    if (status.state === 'ended' && previous !== 'ended')
    {
      this.dependencies.events.emit('audio/ended', { landmarkId: track.landmarkId, podcastId: track.podcastId });
    }
    if (status.state === 'playing')
    {
      this.ensureSaveTimer();
    }
    else
    {
      this.clearSaveTimer();
    }
    if (previous !== status.state)
    {
      void this.persistNow();
    }
  }

  private ensureSaveTimer(): void
  {
    if (this.saveTimer === null)
    {
      this.saveTimer = this.dependencies.setInterval(() => void this.persistNow(), SESSION_SAVE_INTERVAL_MS);
    }
  }

  private clearSaveTimer(): void
  {
    if (this.saveTimer !== null)
    {
      this.dependencies.clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private update(partial: Partial<AudioControllerState>): void
  {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners)
    {
      listener(this.state);
    }
  }
}
