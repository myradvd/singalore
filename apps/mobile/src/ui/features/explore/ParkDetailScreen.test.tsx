import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import type { AppServices } from '@/composition/container';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, LANDMARK_SHELTER, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { ParkDetailScreen } from './ParkDetailScreen';

const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: mockDismissTo }) }));

// Stores one downloaded landmark row the way a park download does.
async function storeDetail(services: AppServices, landmarkId: string, description: string, imageLocalPath: string | null): Promise<void>
{
  await services.packDetails.storeDetails({ schemaVersion: 1, parkId: PARK_CIVIC, etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [{ landmarkId, description, imageUrl: null }], podcasts: [], files: [] });
  await services.packDetails.setLandmarkImageLocalPath(landmarkId, imageLocalPath);
}

// Reads the description and image URI a park row is showing.
function shownRow(slug: string): { text: unknown; uri: unknown }
{
  return { text: screen.getByTestId(`park-landmark-description-${slug}`).props.children, uri: screen.getByTestId(`park-landmark-image-${slug}`).props.source[0].uri };
}

describe('ParkDetailScreen', () =>
{
  beforeEach(() =>
  {
    applyCatalogSnapshot(catalogFixture());
    mockDismissTo.mockClear();
    useMapUiStore.setState({ pendingFocus: null });
  });

  it('lists the landmarks of a park in order with attribution', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_CIVIC} />);
    expect(screen.getByText('Civic District')).toBeTruthy();
    expect(screen.getByText('2 SITES')).toBeTruthy();
    expect(screen.getByTestId('park-landmark-chijmes')).toBeTruthy();
    expect(screen.getByText(/CHIJMES: Wikidata Q1072593/)).toBeTruthy();
  });

  it('shows "Description unavailable." for landmarks without text', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    expect(screen.getAllByText(COPY.descriptionUnavailable).length).toBeGreaterThan(0);
  });

  it('downloaded rows: each of 2 rows shows its own full text and local image (UC 1.4.2)', async () =>
  {
    const services = await createTestServices();
    await storeDetail(services, LANDMARK_CHIJMES, 'Full CHIJMES history.', 'file:///packs/civic/chijmes.jpg');
    await storeDetail(services, LANDMARK_RAFFLES, 'Full Raffles history.', 'file:///packs/civic/raffles.jpg');
    await renderWithServices(services, <ParkDetailScreen parkId={PARK_CIVIC} />);
    await act(async () => undefined);
    expect(shownRow('chijmes')).toEqual({ text: 'Full CHIJMES history.', uri: 'file:///packs/civic/chijmes.jpg' });
    expect(shownRow('raffles-hotel')).toEqual({ text: 'Full Raffles history.', uri: 'file:///packs/civic/raffles.jpg' });
  });

  it('plain row: no detail row gives the short text and remote image', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_CIVIC} />);
    await act(async () => undefined);
    const chijmes = catalogFixture().landmarks.find((landmark) => landmark.id === LANDMARK_CHIJMES);
    expect(shownRow('chijmes')).toEqual({ text: chijmes?.shortDescription, uri: chijmes?.thumbnailUrl });
  });

  it('empty text: empty short and full descriptions give "Description unavailable."', async () =>
  {
    const services = await createTestServices();
    await storeDetail(services, LANDMARK_SHELTER, '', null);
    await renderWithServices(services, <ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    await act(async () => undefined);
    expect(screen.getByTestId('park-landmark-description-tiong-bahru-air-raid-shelter').props.children).toBe(COPY.descriptionUnavailable);
  });

  it('sends See on map requests to the home map', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    await fireEvent.press(screen.getByTestId('see-on-map-tiong-bahru-air-raid-shelter'));
    expect(useMapUiStore.getState().pendingFocus).toEqual({ kind: 'landmark', landmarkId: LANDMARK_SHELTER });
    expect(mockDismissTo).toHaveBeenCalledWith('/');
    await fireEvent.press(screen.getByTestId('park-see-on-map'));
    expect(useMapUiStore.getState().pendingFocus).toEqual({ kind: 'park', parkId: PARK_TIONG_BAHRU });
  });

  it('handles a park that disappeared from the catalog', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId="00000000-0000-4000-8000-000000000000" />);
    expect(screen.getByText('Park not found')).toBeTruthy();
  });
});
