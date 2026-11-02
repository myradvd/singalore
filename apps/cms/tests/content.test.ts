import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyseAudio, AudioRejectedError, lengthClassFor, MAX_AUDIO_BYTES } from '@/server/audioAnalysis';
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

// Returns the first form issue for a landmark with the given fields changed, or null when valid.
function landmarkIssue(overrides: Partial<typeof validLandmark>): string | null
{
  const result = LandmarkForm.safeParse({ ...validLandmark, ...overrides });
  return result.success ? null : firstIssue(result.error);
}

describe('landmark form boundary values (N-1)', () =>
{
  it.each([
    ['14', 'Radius must be at least 15 m.'],
    ['15', null],
    ['16', null],
    ['99', null],
    ['100', null],
    ['101', 'Radius must be at most 100 m.'],
    ['30.5', 'Radius must be a whole number.'],
  ])('radius %s gives %s', (geofenceRadiusM, expected) =>
  {
    expect(landmarkIssue({ geofenceRadiusM })).toBe(expected);
  });

  it('radius abc (invalid EC) fails', () =>
  {
    expect(LandmarkForm.safeParse({ ...validLandmark, geofenceRadiusM: 'abc' }).success).toBe(false);
  });

  it.each([
    ['999', 'Built year must be between 1000 and 2100.'],
    ['1000', null],
    ['1001', null],
    ['2099', null],
    ['2100', null],
    ['2101', 'Built year must be between 1000 and 2100.'],
    ['abcd', 'Built year must be between 1000 and 2100.'],
  ])('built year %s gives %s', (builtYear, expected) =>
  {
    expect(landmarkIssue({ builtYear })).toBe(expected);
  });

  it('empty built year (valid EC) parses to null', () =>
  {
    expect(LandmarkForm.parse({ ...validLandmark, builtYear: '' }).builtYear).toBeNull();
  });

  it.each([
    [0, 'Name is required.'],
    [1, null],
    [2, null],
    [119, null],
    [120, null],
    [121, 'Name is too long.'],
  ])('name of %i characters gives %s', (length, expected) =>
  {
    expect(landmarkIssue({ name: 'a'.repeat(length) })).toBe(expected);
  });

  it.each([
    [279, null],
    [280, null],
    [281, 'Short description must be at most 280 characters.'],
  ])('short description of %i characters gives %s', (length, expected) =>
  {
    expect(landmarkIssue({ shortDescription: 'a'.repeat(length) })).toBe(expected);
  });

  it.each([
    [19999, null],
    [20000, null],
    [20001, 'Description is too long.'],
  ])('description of %i characters gives %s', (length, expected) =>
  {
    expect(landmarkIssue({ description: 'a'.repeat(length) })).toBe(expected);
  });

  it.each([
    [79, true],
    [80, true],
    [81, false],
  ])('slug of %i characters passing is %s', (length, expected) =>
  {
    expect(LandmarkForm.safeParse({ ...validLandmark, slug: 'a'.repeat(length) }).success).toBe(expected);
  });
});

describe('podcast form boundary values (N-1)', () =>
{
  it.each([
    [0, 'Title is required.'],
    [1, null],
    [2, null],
    [199, null],
    [200, null],
    [201, 'Title is too long.'],
  ])('title of %i characters gives %s', (length, expected) =>
  {
    const result = PodcastForm.safeParse({ landmarkId: PARK_ID, title: 'a'.repeat(length), voice: '', accent: '', transcript: '' });
    expect(result.success ? null : firstIssue(result.error)).toBe(expected);
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
  // Returns a stand in that reports a size without allocating that many bytes.
  function bytesOfReportedSize(byteLength: number): Uint8Array
  {
    return { byteLength } as unknown as Uint8Array;
  }

  it('limit is 50 MB', () =>
  {
    expect(MAX_AUDIO_BYTES).toBe(52428800);
  });

  // A stand in has no audio to parse, so passing the size check gives the no playable length message.
  it.each([
    [MAX_AUDIO_BYTES - 1, 'The audio file has no playable length.'],
    [MAX_AUDIO_BYTES, 'The audio file has no playable length.'],
    [MAX_AUDIO_BYTES + 1, 'Audio files must be between 1 byte and 50 MB.'],
  ])('audio of %i bytes is rejected with: %s', async (byteLength, expectedMessage) =>
  {
    await expect(analyseAudio(bytesOfReportedSize(byteLength), 'audio/mp4')).rejects.toThrow(new AudioRejectedError(expectedMessage));
  });

  it('computes duration, size, SHA-256, MD5 and length class on the server', async () =>
  {
    const bytes = new Uint8Array(await readFile(path.resolve(import.meta.dirname, 'fixtures/sample.m4a')));
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
