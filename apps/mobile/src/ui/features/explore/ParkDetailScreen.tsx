import type { CatalogLandmark } from '@singalore/shared';
import { formatEpisodeLength } from '@singalore/shared';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { landmarksForPark, totalPodcastSeconds, useCatalogStore } from '@/modules/catalog/catalogStore';
import { COPY, categoryLabel } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { SecondaryButton, TextButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { ErrorState } from '../../primitives/States';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { RemoteImage } from '../../primitives/RemoteImage';

function LandmarkRow({ landmark, podcastSeconds, onSeeOnMap, trailing }: { landmark: CatalogLandmark; podcastSeconds: number | null; onSeeOnMap: () => void; trailing?: ReactNode })
{
  const [expanded, setExpanded] = useState(false);
  const description = landmark.shortDescription.trim().length > 0 ? landmark.shortDescription : COPY.descriptionUnavailable;
  return (
    <View testID={`park-landmark-${landmark.slug}`} style={styles.landmark}>
      <RemoteImage uri={landmark.thumbnailUrl} style={styles.landmarkImage} accessibilityLabel={`Photo of ${landmark.name}`} />
      <View style={styles.landmarkText}>
        <Text style={[typography.eyebrow, { color: colors.primary }]}>{categoryLabel(landmark.category).toUpperCase()}</Text>
        <Text style={[typography.heading, { color: colors.text }]}>{landmark.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{podcastSeconds === null ? COPY.noPodcast : `Podcast ${formatEpisodeLength(podcastSeconds) ?? ''}`.trim()}</Text>
        <Text style={[typography.body, { color: colors.text }]} numberOfLines={expanded ? undefined : 2}>{description}</Text>
        <View style={styles.rowActions}>
          <TextButton label={expanded ? 'Show less' : 'Read more'} onPress={() => setExpanded((value) => !value)} />
          <TextButton testID={`see-on-map-${landmark.slug}`} label="See on map" onPress={onSeeOnMap} />
        </View>
      </View>
      {trailing}
    </View>
  );
}

export function ParkDetailScreen({ parkId, renderLandmarkTrailing, parkActions }: { parkId: string; renderLandmarkTrailing?: (landmark: CatalogLandmark) => ReactNode; parkActions?: ReactNode })
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const catalog = useCatalogStore();
  const requestFocus = useMapUiStore((state) => state.requestFocus);
  const park = catalog.parksById.get(parkId);

  if (park === undefined)
  {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ErrorState icon="map-marker-question-outline" title="Park not found" message="This heritage park is no longer in the catalog." actionLabel="Back" onAction={() => router.back()} />
      </View>
    );
  }

  const landmarks = landmarksForPark(catalog, park.id);
  const seeOnMap = (request: Parameters<typeof requestFocus>[0]) =>
  {
    requestFocus(request);
    router.dismissTo('/');
  };

  return (
    <View testID="park-detail" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View>
          <RemoteImage uri={park.thumbnailUrl} style={styles.hero} placeholderIconSize={48} accessibilityLabel={`Photo of ${park.name}`} />
          <IconButton testID="park-back" icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.sm }]} />
        </View>
        <View style={styles.body}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>{park.district.toUpperCase()}</Text>
          <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">{park.name}</Text>
          <Text style={[typography.body, { color: colors.text }]}>{park.shortDescription.length > 0 ? park.shortDescription : COPY.descriptionUnavailable}</Text>
          <View style={styles.actions}>
            <SecondaryButton testID="park-see-on-map" label="See on map" icon="map-outline" onPress={() => seeOnMap({ kind: 'park', parkId: park.id })} />
            {parkActions}
          </View>
          <Text style={[typography.eyebrow, styles.section]}>{`${landmarks.length} SITES`}</Text>
          {landmarks.map((landmark) => (
            <LandmarkRow
              key={landmark.id}
              landmark={landmark}
              podcastSeconds={totalPodcastSeconds(catalog, landmark.id)}
              onSeeOnMap={() => seeOnMap({ kind: 'landmark', landmarkId: landmark.id })}
              trailing={renderLandmarkTrailing?.(landmark)}
            />
          ))}
          <Text style={[typography.caption, styles.attribution]}>{park.attribution}</Text>
          {landmarks.map((landmark) => landmark.attribution.length > 0 && (
            <Text key={`attribution-${landmark.id}`} style={[typography.caption, styles.attribution]}>{`${landmark.name}: ${landmark.attribution}`}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', height: 240 },
  back: { position: 'absolute', left: spacing.md },
  body: { padding: spacing.xl, gap: spacing.md, marginTop: -spacing.xl, backgroundColor: colors.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginVertical: spacing.sm },
  section: { color: colors.primary, marginTop: spacing.lg },
  landmark: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  landmarkImage: { width: 80, height: 80, borderRadius: radii.md },
  landmarkText: { flex: 1, gap: spacing.xs },
  rowActions: { flexDirection: 'row', gap: spacing.md },
  attribution: { color: colors.textMuted, marginTop: spacing.sm },
});
