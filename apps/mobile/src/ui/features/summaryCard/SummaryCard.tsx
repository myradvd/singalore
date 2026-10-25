import { formatEpisodeLength, type CatalogLandmark } from '@singalore/shared';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COPY, categoryLabel } from '../../copy';
import { TextButton } from '../../primitives/Buttons';
import { Card } from '../../primitives/Card';
import { IconButton } from '../../primitives/IconButton';
import { RemoteImage } from '../../primitives/RemoteImage';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface SummaryCardProps
{
  landmark: CatalogLandmark;
  parkName: string | null;
  podcastSeconds: number | null;
  description: string | null;
  onClose: () => void;
  actions?: ReactNode;
  headerActions?: ReactNode;
}

const COLLAPSED_LINES = 3;

export function SummaryCard({ landmark, parkName, podcastSeconds, description, onClose, actions, headerActions }: SummaryCardProps)
{
  const [expanded, setExpanded] = useState(false);
  const fullText = (description ?? landmark.shortDescription).trim();
  const text = fullText.length > 0 ? fullText : COPY.descriptionUnavailable;
  const canExpand = fullText.length > 140;
  const episodeLength = podcastSeconds === null ? null : formatEpisodeLength(podcastSeconds);
  const caption = [parkName, episodeLength === null ? null : `Podcast ${episodeLength}`].filter((part) => part !== null).join('  ·  ');
  return (
    <Card testID="summary-card" style={styles.card}>
      <View style={styles.top}>
        <RemoteImage testID="summary-thumbnail" uri={landmark.thumbnailUrl} style={styles.thumbnail} accessibilityLabel={`Photo of ${landmark.name}`} />
        <View style={styles.titleBlock}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>{categoryLabel(landmark.category).toUpperCase()}</Text>
          <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">{landmark.name}</Text>
          {caption.length > 0 && <Text testID="summary-caption" style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>}
        </View>
        <View style={styles.headerActions}>
          {headerActions}
          <IconButton testID="close-summary" icon="close" accessibilityLabel="Close site summary" onPress={onClose} variant="plain" />
        </View>
      </View>
      <Text testID="summary-description" style={[typography.body, { color: colors.text }]} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>{text}</Text>
      {canExpand && <TextButton testID="summary-read-more" label={expanded ? 'Show less' : 'Read more'} onPress={() => setExpanded((value) => !value)} />}
      {actions !== undefined && <View style={styles.actions}>{actions}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  thumbnail: { width: 80, height: 80, borderRadius: radii.md },
  titleBlock: { flex: 1, gap: spacing.xs },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginTop: -spacing.sm, marginRight: -spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
});
