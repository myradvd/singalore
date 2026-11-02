import type { CatalogLandmark } from '@singalore/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SearchIndex } from '@/modules/catalog/searchIndex';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { SEARCH_DEBOUNCE_MS, SearchOverlay } from './SearchOverlay';

const catalog = catalogFixture();
const index = new SearchIndex(catalog);
const parksById = new Map(catalog.parks.map((park) => [park.id, park]));
const landmarksById = new Map(catalog.landmarks.map((landmark) => [landmark.id, landmark]));

async function renderOverlay(overrides: Partial<Parameters<typeof SearchOverlay>[0]> = {})
{
  const props = {
    index,
    parksById,
    purpose: 'browse' as const,
    itineraryIds: [],
    landmarksById,
    recentLandmarkIds: [],
    userPosition: null,
    onClearRecent: jest.fn(),
    onSelectLandmark: jest.fn(),
    onSelectPark: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  await render(<SearchOverlay {...props} />);
  return props;
}

async function typeQuery(text: string): Promise<void>
{
  await fireEvent.changeText(screen.getByTestId('search-input'), text);
  await act(() =>
  {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
}

describe('SearchOverlay (A1)', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces input and shows grouped results', async () =>
  {
    await renderOverlay();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'Tiong Bahru');
    expect(screen.queryByText('HERITAGE PARKS')).toBeNull();
    await act(() =>
    {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(screen.getByText('HERITAGE PARKS')).toBeTruthy();
    expect(screen.getByText('LANDMARKS')).toBeTruthy();
    expect(screen.getByTestId('search-park-tiong-bahru')).toBeTruthy();
  });

  it('shows the A1 empty message', async () =>
  {
    await renderOverlay();
    await typeQuery('qqqqzzzz');
    expect(screen.getByTestId('search-empty').props.children).toBe(COPY.searchEmpty);
  });

  it('selects landmarks and parks', async () =>
  {
    const props = await renderOverlay();
    await typeQuery('Chimjes');
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(props.onSelectLandmark).toHaveBeenCalledWith(LANDMARK_CHIJMES);
    await typeQuery('Tiong Bahru');
    await fireEvent.press(screen.getByTestId('search-park-tiong-bahru'));
    expect(props.onSelectPark).toHaveBeenCalledWith(PARK_TIONG_BAHRU);
  });

  it('multi-selects sites to add when opened from the route editor', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute', itineraryIds: [LANDMARK_CHIJMES] });
    await typeQuery('Raffles');
    expect(screen.queryByText('HERITAGE PARKS')).toBeNull();
    await fireEvent.press(screen.getByTestId('search-add-raffles-hotel'));
    await fireEvent.press(screen.getByTestId('search-add-picked'));
    expect(props.onClose).toHaveBeenCalledWith([LANDMARK_RAFFLES]);
    await typeQuery('Chijmes');
    expect(screen.getByTestId('search-add-chijmes').props.accessibilityState.disabled).toBe(true);
  });

  it('closes with nothing picked from browse mode', async () =>
  {
    const props = await renderOverlay();
    await fireEvent.press(screen.getByTestId('close-search'));
    expect(props.onClose).toHaveBeenCalledWith([]);
  });
});

describe('SearchOverlay minimum length hint (T2-2)', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('zero: an empty query shows no hint', async () =>
  {
    await renderOverlay();
    await typeQuery('');
    expect(screen.queryByText('Type at least 2 letters to search.')).toBeNull();
    expect(screen.queryByTestId('search-empty')).toBeNull();
  });

  it('spaces only: a query that trims to 0 characters shows no hint', async () =>
  {
    await renderOverlay();
    await typeQuery('   ');
    expect(screen.queryByText('Type at least 2 letters to search.')).toBeNull();
  });

  it('below: "a" shows the exact hint and not the empty results text', async () =>
  {
    await renderOverlay();
    await typeQuery('a');
    expect(screen.getByText('Type at least 2 letters to search.')).toBeTruthy();
    expect(screen.queryByTestId('search-empty')).toBeNull();
  });

  it('spaces: " a " trims to 1 character and shows the hint', async () =>
  {
    await renderOverlay();
    await typeQuery(' a ');
    expect(screen.getByText('Type at least 2 letters to search.')).toBeTruthy();
  });

  it('on: "ch" shows no hint and the search runs', async () =>
  {
    await renderOverlay();
    await typeQuery('ch');
    expect(screen.queryByText('Type at least 2 letters to search.')).toBeNull();
    expect(screen.getByTestId('search-landmark-chijmes')).toBeTruthy();
  });

  it('no match: "zzz" shows the exact SRS empty results text and no hint', async () =>
  {
    await renderOverlay();
    await typeQuery('zzz');
    expect(screen.getByText('No matching locations found. Try a different search.')).toBeTruthy();
    expect(screen.queryByText('Type at least 2 letters to search.')).toBeNull();
  });
});

