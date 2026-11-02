import { formatDistance } from '@singalore/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { useLocationStore } from '@/modules/location/locationStore';
import { usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { COPY, nearestToLocationTitle } from '../../copy';
import { SecondaryButton, TextButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { ListRow } from '../../primitives/ListRow';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { nearestSites } from './nearestSites';

export interface LocationChoice
{
  kind: 'park' | 'site';
  id: string;
}

// Shows the sites nearest to the chosen location or the user, with the control to pick a location.
export function NearbySitesSection({ choice, onChoiceChange }: { choice: LocationChoice | null; onChoiceChange: (choice: LocationChoice | null) => void })
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const parks = useCatalogStore((state) => state.snapshot.parks);
  const landmarks = useCatalogStore((state) => state.snapshot.landmarks);
  const lastFix = useLocationStore((state) => state.lastFix);
  const signalLost = useLocationStore((state) => state.status === 'waiting_for_signal');
  const distanceUnit = usePreferencesStore((state) => state.preferences.distanceUnit);
  const [pickerOpen, setPickerOpen] = useState(false);

  const parkNames = useMemo(() => new Map(parks.map((park) => [park.id, park.name])), [parks]);
  const sites = useMemo(() => landmarks.filter((site) => parkNames.has(site.parkId)).sort((first, second) => first.name.localeCompare(second.name)), [landmarks, parkNames]);
  const chosenLocation = useMemo(() =>
  {
    const chosenPark = choice?.kind === 'park' ? parks.find((park) => park.id === choice.id) : undefined;
    const chosenSite = choice?.kind === 'site' ? sites.find((site) => site.id === choice.id) : undefined;
    return {
      name: chosenSite?.name ?? chosenPark?.name ?? null,
      point: chosenSite?.position ?? chosenPark?.center ?? null,
      excludedSiteId: chosenSite?.id ?? null,
    };
  }, [choice, parks, sites]);
  const chosenName = chosenLocation.name;
  const userPosition = useMemo(() => (lastFix === null || signalLost ? null : { lat: lastFix.latitude, lng: lastFix.longitude }), [lastFix, signalLost]);
  const origin = chosenLocation.point ?? userPosition;
  const nearbySites = useMemo(() => (origin === null ? [] : nearestSites(sites, origin, chosenLocation.excludedSiteId)), [sites, origin, chosenLocation.excludedSiteId]);

  if (sites.length === 0)
  {
    return null;
  }

  // Applies the option picked in the picker and closes it.
  const chooseLocation = (nextChoice: LocationChoice) =>
  {
    onChoiceChange(nextChoice);
    setPickerOpen(false);
  };

  return (
    <View style={styles.block}>
      {nearbySites.length > 0 && (
        <View testID="nearby-section" style={styles.section}>
          <Text style={[typography.heading, styles.title]} accessibilityRole="header">{chosenName === null ? COPY.nearestToYou : nearestToLocationTitle(chosenName)}</Text>
          {nearbySites.map(({ site, distanceMeters }) => (
            <ListRow
              key={site.id}
              testID={`nearby-site-${site.slug}`}
              title={site.name}
              subtitle={`${formatDistance(distanceMeters, distanceUnit)}  ·  ${parkNames.get(site.parkId) ?? ''}`}
              onPress={() => router.push(`/explore/${site.parkId}?site=${site.id}`)}
            />
          ))}
        </View>
      )}
      {origin === null && <Text style={[typography.body, { color: colors.textMuted }]}>{COPY.selectLocationPrompt}</Text>}
      <View style={styles.actions}>
        <SecondaryButton testID="nearby-select-location" label={COPY.selectLocation} icon="map-marker-outline" onPress={() => setPickerOpen(true)} />
        {chosenName !== null && <TextButton testID="nearby-clear-location" label={COPY.clearLocation} onPress={() => onChoiceChange(null)} />}
      </View>
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)} statusBarTranslucent>
        <View testID="nearby-picker" style={[styles.picker, { paddingTop: insets.top }]}>
          <View style={styles.pickerHeader}>
            <IconButton testID="nearby-picker-close" icon="close" accessibilityLabel={COPY.closeLocationPicker} onPress={() => setPickerOpen(false)} variant="plain" />
            <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">{COPY.selectLocation}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
            <Text style={[typography.eyebrow, styles.pickerGroup]}>{COPY.locationPickerParks.toUpperCase()}</Text>
            {parks.map((park) => <ListRow key={park.id} testID={`nearby-option-park-${park.slug}`} title={park.name} subtitle={park.district} showChevron={false} onPress={() => chooseLocation({ kind: 'park', id: park.id })} />)}
            <Text style={[typography.eyebrow, styles.pickerGroup]}>{COPY.locationPickerSites.toUpperCase()}</Text>
            {sites.map((site) => <ListRow key={site.id} testID={`nearby-option-site-${site.slug}`} title={site.name} subtitle={parkNames.get(site.parkId) ?? ''} showChevron={false} onPress={() => chooseLocation({ kind: 'site', id: site.id })} />)}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md, marginBottom: spacing.md },
  section: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', ...shadows.card },
  title: { color: colors.text, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  picker: { flex: 1, backgroundColor: colors.background },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  pickerGroup: { color: colors.primary, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
});
