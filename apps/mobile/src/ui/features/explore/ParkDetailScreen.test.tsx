import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import ParkDetailRoute from '@/app/explore/[parkId]';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import type { AppServices } from '@/composition/container';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_MARKET, LANDMARK_RAFFLES, LANDMARK_SHELTER, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { spacing } from '../../theme/tokens';
import { showToast, useToastStore } from '../../toastStore';
import { ParkDetailScreen } from './ParkDetailScreen';

const mockDismissTo = jest.fn();
let mockRouteParams: { parkId: string; site?: string } = { parkId: '0b5a2f10-0000-4000-8000-000000000001' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockRouteParams,
}));

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

const BODY_Y = 216;
const ROW_Y = 500;

// Reports a measured vertical position for an element, as the device would after layout.
async function reportLayout(testId: string, y: number): Promise<void>
{
  await fireEvent(screen.getByTestId(testId), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height: 120 } } });
}

// Renders the park screen for one site, inside the app services its rows need.
async function renderForSite(focusSiteId: string | undefined): Promise<void>
{
  await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={focusSiteId} />);
}

describe('ParkDetailScreen opened for one site', () =>
{
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');

  // Lengthens every description past the row limit, so each row offers Read more.
  function catalogWithLongDescriptions(): ReturnType<typeof catalogFixture>
  {
    const fixture = catalogFixture();
    return { ...fixture, landmarks: fixture.landmarks.map((landmark) => ({ ...landmark, shortDescription: `${landmark.shortDescription} ${'x'.repeat(80)}` })) };
  }

  beforeEach(() =>
  {
    applyCatalogSnapshot(catalogWithLongDescriptions());
    scrollTo.mockClear();
  });

  it('scrolls to the chosen row once its position is known, and only once', async () =>
  {
    await renderForSite(LANDMARK_RAFFLES);
    expect(scrollTo).not.toHaveBeenCalled();
    await reportLayout('park-detail-body', BODY_Y);
    expect(scrollTo).not.toHaveBeenCalled();
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: BODY_Y + ROW_Y - spacing.md, animated: false });
    await reportLayout('park-landmark-raffles-hotel', ROW_Y + 50);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('scrolls when the row is measured before the body', async () =>
  {
    await renderForSite(LANDMARK_RAFFLES);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    await reportLayout('park-detail-body', BODY_Y);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('ignores the layout of a row that was not chosen', async () =>
  {
    await renderForSite(LANDMARK_RAFFLES);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-chijmes', ROW_Y);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('expands only the chosen row, which can still be collapsed', async () =>
  {
    await renderForSite(LANDMARK_RAFFLES);
    const chosenRow = within(screen.getByTestId('park-landmark-raffles-hotel'));
    expect(chosenRow.getByText('Show less')).toBeTruthy();
    expect(screen.getByTestId('park-landmark-description-raffles-hotel').props.numberOfLines).toBeUndefined();
    expect(within(screen.getByTestId('park-landmark-chijmes')).getByText('Read more')).toBeTruthy();
    await fireEvent.press(chosenRow.getByText('Show less'));
    expect(screen.getByTestId('park-landmark-description-raffles-hotel').props.numberOfLines).toBe(2);
  });

  it.each([
    ['absent', undefined],
    ['an unknown id', '00000000-0000-4000-8000-000000000000'],
    ['a site in another park', LANDMARK_MARKET],
  ])('%s site param does not scroll or expand anything', async (_name, focusSiteId) =>
  {
    await renderForSite(focusSiteId);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    await reportLayout('park-landmark-chijmes', ROW_Y);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByText('Show less')).toBeNull();
    expect(screen.getAllByText('Read more')).toHaveLength(2);
  });

  it('the route passes the site param to the screen', async () =>
  {
    mockRouteParams = { parkId: PARK_CIVIC, site: LANDMARK_RAFFLES };
    await renderWithServices(await createTestServices(), <ParkDetailRoute />);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('the route without a site param opens the park as before', async () =>
  {
    mockRouteParams = { parkId: PARK_CIVIC };
    await renderWithServices(await createTestServices(), <ParkDetailRoute />);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByText('Show less')).toBeNull();
  });
});

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

  it.each([[79, false], [80, false], [81, true]])('Read more with a %i character description: shown is %s (UC 1.2.2)', async (length, shown) =>
  {
    const services = await createTestServices();
    await storeDetail(services, LANDMARK_CHIJMES, 'x'.repeat(length), null);
    await renderWithServices(services, <ParkDetailScreen parkId={PARK_CIVIC} />);
    await act(async () => undefined);
    expect(screen.queryByTestId('read-more-chijmes') !== null).toBe(shown);
  });

  it('Read more above the limit expands to the full text and toggles to "Show less"', async () =>
  {
    const services = await createTestServices();
    await storeDetail(services, LANDMARK_CHIJMES, 'x'.repeat(81), null);
    await renderWithServices(services, <ParkDetailScreen parkId={PARK_CIVIC} />);
    await act(async () => undefined);
    expect(screen.getByTestId('park-landmark-description-chijmes').props.numberOfLines).toBe(2);
    expect(screen.getByText('Read more')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('read-more-chijmes'));
    expect(screen.getByTestId('park-landmark-description-chijmes').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Show less')).toBeTruthy();
  });

  it('no text: "Description unavailable." shows without Read more', async () =>
  {
    await renderWithServices(await createTestServices(), <ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    await act(async () => undefined);
    expect(screen.getByTestId('park-landmark-description-tiong-bahru-air-raid-shelter').props.children).toBe(COPY.descriptionUnavailable);
    expect(screen.queryByTestId('read-more-tiong-bahru-air-raid-shelter')).toBeNull();
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

describe('park landmark add button (T2-1, design 6.4)', () =>
{
  // Returns the messages of the toasts on screen.
  function toastMessages(): string[]
  {
    return useToastStore.getState().toasts.map((toast) => toast.message);
  }

  beforeEach(async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
    useToastStore.setState({ toasts: [] });
    configureFlowRuntime({
      onEffect: (effect) =>
      {
        if (effect.type === 'toast')
        {
          showToast(effect.message);
        }
      },
      persist: () =>
      {
      },
    });
    await renderWithServices(await createTestServices(), <ParkDetailRoute />);
  });

  it('gives each landmark row one button of at least 48 dp', () =>
  {
    for (const slug of ['chijmes', 'raffles-hotel'])
    {
      const style = StyleSheet.flatten(screen.getByTestId(`add-stop-${slug}`).props.style) as { width: number; height: number };
      expect(style.width).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeGreaterThanOrEqual(48);
    }
  });

  it('valid EC, new stop: adds it and shows the added toast', async () =>
  {
    await fireEvent.press(screen.getByTestId('add-stop-chijmes'));
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_CHIJMES]);
    expect(toastMessages()).toEqual([COPY.stopAddedToRoute]);
  });

  it('valid EC, stop already in the route: shows only the exact duplicate toast', async () =>
  {
    dispatchFlow({ type: 'addToItinerary', landmarkId: LANDMARK_CHIJMES });
    await fireEvent.press(screen.getByTestId('add-stop-chijmes'));
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_CHIJMES]);
    expect(toastMessages()).toEqual(['Landmark is already in your route.']);
  });

  it('valid EC, route at 11 stops: stays at 11 and shows only the cap toast', async () =>
  {
    dispatchFlow({ type: 'loadItinerary', landmarkIds: Array.from({ length: 11 }, (_, index) => `stop-${index}`) });
    await fireEvent.press(screen.getByTestId('add-stop-chijmes'));
    expect(useFlowStore.getState().state.itinerary).toHaveLength(11);
    expect(toastMessages()).toEqual(['A route can have at most 11 stops.']);
  });
});