// Builds a catalog of numbered sites, each 100 m further north, for the empty search sections.
function numberedSites(count: number): Map<string, CatalogLandmark>
{
  const base = catalog.landmarks[0] as CatalogLandmark;
  const sites = Array.from({ length: count }, (_, position) => ({
    ...base,
    id: `id-${position + 1}`,
    slug: `site-${position + 1}`,
    name: `Site ${position + 1}`,
    position: { lat: 1.3 + (position + 1) * 0.001, lng: 103.8 },
  }));
  return new Map(sites.map((site) => [site.id, site]));
}

// Reads the test ids of the shown rows of one section, top to bottom.
function shownRows(section: 'recent' | 'suggested'): string[]
{
  return screen.queryAllByTestId(new RegExp(`^search-${section}-landmark-`)).map((row) => String(row.props.testID).replace(`search-${section}-landmark-`, ''));
}

describe('SearchOverlay empty box: Recent searches', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('0 recent, below the visible range: the section and its Clear are hidden', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6) });
    expect(screen.queryByText('RECENT SEARCHES')).toBeNull();
    expect(screen.queryByTestId('search-recent-clear')).toBeNull();
  });

  it('1 recent, lowest visible: shows the section with 1 row and no See all', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), recentLandmarkIds: ['id-1'] });
    expect(screen.getByText('RECENT SEARCHES')).toBeTruthy();
    expect(shownRows('recent')).toEqual(['site-1']);
    expect(screen.queryByTestId('search-recent-see-all')).toBeNull();
  });

  it('5 recent, on the limit: shows all 5 in saved order and no See all', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), recentLandmarkIds: ['id-5', 'id-4', 'id-3', 'id-2', 'id-1'] });
    expect(shownRows('recent')).toEqual(['site-5', 'site-4', 'site-3', 'site-2', 'site-1']);
    expect(screen.queryByTestId('search-recent-see-all')).toBeNull();
  });

  it('6 recent, just above the limit: shows the newest 5, and See all lists all 6', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), recentLandmarkIds: ['id-6', 'id-5', 'id-4', 'id-3', 'id-2', 'id-1'] });
    expect(shownRows('recent')).toEqual(['site-6', 'site-5', 'site-4', 'site-3', 'site-2']);
    await fireEvent.press(screen.getByText('See all'));
    expect(shownRows('recent')).toEqual(['site-6', 'site-5', 'site-4', 'site-3', 'site-2', 'site-1']);
    expect(screen.queryByTestId('search-recent-see-all')).toBeNull();
  });

  it('removed site: an id no longer in the catalog is skipped and does not use up a slot', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), recentLandmarkIds: ['gone', 'id-5', 'id-4', 'id-3', 'id-2', 'id-1'] });
    expect(shownRows('recent')).toEqual(['site-5', 'site-4', 'site-3', 'site-2', 'site-1']);
    expect(screen.queryByTestId('search-recent-see-all')).toBeNull();
  });

  it('only removed sites: the section is hidden', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(1), recentLandmarkIds: ['gone'] });
    expect(screen.queryByText('RECENT SEARCHES')).toBeNull();
  });

  it('Clear: pressing it asks the owner to clear once', async () =>
  {
    const props = await renderOverlay({ landmarksById: numberedSites(1), recentLandmarkIds: ['id-1'] });
    await fireEvent.press(screen.getByText('Clear'));
    expect(props.onClearRecent).toHaveBeenCalledTimes(1);
  });

  it('touch targets: rows, Clear and See all are at least 48 dp tall', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), recentLandmarkIds: ['id-6', 'id-5', 'id-4', 'id-3', 'id-2', 'id-1'] });
    // Reads the minimum height of a control.
    const minimumHeight = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).minHeight;
    expect(minimumHeight('search-recent-clear')).toBeGreaterThanOrEqual(48);
    expect(minimumHeight('search-recent-see-all')).toBeGreaterThanOrEqual(48);
    expect(StyleSheet.flatten(screen.getByTestId('search-recent-landmark-site-6').parent?.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});

