import { act, fireEvent, screen } from '@testing-library/react-native';
import { ensureNotificationPermission, type LocalNotifier, type NotificationPermission } from '@/core/notifications';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { INITIAL_FLOW_STATE } from '@/modules/flow/flowReducer';
import { useFlowStore } from '@/modules/flow/flowStore';
import { bindDownloadsStore, useDownloadsStore } from '@/modules/offline/downloadsStore';
import { catalogFixture, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { HomeScreen } from '../home/HomeScreen';
import { DownloadsScreen } from './DownloadsScreen';
import { PackActionButton, packStatusLabel } from './PackActionButton';

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

describe('ensureNotificationPermission (UC 1.4.1 step 7, UC 1.3.2.3)', () =>
{
  // Builds a notifier that reports the given status.
  function notifierWithStatus(status: NotificationPermission)
  {
    return { permission: jest.fn(async () => status), requestPermission: jest.fn(async (): Promise<NotificationPermission> => 'granted'), notify: jest.fn(async () => true) } satisfies LocalNotifier;
  }

  it('undetermined: requests once', async () =>
  {
    const notifier = notifierWithStatus('undetermined');
    await ensureNotificationPermission(notifier);
    expect(notifier.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('granted: does not request', async () =>
  {
    const notifier = notifierWithStatus('granted');
    await ensureNotificationPermission(notifier);
    expect(notifier.requestPermission).not.toHaveBeenCalled();
  });

  it('valid EC, no action: denied does not request', async () =>
  {
    const notifier = notifierWithStatus('denied');
    await ensureNotificationPermission(notifier);
    expect(notifier.requestPermission).not.toHaveBeenCalled();
  });

  it('undetermined, two calls at once: requests once', async () =>
  {
    const notifier = notifierWithStatus('undetermined');
    await Promise.all([ensureNotificationPermission(notifier), ensureNotificationPermission(notifier)]);
    expect(notifier.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('undetermined, second call after the first finished and was refused: asks the current status again', async () =>
  {
    const notifier = notifierWithStatus('undetermined');
    await ensureNotificationPermission(notifier);
    notifier.permission.mockResolvedValue('denied');
    await ensureNotificationPermission(notifier);
    expect(notifier.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('exception flow: status check throws, resolves without requesting', async () =>
  {
    const notifier = notifierWithStatus('undetermined');
    notifier.permission.mockRejectedValue(new Error('no module'));
    await expect(ensureNotificationPermission(notifier)).resolves.toBeUndefined();
    expect(notifier.requestPermission).not.toHaveBeenCalled();
  });

  it('exception flow: request throws, resolves', async () =>
  {
    const notifier = notifierWithStatus('undetermined');
    notifier.requestPermission.mockRejectedValue(new Error('no activity'));
    await expect(ensureNotificationPermission(notifier)).resolves.toBeUndefined();
  });
});

describe('PackActionButton asks for notifications before downloading (UC 1.4.1 step 7)', () =>
{
  // Presses Download with the given notification status and returns the order of calls.
  async function pressDownload(status: NotificationPermission, requestOutcome: 'denied' | 'granted' = 'granted')
  {
    const services = await createTestServices();
    const calls: string[] = [];
    jest.spyOn(services.notifier, 'permission').mockImplementation(async () =>
    {
      calls.push('permission');
      return status;
    });
    jest.spyOn(services.notifier, 'requestPermission').mockImplementation(async () =>
    {
      calls.push('request');
      return requestOutcome;
    });
    jest.spyOn(services.downloads, 'download').mockImplementation(async () =>
    {
      calls.push('download');
      return { kind: 'downloaded' };
    });
    await renderWithServices(services, <PackActionButton parkId={PARK_CIVIC} estimatedBytes={1000} />);
    await fireEvent.press(screen.getByTestId('pack-download'));
    await act(async () => undefined);
    return calls;
  }

  it('undetermined: requests once, before the download, and not again after it', async () =>
  {
    expect(await pressDownload('undetermined')).toEqual(['permission', 'request', 'download']);
  });

  it('undetermined, user refuses: the download still runs', async () =>
  {
    expect(await pressDownload('undetermined', 'denied')).toEqual(['permission', 'request', 'download']);
  });

  it('granted: does not request, the download runs', async () =>
  {
    expect(await pressDownload('granted')).toEqual(['permission', 'download']);
  });

  it('valid EC, no action: denied does not request, the download still runs', async () =>
  {
    expect(await pressDownload('denied')).toEqual(['permission', 'download']);
  });
});
