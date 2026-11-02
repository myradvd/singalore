import type { CatalogResponse } from '@singalore/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { useLocationStore } from '@/modules/location/locationStore';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_MARKET, PARK_CIVIC, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { nearestSites } from './nearestSites';
import { ExploreListScreen, filterParks } from './ExploreListScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }) }));
jest.mock('./nearestSites', () =>
{
  const actual = jest.requireActual<typeof import('./nearestSites')>('./nearestSites');
  return { ...actual, nearestSites: jest.fn(actual.nearestSites) };
});

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

const FIX_POINT = { lat: 1.29, lng: 103.85 };

// Puts the user at a point, or removes their GPS fix when given null.
function setUserFix(point: { lat: number; lng: number } | null): void
{
  useLocationStore.setState(point === null
    ? { lastFix: null, status: 'idle' }
    : { lastFix: { latitude: point.lat, longitude: point.lng, accuracyMeters: 5, timestamp: 0, source: 'device' }, status: 'ok' });
}

// Builds a catalog with one park and sites in a row, each further north of the fix than the last.
function catalogWithSites(count: number): CatalogResponse
{
  const catalog = catalogFixture();
  const template = catalog.landmarks[0]!;
  return {
    ...catalog,
    podcasts: [],
    landmarks: Array.from({ length: count }, (_, index) => ({
      ...template,
      id: `site-${index}`,
      slug: `site-${index}`,
      name: `Row site ${index}`,
      parkId: PARK_CIVIC,
      position: { lat: FIX_POINT.lat + (index + 1) * 0.001, lng: FIX_POINT.lng },
    })),
  };
}

// Lists the test ids of the nearby rows in screen order.
function nearbyRowIds(): string[]
{
  return screen.queryAllByTestId(/^nearby-site-/).map((row) => row.props.testID as string);
}

// Opens the picker and chooses one option from it.
async function chooseLocation(optionTestId: string): Promise<void>
{
  await fireEvent.press(screen.getByTestId('nearby-select-location'));
  await fireEvent.press(screen.getByTestId(optionTestId));
}

