import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SearchIndex } from '@/modules/catalog/searchIndex';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, PARK_TIONG_BAHRU } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { SEARCH_DEBOUNCE_MS, SearchOverlay } from './SearchOverlay';

const catalog = catalogFixture();
const index = new SearchIndex(catalog);
const parksById = new Map(catalog.parks.map((park) => [park.id, park]));

async function renderOverlay(overrides: Partial<Parameters<typeof SearchOverlay>[0]> = {})
{
  const props = {
    index,
    parksById,
    purpose: 'browse' as const,
    itineraryIds: [],
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
