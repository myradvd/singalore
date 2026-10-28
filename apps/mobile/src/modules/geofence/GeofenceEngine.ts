import type { AppEventBus } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { DiagnosticsRecorder } from '@/core/diagnostics';
import type { GeofenceTarget, LocationFix, PlaybackStatusProvider } from '@/core/location';
import { GeofenceEvaluator } from './GeofenceEvaluator';
import { selectOsWindow, sameRegions, shouldRefreshWindow, type OsRegion } from './osWindow';
import { decidePrompt } from './promptPolicy';

export interface GeofenceSettings
{
  geofenceTriggersEnabled: boolean;
  autoplayEnabled: boolean;
}

export interface OsGeofencer
{
  setRegions(regions: OsRegion[]): Promise<void>;
  clear(): Promise<void>;
}

export interface ActivePrompt
{
  landmarkId: string;
  triggeredAt: number;
  forced: boolean;
}

export interface GeofenceState
{
  prompt: ActivePrompt | null;
  nextUpLandmarkId: string | null;
  outOfRange: { landmarkId: string; at: number } | null;
  insideLandmarkIds: string[];
  osRegionIds: string[];
}

export interface GeofenceEngineDependencies
{
  events: AppEventBus;
  clock: Clock;
  diagnostics: DiagnosticsRecorder;
  targets: () => readonly GeofenceTarget[];
  settings: () => GeofenceSettings;
  playback: PlaybackStatusProvider;
  osGeofencer: OsGeofencer;
}
/**
 * Control class for geofencing (GeofenceMonitor in the design).
 * Feeds each location fix to GeofenceEvaluator, applies the prompt rules
 * (settings, already played, dismissed in the last 10 minutes, audio already playing),
 * and keeps the OS geofence window registered for background wake-ups.
 */
export class GeofenceEngine
{
  private readonly evaluator = new GeofenceEvaluator();
  private readonly dismissedAt = new Map<string, number>();
  private readonly playedInTour = new Set<string>();
  private readonly listeners = new Set<(state: GeofenceState) => void>();
  private unsubscribers: (() => void)[] = [];
  private windowCenter: { latitude: number; longitude: number } | null = null;
  private osRegions: OsRegion[] = [];
  private state: GeofenceState = { prompt: null, nextUpLandmarkId: null, outOfRange: null, insideLandmarkIds: [], osRegionIds: [] };

  constructor(private readonly dependencies: GeofenceEngineDependencies)
  {
  }
/** Starts listening to location fixes and playback events. */
  start(): void
  {
    const { events } = this.dependencies;
    this.unsubscribers = [
      events.on('location/fix', (fix) => this.handleFix(fix)),
      events.on('audio/started', ({ landmarkId }) => this.handlePlaybackStarted(landmarkId)),
      events.on('audio/ended', () => this.handlePlaybackEnded()),
    ];
  }

