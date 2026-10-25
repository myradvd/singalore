export const DISMISS_SUPPRESSION_MS = 10 * 60 * 1000;

export interface PromptContext
{
  geofenceTriggersEnabled: boolean;
  autoplayEnabled: boolean;
  hasPodcast: boolean;
  audioPlaying: boolean;
  playingLandmarkId: string | null;
  playedInTour: ReadonlySet<string>;
  dismissedAt: ReadonlyMap<string, number>;
  now: number;
}

export type PromptDecision =
  | { action: 'prompt' }
  | { action: 'autoplay' }
  | { action: 'next_up' }
  | { action: 'suppress'; reason: 'triggers_off' | 'no_podcast' | 'already_played' | 'recently_dismissed' | 'already_playing' };

export function decidePrompt(landmarkId: string, context: PromptContext): PromptDecision
{
  if (!context.geofenceTriggersEnabled)
  {
    return { action: 'suppress', reason: 'triggers_off' };
  }
  if (!context.hasPodcast)
  {
    return { action: 'suppress', reason: 'no_podcast' };
  }
  if (context.playingLandmarkId === landmarkId)
  {
    return { action: 'suppress', reason: 'already_playing' };
  }
  if (context.playedInTour.has(landmarkId))
  {
    return { action: 'suppress', reason: 'already_played' };
  }
  const dismissed = context.dismissedAt.get(landmarkId);
  if (dismissed !== undefined && context.now - dismissed < DISMISS_SUPPRESSION_MS)
  {
    return { action: 'suppress', reason: 'recently_dismissed' };
  }
  if (context.audioPlaying)
  {
    return { action: 'next_up' };
  }
  return context.autoplayEnabled ? { action: 'autoplay' } : { action: 'prompt' };
}
