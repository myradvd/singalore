import { destinationPoint, distanceBetween, type CatalogLandmark, type GeoPoint } from '@singalore/shared';
import { catalogFixture } from '@test/support/catalogFixture';
import { recentCatalogSites, SHOWN_RECENT_SITES, SHOWN_SUGGESTED_SITES, suggestedSites } from './searchSuggestions';

const ORIGIN: GeoPoint = { lat: 1.3, lng: 103.8 };
const baseLandmark = catalogFixture().landmarks[0] as CatalogLandmark;

// Builds a site a given distance north of the origin.
function siteAt(name: string, metersNorthOfOrigin: number): CatalogLandmark
{
  return { ...baseLandmark, id: name, slug: name, name, position: destinationPoint(ORIGIN, 0, metersNorthOfOrigin) };
}

// Builds numbered sites, each 100 m further from the origin.
function namedSites(count: number): CatalogLandmark[]
{
  return Array.from({ length: count }, (_, position) => siteAt(`site-${position + 1}`, (position + 1) * 100));
}

// Indexes sites by id like the catalog store.
function byId(sites: readonly CatalogLandmark[]): ReadonlyMap<string, CatalogLandmark>
{
  return new Map(sites.map((site) => [site.id, site]));
}

// Runs suggestedSites with browse defaults and returns the names.
function suggestedNames(input: Partial<Parameters<typeof suggestedSites>[0]> & { sites: readonly CatalogLandmark[] }): string[]
{
  return suggestedSites({ purpose: 'browse', itineraryIds: [], userPosition: null, ...input, landmarksById: byId(input.sites) }).map((site) => site.name);
}

describe('recentCatalogSites', () =>
{
  it('keeps the saved order', () =>
  {
    const sites = namedSites(2);
    expect(recentCatalogSites(['site-2', 'site-1'], byId(sites)).map((site) => site.id)).toEqual(['site-2', 'site-1']);
  });

  it('zero saved: gives an empty list', () =>
  {
    expect(recentCatalogSites([], byId(namedSites(2)))).toEqual([]);
  });

  it('removed site: skips an id no longer in the catalog', () =>
  {
    expect(recentCatalogSites(['gone', 'site-1'], byId(namedSites(1))).map((site) => site.id)).toEqual(['site-1']);
  });
});

describe('suggestedSites', () =>
{
  it('shows 5 of each section', () =>
  {
    expect(SHOWN_RECENT_SITES).toBe(5);
    expect(SHOWN_SUGGESTED_SITES).toBe(5);
  });

  it('with a fix: lists the nearest sites, nearest first, by distanceBetween', () =>
  {
    const near = siteAt('near', 100);
    const middle = siteAt('middle', 200);
    const far = siteAt('far', 300);
    expect(distanceBetween(ORIGIN, near.position)).toBeLessThan(distanceBetween(ORIGIN, middle.position));
    expect(suggestedNames({ sites: [far, near, middle], userPosition: ORIGIN })).toEqual(['near', 'middle', 'far']);
  });

  it.each([
    ['just below the limit', 4, 4],
    ['on the limit', 5, 5],
    ['just above the limit', 6, 5],
  ])('%s: %i catalog sites suggest %i', (_name, siteCount, shownCount) =>
  {
    expect(suggestedNames({ sites: namedSites(siteCount), userPosition: ORIGIN })).toHaveLength(shownCount);
  });

  it('just above the limit: the 6th nearest site is the one left out', () =>
  {
    expect(suggestedNames({ sites: namedSites(6), userPosition: ORIGIN })).not.toContain('site-6');
  });

  it('equal distance: ties sort by name', () =>
  {
    expect(suggestedNames({ sites: [siteAt('b', 100), siteAt('a', 100)], userPosition: ORIGIN })).toEqual(['a', 'b']);
  });

  it('no fix and no stops: lists the first 5 alphabetically', () =>
  {
    const sites = ['f', 'e', 'd', 'c', 'b', 'a'].map((name) => siteAt(name, 100));
    expect(suggestedNames({ sites })).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('no sites: gives an empty list', () =>
  {
    expect(suggestedNames({ sites: [], userPosition: ORIGIN })).toEqual([]);
  });

  it('add to route: leaves out sites already on the route', () =>
  {
    const sites = namedSites(3);
    expect(suggestedNames({ sites, purpose: 'addToRoute', itineraryIds: ['site-1'], userPosition: ORIGIN })).toEqual(['site-2', 'site-3']);
  });

  it('add to route: measures from the last stop, not the user', () =>
  {
    const sites = [siteAt('stop', 1000), siteAt('close-to-user', 100), siteAt('close-to-stop', 900)];
    expect(suggestedNames({ sites, purpose: 'addToRoute', itineraryIds: ['stop'], userPosition: ORIGIN })).toEqual(['close-to-stop', 'close-to-user']);
  });

  it('add to route, 2 stops: the last stop is the origin, not the first', () =>
  {
    const sites = [siteAt('first', 100), siteAt('last', 1000), siteAt('close-to-first', 200), siteAt('close-to-last', 900)];
    expect(suggestedNames({ sites, purpose: 'addToRoute', itineraryIds: ['first', 'last'], userPosition: ORIGIN })).toEqual(['close-to-last', 'close-to-first']);
  });

  it('add to route, stops and no fix: still measures from the last stop', () =>
  {
    const sites = [siteAt('stop', 1000), siteAt('a-far', 100), siteAt('z-close', 900)];
    expect(suggestedNames({ sites, purpose: 'addToRoute', itineraryIds: ['stop'] })).toEqual(['z-close', 'a-far']);
  });

  it('add to route, no stops: measures from the user', () =>
  {
    const sites = [siteAt('far', 300), siteAt('near', 100)];
    expect(suggestedNames({ sites, purpose: 'addToRoute', userPosition: ORIGIN })).toEqual(['near', 'far']);
  });

  it('add to route, last stop removed from the catalog: measures from the user', () =>
  {
    const sites = [siteAt('far', 300), siteAt('near', 100)];
    expect(suggestedNames({ sites, purpose: 'addToRoute', itineraryIds: ['gone'], userPosition: ORIGIN })).toEqual(['near', 'far']);
  });

  it('browse with stops: ignores the route for both the origin and the filter', () =>
  {
    const sites = [siteAt('stop', 1000), siteAt('near', 100)];
    expect(suggestedNames({ sites, itineraryIds: ['stop'], userPosition: ORIGIN })).toEqual(['near', 'stop']);
  });
});
