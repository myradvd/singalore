import { fireEvent, render, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { catalogFixture, PARK_CIVIC } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
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
    useCatalogStore.setState({ snapshot: EMPTY_CATALOG });
    await render(<ExploreListScreen />);
    expect(screen.getByText(COPY.emptyCatalogTitle)).toBeTruthy();
  });
});
