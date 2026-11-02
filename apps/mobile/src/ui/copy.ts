export const COPY = {
  searchPlaceholder: 'Search a site or area, e.g. Tiong Bahru',
  searchEmpty: 'No matching locations found. Try a different search.',
  searchMinimumLengthHint: 'Type at least 2 letters to search.',
  searchRecentTitle: 'Recent searches',
  searchRecentClear: 'Clear',
  searchRecentSeeAll: 'See all',
  searchSuggestedTitle: 'Suggested',
  catalogFetchFailed: 'Unable to fetch nearby landmarks. Check your connection.',
  catalogLoading: 'Loading heritage sites...',
  waitingForGps: 'Waiting for GPS signal...',
  stopAddedToRoute: 'Added to your route.',
  offRouteMessage: 'Return to the highlighted path, or recalculate a new route from here through your remaining stops.',
  followRouteLine: 'Follow the highlighted line',
  nearestToYou: 'Nearest to you',
  selectLocationPrompt: 'Select a location to see nearby sites',
  selectLocation: 'Select a location',
  clearLocation: 'Clear location',
  closeLocationPicker: 'Close location picker',
  locationPickerParks: 'Parks',
  locationPickerSites: 'Sites',
  descriptionUnavailable: 'Description unavailable.',
  emptyCatalogTitle: 'No heritage map yet',
  emptyCatalogMessage: 'Connect to the internet once so Singalore can download the heritage map. After that it keeps working offline.',
  emptyCatalogRetry: 'Try again',
  historyLoading: 'Loading...',
  historyLoadFailedTitle: 'Could not load tour history',
  historyLoadFailedMessage: 'Please try again.',
  historyRetry: 'Retry',
  noPodcast: 'No podcast for this site yet',
  noPodcastShort: 'No podcast yet',
} as const;

// Builds the section title for a location the user picked.
export function nearestToLocationTitle(locationName: string): string
{
  return `Nearest to ${locationName}`;
}

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
