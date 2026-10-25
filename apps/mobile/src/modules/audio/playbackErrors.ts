import type { MediaProbeResult } from '@/core/media';

export type PlaybackFailureKind = 'no_audio' | 'file_not_found' | 'network_unreachable' | 'server_error' | 'local_file_unplayable' | 'unplayable';

export const PLAYBACK_ERROR_MESSAGES: Record<PlaybackFailureKind, string> = {
  no_audio: 'There is no audio for this site yet.',
  file_not_found: 'The audio file for this podcast was not found on the server.',
  network_unreachable: 'Could not reach the audio server. Check your connection and try again.',
  server_error: 'The audio server returned an error. Try again later.',
  local_file_unplayable: 'The downloaded audio file could not be played. Re-download this park in Manage Downloads.',
  unplayable: 'This audio file could not be played.',
};

export function classifyStreamFailure(probe: MediaProbeResult): PlaybackFailureKind
{
  switch (probe.kind)
  {
    case 'not_found':
      return 'file_not_found';
    case 'unreachable':
      return 'network_unreachable';
    case 'http_error':
      return 'server_error';
    case 'reachable':
      return 'unplayable';
  }
}
