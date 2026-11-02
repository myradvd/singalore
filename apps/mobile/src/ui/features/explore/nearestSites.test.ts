import { distanceBetween, type CatalogLandmark } from '@singalore/shared';
import { catalogFixture } from '@test/support/catalogFixture';
import { nearestSites } from './nearestSites';

const ORIGIN = { lat: 1.29, lng: 103.85 };

// Builds a number of sites, each one further north of the origin than the last.
function sitesInARow(count: number): CatalogLandmark[]
{
  const template = catalogFixture().landmarks[0]!;
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `site-${index}`,
    name: `Site ${index}`,
    position: { lat: ORIGIN.lat + (index + 1) * 0.001, lng: ORIGIN.lng },
  }));
}

// Lists the ids of the nearby sites in the order they were returned.
function idsOf(sites: readonly { site: CatalogLandmark }[]): string[]
{
  return sites.map((nearby) => nearby.site.id);
}

describe('nearestSites', () =>
{
  it('returns nothing for 0 sites', () =>
  {
    expect(nearestSites([], ORIGIN)).toEqual([]);
  });

  it('returns the only site with its straight line distance for 1 site', () =>
  {
    const [site] = sitesInARow(1);
    expect(nearestSites([site!], ORIGIN)).toEqual([{ site, distanceMeters: distanceBetween(ORIGIN, site!.position) }]);
  });

  it('below the limit: returns all 4 of 4 sites', () =>
  {
    expect(nearestSites(sitesInARow(4), ORIGIN)).toHaveLength(4);
  });

  it('on the limit: returns all 5 of 5 sites', () =>
  {
    expect(idsOf(nearestSites(sitesInARow(5), ORIGIN))).toEqual(['site-0', 'site-1', 'site-2', 'site-3', 'site-4']);
  });

  it('above the limit: returns the nearest 5 of 6 sites and drops the furthest', () =>
  {
    expect(idsOf(nearestSites(sitesInARow(6), ORIGIN))).toEqual(['site-0', 'site-1', 'site-2', 'site-3', 'site-4']);
  });

  it('sorts unordered sites by distance without changing the input', () =>
  {
    const reversed = sitesInARow(3).reverse();
    expect(idsOf(nearestSites(reversed, ORIGIN))).toEqual(['site-0', 'site-1', 'site-2']);
    expect(reversed[0]!.id).toBe('site-2');
  });

  it('breaks an equal distance by name', () =>
  {
    const [template] = sitesInARow(1);
    const samePlace = [{ ...template!, id: 'second', name: 'Beta' }, { ...template!, id: 'first', name: 'Alpha' }];
    expect(idsOf(nearestSites(samePlace, ORIGIN))).toEqual(['first', 'second']);
  });

  it('leaves out the excluded site and still fills the 5 places from 6 sites', () =>
  {
    expect(idsOf(nearestSites(sitesInARow(6), ORIGIN, 'site-0'))).toEqual(['site-1', 'site-2', 'site-3', 'site-4', 'site-5']);
  });

  it('leaves out nothing when the excluded id is not one of the sites', () =>
  {
    expect(nearestSites(sitesInARow(2), ORIGIN, 'not-a-site')).toHaveLength(2);
  });
});
