import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AudioControllerState } from '@/modules/audio/AudioController';
import { IconButton } from '../../primitives/IconButton';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { isActivelyPlaying } from './playerLabels';

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

const styles = StyleSheet.create({
  container: { backgroundColor: colors.glass, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.floating },
  track: { height: 3, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, overflow: 'hidden' },
  progress: { height: 3, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
