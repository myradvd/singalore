import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { formatDurationShort, type CatalogResponse } from '@singalore/shared';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { bindAudioStore } from '@/modules/audio/audioStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { bindGeofenceStore } from '@/modules/geofence/geofenceStore';
import { DEFAULT_PREFERENCES } from '@/modules/prefs/preferencesSchema';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_RAFFLES, PARK_CIVIC, PODCAST_CHIJMES_GB, PODCAST_CHIJMES_US } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { seekFraction } from '../../primitives/SeekBar';
import { ParkDetailScreen } from '../explore/ParkDetailScreen';
import { HomeScreen } from '../home/HomeScreen';
import { estimateFromStops } from '../route/routeEstimates';
import { FullPlayerScreen } from './FullPlayerScreen';
import { MiniPlayer } from './MiniPlayer';
import { formatRate, nextPlaybackRate, shownEpisodeSeconds } from './playerLabels';
import { TRANSCRIPT_UNAVAILABLE, TranscriptScreen } from './TranscriptScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

// Builds a catalog where CHIJMES has a 200 s British and a 300 s American episode.
function catalogWithDurationVariants(): CatalogResponse
{
  const catalog = catalogFixture();
  const durations = new Map([[PODCAST_CHIJMES_GB, 200], [PODCAST_CHIJMES_US, 300]]);
  catalog.podcasts = catalog.podcasts.map((podcast) => ({ ...podcast, durationSeconds: durations.get(podcast.id) ?? podcast.durationSeconds }));
  return catalog;
}

// Sets the preferred accent in the real preferences store.
function setPreferredAccent(preferredAccent: string | null): void
{
  usePreferencesStore.setState({ preferences: { ...DEFAULT_PREFERENCES, preferredAccent } });
}

describe('player helpers', () =>
{
  it('cycles playback rates and clamps seek fractions', () =>
  {
    expect(nextPlaybackRate(1)).toBe(1.25);
    expect(nextPlaybackRate(2)).toBe(0.75);
    expect(formatRate(1.5)).toBe('1.5x');
    expect(seekFraction(50, 200)).toBe(0.25);
    expect(seekFraction(-5, 200)).toBe(0);
    expect(seekFraction(500, 200)).toBe(1);
    expect(seekFraction(5, 0)).toBe(0);
  });
});

describe('shownEpisodeSeconds (UC 1.2.2, UC 1.3.2, UC 1.5.3)', () =>
{
  const noPreference = { preferredVoice: null, preferredAccent: null, preferredLength: null };

  beforeEach(() => applyCatalogSnapshot(catalogWithDurationVariants()));

  it('returns 300 when the preferred accent matches the 300 s variant', () =>
  {
    expect(shownEpisodeSeconds(useCatalogStore.getState(), LANDMARK_CHIJMES, { ...noPreference, preferredAccent: 'American' })).toBe(300);
  });

  it('returns the first variant by order when there is no preference', () =>
  {
    expect(shownEpisodeSeconds(useCatalogStore.getState(), LANDMARK_CHIJMES, noPreference)).toBe(200);
  });

  it('returns the first variant, not the shortest, when the longer one comes first', () =>
  {
    const catalog = catalogWithDurationVariants();
    catalog.podcasts.reverse();
    applyCatalogSnapshot(catalog);
    expect(shownEpisodeSeconds(useCatalogStore.getState(), LANDMARK_CHIJMES, noPreference)).toBe(300);
  });

  it('returns the first variant when the preferred accent matches no variant', () =>
  {
    expect(shownEpisodeSeconds(useCatalogStore.getState(), LANDMARK_CHIJMES, { ...noPreference, preferredAccent: 'Australian' })).toBe(200);
  });

  it('returns the only variant even when the preference does not match it', () =>
  {
    expect(shownEpisodeSeconds(useCatalogStore.getState(), LANDMARK_RAFFLES, { ...noPreference, preferredAccent: 'American' })).toBe(180);
  });

  it('returns null for a landmark with no podcast (valid EC, no duration)', () =>
  {
    expect(shownEpisodeSeconds(useCatalogStore.getState(), 'landmark-without-podcast', noPreference)).toBeNull();
  });
});

