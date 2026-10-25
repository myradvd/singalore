import { z } from 'zod';

export const APP_VARIANTS = ['development', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export interface BuildEnv
{
  variant: AppVariant;
  apiBaseUrl: string;
  mapStyleUrl: string;
  debugToolsEnabled: boolean;
  satelliteTileUrl: string | null;
  sentryDsn: string | null;
  allowCleartext: boolean;
}

const RawBuildEnv = z.object({
  APP_VARIANT: z.enum(APP_VARIANTS).default('development'),
  EXPO_PUBLIC_API_BASE_URL: z.string().optional(),
  EXPO_PUBLIC_MAP_STYLE_URL: z.string().optional(),
  EXPO_PUBLIC_DEBUG_TOOLS: z.enum(['0', '1']).optional(),
  EXPO_PUBLIC_SATELLITE_TILE_URL: z.string().optional(),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /\.local$/i,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
];

export function isLocalOrPrivateHost(hostname: string): boolean
{
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function isPublicHttpsUrl(value: string): boolean
{
  try
  {
    const url = new URL(value);
    return url.protocol === 'https:' && !isLocalOrPrivateHost(url.hostname);
  }
  catch
  {
    return false;
  }
}

function blankToUndefined(value: string | undefined): string | undefined
{
  return value === undefined || value.trim().length === 0 ? undefined : value.trim();
}

export function resolveBuildEnv(raw: Record<string, string | undefined>): BuildEnv
{
  const parsed = RawBuildEnv.parse(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, blankToUndefined(value)])));
  const variant = parsed.APP_VARIANT;
  const releaseLike = variant !== 'development';
  const apiBaseUrl = parsed.EXPO_PUBLIC_API_BASE_URL;
  if (apiBaseUrl === undefined)
  {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for the ${variant} build. Set apiBaseUrl in apps/mobile/config/hostedProject.ts (QUICKSTART.md) or EXPO_PUBLIC_API_BASE_URL in apps/mobile/.env.`);
  }
  let apiUrl: URL;
  try
  {
    apiUrl = new URL(apiBaseUrl);
  }
  catch
  {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is not a valid URL: ${apiBaseUrl}`);
  }
  if (releaseLike && !isPublicHttpsUrl(apiBaseUrl))
  {
    throw new Error(`A ${variant} build must use a public https API URL, not ${apiBaseUrl}. Deploy the backend or use a tunnel (docs/DEPLOY.md).`);
  }
  if (!['http:', 'https:'].includes(apiUrl.protocol))
  {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use http or https.');
  }
  const mapStyleUrl = parsed.EXPO_PUBLIC_MAP_STYLE_URL ?? DEFAULT_MAP_STYLE_URL;
  if (releaseLike && !isPublicHttpsUrl(mapStyleUrl))
  {
    throw new Error(`A ${variant} build must use a public https map style URL.`);
  }
  const satelliteTileUrl = parsed.EXPO_PUBLIC_SATELLITE_TILE_URL ?? null;
  if (satelliteTileUrl !== null && releaseLike && !satelliteTileUrl.startsWith('https://'))
  {
    throw new Error('EXPO_PUBLIC_SATELLITE_TILE_URL must be https for release builds.');
  }
  const debugDefault = variant === 'production' ? '0' : '1';
  const debugToolsEnabled = (parsed.EXPO_PUBLIC_DEBUG_TOOLS ?? debugDefault) === '1';
  if (variant === 'production' && debugToolsEnabled)
  {
    throw new Error('Debug tools must be off in production builds.');
  }
  return {
    variant,
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    mapStyleUrl,
    debugToolsEnabled,
    satelliteTileUrl,
    sentryDsn: parsed.EXPO_PUBLIC_SENTRY_DSN ?? null,
    allowCleartext: variant === 'development',
  };
}
