import { describe, expect, it } from 'vitest';
import { CatalogResponse } from '@singalore/shared';
import { buildCatalog, computeEtag, mediaUrl, type CatalogRows } from '@/server/catalogBuilder';
import { etagMatches, snapshotResponse } from '@/server/http';

const parkId = '11111111-1111-4111-8111-111111111111';
const landmarkId = '22222222-2222-4222-8222-222222222222';
const orphanLandmarkId = '33333333-3333-4333-8333-333333333333';
const podcastId = '44444444-4444-4444-8444-444444444444';
const base = 'https://cdn.example.com/storage/v1/object/public/media';

function rows(): CatalogRows
{
  return {
    parks: [{
      id: parkId,
      slug: 'civic-district',
      name: 'Civic District',
      district: 'Downtown Core',
      description: 'The Civic District is a district located near the Singapore River. It has many monuments.',
      center_lat: 1.29,
      center_lng: 103.85,
      boundary: { type: 'Polygon', coordinates: [[[103.85, 1.29], [103.86, 1.29], [103.86, 1.3], [103.85, 1.29]]] },
      thumbnail_path: 'images/parks/civic district.jpg',
      attribution: 'Wikipedia',
    }],
    landmarks: [
      {
        id: landmarkId,
        park_id: parkId,
        slug: 'chijmes',
        name: 'CHIJMES',
        aliases: ['Chijmes'],
        category: 'religious',
        lat: 1.2951,
        lng: 103.852,
        geofence_radius_m: 30,
        short_description: 'Former convent.',
        thumbnail_path: 'images/landmarks/chijmes.jpg',
        image_bytes: 1000,
        built_year: 1904,
        architectural_style: 'Gothic Revival',
        sort_order: 0,
        attribution: 'Wikidata',
      },
      {
        id: orphanLandmarkId,
        park_id: '99999999-9999-4999-8999-999999999999',
        slug: 'orphan',
        name: 'Orphan',
        aliases: [],
        category: 'other',
        lat: 1.3,
        lng: 103.8,
        geofence_radius_m: 30,
        short_description: '',
        thumbnail_path: null,
        image_bytes: null,
        built_year: null,
        architectural_style: null,
        sort_order: 1,
        attribution: '',
      },
    ],
    podcasts: [{
      id: podcastId,
      landmark_id: landmarkId,
      title: 'CHIJMES: a short history',
      audio_path: 'audio/chijmes-gb.m4a',
      duration_seconds: 24,
      file_size_bytes: 5000,
      voice: 'Male',
      accent: 'British',
      length_class: 'short',
      has_transcript: true,
    }],
  };
}

describe('buildCatalog', () =>
{
  it('produces a schema valid snapshot with absolute media URLs', () =>
  {
    const catalog = buildCatalog(rows(), base, new Date('2026-10-12T00:00:00Z'));
    expect(CatalogResponse.safeParse(catalog).success).toBe(true);
    expect(catalog.parks[0]?.thumbnailUrl).toBe(`${base}/images/parks/civic%20district.jpg`);
    expect(catalog.podcasts[0]?.audioUrl).toBe(`${base}/audio/chijmes-gb.m4a`);
    expect(catalog.parks[0]?.packBytes).toBe(6000);
    expect(catalog.parks[0]?.landmarkCount).toBe(1);
  });

  it('drops landmarks whose park is not published', () =>
  {
    const catalog = buildCatalog(rows(), base, new Date());
    expect(catalog.landmarks.map((landmark) => landmark.id)).toEqual([landmarkId]);
  });

  it('keeps the etag stable across generation times and changes it with content', () =>
  {
    const first = buildCatalog(rows(), base, new Date('2026-01-01T00:00:00Z'));
    const second = buildCatalog(rows(), base, new Date('2026-06-01T00:00:00Z'));
    expect(first.etag).toBe(second.etag);
    const changed = rows();
    const firstLandmark = changed.landmarks[0];
    if (firstLandmark !== undefined)
    {
      firstLandmark.name = 'Chijmes Hall';
    }
    expect(buildCatalog(changed, base, new Date()).etag).not.toBe(first.etag);
  });

  it('treats an invalid boundary as missing', () =>
  {
    const broken = rows();
    const park = broken.parks[0];
    if (park !== undefined)
    {
      park.boundary = { type: 'Polygon', coordinates: [] };
    }
    expect(buildCatalog(broken, base, new Date()).parks[0]?.boundary).toBeNull();
  });
});

describe('mediaUrl and etag helpers', () =>
{
  it('returns null for missing paths', () =>
  {
    expect(mediaUrl(base, null)).toBeNull();
    expect(mediaUrl(base, '')).toBeNull();
  });

  it('quotes etags and matches If-None-Match lists including weak tags', () =>
  {
    const etag = computeEtag({ a: 1 });
    expect(etag.startsWith('"') && etag.endsWith('"')).toBe(true);
    expect(etagMatches(`"other", W/${etag}`, etag)).toBe(true);
    expect(etagMatches('"other"', etag)).toBe(false);
    expect(etagMatches(null, etag)).toBe(false);
  });

  it('returns 304 without a body when the etag matches', async () =>
  {
    const etag = computeEtag({ a: 1 });
    const notModified = snapshotResponse(new Request('https://x.test/api/v1/catalog', { headers: { 'If-None-Match': etag } }), etag, { a: 1 });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe('');
    const fresh = snapshotResponse(new Request('https://x.test/api/v1/catalog'), etag, { a: 1 });
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('ETag')).toBe(etag);
    expect(fresh.headers.get('Cache-Control')).toContain('s-maxage=60');
  });
});
