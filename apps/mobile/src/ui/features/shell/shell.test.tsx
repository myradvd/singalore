import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { HistoryScreen } from '../history/HistoryScreen';
import { HomeScreen } from '../home/HomeScreen';
import { NOT_AVAILABLE_ROUTING, PREFERENCE_SECTIONS } from '../preferences/preferenceSections';
import { PreferencesIndexScreen, PreferencesSectionScreen } from '../preferences/PreferencesScreens';
import { SavedScreen } from '../saved/SavedScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

function section(id: string)
{
  const match = PREFERENCE_SECTIONS.find((candidate) => candidate.id === id);
  if (match === undefined)
  {
    throw new Error(`missing section ${id}`);
  }
  return match;
}

beforeEach(() =>
{
  mockPush.mockClear();
  mockBack.mockClear();
  useFlowStore.setState({ state: INITIAL_FLOW_STATE });
  usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES, loaded: true });
  applyCatalogSnapshot(catalogFixture());
});

describe('sidebar (M6)', () =>
{
  it('opens saved routes, history, downloads, preferences and help', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    for (const [key, path] of [['saved', '/saved'], ['history', '/history'], ['downloads', '/downloads'], ['preferences', '/preferences'], ['help', '/help']] as const)
    {
      await act(async () => dispatchFlow({ type: 'openSidebar' }));
      await fireEvent.press(screen.getByTestId(`sidebar-${key}`));
      expect(mockPush).toHaveBeenLastCalledWith(path);
      expect(useFlowStore.getState().state.overlays).toEqual([]);
    }
  });
});

describe('Saved Routes and Sites (A4)', () =>
{
  it('shows the empty state', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <SavedScreen />);
    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
  });

  it('opens a saved route in the editor, deletes routes and removes sites', async () =>
  {
    const services = await createTestServices();
    const routeId = await services.saved.saveItinerary('Civic walk', [LANDMARK_CHIJMES, LANDMARK_RAFFLES]);
    await services.saved.toggleLandmark(LANDMARK_RAFFLES);
    await renderWithServices(services, <SavedScreen />);
    expect(await screen.findByText('Civic walk')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`saved-route-${routeId}`));
    expect(useFlowStore.getState().state.screen).toBe('routeEditor');
    expect(useFlowStore.getState().state.itinerary).toEqual([LANDMARK_CHIJMES, LANDMARK_RAFFLES]);
    expect(mockBack).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId(`saved-site-remove-${LANDMARK_RAFFLES}`));
    await fireEvent.press(screen.getByTestId(`saved-route-delete-${routeId}`));
    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
    expect(await services.saved.savedItineraries()).toEqual([]);
  });
});

describe('Tour History', () =>
{
  it('shows the empty state and recorded tours', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HistoryScreen />);
    expect(await screen.findByTestId('history-empty')).toBeTruthy();
    screen.unmount();

    await services.history.record({ id: 'tour-1', title: 'Civic walk', landmarkIds: [LANDMARK_CHIJMES], startedAt: '2026-10-12T01:00:00.000Z', endedAt: '2026-10-12T02:00:00.000Z', status: 'completed', completedLandmarkIds: [LANDMARK_CHIJMES] });
    await renderWithServices(services, <HistoryScreen />);
    expect(await screen.findByText('Civic walk')).toBeTruthy();
  });
});

describe('Tour Preferences (A3)', () =>
{
  it('saves a section only after Save and persists it', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <PreferencesSectionScreen section={section('route')} />);
    expect(screen.getByTestId('pref-save').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('pref-walkingPace-Slow'));
    expect(usePreferencesStore.getState().preferences.walkingPace).toBe('normal');
    await fireEvent.press(screen.getByTestId('pref-save'));
    await act(async () => undefined);
    expect(usePreferencesStore.getState().preferences.walkingPace).toBe('slow');
    expect((await services.preferences.load()).walkingPace).toBe('slow');
  });

  it('shows unavailable options disabled with a reason', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <PreferencesSectionScreen section={section('route')} />);
    expect(screen.getAllByText(NOT_AVAILABLE_ROUTING).length).toBe(2);
  });

  it('guards unsaved changes on back', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <PreferencesSectionScreen section={section('audio')} />);
    await fireEvent(screen.getByTestId('pref-autoplayEnabled'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('screen-back'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Save your changes?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pref-unsaved-discard'));
    expect(mockBack).toHaveBeenCalled();
    expect(usePreferencesStore.getState().preferences.autoplayEnabled).toBe(false);
  });

  it('resets every preference after confirmation', async () =>
  {
    const services = await createTestServices();
    await services.preferences.save({ autoplayEnabled: true });
    usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, autoplayEnabled: true }, loaded: true });
    await renderWithServices(services, <PreferencesIndexScreen />);
    await fireEvent.press(screen.getByTestId('preferences-audio'));
    expect(mockPush).toHaveBeenCalledWith('/preferences/audio');
    await fireEvent.press(screen.getByTestId('preferences-reset'));
    await fireEvent.press(screen.getByTestId('preferences-reset-confirm'));
    await act(async () => undefined);
    expect(usePreferencesStore.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(await services.preferences.load()).toEqual(DEFAULT_PREFERENCES);
  });
});
