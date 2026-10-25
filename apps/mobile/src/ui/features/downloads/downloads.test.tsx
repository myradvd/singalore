import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { useFlowStore } from '@/modules/flow/flowStore';
import { bindDownloadsStore, useDownloadsStore } from '@/modules/offline/downloadsStore';
import { catalogFixture, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { HomeScreen } from '../home/HomeScreen';
import { DownloadsScreen } from './DownloadsScreen';
import { packStatusLabel } from './PackActionButton';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

describe('packStatusLabel', () =>
{
  it('describes each pack state', () =>
  {
    const base = { parkId: 'p', packEtag: null, totalBytes: 2 * 1024 * 1024, doneBytes: 1024 * 1024, errorCode: null, completedAt: null };
    expect(packStatusLabel(undefined, 500000)).toBe('Not downloaded  ·  about 488 KB');
    expect(packStatusLabel({ ...base, state: 'downloading' }, 0)).toBe('Downloading 1.0 MB of 2.0 MB');
    expect(packStatusLabel({ ...base, state: 'downloaded' }, 0)).toBe('Available offline  ·  2.0 MB');
    expect(packStatusLabel({ ...base, state: 'failed', errorCode: 'insufficient_storage' }, 0)).toBe('Not enough storage');
    expect(packStatusLabel({ ...base, state: 'update_available' }, 0)).toBe('Update available');
  });
});

describe('Downloads UI (UC 1.4.1, A7)', () =>
{
  beforeEach(() =>
  {
    mockPush.mockClear();
    useFlowStore.setState({ state: INITIAL_FLOW_STATE });
  });

  it('lists parks with download actions and the Wi-Fi only switch', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindDownloadsStore(services.downloads, services.connectivity);
    await renderWithServices(services, <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId(`pack-${PARK_CIVIC}`)).toBeTruthy();
    expect(screen.getAllByTestId('pack-download').length).toBe(2);
    expect(screen.getByTestId('downloads-wifi-only')).toBeTruthy();
  });

  it('shows the unstable connection banner with a shortcut to downloads and Ignore', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    bindDownloadsStore(services.downloads, services.connectivity);
    await renderWithServices(services, <HomeScreen userLocation={null} />);
    expect(screen.queryByTestId('connectivity-banner')).toBeNull();
    await act(async () => services.connectivity.setNetwork(false, false));
    expect(screen.getByText('Your internet is unstable')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go to downloads?'));
    expect(mockPush).toHaveBeenCalledWith('/downloads');
    await fireEvent.press(screen.getByText('Ignore'));
    expect(useDownloadsStore.getState().connectivity.bannerVisible).toBe(false);
  });
});