describe('ExploreListScreen nearest to you section', () =>
{
  beforeEach(() =>
  {
    mockPush.mockClear();
    setUserFix(null);
    usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES });
  });

  afterAll(() => setUserFix(null));

  it('with no fix hides the section and shows the select a location prompt', async () =>
  {
    applyCatalogSnapshot(catalogWithSites(2));
    await render(<ExploreListScreen />);
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.getByText('Select a location to see nearby sites')).toBeTruthy();
    expect(screen.getByTestId('nearby-select-location')).toBeTruthy();
  });

  it('with a fix shows the section nearest first with a metric distance and no prompt', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(2));
    await render(<ExploreListScreen />);
    expect(screen.getByText('Nearest to you')).toBeTruthy();
    expect(nearbyRowIds()).toEqual(['nearby-site-site-0', 'nearby-site-site-1']);
    expect(screen.getByText('110 m  ·  Civic District')).toBeTruthy();
    expect(screen.queryByText('Select a location to see nearby sites')).toBeNull();
    expect(screen.queryByTestId('nearby-clear-location')).toBeNull();
  });

  it('uses the unit preference for the distance', async () =>
  {
    setUserFix(FIX_POINT);
    usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, distanceUnit: 'imperial' } });
    applyCatalogSnapshot(catalogWithSites(1));
    await render(<ExploreListScreen />);
    expect(screen.getByText('360 ft  ·  Civic District')).toBeTruthy();
  });

  it('0 sites with a fix hides the section and the picker', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(0));
    await render(<ExploreListScreen />);
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.queryByTestId('nearby-select-location')).toBeNull();
  });

  it('0 sites with no fix hides the prompt, because there is nothing to select', async () =>
  {
    applyCatalogSnapshot(catalogWithSites(0));
    await render(<ExploreListScreen />);
    expect(screen.queryByText('Select a location to see nearby sites')).toBeNull();
  });

  it.each([
    ['1 site', 1, 1],
    ['below the limit, 4 sites', 4, 4],
    ['on the limit, 5 sites', 5, 5],
    ['above the limit, 6 sites', 6, 5],
  ])('%s shows the right number of rows', async (_name, siteCount, rowCount) =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(siteCount));
    await render(<ExploreListScreen />);
    expect(nearbyRowIds()).toHaveLength(rowCount);
  });

  it('tapping a row opens the park detail at that site, and sends nothing off the device', async () =>
  {
    const fetchSpy = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await fireEvent.press(screen.getByTestId('nearby-site-tiong-bahru-market'));
    globalThis.fetch = originalFetch;
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/explore/${PARK_TIONG_BAHRU}?site=${LANDMARK_MARKET}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps rows and picker controls at least 48 dp tall', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(1));
    await render(<ExploreListScreen />);
    await fireEvent.press(screen.getByTestId('nearby-select-location'));
    for (const testId of ['nearby-site-site-0', 'nearby-select-location', 'nearby-picker-close', 'nearby-option-site-site-0', 'nearby-option-park-civic-district'])
    {
      const style = StyleSheet.flatten(screen.getByTestId(testId).props.style) as { minHeight?: number; height?: number };
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(48);
    }
    await fireEvent.press(screen.getByTestId('nearby-option-park-civic-district'));
    const clearStyle = StyleSheet.flatten(screen.getByTestId('nearby-clear-location').props.style) as { minHeight?: number };
    expect(clearStyle.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('signal loss hides the section and shows the prompt until the signal returns', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(2));
    await render(<ExploreListScreen />);
    await act(async () => useLocationStore.setState({ status: 'waiting_for_signal' }));
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.getByText('Select a location to see nearby sites')).toBeTruthy();
    await act(async () => useLocationStore.setState({ status: 'ok' }));
    expect(screen.getByText('Nearest to you')).toBeTruthy();
  });

  it('signal loss leaves a chosen location showing', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(3));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-2');
    await act(async () => useLocationStore.setState({ status: 'waiting_for_signal' }));
    expect(screen.getByText('Nearest to Row site 2')).toBeTruthy();
    expect(nearbyRowIds()).toEqual(['nearby-site-site-1', 'nearby-site-site-0']);
    expect(screen.queryByText('Select a location to see nearby sites')).toBeNull();
  });

  it('does not work out the list again on a new fix while a location is chosen', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(3));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-2');
    jest.mocked(nearestSites).mockClear();
    await act(async () => setUserFix({ lat: 1.3, lng: 103.86 }));
    expect(nearestSites).not.toHaveBeenCalled();
  });

  it('works out the list again when the user position moves', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(3));
    await render(<ExploreListScreen />);
    await act(async () => setUserFix({ lat: FIX_POINT.lat + 0.01, lng: FIX_POINT.lng }));
    expect(nearbyRowIds()).toEqual(['nearby-site-site-2', 'nearby-site-site-1', 'nearby-site-site-0']);
  });

  it('selecting a site measures from it and leaves it out, with no fix needed', async () =>
  {
    applyCatalogSnapshot(catalogWithSites(6));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-5');
    expect(screen.getByText('Nearest to Row site 5')).toBeTruthy();
    expect(screen.queryByText('Select a location to see nearby sites')).toBeNull();
    expect(nearbyRowIds()).toEqual(['nearby-site-site-4', 'nearby-site-site-3', 'nearby-site-site-2', 'nearby-site-site-1', 'nearby-site-site-0']);
  });

  it('selecting the only site hides the empty section but keeps the clear control', async () =>
  {
    applyCatalogSnapshot(catalogWithSites(1));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-0');
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.getByTestId('nearby-clear-location')).toBeTruthy();
  });

  it('selecting a park measures from its center and keeps the sites inside it', async () =>
  {
    setUserFix({ lat: 1.2855, lng: 103.8315 });
    const catalog = catalogFixture();
    applyCatalogSnapshot(catalog);
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-park-civic-district');
    const civicCenter = catalog.parks.find((park) => park.id === PARK_CIVIC)!.center;
    const expectedOrder = nearestSites(catalog.landmarks, civicCenter).map((nearby) => `nearby-site-${nearby.site.slug}`);
    expect(screen.getByText('Nearest to Civic District')).toBeTruthy();
    expect(nearbyRowIds()).toEqual(expectedOrder);
    expect(nearbyRowIds()).toHaveLength(catalog.landmarks.length);
    expect(nearbyRowIds()).toEqual(expect.arrayContaining(['nearby-site-chijmes', 'nearby-site-raffles-hotel']));
  });

  it('clearing the choice goes back to the user position', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(6));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-5');
    await fireEvent.press(screen.getByTestId('nearby-clear-location'));
    expect(screen.getByText('Nearest to you')).toBeTruthy();
    expect(nearbyRowIds()[0]).toBe('nearby-site-site-0');
    expect(screen.queryByTestId('nearby-clear-location')).toBeNull();
  });

  it('clearing the choice with no fix goes back to the prompt', async () =>
  {
    applyCatalogSnapshot(catalogWithSites(2));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-0');
    await fireEvent.press(screen.getByTestId('nearby-clear-location'));
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.getByText('Select a location to see nearby sites')).toBeTruthy();
  });

  it('does not keep the choice after Explore closes', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(2));
    const firstVisit = await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-1');
    await firstVisit.unmount();
    await render(<ExploreListScreen />);
    expect(screen.getByText('Nearest to you')).toBeTruthy();
  });

  it('closing the picker without choosing changes nothing', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(2));
    await render(<ExploreListScreen />);
    await fireEvent.press(screen.getByTestId('nearby-select-location'));
    await fireEvent.press(screen.getByTestId('nearby-picker-close'));
    expect(screen.queryByTestId('nearby-option-site-site-1')).toBeNull();
    expect(screen.getByText('Nearest to you')).toBeTruthy();
  });

  it('a site removed from the catalog drops off the list', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(6));
    await render(<ExploreListScreen />);
    const catalog = catalogWithSites(6);
    await act(async () => applyCatalogSnapshot({ ...catalog, landmarks: catalog.landmarks.filter((site) => site.id !== 'site-0') }));
    expect(nearbyRowIds()).toEqual(['nearby-site-site-1', 'nearby-site-site-2', 'nearby-site-site-3', 'nearby-site-site-4', 'nearby-site-site-5']);
  });

  it('a chosen site removed from the catalog falls back to the user position', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogWithSites(3));
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-site-2');
    await act(async () => applyCatalogSnapshot(catalogWithSites(2)));
    expect(screen.getByText('Nearest to you')).toBeTruthy();
    expect(screen.queryByTestId('nearby-clear-location')).toBeNull();
  });

  it('a chosen park removed from the catalog falls back to the prompt with no fix', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-park-tiong-bahru');
    const catalog = catalogFixture();
    await act(async () => applyCatalogSnapshot({
      ...catalog,
      parks: catalog.parks.filter((park) => park.id !== PARK_TIONG_BAHRU),
      landmarks: catalog.landmarks.filter((site) => site.parkId !== PARK_TIONG_BAHRU),
    }));
    expect(screen.getByText('Select a location to see nearby sites')).toBeTruthy();
    expect(screen.queryByTestId('nearby-section')).toBeNull();
  });

  it('skips a site whose park left the catalog, because its details could not open', async () =>
  {
    setUserFix(FIX_POINT);
    const catalog = catalogFixture();
    applyCatalogSnapshot({ ...catalog, parks: catalog.parks.filter((park) => park.id !== PARK_TIONG_BAHRU) });
    await render(<ExploreListScreen />);
    expect(screen.queryByTestId('nearby-site-tiong-bahru-market')).toBeNull();
    expect(screen.getByTestId('nearby-site-chijmes')).toBeTruthy();
  });

  it('hides while a text filter is active and comes back with the choice kept', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await chooseLocation('nearby-option-site-chijmes');
    await fireEvent.changeText(screen.getByTestId('explore-filter'), 'tiong');
    expect(screen.queryByTestId('nearby-section')).toBeNull();
    expect(screen.queryByTestId('nearby-select-location')).toBeNull();
    expect(screen.getByTestId('explore-park-tiong-bahru')).toBeTruthy();
    expect(screen.queryByTestId('explore-park-civic-district')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('explore-filter'), '');
    expect(screen.getByText('Nearest to CHIJMES')).toBeTruthy();
  });

  it('hides the prompt while a district filter is active and brings it back for all districts', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await fireEvent.press(screen.getByTestId('district-Bukit Merah'));
    expect(screen.queryByText('Select a location to see nearby sites')).toBeNull();
    expect(screen.queryByTestId('explore-park-civic-district')).toBeNull();
    await fireEvent.press(screen.getByText('All districts'));
    expect(screen.getByText('Select a location to see nearby sites')).toBeTruthy();
  });

  it('stays visible for a filter of only spaces, which filters nothing', async () =>
  {
    setUserFix(FIX_POINT);
    applyCatalogSnapshot(catalogFixture());
    await render(<ExploreListScreen />);
    await fireEvent.changeText(screen.getByTestId('explore-filter'), '   ');
    expect(screen.getByTestId('nearby-section')).toBeTruthy();
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
