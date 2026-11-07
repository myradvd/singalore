import { usePathname, useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import type { AudioControllerState } from '@/modules/audio/AudioController';
import { useAudioStore } from '@/modules/audio/audioStore';
import { IconButton } from '../../primitives/IconButton';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { isActivelyPlaying } from './playerLabels';

const FULL_PLAYER_PATH = '/player';

export interface MiniPlayerProps
{
  audio: AudioControllerState;
  onTogglePlay: () => void;
  onOpen: () => void;
  onClose: () => void;
}

export function MiniPlayer({ audio, onTogglePlay, onOpen, onClose }: MiniPlayerProps)
{
  if (audio.track === null)
  {
    return null;
  }
  const { status, track } = audio;
  const progress = status.durationSeconds > 0 ? status.positionSeconds / status.durationSeconds : 0;
  const busy = status.state === 'loading' || status.state === 'buffering';
  return (
    <View testID="mini-player" style={styles.container}>
      <View style={styles.track}><View style={[styles.progress, { width: `${Math.min(1, progress) * 100}%` }]} /></View>
      <View style={styles.row}>
        <IconButton
          testID="mini-toggle"
          icon={isActivelyPlaying(status.state) ? 'pause' : 'play'}
          accessibilityLabel={isActivelyPlaying(status.state) ? 'Pause' : 'Play'}
          onPress={onTogglePlay}
          variant="accent"
          size="player"
        />
        <Pressable testID="mini-open" accessibilityRole="button" accessibilityLabel={`Open player for ${track.title}`} onPress={onOpen} style={styles.text}>
          <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>{track.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{track.landmarkName}</Text>
        </Pressable>
        {busy && <ActivityIndicator testID="mini-buffering" color={colors.primary} accessibilityLabel="Loading audio" />}
        <IconButton testID="mini-close" icon="close" accessibilityLabel="Stop and close player" onPress={onClose} variant="plain" />
      </View>
    </View>
  );
}

// Reads the audio store here so position updates re-render only the mini player.
export function MiniPlayerHost()
{
  const services = useAppServices();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const audio = useAudioStore();
  if (pathname === FULL_PLAYER_PATH || audio.track === null)
  {
    return null;
  }
  return (
    <View testID="mini-player-host" style={[styles.host, { paddingBottom: insets.bottom + spacing.sm }]}>
      <MiniPlayer audio={audio} onTogglePlay={() => services.audio.togglePlay()} onOpen={() => router.push(FULL_PLAYER_PATH)} onClose={() => void services.audio.stopAndClear()} />
    </View>
  );
}

// Stacks the mini player under the screens so it never covers their bottom controls.
// While it shows, it owns the bottom inset, so screens above it see a bottom inset of 0.
export function WithMiniPlayer({ children }: { children: ReactNode })
{
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hasTrack = useAudioStore((state) => state.track !== null);
  const playerShown = hasTrack && pathname !== FULL_PLAYER_PATH;
  const screenInsets = useMemo(() => (playerShown ? { ...insets, bottom: 0 } : insets), [playerShown, insets]);
  return (
    <View style={styles.frame}>
      <SafeAreaInsetsContext.Provider value={screenInsets}>
        <View style={styles.screens}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      <MiniPlayerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  screens: { flex: 1 },
  host: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, backgroundColor: colors.background },
  container: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.floating },
  track: { height: 3, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, overflow: 'hidden' },
  progress: { height: 3, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
