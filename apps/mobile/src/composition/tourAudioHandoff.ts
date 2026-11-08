import type { AppEventBus } from '@/core/appEvents';
import { nextUnvisitedStop } from '@/modules/flow/flowReducer';
import type { FlowEvent, FlowState } from '@/modules/flow/flowTypes';

export interface TourAudioHandoffDependencies
{
  events: AppEventBus;
  flow: () => FlowState;
  dispatch: (event: FlowEvent) => void;
  queuedLandmarkId: () => string | null;
  landmarkName: (landmarkId: string) => string;
  stopAudio: () => void;
  toast: (message: string) => void;
  notify: (title: string, body: string) => void;
  isAppActive: () => boolean;
  now: () => number;
}

// Builds the "head to the next stop" message shown when an episode finishes on a tour.
export function upNextMessage(name: string): string
{
  return `Up next: ${name}. Head there to hear its story.`;
}

/**
 * When an episode ends during a tour: marks its stop visited, then, unless another
 * stop's episode is already queued, closes the player and points the walker to the
 * next stop. The next episode plays only when the walker arrives there.
 * Must be registered before GeofenceEngine.start, which clears the queue on the same event.
 */
export function wireTourAudioHandoff(dependencies: TourAudioHandoffDependencies): () => void
{
  return dependencies.events.on('audio/ended', ({ landmarkId }) =>
  {
    if (dependencies.flow().base !== 'inProgress')
    {
      return;
    }
    dependencies.dispatch({ type: 'markVisited', landmarkId, at: dependencies.now() });
    if (dependencies.queuedLandmarkId() !== null)
    {
      return;
    }
    const next = nextUnvisitedStop(dependencies.flow());
    if (next === null)
    {
      return;
    }
    dependencies.stopAudio();
    const message = upNextMessage(dependencies.landmarkName(next));
    dependencies.toast(message);
    if (!dependencies.isAppActive())
    {
      dependencies.notify('Episode finished', message);
    }
  });
}
