import { act, fireEvent, screen } from '@testing-library/react-native';
import type { CatalogPodcast } from '@singalore/shared';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import type { TourHistoryEntry } from '@/modules/history/HistoryRepository';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { cameraCalls } from '@test/mocks/maplibre';
import { COPY } from '../../copy';
import { useToastStore } from '../../toastStore';
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

describe('Saved sites open and remove (D5)', () =>
{
  const removedToast = 'Removed from saved sites.';

  // Reads the messages of the toasts now on screen.
  const toastMessages = () => useToastStore.getState().toasts.map((toast) => toast.message);

  beforeEach(() =>
  {
    useToastStore.setState({ toasts: [] });
    cameraCalls.length = 0;
  });

  it('open: tapping a saved site moves the camera once at zoom 16.5 and shows the card', async () =>
  {
    const services = await createTestServices();
    await services.saved.toggleLandmark(LANDMARK_RAFFLES);
    await renderWithServices(services, (
      <>
        <HomeScreen userLocation={null} />
        <SavedScreen />
      </>
    ));
    const row = await screen.findByTestId(`saved-site-${LANDMARK_RAFFLES}`);
    cameraCalls.length = 0;

    await fireEvent.press(row);

    expect(cameraCalls).toHaveLength(1);
    expect(cameraCalls[0]).toMatchObject({ method: 'easeTo', args: [{ center: [103.85441, 1.29486], zoom: 16.5 }] });
    expect(useFlowStore.getState().state.selectedLandmarkId).toBe(LANDMARK_RAFFLES);
    expect(screen.getByTestId('summary-card')).toBeTruthy();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('remove: tapping remove on a saved site shows the toast and removes the row', async () =>
  {
    const services = await createTestServices();
    await services.saved.toggleLandmark(LANDMARK_RAFFLES);
    await renderWithServices(services, <SavedScreen />);

    await fireEvent.press(await screen.findByTestId(`saved-site-remove-${LANDMARK_RAFFLES}`));

    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
    expect(screen.queryByTestId(`saved-site-${LANDMARK_RAFFLES}`)).toBeNull();
    expect(toastMessages()).toEqual([removedToast]);
    expect(await services.saved.savedLandmarkIds()).toEqual([]);
  });

  it('double tap: two presses on remove while the refresh is still running leave the site not saved', async () =>
  {
    const services = await createTestServices();
    await services.saved.toggleLandmark(LANDMARK_RAFFLES);
    await renderWithServices(services, <SavedScreen />);
    const removeButton = await screen.findByTestId(`saved-site-remove-${LANDMARK_RAFFLES}`);
    let finishRefresh: (routes: never[]) => void = () => undefined;
    const heldRefresh = jest.spyOn(services.saved, 'savedItineraries').mockImplementation(() => new Promise((resolve) =>
    {
      finishRefresh = resolve;
    }));

    await fireEvent.press(removeButton);
    await fireEvent.press(removeButton);
    heldRefresh.mockRestore();
    await act(async () => finishRefresh([]));

    expect(await services.saved.savedLandmarkIds()).toEqual([]);
    expect(toastMessages()).toEqual([removedToast]);
    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
  });

  it('exception flow, missing site: an id not in the catalog shows the placeholder and can be removed with the toast', async () =>
  {
    const services = await createTestServices();
    await services.saved.toggleLandmark('landmark-not-in-catalog');
    await renderWithServices(services, <SavedScreen />);
    expect(await screen.findByText('Site no longer available')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove unavailable site'));

    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
    expect(toastMessages()).toEqual([removedToast]);
    expect(await services.saved.savedLandmarkIds()).toEqual([]);
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

  const civicWalkEntry: TourHistoryEntry = { id: 'tour-1', title: 'Civic walk', landmarkIds: [LANDMARK_CHIJMES], startedAt: '2026-10-12T01:00:00.000Z', endedAt: '2026-10-12T02:00:00.000Z', status: 'completed', completedLandmarkIds: [LANDMARK_CHIJMES] };

  it('loading: a pending list shows only the loading text', async () =>
  {
    const services = await createTestServices();
    jest.spyOn(services.history, 'list').mockReturnValue(new Promise(() => undefined));
    await renderWithServices(services, <HistoryScreen />);
    expect(screen.getByText(COPY.historyLoading)).toBeTruthy();
    expect(screen.queryByTestId('history-empty')).toBeNull();
    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('exception flow: a rejected list shows the error with Retry and not the empty state', async () =>
  {
    const services = await createTestServices();
    jest.spyOn(services.history, 'list').mockRejectedValue(new Error('database closed'));
    await renderWithServices(services, <HistoryScreen />);
    expect(await screen.findByTestId('history-error')).toBeTruthy();
    expect(screen.getByText(COPY.historyLoadFailedTitle)).toBeTruthy();
    expect(screen.getByText(COPY.historyRetry)).toBeTruthy();
    expect(screen.queryByTestId('history-empty')).toBeNull();
    expect(screen.queryByText('No tours yet')).toBeNull();
    expect(screen.queryByText(COPY.historyLoading)).toBeNull();
  });

  it('retry: a Retry that succeeds replaces the error with the list', async () =>
  {
    const services = await createTestServices();
    await services.history.record(civicWalkEntry);
    jest.spyOn(services.history, 'list').mockRejectedValueOnce(new Error('database closed'));
    await renderWithServices(services, <HistoryScreen />);
    await fireEvent.press(await screen.findByText(COPY.historyRetry));
    expect(await screen.findByText('Civic walk')).toBeTruthy();
    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('retry: a Retry that fails again keeps the error', async () =>
  {
    const services = await createTestServices();
    const list = jest.spyOn(services.history, 'list').mockRejectedValue(new Error('database closed'));
    await renderWithServices(services, <HistoryScreen />);
    await fireEvent.press(await screen.findByText(COPY.historyRetry));
    await act(async () => undefined);
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('history-error')).toBeTruthy();
    expect(screen.queryByText('No tours yet')).toBeNull();
  });

  it('empty: a list of 0 entries shows only the empty state', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HistoryScreen />);
    expect(await screen.findByText('No tours yet')).toBeTruthy();
    expect(screen.queryByText(COPY.historyLoading)).toBeNull();
    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('list: a list of 1 entry shows 1 row and no other state', async () =>
  {
    const services = await createTestServices();
    await services.history.record(civicWalkEntry);
    await renderWithServices(services, <HistoryScreen />);
    expect((await screen.findAllByText('Civic walk')).length).toBe(1);
    expect(screen.queryByTestId('history-empty')).toBeNull();
    expect(screen.queryByTestId('history-error')).toBeNull();
    expect(screen.queryByText(COPY.historyLoading)).toBeNull();
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
