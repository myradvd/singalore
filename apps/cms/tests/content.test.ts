import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyseAudio, AudioRejectedError, lengthClassFor } from '@/server/audioAnalysis';
import { databaseErrorMessage, firstIssue, formText, LandmarkForm, PodcastForm, slugify } from '@/server/contentForms';

const PARK_ID = '0b5a2f10-0000-4000-8000-000000000001';
const validLandmark = {
  parkId: PARK_ID,
  name: 'CHIJMES Chapel',
  slug: '',
  category: 'religious',
  lat: '1.2952',
  lng: '103.8521',
  geofenceRadiusM: '40',
  shortDescription: 'A Gothic chapel.',
  description: '',
  builtYear: '1904',
  architecturalStyle: '',
};

describe('landmark form', () =>
{
  it('coerces numbers, derives the slug and empties optional fields', () =>
  {
    const parsed = LandmarkForm.parse(validLandmark);
    expect(parsed).toMatchObject({ slug: 'chijmes-chapel', lat: 1.2952, geofenceRadiusM: 40, builtYear: 1904, architecturalStyle: null });
    expect(slugify('Ćafé  Rex (1930)!')).toBe('cafe-rex-1930');
  });

  it('rejects positions outside Singapore, bad radius, bad year and bad slugs', () =>
  {
    const outside = LandmarkForm.safeParse({ ...validLandmark, lat: '51.5', lng: '-0.12' });
    expect(outside.success ? null : firstIssue(outside.error)).toBe('The position must be in Singapore.');
    const radius = LandmarkForm.safeParse({ ...validLandmark, geofenceRadiusM: '200' });
    expect(radius.success ? null : firstIssue(radius.error)).toBe('Radius must be at most 100 m.');
    const year = LandmarkForm.safeParse({ ...validLandmark, builtYear: '20' });
    expect(year.success ? null : firstIssue(year.error)).toBe('Built year must be between 1000 and 2100.');
    expect(LandmarkForm.safeParse({ ...validLandmark, slug: 'Not OK' }).success).toBe(false);
    expect(LandmarkForm.safeParse({ ...validLandmark, name: '  ' }).success).toBe(false);
  });
});

describe('podcast form', () =>
{
  it('trims and nulls optional text', () =>
  {
    const formData = new FormData();
    formData.set('landmarkId', PARK_ID);
    formData.set('title', '  A short history ');
    formData.set('voice', '');
    formData.set('accent', 'British');
    formData.set('transcript', '   ');
    formData.set('audio', new File([new Uint8Array([1])], 'a.m4a'));
    expect(PodcastForm.parse(formText(formData))).toEqual({ landmarkId: PARK_ID, title: 'A short history', voice: null, accent: 'British', transcript: null });
  });
});

describe('database errors', () =>
{
  it('maps publish rules and unique slugs to editor messages', () =>
  {
    expect(databaseErrorMessage({ message: 'landmark_requires_published_park' })).toBe('Publish the heritage park before publishing this landmark.');
    expect(databaseErrorMessage({ code: '23514', message: 'new row violates check constraint "published_podcast_complete"' })).toBe('Upload an audio file before publishing this podcast.');
    expect(databaseErrorMessage({ code: '23505', message: 'duplicate key' })).toBe('Another landmark already uses this slug.');
    expect(databaseErrorMessage({ message: 'boom' })).toBe('The change could not be saved. Please try again.');
  });
});

describe('audio analysis', () =>
{
  it('computes duration, size, SHA-256, MD5 and length class on the server', async () =>
  {
    const bytes = new Uint8Array(await readFile(path.resolve(import.meta.dirname, '../../../supabase/seed/audio/chijmes-gb.m4a')));
    const analysis = await analyseAudio(bytes, 'audio/mp4');
    expect(analysis.durationSeconds).toBeGreaterThan(0);
    expect(analysis.fileSizeBytes).toBe(bytes.byteLength);
    expect(analysis.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(analysis.md5).toMatch(/^[0-9a-f]{32}$/);
    expect(analysis.extension).toBe('m4a');
  });

  it('rejects unsupported types and unreadable files', async () =>
  {
    await expect(analyseAudio(new Uint8Array([1, 2, 3]), 'audio/wav')).rejects.toBeInstanceOf(AudioRejectedError);
    await expect(analyseAudio(new Uint8Array([1, 2, 3]), 'audio/mpeg')).rejects.toBeInstanceOf(AudioRejectedError);
    expect([lengthClassFor(30), lengthClassFor(120), lengthClassFor(600)]).toEqual(['short', 'standard', 'long']);
  });
});
