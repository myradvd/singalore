import { act, screen } from '@testing-library/react-native';
import { API_PATHS, type CatalogLandmark, type CatalogResponse, type PackResponse } from '@singalore/shared';
import type { AppServices } from '@/composition/container';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { SummaryCard } from './SummaryCard';
import { useLandmarkDetail } from './useLandmarkDetail';

const SHORT_TEXT = 'S'.repeat(140);
const FULL_TEXT = `${SHORT_TEXT} and the rest of the downloaded history of the site.`;

// Catalog and pack payloads as the CMS sends them: one landmark with text (like Chinese Heritage Centre) and one without (like Nantah Arch).
function payloads(): { catalog: CatalogResponse; pack: PackResponse }
{
  const base = catalogFixture();
  const catalog: CatalogResponse = {
    ...base,
    landmarks: base.landmarks.map((landmark) =>
    {
      if (landmark.id === LANDMARK_CHIJMES)
      {
        return { ...landmark, shortDescription: SHORT_TEXT };
      }
      return landmark.id === LANDMARK_RAFFLES ? { ...landmark, shortDescription: '' } : landmark;
    }),
  };
  const pack: PackResponse = {
    schemaVersion: 1,
    parkId: PARK_CIVIC,
    etag: '"pack-1"',
    generatedAt: '2026-10-12T00:00:00.000Z',
    totalBytes: 0,
    landmarks: [{ landmarkId: LANDMARK_CHIJMES, description: FULL_TEXT, imageUrl: null }, { landmarkId: LANDMARK_RAFFLES, description: '', imageUrl: null }],
    podcasts: [],
    files: [],
  };
  return { catalog, pack };
}

// Serves the payloads through fetch so the data passes the API client, the zod schemas and SQLite.
function fakeCms(catalog: CatalogResponse, pack: PackResponse): typeof fetch
{
  return async (input) =>
  {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith(API_PATHS.catalog))
    {
      return new Response(JSON.stringify(catalog), { status: 200, headers: { 'content-type': 'application/json', 'etag': catalog.etag } });
    }
    if (url.endsWith(API_PATHS.pack(PARK_CIVIC)))
    {
      return new Response(JSON.stringify(pack), { status: 200, headers: { 'content-type': 'application/json', 'etag': pack.etag } });
    }
    return new Response(null, { status: 404 });
  };
}

function DetailCard({ landmark }: { landmark: CatalogLandmark })
{
  const detail = useLandmarkDetail(landmark.id);
  return <SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={detail.description} imageUri={detail.imageUri} onClose={jest.fn()} />;
}

describe('landmark description from API payload to summary card', () =>
{
  let services: AppServices;
  let stored: Map<string, CatalogLandmark>;

  beforeEach(async () =>
  {
    useDownloadsStore.setState({ records: {} });
    const { catalog, pack } = payloads();
    services = await createTestServices(fakeCms(catalog, pack));
    expect(await services.catalogSync.sync()).toMatchObject({ kind: 'updated' });
    stored = new Map((await services.catalogRepository.load()).landmarks.map((landmark) => [landmark.id, landmark]));
  });

  // Renders the card for one landmark as read back from SQLite.
  async function showCard(landmarkId: string): Promise<void>
  {
    const landmark = stored.get(landmarkId);
    if (landmark === undefined)
    {
      throw new Error('landmark lost between catalog payload and SQLite');
    }
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
  }

  it('before download, the catalog short text survives the round trip and Read more stays hidden', async () =>
  {
    await showCard(LANDMARK_CHIJMES);
    expect(screen.getByTestId('summary-description').props.children).toBe(SHORT_TEXT);
    expect(screen.queryByTestId('summary-read-more')).toBeNull();
  });

  it('after download, the full pack description reaches the card with Read more', async () =>
  {
    await services.packDetails.fetchPack(PARK_CIVIC);
    await showCard(LANDMARK_CHIJMES);
    expect(screen.getByTestId('summary-description').props.children).toBe(FULL_TEXT);
    expect(screen.getByTestId('summary-read-more')).toBeTruthy();
  });

  it('a landmark with no text anywhere shows Description unavailable without Read more', async () =>
  {
    await services.packDetails.fetchPack(PARK_CIVIC);
    await showCard(LANDMARK_RAFFLES);
    expect(screen.getByTestId('summary-description').props.children).toBe(COPY.descriptionUnavailable);
    expect(screen.queryByTestId('summary-read-more')).toBeNull();
  });

  it('removing the download drops the full text and the card falls back to the catalog text', async () =>
  {
    await services.packDetails.fetchPack(PARK_CIVIC);
    await services.downloads.remove(PARK_CIVIC);
    expect(await services.packDetails.landmarkDetail(LANDMARK_CHIJMES)).toBeNull();
    await showCard(LANDMARK_CHIJMES);
    expect(screen.getByTestId('summary-description').props.children).toBe(SHORT_TEXT);
  });
});
