import { create } from 'zustand';
import { INITIAL_FLOW_STATE, flowReducer, toFlowCache } from './flowReducer';
import type { FlowCachePayload, FlowEffect, FlowEvent, FlowState } from './flowTypes';

export interface FlowRuntime
{
  onEffect: (effect: FlowEffect) => void;
  persist: (cache: FlowCachePayload) => void;
}

let runtime: FlowRuntime = {
  onEffect: () =>
  {
  },
  persist: () =>
  {
  },
};

export function configureFlowRuntime(next: FlowRuntime): void
{
  runtime = next;
}

interface FlowStore
{
  state: FlowState;
  dispatch: (event: FlowEvent) => void;
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  state: INITIAL_FLOW_STATE,
  dispatch: (event) =>
  {
    const previous = get().state;
    const transition = flowReducer(previous, event);
    if (transition.state !== previous)
    {
      set({ state: transition.state });
      const previousCache = JSON.stringify(toFlowCache(previous));
      const nextCache = toFlowCache(transition.state);
      if (JSON.stringify(nextCache) !== previousCache || event.type === 'restoreFromCache')
      {
        runtime.persist(nextCache);
      }
    }
    for (const effect of transition.effects)
    {
      runtime.onEffect(effect);
    }
  },
}));

export function dispatchFlow(event: FlowEvent): void
{
  useFlowStore.getState().dispatch(event);
}