describe('screens show the episode that plays, and follow preference changes', () =>
{
  beforeEach(() =>
  {
    applyCatalogSnapshot(catalogWithDurationVariants());
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
    setPreferredAccent('American');
  });

  afterEach(() => setPreferredAccent(null));

  it('summary card shows 5 min for American, then 3 min after switching to British', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'selectLandmark', landmarkId: LANDMARK_CHIJMES }));
    expect(screen.getByTestId('summary-caption').props.children).toContain('Podcast 5 min');
    await act(async () => setPreferredAccent('British'));
    expect(screen.getByTestId('summary-caption').props.children).toContain('Podcast 3 min');
  });

  it('prompt shows 5 min for American, then 3 min after switching to British', async () =>
  {
    const services = await createTestServices();
    bindGeofenceStore(services.geofence);
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => services.geofence.presentPrompt(LANDMARK_CHIJMES));
    expect(screen.getByText('Episode length 5 min')).toBeTruthy();
    await act(async () => setPreferredAccent('British'));
    expect(screen.getByText('Episode length 3 min')).toBeTruthy();
  });

  it('route total sums the picked variants of 2 stops, and follows a preference change', async () =>
  {
    const services = await createTestServices();
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => dispatchFlow({ type: 'addToItinerary', landmarkId: LANDMARK_CHIJMES }));
    await act(async () => dispatchFlow({ type: 'addToItinerary', landmarkId: LANDMARK_RAFFLES }));
    await fireEvent.press(screen.getByTestId('route-strip'));
    const landmarksById = useCatalogStore.getState().landmarksById;
    const positions = [LANDMARK_CHIJMES, LANDMARK_RAFFLES].flatMap((id) =>
    {
      const landmark = landmarksById.get(id);
      return landmark === undefined ? [] : [landmark.position];
    });
    const expectedTotal = (podcastSeconds: number[]) => formatDurationShort(estimateFromStops(null, positions, podcastSeconds, DEFAULT_PREFERENCES.walkingPace).totalSeconds);
    expect(expectedTotal([300, 180])).not.toBe(expectedTotal([200, 180]));
    expect(screen.getByLabelText(`Total: ${expectedTotal([300, 180])}`)).toBeTruthy();
    await act(async () => setPreferredAccent('British'));
    expect(screen.getByLabelText(`Total: ${expectedTotal([200, 180])}`)).toBeTruthy();
  });

  it('park detail row shows 5 min for American, then 3 min after switching to British', async () =>
  {
    await render(<ParkDetailScreen parkId={PARK_CIVIC} />);
    const chijmesRow = within(screen.getByTestId('park-landmark-chijmes'));
    expect(chijmesRow.getByText('Podcast 5 min')).toBeTruthy();
    await act(async () => setPreferredAccent('British'));
    expect(chijmesRow.getByText('Podcast 3 min')).toBeTruthy();
  });
});

describe('FullPlayerScreen (UC 1.3.4)', () =>
{
  it('controls playback with large buttons: pause, skip, speed and stop', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindAudioStore(services.audio);
    await services.audio.playLandmark(LANDMARK_CHIJMES);
    await renderWithServices(services, <FullPlayerScreen />);
    expect(screen.getByText('CHIJMES: a short history')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('player-toggle'));
    expect(services.audio.getState().status.state).toBe('paused');
    await fireEvent.press(screen.getByTestId('player-forward'));
    expect(services.audio.getState().status.positionSeconds).toBe(10);
    await fireEvent.press(screen.getByTestId('player-rate'));
    expect(services.audio.getState().status.rate).toBe(1.25);
    expect(screen.getByTestId('player-toggle').props.style).toBeDefined();
    await fireEvent.press(screen.getByTestId('player-stop'));
    expect(services.audio.getState().track).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an empty state when nothing is playing', async () =>
  {
    const services = await createTestServices();
    bindAudioStore(services.audio);
    await renderWithServices(services, <FullPlayerScreen />);
    expect(screen.getByText('Nothing playing')).toBeTruthy();
  });
});

describe('MiniPlayer', () =>
{
  it('renders nothing without a track and shows buffering when loading (UC 1.3.4.1)', async () =>
  {
    const props = { onTogglePlay: jest.fn(), onOpen: jest.fn(), onClose: jest.fn() };
    const idle = { track: null, status: { state: 'idle' as const, positionSeconds: 0, durationSeconds: 0, rate: 1, errorMessage: null }, resumeOffer: null, lastError: null };
    await render(<MiniPlayer audio={idle} {...props} />);
    expect(screen.queryByTestId('mini-player')).toBeNull();
    const buffering = { ...idle, track: { podcastId: 'p', landmarkId: 'l', title: 'T', landmarkName: 'L', source: 'stream' as const }, status: { ...idle.status, state: 'buffering' as const } };
    await render(<MiniPlayer audio={buffering} {...props} />);
    expect(screen.getByTestId('mini-buffering')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mini-toggle'));
    expect(props.onTogglePlay).toHaveBeenCalled();
  });
});

describe('TranscriptScreen (A5)', () =>
{
  it('shows the stored transcript, or the A5 placeholder when missing', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindAudioStore(services.audio);
    await services.audio.playLandmark(LANDMARK_CHIJMES);
    const podcastId = services.audio.getState().track?.podcastId ?? '';
    await services.packDetails.storeDetails({ schemaVersion: 1, parkId: '0b5a2f10-0000-4000-8000-000000000001', etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [], podcasts: [{ podcastId, transcript: 'CHIJMES. A convent.' }], files: [] });
    await renderWithServices(services, <TranscriptScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId('transcript-text').props.children).toBe('CHIJMES. A convent.');

    await services.packDetails.storeDetails({ schemaVersion: 1, parkId: '0b5a2f10-0000-4000-8000-000000000001', etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [], podcasts: [{ podcastId, transcript: null }], files: [] });
    await renderWithServices(services, <TranscriptScreen />);
    await act(async () => undefined);
    expect(screen.getAllByText(TRANSCRIPT_UNAVAILABLE).length).toBeGreaterThan(0);
  });
});
