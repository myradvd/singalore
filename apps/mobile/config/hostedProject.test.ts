import { resolveBuildEnv } from './buildEnv';
import { updatesUrl, withHostedDefaults } from './hostedProject';
import type { HostedProject } from './hostedProject';

const linked: HostedProject = { apiBaseUrl: 'https://singalore-cms.vercel.app', easProjectId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b' };
const unlinked: HostedProject = { apiBaseUrl: null, easProjectId: null };

describe('withHostedDefaults', () =>
{
  it('uses the hosted API when nothing is set locally', () =>
  {
    const env = resolveBuildEnv(withHostedDefaults({ APP_VARIANT: 'development' }, linked));
    expect(env.apiBaseUrl).toBe('https://singalore-cms.vercel.app');
  });

  it('lets a local .env value win over the hosted API', () =>
  {
    const env = resolveBuildEnv(withHostedDefaults({ APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000' }, linked));
    expect(env.apiBaseUrl).toBe('http://10.0.2.2:3000');
  });

  it('keeps preview builds working with the hosted https API', () =>
  {
    const env = resolveBuildEnv(withHostedDefaults({ APP_VARIANT: 'preview' }, linked));
    expect(env.apiBaseUrl).toBe('https://singalore-cms.vercel.app');
    expect(env.allowCleartext).toBe(false);
  });

  it('still requires an API URL before the project is linked', () =>
  {
    expect(() => resolveBuildEnv(withHostedDefaults({ APP_VARIANT: 'development' }, unlinked))).toThrow('EXPO_PUBLIC_API_BASE_URL is required');
  });

  it('treats an explicit blank value as missing, not as the hosted default', () =>
  {
    expect(() => resolveBuildEnv(withHostedDefaults({ APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: '' }, linked))).toThrow('required');
  });
});

describe('updatesUrl', () =>
{
  it('points at the Expo Updates server only once the project is linked', () =>
  {
    expect(updatesUrl(linked)).toBe('https://u.expo.dev/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b');
    expect(updatesUrl(unlinked)).toBeNull();
  });
});
