import type { AudioController } from '@/modules/audio/AudioController';
import type { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';

// Prepares the prompted episode whenever the geofence engine shows a prompt.
export function wirePromptAudio(geofence: GeofenceEngine, audio: AudioController): () => void
{
  return geofence.subscribe((state) =>
  {
    if (state.prompt !== null)
    {
      void audio.prepare(state.prompt.landmarkId);
    }
  });
}
