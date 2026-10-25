import type { ConfigContext, ExpoConfig } from 'expo/config';
import { resolveBuildEnv } from './config/buildEnv.ts';
import { HOSTED_PROJECT, updatesUrl, withHostedDefaults } from './config/hostedProject.ts';

const IDENTIFIERS = {
  development: { name: 'Singalore Dev', id: 'com.singalore.app.dev' },
  preview: { name: 'Singalore Preview', id: 'com.singalore.app.preview' },
  production: { name: 'Singalore', id: 'com.singalore.app' },
} as const;

const LOCATION_WHEN_IN_USE = 'Singalore uses your location to show you on the map and to offer a podcast when you reach a heritage site.';
const LOCATION_ALWAYS = 'Allow location all the time so Singalore can tell you about a heritage site you reach while the app is in the background during a tour.';

export default ({ config }: ConfigContext): ExpoConfig =>
{
  const env = resolveBuildEnv(withHostedDefaults(process.env, HOSTED_PROJECT));
  const identity = IDENTIFIERS[env.variant];
  const updatesServerUrl = updatesUrl(HOSTED_PROJECT);
  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    'expo-sqlite',
    'expo-image',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: '#F6F1E7', image: './assets/splash-icon.png', imageWidth: 160 }],
    ['@maplibre/maplibre-react-native', {}],
    ['expo-location', {
      locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS,
      locationAlwaysPermission: LOCATION_ALWAYS,
      locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
      isIosBackgroundLocationEnabled: true,
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    }],
    ['expo-audio', {
      microphonePermission: false,
      recordAudioAndroid: false,
      enableBackgroundPlayback: true,
    }],
    ['expo-notifications', { color: '#1D6A66' }],
    ['expo-build-properties', {
      android: { usesCleartextTraffic: env.allowCleartext },
      ios: {},
    }],
  ];
  if (env.sentryDsn !== null)
  {
    plugins.push('@sentry/react-native');
  }
  return {
    ...config,
    name: identity.name,
    slug: 'singalore',
    scheme: 'singalore',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F6F1E7',
    ios: {
      bundleIdentifier: identity.id,
      supportsTablet: false,
      infoPlist: {
        ...(env.allowCleartext ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
      },
    },
    android: {
      package: identity.id,
      adaptiveIcon: {
        backgroundColor: '#121212',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
      ],
      blockedPermissions: ['android.permission.RECORD_AUDIO'],
      predictiveBackGestureEnabled: false,
    },
    plugins,
    experiments: { typedRoutes: true },
    ...(updatesServerUrl !== null
      ? {
        runtimeVersion: { policy: 'fingerprint' as const },
        updates: { url: updatesServerUrl, checkAutomatically: 'ON_LOAD' as const, fallbackToCacheTimeout: 0 },
      }
      : {}),
    extra: {
      ...(HOSTED_PROJECT.easProjectId !== null ? { eas: { projectId: HOSTED_PROJECT.easProjectId } } : {}),
      appVariant: env.variant,
      apiBaseUrl: env.apiBaseUrl,
      mapStyleUrl: env.mapStyleUrl,
      debugToolsEnabled: env.debugToolsEnabled,
      ...(env.satelliteTileUrl !== null ? { satelliteTileUrl: env.satelliteTileUrl } : {}),
      ...(env.sentryDsn !== null ? { sentryDsn: env.sentryDsn } : {}),
    },
  };
};
