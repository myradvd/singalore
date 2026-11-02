import { act, fireEvent, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot, useCatalogStore } from '@/modules/catalog/catalogStore';
import { EMPTY_CATALOG } from '@/modules/catalog/types';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { useFlowStore } from '@/modules/flow/flowStore';
import { bindDownloadsStore, useDownloadsStore } from '@/modules/offline/downloadsStore';
import { catalogFixture, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { useToastStore } from '../../toastStore';
import { HomeScreen } from '../home/HomeScreen';
import { DownloadsScreen } from './DownloadsScreen';
import { packStatusLabel } from './PackActionButton';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }),
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

describe('Downloads catalog states (UC 1.2.1.4)', () =>
{
  beforeEach(() => useToastStore.setState({ toasts: [] }));

  it('shows loading, not the empty title, while the first sync runs with 0 parks', async () =>
  {
    useCatalogStore.setState({ status: 'loading', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId('catalog-loading')).toBeTruthy();
    expect(screen.getByText('Loading heritage sites...')).toBeTruthy();
    expect(screen.queryByText('No heritage map yet')).toBeNull();
  });

  it('shows the exact Home copy with Try again when unavailable, and no old text', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByText('No heritage map yet')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByText('No parks yet')).toBeNull();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
  });

  it('shows the exact toast when Try again fails with no cache', async () =>
  {
    useCatalogStore.setState({ status: 'unavailable', snapshot: EMPTY_CATALOG });
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    await fireEvent.press(screen.getByText('Try again'));
    await act(async () => undefined);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Unable to fetch nearby landmarks. Check your connection.']);
  });

  it('shows neither state when parks exist, even while loading', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useCatalogStore.setState({ status: 'loading' });
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId(`pack-${PARK_CIVIC}`)).toBeTruthy();
    expect(screen.queryByTestId('catalog-loading')).toBeNull();
    expect(screen.queryByText('No heritage map yet')).toBeNull();
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

  it('uses the shared header: one title and a back button that goes back once', async () =>
  {
    mockBack.mockClear();
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId('downloads-screen')).toBeTruthy();
    expect(screen.getAllByRole('header').length).toBe(1);
    expect(screen.getByText('Manage Downloads')).toBeTruthy();
    expect(screen.queryByText('Manage downloads')).toBeNull();
    await fireEvent.press(screen.getByTestId('screen-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows, the total and the Wi-Fi toggle inside the shared header', async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    await renderWithServices(await createTestServices(), <DownloadsScreen />);
    await act(async () => undefined);
    expect(screen.getByTestId(`pack-${PARK_CIVIC}`)).toBeTruthy();
    expect(screen.getByTestId('downloads-total')).toBeTruthy();
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
