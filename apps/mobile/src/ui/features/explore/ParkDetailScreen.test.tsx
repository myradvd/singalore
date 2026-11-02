import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import ParkDetailRoute from '@/app/explore/[parkId]';
import { catalogFixture, LANDMARK_MARKET, LANDMARK_RAFFLES, LANDMARK_SHELTER, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { spacing } from '../../theme/tokens';
import { ParkDetailScreen } from './ParkDetailScreen';

const mockDismissTo = jest.fn();
let mockRouteParams: { parkId: string; site?: string } = { parkId: '' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock('@/ui/features/downloads/PackActionButton', () => ({ PackActionButton: () => null }));

const BODY_Y = 216;
const ROW_Y = 500;

// Reports a measured vertical position for an element, as the device would after layout.
async function reportLayout(testId: string, y: number): Promise<void>
{
  await fireEvent(screen.getByTestId(testId), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height: 120 } } });
}

describe('ParkDetailScreen opened for one site', () =>
{
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');

  beforeEach(() =>
  {
    applyCatalogSnapshot(catalogFixture());
    scrollTo.mockClear();
  });

  it('scrolls to the chosen row once its position is known, and only once', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={LANDMARK_RAFFLES} />);
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
    await render(<ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={LANDMARK_RAFFLES} />);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    await reportLayout('park-detail-body', BODY_Y);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('ignores the layout of a row that was not chosen', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={LANDMARK_RAFFLES} />);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-chijmes', ROW_Y);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('expands only the chosen row, which can still be collapsed', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={LANDMARK_RAFFLES} />);
    const chosenRow = within(screen.getByTestId('park-landmark-raffles-hotel'));
    expect(chosenRow.getByText('Show less')).toBeTruthy();
    expect(chosenRow.getByText('Raffles Hotel is a historic luxury hotel.').props.numberOfLines).toBeUndefined();
    expect(within(screen.getByTestId('park-landmark-chijmes')).getByText('Read more')).toBeTruthy();
    await fireEvent.press(chosenRow.getByText('Show less'));
    expect(chosenRow.getByText('Raffles Hotel is a historic luxury hotel.').props.numberOfLines).toBe(2);
  });

  it.each([
    ['absent', undefined],
    ['an unknown id', '00000000-0000-4000-8000-000000000000'],
    ['a site in another park', LANDMARK_MARKET],
  ])('%s site param does not scroll or expand anything', async (_name, focusSiteId) =>
  {
    await render(<ParkDetailScreen parkId={PARK_CIVIC} focusSiteId={focusSiteId} />);
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
    await render(<ParkDetailRoute />);
    await reportLayout('park-detail-body', BODY_Y);
    await reportLayout('park-landmark-raffles-hotel', ROW_Y);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('the route without a site param opens the park as before', async () =>
  {
    mockRouteParams = { parkId: PARK_CIVIC };
    await render(<ParkDetailRoute />);
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
    await render(<ParkDetailScreen parkId={PARK_CIVIC} />);
    expect(screen.getByText('Civic District')).toBeTruthy();
    expect(screen.getByText('2 SITES')).toBeTruthy();
    expect(screen.getByTestId('park-landmark-chijmes')).toBeTruthy();
    expect(screen.getByText(/CHIJMES: Wikidata Q1072593/)).toBeTruthy();
  });

  it('shows "Description unavailable." for landmarks without text', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    expect(screen.getAllByText(COPY.descriptionUnavailable).length).toBeGreaterThan(0);
  });

  it('sends See on map requests to the home map', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_TIONG_BAHRU} />);
    await fireEvent.press(screen.getByTestId('see-on-map-tiong-bahru-air-raid-shelter'));
    expect(useMapUiStore.getState().pendingFocus).toEqual({ kind: 'landmark', landmarkId: LANDMARK_SHELTER });
    expect(mockDismissTo).toHaveBeenCalledWith('/');
    await fireEvent.press(screen.getByTestId('park-see-on-map'));
    expect(useMapUiStore.getState().pendingFocus).toEqual({ kind: 'park', parkId: PARK_TIONG_BAHRU });
  });

  it('handles a park that disappeared from the catalog', async () =>
  {
    await render(<ParkDetailScreen parkId="00000000-0000-4000-8000-000000000000" />);
    expect(screen.getByText('Park not found')).toBeTruthy();
  });
});
