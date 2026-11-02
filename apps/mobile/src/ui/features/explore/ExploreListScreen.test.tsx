import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { catalogFixture, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { useToastStore } from '../../toastStore';
import { ExploreListScreen, filterParks } from './ExploreListScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }) }));

describe('filterParks', () =>
{
  const parks = catalogFixture().parks;

  it('filters by name, district and both', async () =>
  {
    expect(filterParks(parks, 'civic', null).map((park) => park.slug)).toEqual(['civic-district']);
    expect(filterParks(parks, '', 'Bukit Merah').map((park) => park.slug)).toEqual(['tiong-bahru']);
    expect(filterParks(parks, 'bukit', null).map((park) => park.slug)).toEqual(['tiong-bahru']);
    expect(filterParks(parks, 'civic', 'Bukit Merah')).toEqual([]);
  });
});

describe('ExploreListScreen (Explore menu)', () =>
{
  beforeEach(() => mockPush.mockClear());

  it('lists parks, filters by district and opens a park', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    expect(screen.getByTestId('explore-park-civic-district')).toBeTruthy();
    expect(screen.getByTestId('explore-park-tiong-bahru')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('district-Bukit Merah'));
    expect(screen.queryByTestId('explore-park-civic-district')).toBeNull();
    await fireEvent.press(screen.getByText('All districts'));
    await fireEvent.press(screen.getByTestId('explore-park-civic-district'));
    expect(mockPush).toHaveBeenCalledWith(`/explore/${PARK_CIVIC}`);
  });

  it('shows the no match message', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await fireEvent.changeText(screen.getByTestId('explore-filter'), 'nothing like this');
    expect(screen.getByTestId('explore-empty')).toBeTruthy();
  });

  it('shows the empty catalog state before the first sync', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <ExploreListScreen />);
    expect(screen.getByText(COPY.emptyCatalogTitle)).toBeTruthy();
  });

  it('shows the Home copy with Try again when the catalog is ready with 0 parks', async () =>
  {
    useCatalogStore.setState({ status: 'ready', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <ExploreListScreen />);
    expect(screen.getByText('No heritage map yet')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
  });

  it('shows loading, not the empty title, while the first sync runs with 0 parks', async () =>
  {
    useCatalogStore.setState({ status: 'loading', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <ExploreListScreen />);
    expect(screen.getByTestId('catalog-loading')).toBeTruthy();
    expect(screen.getByText('Loading heritage sites...')).toBeTruthy();
    expect(screen.queryByText('No heritage map yet')).toBeNull();
    expect(screen.queryByTestId('explore-empty')).toBeNull();
  });

  it('lists the parks, not loading, when status is loading with parks already held', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useCatalogStore.setState({ status: 'loading' });
    await render(<ExploreListScreen />);
    expect(screen.getByTestId('explore-park-civic-district')).toBeTruthy();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
  });

  it('shows the exact Home copy with Try again when unavailable', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <ExploreListScreen />);
    expect(screen.getByText('No heritage map yet')).toBeTruthy();
    expect(screen.getByText(COPY.emptyCatalogMessage)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
  });

  it('shows the exact toast when Try again fails with no cache', async () =>
  {
    useToastStore.setState({ toasts: [] });
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <ExploreListScreen />);
    await fireEvent.press(screen.getByText('Try again'));
    await act(async () => undefined);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Unable to fetch nearby landmarks. Check your connection.']);
  });

  it('lists the parks with no toast when Try again succeeds', async () =>
  {
    useToastStore.setState({ toasts: [] });
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    const services = await createTestServices();
    jest.spyOn(services.catalogSync, 'sync').mockResolvedValue({ kind: 'updated', snapshot: catalogFixture() });
    await renderWithServices(services, <ExploreListScreen />);
    await fireEvent.press(screen.getByText('Try again'));
    await act(async () => undefined);
    expect(screen.getByTestId('explore-park-civic-district')).toBeTruthy();
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('shows the exact search empty text, not the catalog states, when a filter matches nothing', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await fireEvent.changeText(screen.getByTestId('explore-filter'), 'nothing like this');
    expect(screen.getByText('No matching locations found. Try a different search.')).toBeTruthy();
    expect(screen.queryByText('No heritage map yet')).toBeNull();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
  });
});
