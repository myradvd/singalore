import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  if (pathname === FULL_PLAYER_PATH)
  {
    return null;
  }
  return (
    <View style={[styles.host, { paddingBottom: insets.bottom + spacing.sm }]}>
      <MiniPlayer audio={audio} onTogglePlay={() => services.audio.togglePlay()} onOpen={() => router.push(FULL_PLAYER_PATH)} onClose={() => void services.audio.stopAndClear()} />
    </View>
  );
}

// Stacks the mini player under the screens so it never covers their bottom controls.
export function WithMiniPlayer({ children }: { children: ReactNode })
{
  return (
    <View style={styles.frame}>
      <View style={styles.screens}>{children}</View>
      <MiniPlayerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  screens: { flex: 1 },
  host: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, backgroundColor: colors.background },
  container: { backgroundColor: colors.glass, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.floating },
  track: { height: 3, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, overflow: 'hidden' },
  progress: { height: 3, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
