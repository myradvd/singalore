import { isLocalOrPrivateHost, isPublicHttpsUrl, resolveBuildEnv } from './buildEnv';

describe('resolveBuildEnv', () =>
{
  it('allows a LAN http API and cleartext for development', () =>
  {
    const env = resolveBuildEnv({ APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'http://192.168.1.5:3000/' });
    expect(env.apiBaseUrl).toBe('http://192.168.1.5:3000');
    expect(env.allowCleartext).toBe(true);
    expect(env.debugToolsEnabled).toBe(true);
  });

  it('requires a public https API for preview and production', () =>
  {
    expect(() => resolveBuildEnv({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com' })).toThrow('public https');
    expect(() => resolveBuildEnv({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://10.0.0.4' })).toThrow('public https');
    expect(() => resolveBuildEnv({ APP_VARIANT: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://localhost' })).toThrow('public https');
    const preview = resolveBuildEnv({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com' });
    expect(preview.allowCleartext).toBe(false);
    expect(preview.debugToolsEnabled).toBe(true);
  });

  it('turns debug tools off by default in production and rejects forcing them on', () =>
  {
    expect(resolveBuildEnv({ APP_VARIANT: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com' }).debugToolsEnabled).toBe(false);
    expect(() => resolveBuildEnv({ APP_VARIANT: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com', EXPO_PUBLIC_DEBUG_TOOLS: '1' })).toThrow('Debug tools');
  });

  it('requires an API URL and treats blanks as missing', () =>
  {
    expect(() => resolveBuildEnv({ APP_VARIANT: 'development' })).toThrow('EXPO_PUBLIC_API_BASE_URL is required');
    expect(() => resolveBuildEnv({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: '   ' })).toThrow('required');
    expect(() => resolveBuildEnv({ APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'not a url' })).toThrow('valid URL');
  });

  it('only exposes satellite tiles when configured', () =>
  {
    expect(resolveBuildEnv({ APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000' }).satelliteTileUrl).toBeNull();
    expect(() => resolveBuildEnv({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com', EXPO_PUBLIC_SATELLITE_TILE_URL: 'http://tiles.example.com/{z}/{x}/{y}.png' })).toThrow('https');
  });
});

describe('host classification', () =>
{
  it.each([
    ['localhost', true],
    ['127.0.0.1', true],
    ['10.0.2.2', true],
    ['192.168.1.1', true],
    ['172.20.1.1', true],
    ['172.40.1.1', false],
    ['mylaptop.local', true],
    ['api.singalore.app', false],
  ])('%s private=%s', (host, expected) =>
  {
    expect(isLocalOrPrivateHost(host)).toBe(expected);
  });

  it('accepts only https public URLs', () =>
  {
    expect(isPublicHttpsUrl('https://abc.trycloudflare.com')).toBe(true);
    expect(isPublicHttpsUrl('http://abc.trycloudflare.com')).toBe(false);
    expect(isPublicHttpsUrl('garbage')).toBe(false);
  });
});
