import type { CatalogLandmark, CatalogPark, GeoPoint } from '@singalore/shared';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchIndex } from '@/modules/catalog/searchIndex';
import { SEARCH_MINIMUM_QUERY_LENGTH } from '@/modules/catalog/searchIndex';
import { COPY, categoryLabel } from '../../copy';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PrimaryButton, TextButton } from '../../primitives/Buttons';
import { Icon } from '../../primitives/Icon';
import { IconButton } from '../../primitives/IconButton';
import { colors, fill, radii, shadows, spacing, touchTargets, typography } from '../../theme/tokens';
import { recentCatalogSites, SHOWN_RECENT_SITES, suggestedSites } from './searchSuggestions';

export const SEARCH_DEBOUNCE_MS = 300;

type ResultRow =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'recentHeader'; key: string }
  | { kind: 'recentSeeAll'; key: string }
  | { kind: 'park'; key: string; park: CatalogPark }
  | { kind: 'landmark'; key: string; testIdPrefix: string; landmark: CatalogLandmark; parkName: string };

export interface SearchOverlayProps
{
  index: SearchIndex;
  parksById: ReadonlyMap<string, CatalogPark>;
  purpose: 'browse' | 'addToRoute';
  itineraryIds: readonly string[];
  landmarksById: ReadonlyMap<string, CatalogLandmark>;
  recentLandmarkIds: readonly string[];
  userPosition: GeoPoint | null;
  onClearRecent: () => void;
  onSelectLandmark: (landmarkId: string) => void;
  onSelectPark: (parkId: string) => void;
  onClose: (addLandmarkIds: string[]) => void;
}

