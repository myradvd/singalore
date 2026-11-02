import type { AudioController } from '@/modules/audio/AudioController';
import type { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';

// Prepares the prompted episode while a prompt shows and releases it once the prompt goes.
export function wirePromptAudio(geofence: GeofenceEngine, audio: AudioController): () => void
{
  return geofence.subscribe((state) =>
  {
    if (state.prompt !== null)
    {
      void audio.prepare(state.prompt.landmarkId);
    }
    else
    {
      audio.discardPrepared();
    }
  });
}
