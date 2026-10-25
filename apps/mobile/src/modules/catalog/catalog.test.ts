import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { silentDiagnostics } from '@/core/diagnostics';
import { ApiClient } from '@/core/http/ApiClient';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { LANDMARK_CHIJMES, LANDMARK_MARKET, PARK_CIVIC, PARK_TIONG_BAHRU, catalogFixture } from '@test/support/catalogFixture';
import { CatalogRepository } from './CatalogRepository';
import { CatalogSync } from './CatalogSync';
import { buildLandmarkPins, buildParkBoundaries, buildParkCenterMarkers } from './mapFeatures';
import { SearchIndex } from './searchIndex';

async function setup(responder: (init: RequestInit | undefined) => Response | Promise<Response>)
{
  const db = createMemoryDb();
  await migrate(db);
  const events = createAppEventBus();
  const updates: number[] = [];
  events.on('catalog/updated', (payload) => updates.push(payload.landmarkCount));
  const fetchMock = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => responder(init));
  const api = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation: fetchMock, clock: new ManualClock(0), events });
  const repository = new CatalogRepository(db);
  const sync = new CatalogSync(api, repository, new ManualClock(Date.parse('2026-10-12T00:00:00Z')), events, silentDiagnostics);
  return { db, repository, sync, fetchMock, updates };
}

const ok = (etag: string) => new Response(JSON.stringify(catalogFixture(etag)), { status: 200, headers: { ETag: etag } });

