import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import type { FlowEvent, FlowState } from '@/modules/flow/flowTypes';

// Undoes the top Home layer for a back press and says whether the press was used.
export function handleHomeBack(state: FlowState, dispatch: (event: FlowEvent) => void): boolean
{
  const top = state.overlays[state.overlays.length - 1];
  if (top === 'search')
  {
    dispatch({ type: 'closeSearch' });
    return true;
  }
  if (top === 'sidebar')
  {
    dispatch({ type: 'closeSidebar' });
    return true;
  }
  if (state.screen === 'expandedMap')
  {
    dispatch({ type: 'closeExpandedMap' });
    return true;
  }
  if (state.selectedLandmarkId !== null)
  {
    dispatch({ type: 'selectLandmark', landmarkId: null });
    return true;
  }
  return false;
}

// Connects handleHomeBack to the hardware back button while Home is mounted.
export function useHomeBackHandler(): void
{
  useEffect(() =>
  {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleHomeBack(useFlowStore.getState().state, dispatchFlow));
    return () => subscription.remove();
  }, []);
}
