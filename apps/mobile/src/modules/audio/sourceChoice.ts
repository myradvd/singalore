export const OFFLINE_AUDIO_UNAVAILABLE = 'Audio file unavailable. Please reconnect to the internet and re-download.';

export type AudioSourceChoice =
  | { kind: 'local'; uri: string }
  | { kind: 'stream'; uri: string }
  | { kind: 'unavailable'; message: string };

export function chooseAudioSource(localUri: string | null, streamUrl: string, online: boolean): AudioSourceChoice
{
  if (localUri !== null)
  {
    return { kind: 'local', uri: localUri };
  }
  if (online)
  {
    return { kind: 'stream', uri: streamUrl };
  }
  return { kind: 'unavailable', message: OFFLINE_AUDIO_UNAVAILABLE };
}
