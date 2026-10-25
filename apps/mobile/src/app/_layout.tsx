import '@/composition/backgroundTasks';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppServicesProvider } from '@/composition/AppServicesContext';
import { useAppBootstrap } from '@/composition/useAppBootstrap';
import { ErrorState } from '@/ui/primitives/States';
import { ToastHost } from '@/ui/primitives/ToastHost';
import { FONT_SOURCES } from '@/ui/theme/fontSources';
import { colors } from '@/ui/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout()
{
  const bootstrap = useAppBootstrap();
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() =>
  {
    if (bootstrap.status !== 'starting' && fontsSettled)
    {
      void SplashScreen.hideAsync();
    }
  }, [bootstrap.status, fontsSettled]);

  if (!fontsSettled)
  {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {bootstrap.status === 'failed' && (
          <View style={styles.centered}>
            <ErrorState icon="alert-circle-outline" title="Singalore could not start" message={bootstrap.message} />
          </View>
        )}
        {bootstrap.status === 'ready' && (
          <AppServicesProvider services={bootstrap.services}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />
          </AppServicesProvider>
        )}
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center' },
});
