import type { CatalogLandmark, CatalogPark, CatalogPodcast } from '@singalore/shared';
import { create } from 'zustand';
import type { CatalogSync, CatalogSyncOutcome } from './CatalogSync';
import { SearchIndex } from './searchIndex';
import { EMPTY_CATALOG, type CatalogSnapshot } from './types';

export type CatalogStatus = 'loading' | 'ready' | 'unavailable';

export interface CatalogState
{
  status: CatalogStatus;
  syncing: boolean;
  snapshot: CatalogSnapshot;
  searchIndex: SearchIndex;
  parksById: Map<string, CatalogPark>;
  landmarksById: Map<string, CatalogLandmark>;
  podcastsByLandmarkId: Map<string, CatalogPodcast[]>;
  podcastLandmarkIds: Set<string>;
  lastOutcome: CatalogSyncOutcome['kind'] | null;
}

function indexSnapshot(snapshot: CatalogSnapshot): Pick<CatalogState, 'snapshot' | 'searchIndex' | 'parksById' | 'landmarksById' | 'podcastsByLandmarkId' | 'podcastLandmarkIds'>
{
  const podcastsByLandmarkId = new Map<string, CatalogPodcast[]>();
  for (const podcast of snapshot.podcasts)
  {
    const list = podcastsByLandmarkId.get(podcast.landmarkId) ?? [];
    list.push(podcast);
    podcastsByLandmarkId.set(podcast.landmarkId, list);
  }
  return {
    snapshot,
    searchIndex: new SearchIndex(snapshot),
    parksById: new Map(snapshot.parks.map((park) => [park.id, park])),
    landmarksById: new Map(snapshot.landmarks.map((landmark) => [landmark.id, landmark])),
    podcastsByLandmarkId,
    podcastLandmarkIds: new Set(podcastsByLandmarkId.keys()),
  };
}

export const useCatalogStore = create<CatalogState>(() => ({
  status: 'loading',
  syncing: false,
  lastOutcome: null,
  ...indexSnapshot(EMPTY_CATALOG),
}));

export function applyCatalogSnapshot(snapshot: CatalogSnapshot): void
{
  useCatalogStore.setState({ ...indexSnapshot(snapshot), status: 'ready' });
}

export async function initializeCatalog(sync: CatalogSync): Promise<CatalogSyncOutcome>
{
  const cached = await sync.loadCached();
  if (cached !== null)
  {
    applyCatalogSnapshot(cached);
  }
  return refreshCatalog(sync);
}

export async function refreshCatalog(sync: CatalogSync): Promise<CatalogSyncOutcome>
{
  useCatalogStore.setState({ syncing: true });
  const outcome = await sync.sync();
  if (outcome.kind === 'failed_no_cache')
  {
    useCatalogStore.setState({ syncing: false, lastOutcome: outcome.kind, status: useCatalogStore.getState().status === 'ready' ? 'ready' : 'unavailable' });
    return outcome;
  }
  applyCatalogSnapshot(outcome.snapshot);
  useCatalogStore.setState({ syncing: false, lastOutcome: outcome.kind });
  return outcome;
}

export function landmarksForPark(state: CatalogState, parkId: string): CatalogLandmark[]
{
  return state.snapshot.landmarks.filter((landmark) => landmark.parkId === parkId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function totalPodcastSeconds(state: CatalogState, landmarkId: string): number | null
{
  const podcasts = state.podcastsByLandmarkId.get(landmarkId);
  if (podcasts === undefined || podcasts.length === 0)
  {
    return null;
  }
  return Math.min(...podcasts.map((podcast) => podcast.durationSeconds));
}
