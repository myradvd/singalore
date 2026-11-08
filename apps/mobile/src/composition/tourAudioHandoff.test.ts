import { createAppEventBus } from '@/core/appEvents';
import { flowReducer, INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import type { FlowState } from '@/modules/flow/flowTypes';
import { upNextMessage, wireTourAudioHandoff } from './tourAudioHandoff';

const NAMES: Record<string, string> = { a: 'CHIJMES', b: 'Raffles Hotel', c: 'Armenian Church' };

// Builds the handoff with a real flow reducer, a stubbed queue and recorded side effects.
function setup(flow: FlowState, options: { queued?: string | null; active?: boolean } = {})
{
  const events = createAppEventBus();
  let state = flow;
  const effects: string[] = [];
  const toasts: string[] = [];
  const notifications: string[] = [];
  let stops = 0;
  wireTourAudioHandoff({
    events,
    flow: () => state,
    dispatch: (event) =>
    {
      const transition = flowReducer(state, event);
      state = transition.state;
      effects.push(...transition.effects.map((effect) => effect.type));
    },
    queuedLandmarkId: () => options.queued ?? null,
    landmarkName: (landmarkId) => NAMES[landmarkId] ?? 'your next stop',
    stopAudio: () =>
    {
      stops += 1;
    },
    toast: (message) => toasts.push(message),
    notify: (_title, body) => notifications.push(body),
    isAppActive: () => options.active ?? true,
    now: () => 1000,
  });
  return { events, state: () => state, effects, toasts, notifications, stops: () => stops };
}

// A tour in progress over three stops, with the given stops already visited.
function tour(visitedLandmarkIds: string[] = []): FlowState
{
  return { ...INITIAL_FLOW_STATE, base: 'inProgress', screen: 'navigation', itinerary: ['a', 'b', 'c'], tourStartedAt: 0, visitedLandmarkIds };
}

describe('tour audio handoff (walk, arrive, listen, move on)', () =>
{
  it('an episode ending on a tour marks its stop visited, closes the player and points to the next stop', () =>
  {
    const harness = setup(tour());
    harness.events.emit('audio/ended', { landmarkId: 'a', podcastId: 'p-a' });
    expect(harness.state().visitedLandmarkIds).toEqual(['a']);
    expect(harness.stops()).toBe(1);
    expect(harness.toasts).toEqual([upNextMessage('Raffles Hotel')]);
    expect(harness.notifications).toEqual([]);
  });

  it('also notifies when the app is in the background', () =>
  {
    const harness = setup(tour(['a']), { active: false });
    harness.events.emit('audio/ended', { landmarkId: 'a', podcastId: 'p-a' });
    expect(harness.notifications).toEqual([upNextMessage('Raffles Hotel')]);
  });

  it('leaves a queued next-up episode to the geofence engine', () =>
  {
    const harness = setup(tour(), { queued: 'b' });
    harness.events.emit('audio/ended', { landmarkId: 'a', podcastId: 'p-a' });
    expect(harness.state().visitedLandmarkIds).toEqual(['a']);
    expect(harness.stops()).toBe(0);
    expect(harness.toasts).toEqual([]);
  });

  it('the last stop completes the tour without an up next message', () =>
  {
    const harness = setup(tour(['a', 'b']));
    harness.events.emit('audio/ended', { landmarkId: 'c', podcastId: 'p-c' });
    expect(harness.effects).toContain('tourCompleted');
    expect(harness.stops()).toBe(0);
    expect(harness.toasts).toEqual([]);
  });

  it('does nothing outside a tour', () =>
  {
    const harness = setup(INITIAL_FLOW_STATE);
    harness.events.emit('audio/ended', { landmarkId: 'a', podcastId: 'p-a' });
    expect(harness.state()).toBe(INITIAL_FLOW_STATE);
    expect(harness.stops()).toBe(0);
    expect(harness.toasts).toEqual([]);
  });
});
