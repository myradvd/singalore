import type { CatalogLandmark } from '@singalore/shared';
import { formatEpisodeLength } from '@singalore/shared';
import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { landmarksForPark, totalPodcastSeconds, useCatalogStore } from '@/modules/catalog/catalogStore';
import { COPY, categoryLabel } from '../../copy';
import { useMapUiStore } from '../../mapCommandStore';
import { SecondaryButton, TextButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { ErrorState } from '../../primitives/States';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { RemoteImage } from '../../primitives/RemoteImage';

function LandmarkRow({ landmark, podcastSeconds, onSeeOnMap, trailing, expandedAtStart, onRowLayout }: { landmark: CatalogLandmark; podcastSeconds: number | null; onSeeOnMap: () => void; trailing?: ReactNode; expandedAtStart: boolean; onRowLayout?: ((event: LayoutChangeEvent) => void) | undefined })
{
  const [expanded, setExpanded] = useState(expandedAtStart);
  const description = landmark.shortDescription.trim().length > 0 ? landmark.shortDescription : COPY.descriptionUnavailable;
  return (
    <View testID={`park-landmark-${landmark.slug}`} style={styles.landmark} onLayout={onRowLayout}>
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

export function ParkDetailScreen({ parkId, renderLandmarkTrailing, parkActions, focusSiteId }: { parkId: string; renderLandmarkTrailing?: (landmark: CatalogLandmark) => ReactNode; parkActions?: ReactNode; focusSiteId?: string | undefined })
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const catalog = useCatalogStore();
  const requestFocus = useMapUiStore((state) => state.requestFocus);
  const park = catalog.parksById.get(parkId);
  const scrollViewRef = useRef<ScrollView>(null);
  const focusScroll = useRef<{ bodyY: number | null; rowY: number | null; done: boolean }>({ bodyY: null, rowY: null, done: false });

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

  // Scrolls to the chosen site once, as soon as its row and the body have both been measured.
  const scrollToFocusedSite = () =>
  {
    const { bodyY, rowY, done } = focusScroll.current;
    if (done || bodyY === null || rowY === null)
    {
      return;
    }
    focusScroll.current.done = true;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, bodyY + rowY - insets.top - spacing.md), animated: false });
  };

  // Records where the body sits, because row positions are measured from it.
  const onBodyLayout = (event: LayoutChangeEvent) =>
  {
    focusScroll.current.bodyY = event.nativeEvent.layout.y;
    scrollToFocusedSite();
  };

  // Records where the chosen site's row sits inside the body.
  const onFocusedRowLayout = (event: LayoutChangeEvent) =>
  {
    focusScroll.current.rowY = event.nativeEvent.layout.y;
    scrollToFocusedSite();
  };

  return (
    <View testID="park-detail" style={styles.screen}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View>
          <RemoteImage uri={park.thumbnailUrl} style={styles.hero} placeholderIconSize={48} accessibilityLabel={`Photo of ${park.name}`} />
          <IconButton testID="park-back" icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.sm }]} />
        </View>
        <View testID="park-detail-body" style={styles.body} onLayout={onBodyLayout}>
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
              expandedAtStart={landmark.id === focusSiteId}
              onRowLayout={landmark.id === focusSiteId ? onFocusedRowLayout : undefined}
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