describe('CatalogSync', () =>
{
  it('stores a fresh catalog and round trips every field', async () =>
  {
    const { sync, repository, updates } = await setup(() => ok('"v1"'));
    const outcome = await sync.sync();
    expect(outcome.kind).toBe('updated');
    const loaded = await repository.load();
    const fixture = catalogFixture();
    expect(loaded.parks).toEqual([...fixture.parks].sort((a, b) => a.name.localeCompare(b.name)));
    expect(loaded.landmarks).toEqual(expect.arrayContaining(fixture.landmarks));
    expect(loaded.podcasts).toHaveLength(fixture.podcasts.length);
    expect(await repository.getMeta('catalog_etag')).toBe('"v1"');
    expect(updates).toEqual([4]);
  });

  it('sends the stored etag and keeps the cache on 304', async () =>
  {
    let call = 0;
    const { sync, fetchMock } = await setup((init) =>
    {
      call += 1;
      if (call === 1)
      {
        return ok('"v1"');
      }
      expect((init?.headers as Record<string, string>)['If-None-Match']).toBe('"v1"');
      return new Response(null, { status: 304 });
    });
    await sync.sync();
    const second = await sync.sync();
    expect(second.kind).toBe('not_modified');
    expect(second.kind === 'not_modified' && second.snapshot.landmarks.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('replaces removed content on update', async () =>
  {
    let call = 0;
    const { sync, repository } = await setup(() =>
    {
      call += 1;
      const catalog = catalogFixture(call === 1 ? '"v1"' : '"v2"');
      if (call === 2)
      {
        catalog.landmarks = catalog.landmarks.filter((landmark) => landmark.id !== LANDMARK_MARKET);
        catalog.podcasts = catalog.podcasts.filter((podcast) => podcast.landmarkId !== LANDMARK_MARKET);
      }
      return new Response(JSON.stringify(catalog), { status: 200 });
    });
    await sync.sync();
    await sync.sync();
    const loaded = await repository.load();
    expect(loaded.landmarks.map((landmark) => landmark.id)).not.toContain(LANDMARK_MARKET);
    expect(await repository.getMeta('catalog_etag')).toBe('"v2"');
  });

  it('falls back to the cache when offline and reports no cache on first launch', async () =>
  {
    let online = true;
    const { sync } = await setup(() =>
    {
      if (!online)
      {
        throw new TypeError('Network request failed');
      }
      return ok('"v1"');
    });
    online = false;
    expect(await sync.sync()).toEqual({ kind: 'failed_no_cache', reason: 'network' });
    online = true;
    await sync.sync();
    online = false;
    const outcome = await sync.sync();
    expect(outcome.kind).toBe('failed_using_cache');
    expect(outcome.kind === 'failed_using_cache' && outcome.snapshot.parks.length).toBe(2);
  });

  it('keeps the previous cache when a response fails validation', async () =>
  {
    let call = 0;
    const { sync, repository } = await setup(() =>
    {
      call += 1;
      return call === 1 ? ok('"v1"') : new Response(JSON.stringify({ schemaVersion: 1, parks: 'oops' }), { status: 200 });
    });
    await sync.sync();
    expect((await sync.sync()).kind).toBe('failed_using_cache');
    expect((await repository.load()).landmarks).toHaveLength(4);
  });

  it('shares one request between concurrent callers', async () =>
  {
    const { sync, fetchMock } = await setup(() => ok('"v1"'));
    await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loadCached is null before the first sync', async () =>
  {
    const { sync } = await setup(() => ok('"v1"'));
    expect(await sync.loadCached()).toBeNull();
    await sync.sync();
    expect((await sync.loadCached())?.parks).toHaveLength(2);
  });
});

describe('SearchIndex (A1)', () =>
{
  const catalog = catalogFixture();
  const index = new SearchIndex(catalog);

  it('finds landmarks by name and tolerates misspellings', () =>
  {
    expect(index.search('Chijmes').landmarks[0]?.id).toBe(LANDMARK_CHIJMES);
    expect(index.search('Chimjes').landmarks[0]?.id).toBe(LANDMARK_CHIJMES);
    expect(index.search('Tiong Bharu Market').landmarks[0]?.id).toBe(LANDMARK_MARKET);
  });

  it('matches aliases', () =>
  {
    expect(index.search('Holy Infant Jesus').landmarks[0]?.id).toBe(LANDMARK_CHIJMES);
  });

  it('groups parks and landmarks and finds parks by district', () =>
  {
    const results = index.search('Tiong Bahru');
    expect(results.parks[0]?.id).toBe(PARK_TIONG_BAHRU);
    expect(results.landmarks.length).toBeGreaterThan(0);
    expect(index.search('Downtown').parks[0]?.id).toBe(PARK_CIVIC);
  });

  it('returns nothing for very short or unmatched queries', () =>
  {
    expect(index.search('a')).toEqual({ parks: [], landmarks: [] });
    expect(index.search('zzzzqqq')).toEqual({ parks: [], landmarks: [] });
  });
});

describe('map features', () =>
{
  const catalog = catalogFixture();

  it('builds pins with podcast, itinerary and selection flags', () =>
  {
    const pins = buildLandmarkPins(catalog.landmarks, new Set([LANDMARK_CHIJMES]), [LANDMARK_MARKET], LANDMARK_CHIJMES);
    const chijmes = pins.features.find((feature) => feature.properties.landmarkId === LANDMARK_CHIJMES);
    const market = pins.features.find((feature) => feature.properties.landmarkId === LANDMARK_MARKET);
    expect(chijmes?.properties).toMatchObject({ hasPodcast: true, selected: true, inItinerary: false });
    expect(market?.properties).toMatchObject({ hasPodcast: false, inItinerary: true, itineraryIndex: 1 });
    expect(chijmes?.geometry.coordinates).toEqual([103.85193, 1.29516]);
  });

  it('draws boundaries where they exist and a centre marker otherwise (UC 1.1.3.1)', () =>
  {
    expect(buildParkBoundaries(catalog.parks).features.map((feature) => feature.properties.parkId)).toEqual([PARK_CIVIC]);
    expect(buildParkCenterMarkers(catalog.parks).features.map((feature) => feature.properties.parkId)).toEqual([PARK_TIONG_BAHRU]);
  });
});
