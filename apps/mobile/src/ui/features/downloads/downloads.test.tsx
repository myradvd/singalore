import { act, fireEvent, screen } from '@testing-library/react-native';
import { ensureNotificationPermission, type LocalNotifier, type NotificationPermission } from '@/core/notifications';
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
import { formatMegabytes } from '../explore/formatBytes';
import { downloadProgressFraction, PackActionButton, packStatusLabel } from './PackActionButton';
import { SiteDownloadButton } from './SiteDownloadButton';

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

describe('formatMegabytes (UC 1.4.1 step 6)', () =>
{
  it.each([
    ['zero', 0, '0.0 MB'],
    ['below 1 MB in bytes', 1023, '0.0 MB'],
    ['just below the first rounding step', 52428, '0.0 MB'],
    ['on the first rounding step', 52429, '0.1 MB'],
    ['just below 1 MB', 1048575, '1.0 MB'],
    ['on 1 MB', 1048576, '1.0 MB'],
    ['just above 1 MB', 1048577, '1.0 MB'],
    ['10 MB', 10485760, '10.0 MB'],
  ])('%s: %d bytes reads %s', (_name, bytes, expected) =>
  {
    expect(formatMegabytes(bytes)).toBe(expected);
  });
});

describe('download progress label (UC 1.4.1 step 6)', () =>
{
  const base = { parkId: 'p', packEtag: null, errorCode: null, completedAt: null };

  it('zero: 0 of 10 MB reads the exact SRS label', () =>
  {
    expect(packStatusLabel({ ...base, state: 'downloading', doneBytes: 0, totalBytes: 10485760 }, 0)).toBe('Downloading 0.0 MB of 10.0 MB');
  });

  it.each([0, 1, 1023, 1024, 500000, 1048575, 1048576, 5000000000])('%d bytes done keeps the label in MB', (doneBytes) =>
  {
    expect(packStatusLabel({ ...base, state: 'downloading', doneBytes, totalBytes: 5000000000 }, 0)).toMatch(/^Downloading \d+\.\d MB of \d+\.\d MB$/);
  });

  it('paused below 1 MB also reads in MB', () =>
  {
    expect(packStatusLabel({ ...base, state: 'paused', doneBytes: 1023, totalBytes: 512 }, 0)).toBe('Paused at 0.0 MB of 0.0 MB');
  });
});

describe('downloadProgressFraction (UC 1.4.1 step 6)', () =>
{
  it.each([
    ['zero done', 0, 1000, 0],
    ['half done', 500, 1000, 0.5],
    ['just below total', 999, 1000, 0.999],
    ['on total', 1000, 1000, 1],
    ['just above total is capped', 1001, 1000, 1],
    ['total zero (invalid EC) has no NaN', 0, 0, 0],
  ])('%s: %d of %d gives %d', (_name, doneBytes, totalBytes, expected) =>
  {
    expect(downloadProgressFraction(doneBytes, totalBytes)).toBe(expected);
  });
});

