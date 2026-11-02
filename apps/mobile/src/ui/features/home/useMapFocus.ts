import { useCallback, useEffect, type RefObject } from 'react';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { dispatchFlow } from '@/modules/flow/flowStore';
import type { HeritageMapHandle } from '../../map/mapTypes';
import { useMapUiStore } from '../../mapCommandStore';

// Gives Home its landmark and park focus actions and serves pending focus requests once the catalog is ready.
export function useMapFocus(mapRef: RefObject<HeritageMapHandle | null>)
{
  const catalog = useCatalogStore();
  const pendingFocus = useMapUiStore((store) => store.pendingFocus);

  const focusLandmark = useCallback((landmarkId: string) =>
  {
    const landmark = catalog.landmarksById.get(landmarkId);
    if (landmark === undefined)
    {
      return;
    }
    dispatchFlow({ type: 'selectLandmark', landmarkId });
    mapRef.current?.centerOn(landmark.position.lat, landmark.position.lng, 16.5);
  }, [catalog.landmarksById, mapRef]);

  const focusPark = useCallback((parkId: string) =>
  {
    const parkLandmarks = catalog.snapshot.landmarks.filter((landmark) => landmark.parkId === parkId);
    const park = catalog.parksById.get(parkId);
    dispatchFlow({ type: 'selectLandmark', landmarkId: null });
    if (parkLandmarks.length > 0)
    {
      mapRef.current?.fitTo(parkLandmarks.map((landmark) => ({ latitude: landmark.position.lat, longitude: landmark.position.lng })));
    }
    else if (park !== undefined)
    {
      mapRef.current?.centerOn(park.center.lat, park.center.lng, 15.5);
    }
  }, [catalog.snapshot.landmarks, catalog.parksById, mapRef]);

  useEffect(() =>
  {
    if (pendingFocus === null || catalog.status !== 'ready')
    {
      return;
    }
    const request = useMapUiStore.getState().consumeFocus();
    if (request?.kind === 'landmark')
    {
      focusLandmark(request.landmarkId);
    }
    else if (request?.kind === 'park')
    {
      focusPark(request.parkId);
    }
  }, [pendingFocus, catalog.status, focusLandmark, focusPark]);

  return { focusLandmark, focusPark };
}
