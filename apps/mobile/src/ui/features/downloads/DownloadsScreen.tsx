import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { updatePreferences, usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { IconButton } from '../../primitives/IconButton';
import { EmptyState } from '../../primitives/States';
import { Toggle } from '../../primitives/Toggle';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import { formatBytes } from '../explore/formatBytes';
import { PackActionButton } from './PackActionButton';

export function DownloadsScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();
  const parks = useCatalogStore((state) => state.snapshot.parks);
  const records = useDownloadsStore((state) => state.records);
  const wifiOnly = usePreferencesStore((state) => state.preferences.downloadOverWifiOnly);
  const [storedBytes, setStoredBytes] = useState(0);

  useEffect(() =>
  {
    void services.downloads.totalStoredBytes().then(setStoredBytes);
  }, [records, services]);

  return (
    <View testID="downloads-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} variant="plain" />
        <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">Manage downloads</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Text testID="downloads-total" style={[typography.caption, styles.total]}>{`Stored on this phone: ${formatBytes(storedBytes)}`}</Text>
        <Toggle testID="downloads-wifi-only" label="Download over Wi-Fi only" description="Avoid mobile data charges" value={wifiOnly} onValueChange={(value) => void updatePreferences(services.preferences, { downloadOverWifiOnly: value })} />
        {parks.length === 0 && <EmptyState icon="cloud-off-outline" title="No parks yet" message="Connect once so Singalore can load the heritage parks." />}
        {parks.map((park) => (
          <View key={park.id} style={styles.park}>
            <Text style={[typography.heading, { color: colors.text }]}>{park.name}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{`${park.landmarkCount} sites  ·  ${park.district}`}</Text>
            <PackActionButton parkId={park.id} estimatedBytes={park.packBytes} />
          </View>
        ))}
        <Text style={[typography.caption, styles.note]}>Downloads include podcasts, photos, transcripts and full descriptions. The map itself needs a connection; offline you will see pins, boundaries and your route on a plain background.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  total: { color: colors.textMuted, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  park: { margin: spacing.lg, marginBottom: 0, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  note: { color: colors.textMuted, padding: spacing.xl },
});
