export const COPY = {
  searchPlaceholder: 'Search a site or area, e.g. Tiong Bahru',
  searchEmpty: 'No matching locations found. Try a different search.',
  catalogFetchFailed: 'Unable to fetch nearby landmarks. Check your connection.',
  waitingForGps: 'Waiting for GPS signal...',
  descriptionUnavailable: 'Description unavailable.',
  emptyCatalogTitle: 'No heritage map yet',
  emptyCatalogMessage: 'Connect to the internet once so Singalore can download the heritage map. After that it keeps working offline.',
  emptyCatalogRetry: 'Try again',
  noPodcast: 'No podcast for this site yet',
  noPodcastShort: 'No podcast yet',
} as const;

export const CATEGORY_LABELS: Record<string, string> = {
  religious: 'Religious heritage',
  residential: 'Residential heritage',
  civic: 'Civic heritage',
  commercial: 'Commercial heritage',
  transport: 'Transport heritage',
  museum: 'Museum',
  military: 'Military heritage',
  other: 'Heritage site',
};

export function categoryLabel(category: string): string
{
  return CATEGORY_LABELS[category] ?? 'Heritage site';
}
