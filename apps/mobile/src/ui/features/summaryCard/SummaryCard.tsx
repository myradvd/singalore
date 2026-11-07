import { formatEpisodeLength, type CatalogLandmark } from '@singalore/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  imageUri?: string | null;
  onClose: () => void;
  actions?: ReactNode;
  headerActions?: ReactNode;
}

const COLLAPSED_LINES = 3;
const EXPANDED_TEXT_WINDOW_FRACTION = 0.2;

export function SummaryCard({ landmark, parkName, podcastSeconds, description, imageUri, onClose, actions, headerActions }: SummaryCardProps)
{
  const [expanded, setExpanded] = useState(false);
  const windowHeight = useWindowDimensions().height;
  const fullText = (description ?? landmark.shortDescription).trim();
  const text = fullText.length > 0 ? fullText : COPY.descriptionUnavailable;
  const canExpand = fullText.length > 140;
  const episodeLength = podcastSeconds === null ? null : formatEpisodeLength(podcastSeconds);
  const caption = [parkName, episodeLength === null ? null : `Podcast ${episodeLength}`].filter((part) => part !== null).join('  ·  ');
  return (
    <Card testID="summary-card" style={styles.card}>
      <ScrollView testID="summary-body" style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
        <View style={styles.top}>
          <RemoteImage testID="summary-thumbnail" uri={imageUri ?? landmark.thumbnailUrl} style={styles.thumbnail} accessibilityLabel={`Photo of ${landmark.name}`} />
          <View testID="summary-title-block" style={styles.titleBlock}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>{categoryLabel(landmark.category).toUpperCase()}</Text>
            <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">{landmark.name}</Text>
            {caption.length > 0 && <Text testID="summary-caption" style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>}
          </View>
          <View testID="summary-header-actions" style={styles.headerActions}>
            <IconButton testID="close-summary" icon="close" accessibilityLabel="Close site summary" onPress={onClose} variant="plain" />
            {headerActions}
          </View>
        </View>
        {expanded
          ? (
            <ScrollView testID="summary-description-scroll" style={{ maxHeight: windowHeight * EXPANDED_TEXT_WINDOW_FRACTION }} nestedScrollEnabled>
              <Text testID="summary-description" style={[typography.body, { color: colors.text }]}>{text}</Text>
            </ScrollView>
          )
          : <Text testID="summary-description" style={[typography.body, { color: colors.text }]} numberOfLines={COLLAPSED_LINES}>{text}</Text>}
        {canExpand && <TextButton testID="summary-read-more" label={expanded ? 'Show less' : 'Read more'} onPress={() => setExpanded((value) => !value)} />}
        {actions !== undefined && <View style={styles.actions}>{actions}</View>}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexShrink: 1 },
  top: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  thumbnail: { width: 80, height: 80, borderRadius: radii.md },
  titleBlock: { flex: 1, minWidth: 0, gap: spacing.xs },
  headerActions: { flexDirection: 'column', alignItems: 'center', marginTop: -spacing.sm, marginRight: -spacing.sm },
  body: { flexShrink: 1 },
  bodyContent: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
});
