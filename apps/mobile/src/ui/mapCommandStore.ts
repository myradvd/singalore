import { create } from 'zustand';
import type { MapLayerSettings } from './map/mapTypes';

export type MapFocusRequest =
  | { kind: 'landmark'; landmarkId: string }
  | { kind: 'park'; parkId: string };

interface MapUiState
{
  pendingFocus: MapFocusRequest | null;
  layers: MapLayerSettings;
  requestFocus: (request: MapFocusRequest) => void;
  consumeFocus: () => MapFocusRequest | null;
  setLayers: (layers: Partial<MapLayerSettings>) => void;
}

export const useMapUiStore = create<MapUiState>((set, get) => ({
  pendingFocus: null,
  layers: { baseLayer: 'standard', showHeritageBoundaries: true },
  requestFocus: (request) => set({ pendingFocus: request }),
  consumeFocus: () =>
  {
    const pending = get().pendingFocus;
    if (pending !== null)
    {
      set({ pendingFocus: null });
    }
    return pending;
  },
  setLayers: (layers) => set((state) => ({ layers: { ...state.layers, ...layers } })),
}));
