import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import { bindAudioStore } from '@/modules/audio/audioStore';
import { catalogFixture, LANDMARK_CHIJMES } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { seekFraction } from '../../primitives/SeekBar';
import { FullPlayerScreen } from './FullPlayerScreen';
import { MiniPlayer } from './MiniPlayer';
import { formatRate, nextPlaybackRate } from './playerLabels';
import { TRANSCRIPT_UNAVAILABLE, TranscriptScreen } from './TranscriptScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }) }));

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
