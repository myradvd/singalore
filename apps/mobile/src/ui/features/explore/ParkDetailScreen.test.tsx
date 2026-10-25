import { fireEvent, render, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { catalogFixture, LANDMARK_SHELTER, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { ParkDetailScreen } from './ParkDetailScreen';

const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: mockDismissTo }) }));

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
