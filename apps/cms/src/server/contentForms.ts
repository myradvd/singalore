import { LANDMARK_CATEGORIES, SINGAPORE_BBOX, isInsideBoundingBox } from '@singalore/shared';
import { z } from 'zod';

const optionalText = z.string().trim().transform((value) => (value.length === 0 ? null : value));

export function slugify(text: string): string
{
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export const LandmarkForm = z.object({
  parkId: z.uuid('Choose a heritage park.'),
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.'),
  slug: z.string().trim().regex(/^[a-z0-9-]*$/, 'Slug may only use lowercase letters, digits and hyphens.').max(80),
  category: z.enum(LANDMARK_CATEGORIES, 'Choose a category.'),
  lat: z.coerce.number('Latitude must be a number.'),
  lng: z.coerce.number('Longitude must be a number.'),
  geofenceRadiusM: z.coerce.number().int('Radius must be a whole number.').min(15, 'Radius must be at least 15 m.').max(100, 'Radius must be at most 100 m.'),
  shortDescription: z.string().trim().max(280, 'Short description must be at most 280 characters.'),
  description: z.string().trim().max(20000, 'Description is too long.'),
  builtYear: z.string().trim().transform((value, context) =>
  {
    if (value.length === 0)
    {
      return null;
    }
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1000 || year > 2100)
    {
      context.addIssue({ code: 'custom', message: 'Built year must be between 1000 and 2100.' });
      return z.NEVER;
    }
    return year;
  }),
  architecturalStyle: optionalText,
}).refine((form) => isInsideBoundingBox({ lat: form.lat, lng: form.lng }, SINGAPORE_BBOX), { message: 'The position must be in Singapore.', path: ['lat'] })
  .transform((form) => ({ ...form, slug: form.slug.length > 0 ? form.slug : slugify(form.name) }));
export type LandmarkForm = z.infer<typeof LandmarkForm>;

export const PodcastForm = z.object({
  landmarkId: z.uuid('Choose a landmark.'),
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Title is too long.'),
  voice: optionalText,
  accent: optionalText,
  transcript: optionalText,
});
export type PodcastForm = z.infer<typeof PodcastForm>;

export function formText(formData: FormData): Record<string, string>
{
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries())
  {
    if (typeof value === 'string')
    {
      result[key] = value;
    }
  }
  return result;
}

export function firstIssue(error: z.ZodError): string
{
  return error.issues[0]?.message ?? 'The form is not valid.';
}

export function databaseErrorMessage(error: { code?: string; message: string }): string
{
  if (error.message.includes('landmark_requires_published_park'))
  {
    return 'Publish the heritage park before publishing this landmark.';
  }
  if (error.message.includes('published_podcast_complete'))
  {
    return 'Upload an audio file before publishing this podcast.';
  }
  if (error.code === '23505')
  {
    return 'Another landmark already uses this slug.';
  }
  return 'The change could not be saved. Please try again.';
}
