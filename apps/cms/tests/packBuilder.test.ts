import { describe, expect, it } from 'vitest';
import { PackResponse } from '@singalore/shared';
import { buildPack } from '@/server/packBuilder';

const parkId = '11111111-1111-4111-8111-111111111111';
const landmarkA = '22222222-2222-4222-8222-222222222222';
const landmarkB = '33333333-3333-4333-8333-333333333333';
const base = 'https://cdn.example.com/media';

describe('buildPack', () =>
{
  it('lists audio with checksums and images with sizes, plus transcripts and descriptions', () =>
  {
    const pack = buildPack(parkId, [
      { id: landmarkA, description: 'Long text A', image_path: 'images/a.jpg', image_bytes: 1000 },
      { id: landmarkB, description: 'Long text B', image_path: null, image_bytes: null },
    ], [
      { id: '44444444-4444-4444-8444-444444444444', landmark_id: landmarkA, audio_path: 'audio/a.m4a', file_size_bytes: 5000, checksum_sha256: 'a'.repeat(64), checksum_md5: 'b'.repeat(32), transcript: 'Hello' },
      { id: '55555555-5555-4555-8555-555555555555', landmark_id: '99999999-9999-4999-8999-999999999999', audio_path: 'audio/x.m4a', file_size_bytes: 9, checksum_sha256: 'c'.repeat(64), checksum_md5: 'd'.repeat(32), transcript: null },
    ], base, new Date('2026-10-12T00:00:00Z'));
    expect(PackResponse.safeParse(pack).success).toBe(true);
    expect(pack.totalBytes).toBe(6000);
    expect(pack.files.map((file) => file.kind)).toEqual(['audio', 'image']);
    expect(pack.files[0]).toMatchObject({ url: `${base}/audio/a.m4a`, md5: 'b'.repeat(32) });
    expect(pack.podcasts).toEqual([{ podcastId: '44444444-4444-4444-8444-444444444444', transcript: 'Hello' }]);
    expect(pack.landmarks.find((landmark) => landmark.landmarkId === landmarkB)?.imageUrl).toBeNull();
  });

  it('has a stable etag across generation times', () =>
  {
    const first = buildPack(parkId, [], [], base, new Date(1));
    const second = buildPack(parkId, [], [], base, new Date(2));
    expect(first.etag).toBe(second.etag);
    expect(first.totalBytes).toBe(0);
  });
});
