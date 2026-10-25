import { formatEpisodeLength } from '@singalore/shared';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { Banner } from '../../primitives/Banner';
import { Card } from '../../primitives/Card';
import { Chip } from '../../primitives/Chip';
import { colors, spacing, typography } from '../../theme/tokens';

export interface PodcastPromptProps
{
  landmarkName: string;
  podcastSeconds: number | null;
  onListen: () => void;
  onDismiss: () => void;
}

export function PodcastPrompt({ landmarkName, podcastSeconds, onListen, onDismiss }: PodcastPromptProps)
{
  return (
    <Card testID="podcast-prompt" style={styles.card}>
      <Text style={[typography.eyebrow, { color: colors.primary }]} accessibilityRole="header">PODCAST AVAILABLE</Text>
      <Text style={[typography.title, { color: colors.text }]} accessibilityLiveRegion="assertive">{`You have reached ${landmarkName}`}</Text>
      {podcastSeconds !== null && formatEpisodeLength(podcastSeconds) !== null && (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{`Episode length ${formatEpisodeLength(podcastSeconds) ?? ''}`}</Text>
      )}
      <View style={styles.actions}>
        <PrimaryButton testID="prompt-listen" label="Listen" icon="play" onPress={onListen} style={styles.action} />
        <SecondaryButton testID="prompt-dismiss" label="Not now" onPress={onDismiss} style={styles.action} />
      </View>
    </Card>
  );
}

export function NextUpChip({ landmarkName }: { landmarkName: string })
{
  return <Chip testID="next-up-chip" label={`Next up: ${landmarkName}`} icon="playlist-play" />;
}

export function OutOfRangeNotice({ landmarkName, onDismiss }: { landmarkName: string; onDismiss: () => void })
{
  return (
    <Banner
      testID="out-of-range"
      icon="map-marker-distance"
      tone="info"
      message={`You are out of range of ${landmarkName}. Audio continues.`}
      actions={[{ label: 'OK', onPress: onDismiss }]}
    />
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
});
