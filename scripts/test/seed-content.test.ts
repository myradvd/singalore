import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REMOVED_LANDMARK_SLUGS, SEED_PARKS } from '../seed-spec';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_IMAGES_DIRECTORY, SEED_NARRATION_DIRECTORY, type AudioManifestEntry, type SeedContent } from '../seed-types';

const content = JSON.parse(readFileSync(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
const manifest = JSON.parse(readFileSync(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), 'utf8')) as AudioManifestEntry[];
const landmarks = content.parks.flatMap((park) => park.landmarks);
// Places with no suitable free image on Wikimedia Commons.
const LANDMARKS_WITHOUT_IMAGE: string[] = [];

describe('seed content', () =>
{
  it('has 4 parks and 24 landmarks, one per spec entry', () =>
  {
    expect(content.parks.map((park) => park.slug)).toEqual(SEED_PARKS.map((park) => park.slug));
    expect(landmarks).toHaveLength(24);
    for (const park of content.parks)
    {
      expect(park.landmarks).toHaveLength(SEED_PARKS.find((spec) => spec.slug === park.slug)?.landmarks.length ?? -1);
    }
  });

  it('leaves out every retired landmark', () =>
  {
    expect(REMOVED_LANDMARK_SLUGS).toEqual(expect.arrayContaining(['giok-hong-tian-temple', 'grave-of-tan-tock-seng']));
    const slugs = landmarks.map((landmark) => landmark.slug);
    for (const slug of REMOVED_LANDMARK_SLUGS)
    {
      expect(slugs).not.toContain(slug);
      expect(manifest.some((entry) => entry.landmarkSlug === slug)).toBe(false);
      expect(existsSync(path.join(SEED_NARRATION_DIRECTORY, `${slug}.md`))).toBe(false);
    }
  });

  it.each(landmarks.map((landmark) => [landmark.slug, landmark] as const))('%s has a description, script and podcast', (slug, landmark) =>
  {
    expect(landmark.description.length).toBeGreaterThan(0);
    expect(landmark.shortDescription.length).toBeGreaterThan(0);
    expect(existsSync(path.join(SEED_NARRATION_DIRECTORY, `${slug}.md`))).toBe(true);
    expect(manifest.some((entry) => entry.landmarkSlug === slug)).toBe(true);
  });

  it.each(landmarks.filter((landmark) => !LANDMARKS_WITHOUT_IMAGE.includes(landmark.slug)).map((landmark) => [landmark.slug, landmark] as const))('%s has an image file with a Commons credit', (_slug, landmark) =>
  {
    expect(landmark.imageFile).not.toBeNull();
    expect(existsSync(path.join(SEED_IMAGES_DIRECTORY, landmark.imageFile ?? ''))).toBe(true);
    expect(landmark.attribution).toMatch(/Image ".+" by .+, .+, via Wikimedia Commons \(https:\/\/commons\.wikimedia\.org\/wiki\/File:.+\)\./);
  });

  it('credits each Commons image override that the spec sets', () =>
  {
    for (const [index, park] of SEED_PARKS.entries())
    {
      for (const [position, source] of park.landmarks.entries())
      {
        const landmark = content.parks[index]?.landmarks.find((candidate) => candidate.sortOrder === position);
        if (source.commonsImage !== undefined)
        {
          expect(landmark?.attribution).toContain(`Image "${source.commonsImage}" by `);
        }
        if (source.description !== undefined)
        {
          expect(landmark?.description).toBe(source.description.text);
          expect(landmark?.attribution.startsWith(source.description.credit)).toBe(true);
        }
      }
    }
  });

  it('gives every park a description and an existing cover image', () =>
  {
    for (const park of content.parks)
    {
      expect(park.description.length).toBeGreaterThan(0);
      expect(park.thumbnailFile).not.toBeNull();
      expect(existsSync(path.join(SEED_IMAGES_DIRECTORY, park.thumbnailFile ?? ''))).toBe(true);
    }
  });
});