export function SearchOverlay({ index, parksById, purpose, itineraryIds, landmarksById, recentLandmarkIds, userPosition, onClearRecent, onSelectLandmark, onSelectPark, onClose }: SearchOverlayProps)
{
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const results = useMemo(() => index.search(debouncedQuery), [index, debouncedQuery]);
  const boxEmpty = debouncedQuery.trim().length === 0;
  const rows = useMemo<ResultRow[]>(() =>
  {
    const list: ResultRow[] = [];
    if (boxEmpty)
    {
      // Builds one row of an empty box section.
      const landmarkRow = (section: 'recent' | 'suggested', landmark: CatalogLandmark): ResultRow => ({ kind: 'landmark', key: `${section}-${landmark.id}`, testIdPrefix: `search-${section}`, landmark, parkName: parksById.get(landmark.parkId)?.name ?? '' });
      const recent = recentCatalogSites(recentLandmarkIds, landmarksById);
      if (recent.length > 0)
      {
        list.push({ kind: 'recentHeader', key: 'recent-header' });
        list.push(...(showAllRecent ? recent : recent.slice(0, SHOWN_RECENT_SITES)).map((landmark) => landmarkRow('recent', landmark)));
        if (!showAllRecent && recent.length > SHOWN_RECENT_SITES)
        {
          list.push({ kind: 'recentSeeAll', key: 'recent-see-all' });
        }
      }
      const suggested = suggestedSites({ landmarksById, purpose, itineraryIds, userPosition });
      if (suggested.length > 0)
      {
        list.push({ kind: 'header', key: 'suggested-header', title: COPY.searchSuggestedTitle });
        list.push(...suggested.map((landmark) => landmarkRow('suggested', landmark)));
      }
      return list;
    }
    if (purpose === 'browse' && results.parks.length > 0)
    {
      list.push({ kind: 'header', key: 'parks', title: 'Heritage parks' });
      list.push(...results.parks.map((park) => ({ kind: 'park' as const, key: `park-${park.id}`, park })));
    }
    if (results.landmarks.length > 0)
    {
      list.push({ kind: 'header', key: 'landmarks', title: 'Landmarks' });
      list.push(...results.landmarks.map((landmark) => ({ kind: 'landmark' as const, key: `landmark-${landmark.id}`, testIdPrefix: 'search', landmark, parkName: parksById.get(landmark.parkId)?.name ?? '' })));
    }
    return list;
  }, [results, parksById, purpose, boxEmpty, recentLandmarkIds, landmarksById, showAllRecent, itineraryIds, userPosition]);
  const searched = debouncedQuery.trim().length >= SEARCH_MINIMUM_QUERY_LENGTH;

  const togglePicked = (landmarkId: string) =>
  {
    setPicked((current) => (current.includes(landmarkId) ? current.filter((id) => id !== landmarkId) : [...current, landmarkId]));
  };

  return (
    <View testID="search-overlay" style={[styles.overlay, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.inputRow}>
        <IconButton testID="close-search" icon="arrow-left" accessibilityLabel="Close search" onPress={() => onClose(picked)} variant="plain" />
        <View style={styles.inputWrap}>
          <Icon name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            testID="search-input"
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={purpose === 'addToRoute' ? 'Search sites to add to your route' : COPY.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.input]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search heritage sites"
          />
          {query.length > 0 && <IconButton icon="close-circle" accessibilityLabel="Clear search" onPress={() => setQuery('')} variant="plain" />}
        </View>
      </View>
      {debouncedQuery.trim().length === 1 && (
        <Text testID="search-minimum-length-hint" style={[typography.body, styles.empty]} accessibilityLiveRegion="polite">{COPY.searchMinimumLengthHint}</Text>
      )}
      {searched && rows.length === 0 && (
        <Text testID="search-empty" style={[typography.body, styles.empty]} accessibilityLiveRegion="polite">{COPY.searchEmpty}</Text>
      )}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        renderItem={({ item }) =>
        {
          if (item.kind === 'header')
          {
            return <Text style={[typography.eyebrow, styles.sectionHeader]} accessibilityRole="header">{item.title.toUpperCase()}</Text>;
          }
          if (item.kind === 'recentHeader')
          {
            return (
              <View style={styles.recentHeader}>
                <Text style={[typography.eyebrow, { color: colors.textMuted }]} accessibilityRole="header">{COPY.searchRecentTitle.toUpperCase()}</Text>
                <TextButton testID="search-recent-clear" label={COPY.searchRecentClear} onPress={onClearRecent} />
              </View>
            );
          }
          if (item.kind === 'recentSeeAll')
          {
            return <TextButton testID="search-recent-see-all" label={COPY.searchRecentSeeAll} onPress={() => setShowAllRecent(true)} style={styles.recentSeeAll} />;
          }
          if (item.kind === 'park')
          {
            return (
              <Pressable testID={`search-park-${item.park.slug}`} accessibilityRole="button" accessibilityLabel={`${item.park.name}, ${item.park.district}`} onPress={() => onSelectPark(item.park.id)} style={styles.result}>
                <Icon name="map-marker-radius-outline" size={24} color={colors.primary} />
                <View style={styles.resultText}>
                  <Text style={[typography.heading, styles.resultTitle]}>{item.park.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{`${item.park.district}  ·  ${item.park.landmarkCount} sites`}</Text>
                </View>
              </Pressable>
            );
          }
          const inRoute = itineraryIds.includes(item.landmark.id) || picked.includes(item.landmark.id);
          const pickingForRoute = purpose === 'addToRoute';
          return (
            <View style={styles.result}>
              <Pressable testID={`${item.testIdPrefix}-landmark-${item.landmark.slug}`} accessibilityRole="button" accessibilityLabel={`${item.landmark.name}, ${categoryLabel(item.landmark.category)}`} accessibilityState={pickingForRoute ? { selected: inRoute } : undefined} disabled={pickingForRoute && itineraryIds.includes(item.landmark.id)} onPress={() => (pickingForRoute ? togglePicked(item.landmark.id) : onSelectLandmark(item.landmark.id))} style={styles.resultPress}>
                <Icon name="map-marker" size={24} color={colors.primary} />
                <View style={styles.resultText}>
                  <Text style={[typography.eyebrow, { color: colors.primary }]}>{categoryLabel(item.landmark.category).toUpperCase()}</Text>
                  <Text style={[typography.heading, styles.resultTitle]}>{item.landmark.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{item.parkName}</Text>
                </View>
              </Pressable>
              {purpose === 'addToRoute' && (
                <IconButton
                  testID={`${item.testIdPrefix}-add-${item.landmark.slug}`}
                  icon={inRoute ? 'check' : 'plus'}
                  accessibilityLabel={inRoute ? `${item.landmark.name} is in your route` : `Add ${item.landmark.name} to route`}
                  onPress={() => togglePicked(item.landmark.id)}
                  variant={inRoute ? 'accent' : 'glass'}
                  disabled={itineraryIds.includes(item.landmark.id)}
                />
              )}
            </View>
          );
        }}
      />
      {purpose === 'addToRoute' && picked.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <PrimaryButton testID="search-add-picked" label={`Add ${picked.length} to route`} icon="plus" onPress={() => onClose(picked)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...fill, backgroundColor: colors.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.xs },
  inputWrap: { flex: 1, minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingLeft: spacing.lg, gap: spacing.sm, ...shadows.card },
  input: { flex: 1, color: colors.text, minHeight: touchTargets.minimum },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.xl, paddingRight: spacing.md, paddingTop: spacing.md },
  recentSeeAll: { alignSelf: 'flex-start', marginLeft: spacing.md },
  sectionHeader: { color: colors.textMuted, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md, minHeight: touchTargets.minimum + 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md },
  resultText: { flex: 1, gap: spacing.xxs },
  resultTitle: { color: colors.text },
  footer: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
});
