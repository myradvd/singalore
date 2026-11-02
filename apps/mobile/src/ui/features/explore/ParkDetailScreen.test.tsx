import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ParkDetailRoute from '@/app/explore/[parkId]';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { configureFlowRuntime, dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_SHELTER, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { showToast, useToastStore } from '../../toastStore';
import { ParkDetailScreen } from './ParkDetailScreen';

const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => ({ parkId: '0b5a2f10-0000-4000-8000-000000000001' }),
}));

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