describe('SearchOverlay empty box: Suggested', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('with a fix: lists the 5 nearest sites, nearest first', async () =>
  {
    await renderOverlay({ landmarksById: numberedSites(6), userPosition: { lat: 1.3, lng: 103.8 } });
    expect(screen.getByText('SUGGESTED')).toBeTruthy();
    expect(shownRows('suggested')).toEqual(['site-1', 'site-2', 'site-3', 'site-4', 'site-5']);
  });

  it('without a fix or stops: lists the first 5 by name and never says Popular', async () =>
  {
    const sites = [...numberedSites(6).values()].reverse();
    await renderOverlay({ landmarksById: new Map(sites.map((site) => [site.id, site])) });
    expect(shownRows('suggested')).toEqual(['site-1', 'site-2', 'site-3', 'site-4', 'site-5']);
    expect(screen.getByText('SUGGESTED')).toBeTruthy();
    expect(screen.queryByText(/popular/i)).toBeNull();
  });

  it('empty catalog: the section is hidden', async () =>
  {
    await renderOverlay({ landmarksById: new Map() });
    expect(screen.queryByText('SUGGESTED')).toBeNull();
  });

  it('add to route: a site on the route is left out and the last stop is the origin', async () =>
  {
    await renderOverlay({ purpose: 'addToRoute', landmarksById: numberedSites(6), itineraryIds: ['id-6'], userPosition: { lat: 1.3, lng: 103.8 } });
    expect(shownRows('suggested')).toEqual(['site-5', 'site-4', 'site-3', 'site-2', 'site-1']);
  });
});

describe('SearchOverlay empty box: row presses', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('browse: tapping a recent row selects it once', async () =>
  {
    const props = await renderOverlay({ landmarksById: numberedSites(1), recentLandmarkIds: ['id-1'] });
    await fireEvent.press(screen.getByTestId('search-recent-landmark-site-1'));
    expect(props.onSelectLandmark).toHaveBeenCalledTimes(1);
    expect(props.onSelectLandmark).toHaveBeenCalledWith('id-1');
  });

  it('browse: tapping a suggested row selects it once', async () =>
  {
    const props = await renderOverlay({ landmarksById: numberedSites(1) });
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-site-1'));
    expect(props.onSelectLandmark).toHaveBeenCalledTimes(1);
    expect(props.onSelectLandmark).toHaveBeenCalledWith('id-1');
  });

  it('add to route: tapping rows picks and unpicks without selecting or closing', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute', landmarksById: numberedSites(2), recentLandmarkIds: ['id-1'] });
    await fireEvent.press(screen.getByTestId('search-recent-landmark-site-1'));
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-site-2'));
    expect(screen.getByText('Add 2 to route')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-suggested-landmark-site-2'));
    expect(screen.getByText('Add 1 to route')).toBeTruthy();
    expect(props.onSelectLandmark).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('search-add-picked'));
    expect(props.onClose).toHaveBeenCalledWith(['id-1']);
  });

  it('valid EC, no action: a recent site already on the route stays listed and tapping it does nothing', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute', landmarksById: numberedSites(2), itineraryIds: ['id-1'], recentLandmarkIds: ['id-1'] });
    expect(shownRows('recent')).toEqual(['site-1']);
    await fireEvent.press(screen.getByTestId('search-recent-landmark-site-1'));
    expect(screen.queryByTestId('search-add-picked')).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe('SearchOverlay empty box: query length', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('0 trimmed characters: only spaces still show both sections and no hint', async () =>
  {
    await renderOverlay({ recentLandmarkIds: [LANDMARK_CHIJMES] });
    await typeQuery('   ');
    expect(screen.getByText('RECENT SEARCHES')).toBeTruthy();
    expect(screen.getByText('SUGGESTED')).toBeTruthy();
    expect(screen.queryByText(COPY.searchMinimumLengthHint)).toBeNull();
  });

  it('1 trimmed character, just above empty: the hint replaces both sections', async () =>
  {
    await renderOverlay({ recentLandmarkIds: [LANDMARK_CHIJMES] });
    await typeQuery(' a ');
    expect(screen.getByText(COPY.searchMinimumLengthHint)).toBeTruthy();
    expect(screen.queryByText('RECENT SEARCHES')).toBeNull();
    expect(screen.queryByText('SUGGESTED')).toBeNull();
  });

  it('2 characters: normal results replace both sections', async () =>
  {
    await renderOverlay({ recentLandmarkIds: [LANDMARK_RAFFLES] });
    await typeQuery('Chijmes');
    expect(screen.getByTestId('search-landmark-chijmes')).toBeTruthy();
    expect(screen.queryByText('RECENT SEARCHES')).toBeNull();
    expect(screen.queryByText('SUGGESTED')).toBeNull();
    expect(screen.queryByTestId('search-recent-landmark-raffles-hotel')).toBeNull();
  });

  it('clearing the box: both sections come back', async () =>
  {
    await renderOverlay({ recentLandmarkIds: [LANDMARK_RAFFLES] });
    await typeQuery('Chijmes');
    await typeQuery('');
    expect(screen.getByText('RECENT SEARCHES')).toBeTruthy();
    expect(screen.getByText('SUGGESTED')).toBeTruthy();
  });
});

