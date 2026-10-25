import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { HOSTED_PROJECT } from '../apps/mobile/config/hostedProject';

const MINIMUM_NODE_MAJOR = 20;
const REQUEST_TIMEOUT_MS = 15000;
const EMULATOR_METRO_URL = 'http://10.0.2.2:8081';

const HealthResponse = z.object({ status: z.literal('ok') });

const repoRoot = path.resolve(import.meta.dirname, '..');
const mobileEnvFile = path.join(repoRoot, 'apps', 'mobile', '.env');

// Prints one check result in a consistent format.
function report(passed: boolean, message: string): void
{
  console.log(`${passed ? '  ok   ' : '  WARN '} ${message}`);
}

// Finds the API the app will use: apps/mobile/.env wins, otherwise the shared hosted backend.
function resolveApiBaseUrl(): { url: string | null; source: string }
{
  if (existsSync(mobileEnvFile))
  {
    process.loadEnvFile(mobileEnvFile);
  }
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (fromEnv.length > 0)
  {
    return { url: fromEnv.replace(/\/+$/, ''), source: 'apps/mobile/.env or your shell' };
  }
  return { url: HOSTED_PROJECT.apiBaseUrl?.replace(/\/+$/, '') ?? null, source: 'apps/mobile/config/hostedProject.ts' };
}

// Calls one API endpoint and says whether it answered.
async function probe(url: string): Promise<{ ok: boolean; detail: string; body: unknown }>
{
  try
  {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const body: unknown = response.headers.get('content-type')?.includes('json') === true ? await response.json() : null;
    return { ok: response.ok, detail: `HTTP ${response.status}`, body };
  }
  catch (error)
  {
    return { ok: false, detail: error instanceof Error ? error.message : 'request failed', body: null };
  }
}

// Runs every check, then tells the developer how to open the app.
async function main(): Promise<void>
{
  console.log('\nSingalore dev checks\n');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  report(nodeMajor >= MINIMUM_NODE_MAJOR, `Node ${process.versions.node} (24 recommended)`);

  const onWindowsDrive = repoRoot.startsWith('/mnt/');
  report(!onWindowsDrive, onWindowsDrive
    ? `The project is on a Windows drive (${repoRoot}). Move it into your Linux home folder (~), or file watching will be slow and miss changes.`
    : 'Project is inside the Linux file system');

  const api = resolveApiBaseUrl();
  if (api.url === null)
  {
    console.error('\n  No API address is set. Ask the project owner to fill in apps/mobile/config/hostedProject.ts (docs/setup/host-one-time-setup.md step 5),');
    console.error('  or set EXPO_PUBLIC_API_BASE_URL in apps/mobile/.env to use a local backend.\n');
    process.exit(1);
  }
  console.log(`         API: ${api.url} (from ${api.source})`);

  const health = await probe(`${api.url}/api/v1/health`);
  const healthy = health.ok && HealthResponse.safeParse(health.body).success;
  report(healthy, healthy ? 'API is up' : `API did not answer (${health.detail}). The app will open but stay empty until the backend is reachable.`);

  if (healthy)
  {
    const catalog = await probe(`${api.url}/api/v1/catalog`);
    report(catalog.ok, catalog.ok ? 'Database answers through the API' : `Catalog failed (${catalog.detail}). Check the Supabase keys in the CMS hosting settings.`);
  }

  console.log('\nStarting Metro. Then, in the emulator:');
  console.log('  1. Open the "Singalore Dev" app.');
  console.log(`  2. If it shows a list of servers, tap the one listed, or enter ${EMULATOR_METRO_URL} and tap Connect.`);
  console.log('  Saving a file reloads the app. Press r here to reload by hand, Ctrl+C to stop.\n');
}

await main();
