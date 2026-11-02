import { act, renderHook, waitFor } from '@testing-library/react-native';
import { startServicesRecheck } from './servicesRecheck';
import { useAppBootstrap } from './useAppBootstrap';

const mockStopRecheck = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { addEventListener: jest.fn() } }));
jest.mock('expo-notifications', () => ({ getLastNotificationResponseAsync: jest.fn(async () => null), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock('./servicesRecheck', () => ({ startServicesRecheck: jest.fn(() => mockStopRecheck) }));
jest.mock('./backgroundTasks', () => ({ registerLiveBackgroundRuntime: jest.fn() }));
jest.mock('./container', () => ({ createAppServices: jest.fn(() => jest.requireActual<typeof import('@test/support/renderWithProviders')>('@test/support/renderWithProviders').createTestServices()) }));

describe('useAppBootstrap services recheck wiring (UC 1.1.1.2)', () =>
{
  it('starts one recheck once ready, and stops it on unmount', async () =>
  {
    const { result, unmount } = await renderHook(() => useAppBootstrap());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(startServicesRecheck).toHaveBeenCalledTimes(1);
    expect(mockStopRecheck).toHaveBeenCalledTimes(0);
    await act(async () => unmount());
    expect(mockStopRecheck).toHaveBeenCalledTimes(1);
  });
});
