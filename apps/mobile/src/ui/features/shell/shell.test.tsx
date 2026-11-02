import { act, fireEvent, screen } from '@testing-library/react-native';
import type { CatalogPodcast } from '@singalore/shared';
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

// Lists the chip labels shown for one preference, in screen order.
function chipLabels(preferenceKey: string)
{
  const prefix = `pref-${preferenceKey}-`;
  return screen.getAllByTestId(new RegExp(`^${prefix}`))
    .map((chip) => (chip.props.testID as string).slice(prefix.length));
}

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

  it('lists Any plus the sorted voices and accents the catalog offers (design 6.3)', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <PreferencesSectionScreen section={section('audio')} />);
    expect(chipLabels('preferredVoice')).toEqual(['Any', 'Female', 'Male']);
    expect(chipLabels('preferredAccent')).toEqual(['Any', 'American', 'British']);
  });

  describe('preferred length chips (T2-3, design 6.3)', () =>
  {
    // Applies a catalog whose podcasts cycle through the given length classes, or a catalog with no podcasts.
    function applyCatalogWithLengths(lengths: CatalogPodcast['lengthClass'][])
    {
      const fixture = catalogFixture();
      const podcasts = lengths.length === 0 ? [] : fixture.podcasts.map((podcast, index) => ({ ...podcast, lengthClass: lengths[index % lengths.length] ?? null }));
      applyCatalogSnapshot({ ...fixture, podcasts });
    }

    // Renders the audio preferences section with fresh test services.
    async function renderAudioSection()
    {
      const services = await createTestServices();
      await renderWithServices(services, <PreferencesSectionScreen section={section('audio')} />);
      return services;
    }

    it('shows Any, Short and Standard when the catalog offers short and standard', async () =>
    {
      applyCatalogWithLengths(['short', 'standard']);
      await renderAudioSection();
      expect(chipLabels('preferredLength')).toEqual(['Any', 'Short', 'Standard']);
    });

    it('shows Any and Long when every podcast is long', async () =>
    {
      applyCatalogWithLengths(['long']);
      await renderAudioSection();
      expect(chipLabels('preferredLength')).toEqual(['Any', 'Long']);
    });

    it('shows all three lengths shortest first when the catalog offers them all', async () =>
    {
      applyCatalogWithLengths(['long', 'short', 'standard']);
      await renderAudioSection();
      expect(chipLabels('preferredLength')).toEqual(['Any', 'Short', 'Standard', 'Long']);
    });

    it('shows only Any for an empty catalog', async () =>
    {
      applyCatalogWithLengths([]);
      await renderAudioSection();
      expect(chipLabels('preferredLength')).toEqual(['Any']);
    });

    it('shows only Any when every podcast has a null length', async () =>
    {
      applyCatalogWithLengths([null]);
      await renderAudioSection();
      expect(chipLabels('preferredLength')).toEqual(['Any']);
    });

    it('marks the saved length selected when the catalog offers it, and saves a newly chosen one', async () =>
    {
      applyCatalogWithLengths(['short', 'standard']);
      usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, preferredLength: 'short' }, loaded: true });
      const services = await renderAudioSection();
      expect(screen.getByTestId('pref-preferredLength-Short').props.accessibilityState?.selected).toBe(true);
      await fireEvent.press(screen.getByTestId('pref-preferredLength-Standard'));
      await fireEvent.press(screen.getByTestId('pref-save'));
      await act(async () => undefined);
      expect((await services.preferences.load()).preferredLength).toBe('standard');
    });

    it('selects no chip and keeps the saved value when the saved length is not in the catalog', async () =>
    {
      applyCatalogWithLengths(['short', 'standard']);
      usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, preferredLength: 'long' }, loaded: true });
      await renderAudioSection();
      const selectedChips = screen.getAllByTestId(/^pref-preferredLength-/).filter((chip) => chip.props.accessibilityState?.selected === true);
      expect(selectedChips).toEqual([]);
      expect(screen.getByTestId('pref-save').props.accessibilityState?.disabled).toBe(true);
      expect(usePreferencesStore.getState().preferences.preferredLength).toBe('long');
    });
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
