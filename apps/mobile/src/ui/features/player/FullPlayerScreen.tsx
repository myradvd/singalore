import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import { useAudioStore } from '@/modules/audio/audioStore';
import { updatePreferences } from '@/modules/prefs/preferencesStore';
import { SecondaryButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { SeekBar } from '../../primitives/SeekBar';
import { EmptyState } from '../../primitives/States';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatRate, isActivelyPlaying, nextPlaybackRate } from './playerLabels';

export function FullPlayerScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();
  const audio = useAudioStore();
  const { track, status } = audio;

  if (track === null)
  {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <EmptyState icon="headphones-off" title="Nothing playing" message="Choose a landmark on the map or walk into a heritage site to hear its podcast." actionLabel="Back to map" onAction={() => router.back()} />
      </View>
    );
  }

  const changeRate = () =>
  {
    const rate = nextPlaybackRate(status.rate);
    services.audio.setRate(rate);
    void updatePreferences(services.preferences, { playbackRate: rate });
  };

  return (
    <View testID="full-player" style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.header}>
        <IconButton testID="player-collapse" icon="chevron-down" accessibilityLabel="Minimise player" onPress={() => router.back()} variant="plain" />
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>NOW PLAYING</Text>
        <IconButton testID="player-transcript" icon="text-box-outline" accessibilityLabel="Show transcript" onPress={() => router.push('/transcript')} variant="plain" />
      </View>
      <View style={styles.body}>
        <Text style={[typography.eyebrow, { color: colors.primary }]}>{`PODCAST  ·  ${track.source === 'local' ? 'DOWNLOADED' : 'STREAMING'}`}</Text>
        <Text style={[typography.display, { color: colors.text }]} accessibilityRole="header">{track.title}</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>{track.landmarkName}</Text>
        <SeekBar testID="player-seek" positionSeconds={status.positionSeconds} durationSeconds={status.durationSeconds} onSeek={(seconds) => void services.audio.seekTo(seconds)} />
        {(status.state === 'buffering' || status.state === 'loading') && (
          <View style={styles.buffering} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Loading audio...</Text>
          </View>
        )}
        {audio.lastError !== null && <Text testID="player-error" style={[typography.body, { color: colors.danger }]}>{audio.lastError}</Text>}
        <View style={styles.controls}>
          <IconButton testID="player-rate" icon="speedometer" accessibilityLabel={`Playback speed ${formatRate(status.rate)}. Change speed`} onPress={changeRate} variant="plain" size="player" />
          <IconButton testID="player-back" icon="rewind-10" accessibilityLabel="Skip back 10 seconds" onPress={() => void services.audio.skip(-1)} size="player" />
          <IconButton
            testID="player-toggle"
            icon={isActivelyPlaying(status.state) ? 'pause' : 'play'}
            accessibilityLabel={isActivelyPlaying(status.state) ? 'Pause' : status.state === 'ended' ? 'Play again' : 'Play'}
            onPress={() => services.audio.togglePlay()}
            variant="accent"
            size="playerPrimary"
          />
          <IconButton testID="player-forward" icon="fast-forward-10" accessibilityLabel="Skip forward 10 seconds" onPress={() => void services.audio.skip(1)} size="player" />
          <View style={styles.rateLabel}><Text style={[typography.label, { color: colors.text }]} maxFontSizeMultiplier={1.6}>{formatRate(status.rate)}</Text></View>
        </View>
        <SecondaryButton testID="player-stop" label="Stop and close" icon="stop" onPress={() =>
        {
          void services.audio.stopAndClear();
          router.back();
        }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  body: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.xl },
  rateLabel: { minWidth: 56, alignItems: 'center' },
  buffering: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
