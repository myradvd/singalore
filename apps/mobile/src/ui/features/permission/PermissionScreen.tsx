import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import { refreshLocationPermission } from '@/composition/useAppBootstrap';
import { resolvePermissionState } from '@/modules/location/permissions';
import { useLocationStore } from '@/modules/location/locationStore';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { Icon } from '../../primitives/Icon';
import { colors, spacing, typography } from '../../theme/tokens';

export function PermissionScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();
  const permission = useLocationStore((state) => state.permission);
  const denied = permission === 'denied';
  const servicesOff = permission === 'services_off';

  const request = async () =>
  {
    const snapshot = await services.permissions.requestForeground();
    await services.location.setPermission(resolvePermissionState(snapshot));
    if (snapshot.foreground === 'granted')
    {
      router.back();
    }
  };

  return (
    <View testID="permission-screen" style={[styles.screen, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Icon name="map-marker-radius" size={56} color={colors.primary} />
      <Text style={[typography.display, styles.title]} accessibilityRole="header">{servicesOff ? 'Location services are off' : 'Show where you are'}</Text>
      <Text style={[typography.body, styles.body]}>
        {servicesOff
          ? 'Turn on location services in your phone settings so Singalore can place you on the map and offer podcasts at heritage sites.'
          : 'Singalore uses your location on this phone only, to show you on the map and to offer a podcast when you reach a heritage site. Your location is never uploaded or stored.'}
      </Text>
      <View style={styles.actions}>
        {denied || servicesOff
          ? <PrimaryButton testID="permission-settings" label="Go to Settings" icon="cog-outline" onPress={() => void services.permissions.openAppSettings().then(() => refreshLocationPermission(services))} />
          : <PrimaryButton testID="permission-allow" label="Allow location" icon="crosshairs-gps" onPress={() => void request()} />}
        <SecondaryButton testID="permission-later" label="Not now" onPress={() => router.back()} />
      </View>
      {Platform.OS === 'android' && !servicesOff && <Text style={[typography.caption, styles.note]}>You can browse the map and Explore without location.</Text>}
    </View>
  );
}

export function BackgroundRationaleScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();

  const allow = async () =>
  {
    const snapshot = await services.permissions.requestBackground();
    await services.location.setPermission(resolvePermissionState(snapshot));
    if (snapshot.background !== 'granted')
    {
      await services.permissions.openAppSettings();
    }
    router.back();
  };

  return (
    <View testID="background-rationale" style={[styles.screen, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Icon name="walk" size={56} color={colors.primary} />
      <Text style={[typography.display, styles.title]} accessibilityRole="header">Hear about sites with your phone in your pocket</Text>
      <Text style={[typography.body, styles.body]}>
        {Platform.OS === 'android'
          ? 'To tell you about a heritage site while the screen is off, Android needs location access set to "Allow all the time". The next screen opens Singalore in your settings. Choose Location, then "Allow all the time".'
          : 'To tell you about a heritage site while the screen is off, choose "Always" for location access.'}
      </Text>
      <Text style={[typography.caption, styles.note]}>A notification shows while a tour is active. Your location stays on this phone.</Text>
      <View style={styles.actions}>
        <PrimaryButton testID="background-allow" label={Platform.OS === 'android' ? 'Open settings' : 'Continue'} onPress={() => void allow()} />
        <SecondaryButton testID="background-later" label="Only while using the app" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.lg },
  title: { color: colors.text, textAlign: 'center' },
  body: { color: colors.textMuted, textAlign: 'center' },
  note: { color: colors.textMuted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