describe('SearchOverlay row press (UC 1.5.1.1)', () =>
{
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('pick: tapping a row in route mode picks the site and shows the check', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute' });
    await typeQuery('Raffles');
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    expect(screen.getByLabelText('Raffles Hotel is in your route')).toBeTruthy();
    expect(screen.getByText('Add 1 to route')).toBeTruthy();
    expect(props.onSelectLandmark).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('unpick: tapping a picked row again removes the pick', async () =>
  {
    await renderOverlay({ purpose: 'addToRoute' });
    await typeQuery('Raffles');
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    expect(screen.getByLabelText('Add Raffles Hotel to route')).toBeTruthy();
    expect(screen.queryByTestId('search-add-picked')).toBeNull();
  });

  it('two rows: tapping 2 rows gives "Add 2 to route" and adds exactly those 2', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute' });
    await typeQuery('Raffles');
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    await typeQuery('Chijmes');
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(screen.getByText('Add 2 to route')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-add-picked'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledWith([LANDMARK_RAFFLES, LANDMARK_CHIJMES]);
  });

  it('valid EC, no action: tapping a row already on the route changes nothing and does not close', async () =>
  {
    const props = await renderOverlay({ purpose: 'addToRoute', itineraryIds: [LANDMARK_CHIJMES] });
    await typeQuery('Chijmes');
    await fireEvent.press(screen.getByTestId('search-landmark-chijmes'));
    expect(screen.queryByTestId('search-add-picked')).toBeNull();
    expect(props.onSelectLandmark).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('browse: tapping a row calls onSelectLandmark once with the id and picks nothing', async () =>
  {
    const props = await renderOverlay();
    await typeQuery('Raffles');
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    expect(props.onSelectLandmark).toHaveBeenCalledTimes(1);
    expect(props.onSelectLandmark).toHaveBeenCalledWith(LANDMARK_RAFFLES);
    expect(screen.queryByTestId('search-add-picked')).toBeNull();
  });

  it('browse: a site already on the route still opens when its row is tapped', async () =>
  {
    const props = await renderOverlay({ itineraryIds: [LANDMARK_RAFFLES] });
    await typeQuery('Raffles');
    await fireEvent.press(screen.getByTestId('search-landmark-raffles-hotel'));
    expect(props.onSelectLandmark).toHaveBeenCalledTimes(1);
    expect(props.onSelectLandmark).toHaveBeenCalledWith(LANDMARK_RAFFLES);
  });
});
