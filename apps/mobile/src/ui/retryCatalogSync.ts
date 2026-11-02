import type { CatalogSync } from '@/modules/catalog/CatalogSync';
import { refreshCatalog } from '@/modules/catalog/catalogStore';
import { COPY } from './copy';
import { showToast } from './toastStore';

// Retries the catalog sync and shows a toast when there is still nothing to show.
export function retryCatalogSync(catalogSync: CatalogSync): void
{
  void refreshCatalog(catalogSync).then((outcome) =>
  {
    if (outcome.kind === 'failed_no_cache')
    {
      showToast(COPY.catalogFetchFailed, 'error');
    }
  });
}
