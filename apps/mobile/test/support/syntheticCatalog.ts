import type { CatalogLandmark, CatalogPodcast } from '@singalore/shared';
import { LANDMARK_CATEGORIES, destinationPoint } from '@singalore/shared';

function syntheticUuid(prefix: number, index: number): string
{
  return `${prefix.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

export function syntheticLandmarks(count: number, center = { lat: 1.29, lng: 103.85 }, spacingMeters = 120): { landmarks: CatalogLandmark[]; podcasts: CatalogPodcast[] }
{
  const parkId = syntheticUuid(0xabcd, 0);
  const columns = Math.ceil(Math.sqrt(count));
  const landmarks: CatalogLandmark[] = [];
  const podcasts: CatalogPodcast[] = [];
  for (let index = 0; index < count; index += 1)
  {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const east = destinationPoint(center, 90, column * spacingMeters);
    const position = destinationPoint(east, 0, row * spacingMeters);
    const id = syntheticUuid(0x1000, index + 1);
    landmarks.push({
      id,
      parkId,
      slug: `synthetic-${index}`,
      name: `Synthetic Landmark ${index}`,
      aliases: [],
      category: LANDMARK_CATEGORIES[index % LANDMARK_CATEGORIES.length] ?? 'other',
      position,
      geofenceRadiusM: 30,
      shortDescription: `Generated landmark ${index}`,
      thumbnailUrl: null,
      builtYear: null,
      architecturalStyle: null,
      sortOrder: index,
      attribution: 'Synthetic test data',
    });
    if (index % 3 !== 2)
    {
      podcasts.push({
        id: syntheticUuid(0x2000, index + 1),
        landmarkId: id,
        title: `Synthetic podcast ${index}`,
        audioUrl: `https://cdn.test/audio/${index}.m4a`,
        durationSeconds: 60,
        fileSizeBytes: 100000,
        voice: null,
        accent: null,
        lengthClass: 'standard',
        hasTranscript: false,
      });
    }
  }
  return { landmarks, podcasts };
}
