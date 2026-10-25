import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import { isPublicHttpsUrl } from '../../../../config/buildEnv';
import type { DiagnosticsEntry } from '@/modules/diagnostics/DiagnosticsLog';
import { useDebugStore } from '@/modules/debug/debugStore';
import { updatePreferences, usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { Toggle } from '../../primitives/Toggle';
import { colors, spacing, typography } from '../../theme/tokens';
import { showToast } from '../../toastStore';

export function DebugScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();
  const debug = useDebugStore();
  const override = usePreferencesStore((state) => state.preferences.apiBaseUrlOverride);
  const [overrideText, setOverrideText] = useState(override ?? '');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsEntry[]>([]);

  useEffect(() =>
  {
    void services.diagnostics.list(100).then(setDiagnostics);
  }, [services]);

  const setSpoof = async (enabled: boolean) =>
  {
    useDebugStore.setState({ spoofActive: enabled, spoofPlacementArmed: enabled });
    await services.location.useSpoof(enabled);
    if (enabled)
    {
      showToast('Long press the map to place the spoofed location.');
    }
  };

  const saveOverride = async () =>
  {
    const value = overrideText.trim();
    if (value.length > 0 && !isPublicHttpsUrl(value))
    {
      showToast('The API override must be a public https URL.', 'error');
      return;
    }
    await updatePreferences(services.preferences, { apiBaseUrlOverride: value.length > 0 ? value : null });
    showToast(value.length > 0 ? 'API override saved.' : 'API override removed.');
  };

  return (
    <View testID="debug-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} variant="plain" />
        <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">Developer tools</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Toggle testID="debug-spoof" label="Simulate location" description="Long press the map to move. Spoofed fixes go through the same geofence engine as GPS." value={debug.spoofActive} onValueChange={(value) => void setSpoof(value)} />
        <Toggle testID="debug-overlay-toggle" label="GPS metadata overlay" value={debug.showOverlay} onValueChange={(value) => useDebugStore.setState({ showOverlay: value })} />
        <Toggle testID="debug-rings" label="Geofence rings" description="Draw entry and exit rings around every landmark" value={debug.showGeofenceRings} onValueChange={(value) => useDebugStore.setState({ showGeofenceRings: value })} />
        <View style={styles.row}>
          <SecondaryButton testID="debug-clear-prompt" label="Force clear podcast prompt" onPress={() => services.geofence.clearPrompt()} />
        </View>
        <Text style={[typography.eyebrow, styles.section]}>API BASE URL OVERRIDE</Text>
        <View style={styles.row}>
          <TextInput
            testID="debug-api-override"
            value={overrideText}
            onChangeText={setOverrideText}
            placeholder={services.config.apiBaseUrl}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[typography.body, styles.input]}
            accessibilityLabel="API base URL override"
          />
          <PrimaryButton label="Save override" onPress={() => void saveOverride()} />
        </View>
        <Text style={[typography.eyebrow, styles.section]}>NETWORK LOG</Text>
        {debug.networkLog.length === 0 && <Text style={styles.mono}>No requests yet.</Text>}
        {debug.networkLog.map((record) => (
          <Text key={record.id} style={[styles.mono, record.outcome === 'ok' || record.outcome === 'not_modified' ? null : { color: colors.danger }]}>
            {`${new Date(record.at).toLocaleTimeString()} ${record.method} ${record.path} ${record.status ?? record.outcome.toUpperCase()} ${record.latencyMs} ms`}
          </Text>
        ))}
        <Text style={[typography.eyebrow, styles.section]}>DIAGNOSTICS LOG</Text>
        {diagnostics.length === 0 && <Text style={styles.mono}>No entries.</Text>}
        {diagnostics.map((entry) => (
          <Text key={entry.id} style={[styles.mono, entry.level === 'error' ? { color: colors.danger } : null]}>{`${entry.at} ${entry.level} ${entry.code}${entry.detail === null ? '' : ` ${entry.detail}`}`}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  section: { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  input: { color: colors.text, backgroundColor: colors.surfaceSunken, borderRadius: 8, paddingHorizontal: spacing.md, minHeight: 48 },
  mono: { ...typography.mono, color: colors.text, paddingHorizontal: spacing.xl },
});
