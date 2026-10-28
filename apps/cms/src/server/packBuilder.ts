import { PackResponse, type PackFile } from '@singalore/shared';
import { computeEtag, mediaUrl } from './catalogBuilder';

export interface PackLandmarkRow
{
  id: string;
  description: string;
  image_path: string | null;
  image_bytes: number | null;
}

export interface PackPodcastRow
{
  id: string;
  landmark_id: string;
  audio_path: string;
  file_size_bytes: number;
  checksum_sha256: string;
  checksum_md5: string;
  transcript: string | null;
}
/**
 * Builds the offline pack for one park (GET /api/v1/parks/:id/pack).
 * Lists every audio and image file with its size, and checksums for audio,
 * so the app can verify downloads. Also includes long descriptions and transcripts.
 * @param parkId - Park being downloaded.
 * @param landmarks - Published landmarks in the park.
 * @param podcasts - Published podcasts (filtered to this park's landmarks).
 * @param mediaBase - Public media base URL.
 * @param generatedAt - Time stamped into the response.
 * @returns A validated PackResponse.
 */
export function buildPack(parkId: string, landmarks: PackLandmarkRow[], podcasts: PackPodcastRow[], mediaBase: string, generatedAt: Date): PackResponse
{
  const landmarkIds = new Set(landmarks.map((landmark) => landmark.id));
  const parkPodcasts = podcasts.filter((podcast) => landmarkIds.has(podcast.landmark_id)).sort((a, b) => a.id.localeCompare(b.id));
  const sortedLandmarks = [...landmarks].sort((a, b) => a.id.localeCompare(b.id));
  const files: PackFile[] = [
    ...parkPodcasts.map((podcast) => ({
      kind: 'audio' as const,
      url: mediaUrl(mediaBase, podcast.audio_path) ?? '',
      bytes: podcast.file_size_bytes,
      sha256: podcast.checksum_sha256,
      md5: podcast.checksum_md5,
      podcastId: podcast.id,
      landmarkId: podcast.landmark_id,
    })),
    ...sortedLandmarks.flatMap((landmark) =>
    {
      const url = mediaUrl(mediaBase, landmark.image_path);
      return url === null || landmark.image_bytes === null
        ? []
        : [{ kind: 'image' as const, url, bytes: landmark.image_bytes, sha256: null, md5: null, podcastId: null, landmarkId: landmark.id }];
    }),
  ];
  const content = {
    parkId,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    landmarks: sortedLandmarks.map((landmark) => ({ landmarkId: landmark.id, description: landmark.description, imageUrl: mediaUrl(mediaBase, landmark.image_path) })),
    podcasts: parkPodcasts.map((podcast) => ({ podcastId: podcast.id, transcript: podcast.transcript })),
    files,
  };
  return PackResponse.parse({ schemaVersion: 1, etag: computeEtag(content), generatedAt: generatedAt.toISOString(), ...content });
}
