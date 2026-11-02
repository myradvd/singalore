import { distanceBetween, type CatalogLandmark, type GeoPoint } from '@singalore/shared';

export const SHOWN_RECENT_SITES = 5;
export const SHOWN_SUGGESTED_SITES = 5;

export interface SuggestedSitesInput
{
  landmarksById: ReadonlyMap<string, CatalogLandmark>;
  purpose: 'browse' | 'addToRoute';
  itineraryIds: readonly string[];
  userPosition: GeoPoint | null;
}

// Turns saved recent ids into catalog sites, skipping any site no longer in the catalog.
export function recentCatalogSites(recentSiteIds: readonly string[], landmarksById: ReadonlyMap<string, CatalogLandmark>): CatalogLandmark[]
{
  return recentSiteIds.flatMap((siteId) => landmarksById.get(siteId) ?? []);
}

// Lists the sites to suggest: nearest to the origin when there is one, otherwise alphabetical.
export function suggestedSites({ landmarksById, purpose, itineraryIds, userPosition }: SuggestedSitesInput): CatalogLandmark[]
{
  const addingToRoute = purpose === 'addToRoute';
  const lastStopId = itineraryIds[itineraryIds.length - 1];
  const lastStop = addingToRoute && lastStopId !== undefined ? landmarksById.get(lastStopId) : undefined;
  const origin = lastStop?.position ?? userPosition;
  const candidates = [...landmarksById.values()].filter((site) => !addingToRoute || !itineraryIds.includes(site.id));
  const byName = (first: CatalogLandmark, second: CatalogLandmark) => first.name.localeCompare(second.name);
  const sorted = origin === null
    ? candidates.sort(byName)
    : candidates.sort((first, second) => distanceBetween(origin, first.position) - distanceBetween(origin, second.position) || byName(first, second));
  return sorted.slice(0, SHOWN_SUGGESTED_SITES);
}
