import type { ConfigContext } from 'expo/config';
import buildAppConfig from '../../app.config';
import { parseAppConfig } from './config';

function extraFor(env: Record<string, string>): unknown
{
  const savedEnv = process.env;
  process.env = { NODE_ENV: 'test', ...env };
  try
  {
    const context: ConfigContext = { projectRoot: '.', staticConfigPath: null, packageJsonPath: null, config: {} };
    return buildAppConfig(context).extra;
  }
  finally
  {
    process.env = savedEnv;
  }
}

describe('parseAppConfig', () =>
{
  it('loads the app config with every optional value unset', () =>
  {
    const extra = extraFor({ APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000', EXPO_PUBLIC_SATELLITE_TILE_URL: '', EXPO_PUBLIC_SENTRY_DSN: '' });
    expect(extra).not.toHaveProperty('satelliteTileUrl');
    expect(extra).not.toHaveProperty('sentryDsn');
    const config = parseAppConfig(extra);
    expect(config.satelliteTileUrl).toBeNull();
    expect(config.sentryDsn).toBeNull();
    expect(config.debugToolsEnabled).toBe(true);
    expect(config.mapStyleUrl.length).toBeGreaterThan(0);
  });

  it('passes optional values through when they are set', () =>
  {
    const extra = extraFor({
      APP_VARIANT: 'development',
      EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000',
      EXPO_PUBLIC_SATELLITE_TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png',
      EXPO_PUBLIC_SENTRY_DSN: 'https://key@sentry.example.com/1',
    });
    const config = parseAppConfig(extra);
    expect(config.satelliteTileUrl).toBe('https://tiles.example.com/{z}/{x}/{y}.png');
    expect(config.sentryDsn).toBe('https://key@sentry.example.com/1');
  });

  it('accepts null for optional values', () =>
  {
    const config = parseAppConfig({ appVariant: 'preview', apiBaseUrl: 'https://api.example.com', mapStyleUrl: 'https://tiles.example.com/style', debugToolsEnabled: false, satelliteTileUrl: null, sentryDsn: null });
    expect(config.satelliteTileUrl).toBeNull();
    expect(config.sentryDsn).toBeNull();
  });
});