  stop(): void
  {
    for (const unsubscribe of this.unsubscribers)
    {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  getState(): GeofenceState
  {
    return this.state;
  }

  subscribe(listener: (state: GeofenceState) => void): () => void
  {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
/**
 * Processes one location fix: emits geofence/enter and geofence/exit events,
 * updates the prompt state, and refreshes the OS geofence window.
 */
  handleFix(fix: LocationFix): void
  {
    const targets = this.dependencies.targets();
    const transitions = this.evaluator.evaluate(fix, targets);
    for (const transition of transitions)
    {
      if (transition.type === 'enter')
      {
        this.dependencies.events.emit('geofence/enter', { landmarkId: transition.landmarkId, at: transition.at, distanceMeters: transition.distanceMeters, source: 'foreground' });
        this.handleEnter(transition.landmarkId, transition.at, targets);
      }
      else
      {
        this.dependencies.events.emit('geofence/exit', { landmarkId: transition.landmarkId, at: transition.at });
        this.handleExit(transition.landmarkId, transition.at);
      }
    }
    this.update({ insideLandmarkIds: this.evaluator.insideLandmarkIds() });
    void this.refreshOsWindow(fix, targets);
  }
/** Debug tool: shows the podcast prompt for a landmark without checking distance. */
  forcePrompt(landmarkId: string): void
  {
    this.update({ prompt: { landmarkId, triggeredAt: this.dependencies.clock.now(), forced: true } });
    this.dependencies.events.emit('geofence/enter', { landmarkId, at: this.dependencies.clock.now(), distanceMeters: 0, source: 'forced' });
  }

  presentPrompt(landmarkId: string): void
  {
    this.update({ prompt: { landmarkId, triggeredAt: this.dependencies.clock.now(), forced: false } });
  }

  targetName(landmarkId: string): string
  {
    return this.dependencies.targets().find((target) => target.landmarkId === landmarkId)?.name ?? 'a heritage site';
  }

  clearPrompt(): void
  {
    this.update({ prompt: null, nextUpLandmarkId: null });
  }
/** Walker tapped Play on the prompt: closes it and requests playback of that landmark's podcast. */
  acceptPrompt(): void
  {
    const prompt = this.state.prompt;
    if (prompt === null)
    {
      return;
    }
    this.update({ prompt: null });
    this.dependencies.events.emit('audio/playLandmarkRequested', { landmarkId: prompt.landmarkId, reason: 'prompt_accepted' });
  }
/** Walker dismissed the prompt: that landmark will not prompt again for 10 minutes unless they leave and re-enter. */
  dismissPrompt(): void
  {
    const prompt = this.state.prompt;
    if (prompt === null)
    {
      return;
    }
    this.dismissedAt.set(prompt.landmarkId, this.dependencies.clock.now());
    this.update({ prompt: null });
  }

  dismissOutOfRange(): void
  {
    this.update({ outOfRange: null });
  }
/** Clears the list of landmarks already played, at the start of a new tour. */
  resetTour(): void
  {
    this.playedInTour.clear();
    this.update({ nextUpLandmarkId: null });
  }
/** Turns geofencing off (Geofence triggers setting): clears prompts and unregisters all OS regions. */
  async disable(): Promise<void>
  {
    this.windowCenter = null;
    this.osRegions = [];
    this.update({ prompt: null, nextUpLandmarkId: null, osRegionIds: [] });
    await this.dependencies.osGeofencer.clear();
  }

  isInside(landmarkId: string): boolean
  {
    return this.evaluator.insideLandmarkIds().includes(landmarkId);
  }

  private handleEnter(landmarkId: string, at: number, targets: readonly GeofenceTarget[]): void
  {
    const target = targets.find((candidate) => candidate.landmarkId === landmarkId);
    const settings = this.dependencies.settings();
    const decision = decidePrompt(landmarkId, {
      geofenceTriggersEnabled: settings.geofenceTriggersEnabled,
      autoplayEnabled: settings.autoplayEnabled,
      hasPodcast: target?.hasPodcast ?? false,
      audioPlaying: this.dependencies.playback.isPlaying(),
      playingLandmarkId: this.dependencies.playback.currentLandmarkId(),
      playedInTour: this.playedInTour,
      dismissedAt: this.dismissedAt,
      now: at,
    });
    switch (decision.action)
    {
      case 'prompt':
        this.update({ prompt: { landmarkId, triggeredAt: at, forced: false } });
        return;
      case 'autoplay':
        this.update({ prompt: null });
        this.dependencies.events.emit('audio/playLandmarkRequested', { landmarkId, reason: 'autoplay' });
        return;
      case 'next_up':
        this.update({ nextUpLandmarkId: landmarkId });
        return;
      case 'suppress':
        void this.dependencies.diagnostics.record('info', `prompt_suppressed_${decision.reason}`);
        return;
    }
  }

  private handleExit(landmarkId: string, at: number): void
  {
    this.dismissedAt.delete(landmarkId);
    const changes: Partial<GeofenceState> = {};
    if (this.state.prompt?.landmarkId === landmarkId && !this.state.prompt.forced)
    {
      changes.prompt = null;
    }
    if (this.state.nextUpLandmarkId === landmarkId)
    {
      changes.nextUpLandmarkId = null;
    }
    if (this.dependencies.playback.isPlaying() && this.dependencies.playback.currentLandmarkId() === landmarkId)
    {
      changes.outOfRange = { landmarkId, at };
    }
    this.update(changes);
  }

  private handlePlaybackStarted(landmarkId: string): void
  {
    this.playedInTour.add(landmarkId);
    const changes: Partial<GeofenceState> = { outOfRange: null };
    if (this.state.nextUpLandmarkId === landmarkId)
    {
      changes.nextUpLandmarkId = null;
    }
    if (this.state.prompt?.landmarkId === landmarkId)
    {
      changes.prompt = null;
    }
    this.update(changes);
  }

  private handlePlaybackEnded(): void
  {
    const nextUp = this.state.nextUpLandmarkId;
    this.update({ outOfRange: null });
    if (nextUp === null)
    {
      return;
    }
    this.update({ nextUpLandmarkId: null });
    if (!this.isInside(nextUp))
    {
      return;
    }
    if (this.dependencies.settings().autoplayEnabled)
    {
      this.dependencies.events.emit('audio/playLandmarkRequested', { landmarkId: nextUp, reason: 'queued' });
    }
    else
    {
      this.update({ prompt: { landmarkId: nextUp, triggeredAt: this.dependencies.clock.now(), forced: false } });
    }
  }

  private async refreshOsWindow(fix: LocationFix, targets: readonly GeofenceTarget[]): Promise<void>
  {
    if (!this.dependencies.settings().geofenceTriggersEnabled)
    {
      if (this.osRegions.length > 0)
      {
        await this.disable();
      }
      return;
    }
    if (!shouldRefreshWindow(this.windowCenter, fix.latitude, fix.longitude))
    {
      return;
    }
    this.windowCenter = { latitude: fix.latitude, longitude: fix.longitude };
    const regions = selectOsWindow(targets, fix.latitude, fix.longitude);
    if (sameRegions(regions, this.osRegions))
    {
      return;
    }
    this.osRegions = regions;
    this.update({ osRegionIds: regions.map((region) => region.identifier) });
    try
    {
      await this.dependencies.osGeofencer.setRegions(regions);
    }
    catch (error)
    {
      await this.dependencies.diagnostics.record('warn', 'os_geofence_register_failed', error instanceof Error ? error.message : 'unknown');
    }
  }

  private update(partial: Partial<GeofenceState>): void
  {
    if (Object.keys(partial).length === 0)
    {
      return;
    }
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners)
    {
      listener(this.state);
    }
  }
}
