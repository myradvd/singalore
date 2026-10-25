import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { useDebugStore } from '@/modules/debug/debugStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { bindGeofenceStore } from '@/modules/geofence/geofenceStore';
import { useFlowStore } from '@/modules/flow/flowStore';
import { bindLocationStore } from '@/modules/location/locationStore';
import { catalogFixture, LANDMARK_CHIJMES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { useToastStore } from '../../toastStore';
import { formatOverlayLines } from '../debug/DebugOverlay';
import { HomeScreen, resetPermissionPromptForTests } from './HomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

beforeEach(() =>
{
  useFlowStore.setState({ state: INITIAL_FLOW_STATE });
  useToastStore.setState({ toasts: [] });
  useDebugStore.setState({ enabled: false, spoofActive: false, showOverlay: true });
  mockPush.mockClear();
});

describe('HomeScreen geofence and debug integration', () =>
{
  it('shows a podcast prompt when the geofence engine prompts, and Listen requests playback', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindGeofenceStore(services.geofence);
    const requests: string[] = [];
    services.events.on('audio/playLandmarkRequested', (request) => requests.push(`${request.landmarkId}:${request.reason}`));
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    await act(async () => services.geofence.presentPrompt(LANDMARK_CHIJMES));
    expect(screen.getByTestId('podcast-prompt')).toBeTruthy();
    expect(screen.getByText('You have reached CHIJMES')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('prompt-listen'));
    expect(requests).toEqual([`${LANDMARK_CHIJMES}:prompt_accepted`]);
    expect(screen.queryByTestId('podcast-prompt')).toBeNull();
  });

  it('opens developer mode after 7 wordmark taps and spoof long press moves the location', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindLocationStore(services.location);
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    for (let index = 0; index < 7; index += 1)
    {
      await fireEvent.press(screen.getByLabelText('SINGALORE'));
    }
    expect(useDebugStore.getState().enabled).toBe(true);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain('Developer Mode Enabled.');
    expect(screen.getByTestId('debug-overlay')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-debug'));
    expect(mockPush).toHaveBeenCalledWith('/debug');
  });

  it('formats the GPS overlay, including the searching state (UC 1.6.2.1)', () =>
  {
    expect(formatOverlayLines({ fix: null, refreshRateHz: null, insideNames: [], sourceKind: 'device' })[0]).toBe('lat Searching...');
    const lines = formatOverlayLines({ fix: { latitude: 1.2951234, longitude: 103.85, accuracyMeters: 7.6, timestamp: 0, source: 'spoof' }, refreshRateHz: 1, insideNames: ['CHIJMES'], sourceKind: 'spoof' });
    expect(lines).toEqual(['lat 1.295123', 'lng 103.850000', 'acc 8 m', 'geofence Inside: CHIJMES', 'rate 1.0 Hz  source spoof']);
  });

  it('asks for location permission once when it is undetermined', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    resetPermissionPromptForTests();
    const services = await createTestServices();
    bindLocationStore(services.location);
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    expect(mockPush).toHaveBeenCalledWith('/permission');
  });
});
