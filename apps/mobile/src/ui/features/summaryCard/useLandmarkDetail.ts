import { useEffect, useState } from 'react';
import { useAppServices } from '@/composition/AppServicesContext';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';

export interface LandmarkDetail
{
  description: string | null;
  imageUri: string | null;
}

const NO_DETAIL: LandmarkDetail = { description: null, imageUri: null };

// Loads the downloaded description and photo of a landmark, reloading when its park's download state changes.
export function useLandmarkDetail(landmarkId: string | null): LandmarkDetail
{
  const services = useAppServices();
  const parkId = useCatalogStore((state) => (landmarkId === null ? undefined : state.landmarksById.get(landmarkId)?.parkId));
  const packState = useDownloadsStore((state) => (parkId === undefined ? undefined : state.records[parkId]?.state));
  const [loaded, setLoaded] = useState<{ landmarkId: string; detail: LandmarkDetail } | null>(null);

  useEffect(() =>
  {
    if (landmarkId === null)
    {
      return undefined;
    }
    let cancelled = false;
    void services.packDetails.landmarkDetail(landmarkId).then(
      (row) => (row === null ? NO_DETAIL : { description: row.description.trim().length > 0 ? row.description : null, imageUri: row.imageLocalPath }),
      () => NO_DETAIL,
    ).then((detail) =>
    {
      if (!cancelled)
      {
        setLoaded({ landmarkId, detail });
      }
    });
    return () =>
    {
      cancelled = true;
    };
  }, [landmarkId, packState, services]);

  return loaded?.landmarkId === landmarkId ? loaded.detail : NO_DETAIL;
}
