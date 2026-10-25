import { createHash } from 'node:crypto';
import { parseBuffer } from 'music-metadata';

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const AUDIO_TYPES: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3' };

export interface AudioAnalysis
{
  durationSeconds: number;
  fileSizeBytes: number;
  sha256: string;
  md5: string;
  lengthClass: 'short' | 'standard' | 'long';
  extension: string;
}

export class AudioRejectedError extends Error
{
}

export function lengthClassFor(durationSeconds: number): AudioAnalysis['lengthClass']
{
  if (durationSeconds < 60)
  {
    return 'short';
  }
  return durationSeconds < 300 ? 'standard' : 'long';
}

export async function analyseAudio(bytes: Uint8Array, mimeType: string): Promise<AudioAnalysis>
{
  const extension = AUDIO_TYPES[mimeType];
  if (extension === undefined)
  {
    throw new AudioRejectedError('Upload an M4A, AAC or MP3 audio file.');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_BYTES)
  {
    throw new AudioRejectedError('Audio files must be between 1 byte and 50 MB.');
  }
  let duration: number | undefined;
  try
  {
    duration = (await parseBuffer(bytes, { mimeType }, { duration: true })).format.duration;
  }
  catch
  {
    throw new AudioRejectedError('The audio file could not be read.');
  }
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0)
  {
    throw new AudioRejectedError('The audio file has no playable length.');
  }
  const durationSeconds = Math.max(1, Math.round(duration));
  return {
    durationSeconds,
    fileSizeBytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    md5: createHash('md5').update(bytes).digest('hex'),
    lengthClass: lengthClassFor(durationSeconds),
    extension,
  };
}
