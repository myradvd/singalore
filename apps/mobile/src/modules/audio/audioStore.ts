import { create } from 'zustand';
import { IDLE_STATUS } from './AudioEngine';
import type { AudioController, AudioControllerState } from './AudioController';

export const useAudioStore = create<AudioControllerState>(() => ({ track: null, status: IDLE_STATUS, resumeOffer: null, lastError: null }));

export function bindAudioStore(controller: AudioController): () => void
{
  useAudioStore.setState(controller.getState());
  return controller.subscribe((state) => useAudioStore.setState(state));
}