describe('download progress bar (UC 1.4.1 step 6)', () =>
{
  const parkId = 'park-a';

  // Renders the pack button for a record in the given state.
  async function renderPack(state: 'downloading' | 'paused', doneBytes: number, totalBytes: number)
  {
    useDownloadsStore.setState({ records: { [parkId]: { parkId, state, packEtag: null, totalBytes, doneBytes, errorCode: null, completedAt: null } } });
    await renderWithServices(await createTestServices(), <PackActionButton parkId={parkId} estimatedBytes={0} />);
  }

  afterEach(async () =>
  {
    await act(async () => useDownloadsStore.setState({ records: {} }));
  });

  it.each([
    ['just below total is under 100%', 999, 1000, '99.9%', 99],
    ['on total is 100%', 1000, 1000, '100%', 100],
    ['over total is capped at 100%', 1001, 1000, '100%', 100],
    ['total zero (invalid EC) is 0%, no NaN', 0, 0, '0%', 0],
  ])('%s', async (_name, doneBytes, totalBytes, width, percent) =>
  {
    await renderPack('downloading', doneBytes, totalBytes);
    expect(screen.getByTestId('pack-progress-fill').props.style).toEqual(expect.arrayContaining([{ width }]));
    expect(screen.getByRole('progressbar', { name: 'Downloading' }).props.accessibilityValue).toEqual({ min: 0, max: 100, now: percent });
  });

  it('shows no bar when paused', async () =>
  {
    await renderPack('paused', 500, 1000);
    expect(screen.queryByTestId('pack-progress-fill')).toBeNull();
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

  it('does not re-query the stored total as doneBytes changes, only when a park state or size changes', async () =>
  {
    const record = { parkId: PARK_CIVIC, state: 'downloading' as const, packEtag: null, totalBytes: 1000, doneBytes: 0, errorCode: null, completedAt: null };
    useDownloadsStore.setState({ records: { [PARK_CIVIC]: record } });
    applyCatalogSnapshot(catalogFixture());
    const services = await createTestServices();
    const totalStoredBytes = jest.spyOn(services.downloads, 'totalStoredBytes');
    await renderWithServices(services, <DownloadsScreen />);
    await act(async () => undefined);
    const queriesAtStart = totalStoredBytes.mock.calls.length;
    for (const doneBytes of [100, 200, 300])
    {
      await act(async () => useDownloadsStore.setState({ records: { [PARK_CIVIC]: { ...record, doneBytes } } }));
    }
    expect(totalStoredBytes.mock.calls.length).toBe(queriesAtStart);
    await act(async () => useDownloadsStore.setState({ records: { [PARK_CIVIC]: { ...record, state: 'downloaded', doneBytes: 1000 } } }));
    expect(totalStoredBytes.mock.calls.length).toBe(queriesAtStart + 1);
    await act(async () => useDownloadsStore.setState({ records: { [PARK_CIVIC]: { ...record, state: 'downloaded', doneBytes: 2000, totalBytes: 2000 } } }));
    expect(totalStoredBytes.mock.calls.length).toBe(queriesAtStart + 2);
    await act(async () => useDownloadsStore.setState({ records: {} }));
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

describe('SiteDownloadButton on the site card (UC 1.4.1.6)', () =>
{
  // Renders the button with the park in the given state, or no record when state is null.
  async function renderSite(state: 'not_downloaded' | 'failed' | 'update_available' | 'paused' | 'downloading' | 'downloaded' | null)
  {
    const services = await createTestServices();
    const download = jest.spyOn(services.downloads, 'download').mockResolvedValue({ kind: 'downloaded' });
    await renderWithServices(services, <SiteDownloadButton parkId={PARK_CIVIC} parkName="Civic Park" />);
    if (state !== null)
    {
      await act(async () => useDownloadsStore.setState({ records: { [PARK_CIVIC]: { parkId: PARK_CIVIC, state, packEtag: null, totalBytes: 1000, doneBytes: 0, errorCode: null, completedAt: null } } }));
    }
    return download;
  }

  afterEach(async () =>
  {
    await act(async () => useDownloadsStore.setState({ records: {} }));
  });

  it.each([
    ['no record', null, 'Download Civic Park'],
    ['not_downloaded', 'not_downloaded', 'Download Civic Park'],
    ['failed', 'failed', 'Download Civic Park'],
    ['update_available', 'update_available', 'Download Civic Park'],
    ['paused', 'paused', 'Resume download'],
  ] as const)('%s shows an enabled "%s" button', async (_name, state, label) =>
  {
    await renderSite(state);
    expect(screen.getByTestId('site-download').props.accessibilityLabel).toBe(label);
    expect(screen.getByTestId('site-download').props.accessibilityState.disabled).toBe(false);
  });

  it('downloading shows a disabled "Downloading..." button', async () =>
  {
    await renderSite('downloading');
    expect(screen.getByTestId('site-download').props.accessibilityLabel).toBe('Downloading...');
    expect(screen.getByTestId('site-download').props.accessibilityState.disabled).toBe(true);
  });

  it('downloaded renders nothing', async () =>
  {
    await renderSite('downloaded');
    expect(screen.queryByTestId('site-download')).toBeNull();
  });

  it('pressing starts the park download once', async () =>
  {
    const download = await renderSite('not_downloaded');
    await fireEvent.press(screen.getByTestId('site-download'));
    await act(async () => undefined);
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(PARK_CIVIC);
  });

  it('a refused download shows its message as an error toast', async () =>
  {
    const services = await createTestServices();
    jest.spyOn(services.downloads, 'download').mockResolvedValue({ kind: 'failed', message: 'Not enough storage. Free up 5 MB and try again.' });
    await renderWithServices(services, <SiteDownloadButton parkId={PARK_CIVIC} parkName="Civic Park" />);
    await fireEvent.press(screen.getByTestId('site-download'));
    await act(async () => undefined);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Not enough storage. Free up 5 MB and try again.']);
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
