import { buildCatalog } from '@/server/catalogBuilder';
import { loadPublishedCatalogRows } from '@/server/catalogRepository';
import { mediaBaseUrl, serverEnv } from '@/server/env';
import { apiError, snapshotResponse } from '@/server/http';
import { supabaseAdmin } from '@/server/supabaseAdmin';

export async function GET(request: Request): Promise<Response>
{
  try
  {
    const rows = await loadPublishedCatalogRows(supabaseAdmin());
    const catalog = buildCatalog(rows, mediaBaseUrl(serverEnv()), new Date());
    return snapshotResponse(request, catalog.etag, catalog);
  }
  catch (error)
  {
    console.error('catalog_failed', error instanceof Error ? error.message : 'unknown');
    return apiError('internal', 'Catalog is temporarily unavailable.', 503);
  }
}
