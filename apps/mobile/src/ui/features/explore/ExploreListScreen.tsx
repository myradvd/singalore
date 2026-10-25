import type { CatalogPark } from '@singalore/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { COPY } from '../../copy';
import { Chip } from '../../primitives/Chip';
import { Icon } from '../../primitives/Icon';
import { IconButton } from '../../primitives/IconButton';
import { EmptyState } from '../../primitives/States';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../../theme/tokens';
import { formatBytes } from './formatBytes';
import { RemoteImage } from '../../primitives/RemoteImage';

export function filterParks(parks: readonly CatalogPark[], query: string, district: string | null): CatalogPark[]
{
  const needle = query.trim().toLowerCase();
  return parks.filter((park) =>
  {
    const matchesDistrict = district === null || park.district === district;
    const matchesQuery = needle.length === 0 || park.name.toLowerCase().includes(needle) || park.district.toLowerCase().includes(needle);
    return matchesDistrict && matchesQuery;
  });
}

export function ExploreListScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const parks = useCatalogStore((state) => state.snapshot.parks);
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const districts = useMemo(() => [...new Set(parks.map((park) => park.district))].sort(), [parks]);
  const visible = useMemo(() => filterParks(parks, query, district), [parks, query, district]);

  return (
    <View testID="explore-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton testID="explore-back" icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} variant="plain" />
        <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">Explore heritage parks</Text>
      </View>
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          testID="explore-filter"
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by park name or district"
          placeholderTextColor={colors.textMuted}
          style={[typography.body, styles.input]}
          accessibilityLabel="Filter heritage parks"
        />
      </View>
      <View style={styles.chips}>
        <Chip label="All districts" selected={district === null} onPress={() => setDistrict(null)} />
        {districts.map((name) => <Chip key={name} testID={`district-${name}`} label={name} selected={district === name} onPress={() => setDistrict(name)} />)}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(park) => park.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        ListEmptyComponent={parks.length === 0
          ? <EmptyState icon="cloud-off-outline" title={COPY.emptyCatalogTitle} message={COPY.emptyCatalogMessage} />
          : <Text testID="explore-empty" style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>{COPY.searchEmpty}</Text>}
        renderItem={({ item }) => (
          <Pressable testID={`explore-park-${item.slug}`} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.district}, ${item.landmarkCount} sites`} onPress={() => router.push(`/explore/${item.id}`)} style={styles.parkCard}>
            <RemoteImage uri={item.thumbnailUrl} style={styles.thumbnail} accessibilityLabel={`Photo of ${item.name}`} />
            <View style={styles.parkText}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>{item.district.toUpperCase()}</Text>
              <Text style={[typography.heading, { color: colors.text }]}>{item.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>{item.shortDescription}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{`${item.landmarkCount} sites  ·  ${formatBytes(item.packBytes)} offline pack`}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  searchWrap: { marginHorizontal: spacing.lg, minHeight: touchTargets.minimum, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.lg, ...shadows.card },
  input: { flex: 1, color: colors.text, minHeight: touchTargets.minimum },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  parkCard: { flexDirection: 'row', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  thumbnail: { width: 88, height: 88, borderRadius: radii.md },
  parkText: { flex: 1, gap: spacing.xs, paddingVertical: spacing.xxs },
});
