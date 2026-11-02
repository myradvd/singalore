import { distanceBetween, type CatalogLandmark, type GeoPoint } from '@singalore/shared';

export const NEAREST_SITE_LIMIT = 5;

export interface NearbySite
{
  site: CatalogLandmark;
  distanceMeters: number;
}

// Lists the closest sites to a point by straight line distance, leaving out one site if asked.
export function nearestSites(sites: readonly CatalogLandmark[], origin: GeoPoint, excludedSiteId: string | null = null): NearbySite[]
{
  return sites
    .filter((site) => site.id !== excludedSiteId)
    .map((site) => ({ site, distanceMeters: distanceBetween(origin, site.position) }))
    .sort((first, second) => first.distanceMeters - second.distanceMeters || first.site.name.localeCompare(second.site.name))
    .slice(0, NEAREST_SITE_LIMIT);
}
