import type { CatalogSync, CatalogSyncOutcome } from './CatalogSync';
import { refreshCatalog, useCatalogStore } from './catalogStore';
import { EMPTY_CATALOG } from './types';

// Builds a catalog sync that always answers with the given outcome.
function syncAnswering(outcome: CatalogSyncOutcome): CatalogSync
{
  return { sync: async () => outcome } as unknown as CatalogSync;
}

describe('refreshCatalog', () =>
{
  it('failed_no_cache while loading: status becomes unavailable', async () =>
  {
    useCatalogStore.setState({ status: 'loading', snapshot: EMPTY_CATALOG });
    const outcome: CatalogSyncOutcome = { kind: 'failed_no_cache', reason: 'network' };
    expect(await refreshCatalog(syncAnswering(outcome))).toBe(outcome);
    expect(useCatalogStore.getState().status).toBe('unavailable');
  });

  it('failed_no_cache while ready: status stays ready', async () =>
  {
    useCatalogStore.setState({ status: 'ready', snapshot: EMPTY_CATALOG });
    const outcome: CatalogSyncOutcome = { kind: 'failed_no_cache', reason: 'network' };
    expect(await refreshCatalog(syncAnswering(outcome))).toBe(outcome);
    expect(useCatalogStore.getState().status).toBe('ready');
  });

  it('updated while unavailable: applies the snapshot and status becomes ready', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    const snapshot = { parks: [], landmarks: [], podcasts: [] };
    const outcome: CatalogSyncOutcome = { kind: 'updated', snapshot };
    expect(await refreshCatalog(syncAnswering(outcome))).toBe(outcome);
    expect(useCatalogStore.getState().status).toBe('ready');
    expect(useCatalogStore.getState().snapshot).toBe(snapshot);
  });
});
