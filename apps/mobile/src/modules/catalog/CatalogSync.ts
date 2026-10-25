import { API_PATHS, CatalogResponse } from '@singalore/shared';
import type { AppEventBus } from '@/core/appEvents';
import type { Clock } from '@/core/clock';
import type { DiagnosticsRecorder } from '@/core/diagnostics';
import { ApiRequestError, type ApiClient } from '@/core/http/ApiClient';
import type { CatalogRepository } from './CatalogRepository';
import type { CatalogSnapshot } from './types';

export type CatalogSyncOutcome =
  | { kind: 'updated'; snapshot: CatalogSnapshot }
  | { kind: 'not_modified'; snapshot: CatalogSnapshot }
  | { kind: 'failed_using_cache'; snapshot: CatalogSnapshot; reason: string }
  | { kind: 'failed_no_cache'; reason: string };

export class CatalogSync
{
  private inFlight: Promise<CatalogSyncOutcome> | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly repository: CatalogRepository,
    private readonly clock: Clock,
    private readonly events: AppEventBus,
    private readonly diagnostics: DiagnosticsRecorder,
  )
  {
  }

  async loadCached(): Promise<CatalogSnapshot | null>
  {
    const etag = await this.repository.getMeta('catalog_etag');
    return etag === null ? null : this.loadLocalized();
  }

  private async loadLocalized(): Promise<CatalogSnapshot>
  {
    const snapshot = await this.repository.load();
    const localize = (url: string) => this.api.localizeMediaUrl(url);
    return {
      parks: snapshot.parks.map((park) => ({ ...park, thumbnailUrl: park.thumbnailUrl === null ? null : localize(park.thumbnailUrl) })),
      landmarks: snapshot.landmarks.map((landmark) => ({ ...landmark, thumbnailUrl: landmark.thumbnailUrl === null ? null : localize(landmark.thumbnailUrl) })),
      podcasts: snapshot.podcasts.map((podcast) => ({ ...podcast, audioUrl: localize(podcast.audioUrl) })),
    };
  }

  sync(): Promise<CatalogSyncOutcome>
  {
    if (this.inFlight === null)
    {
      this.inFlight = this.runSync().finally(() =>
      {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async runSync(): Promise<CatalogSyncOutcome>
  {
    const etag = await this.repository.getMeta('catalog_etag');
    try
    {
      const result = await this.api.get(API_PATHS.catalog, CatalogResponse, { ifNoneMatch: etag, timeoutMs: 15000 });
      if (result.status === 'not_modified')
      {
        await this.repository.setMeta('catalog_synced_at', new Date(this.clock.now()).toISOString());
        return { kind: 'not_modified', snapshot: await this.loadLocalized() };
      }
      await this.repository.replaceAll(result.data, new Date(this.clock.now()).toISOString());
      const snapshot = await this.loadLocalized();
      this.events.emit('catalog/updated', {
        parkCount: snapshot.parks.length,
        landmarkCount: snapshot.landmarks.length,
        podcastCount: snapshot.podcasts.length,
      });
      return { kind: 'updated', snapshot };
    }
    catch (error)
    {
      const reason = error instanceof ApiRequestError ? error.kind : 'unknown';
      await this.diagnostics.record('warn', 'catalog_sync_failed', reason);
      if (etag === null)
      {
        return { kind: 'failed_no_cache', reason };
      }
      return { kind: 'failed_using_cache', snapshot: await this.loadLocalized(), reason };
    }
  }
}
