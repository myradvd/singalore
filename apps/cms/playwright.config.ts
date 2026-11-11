import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Loads the local Supabase keys and the seeded admin written by scripts/local-env.ts, when that file exists.
const localEnv = path.resolve(__dirname, '.env.local');
if (existsSync(localEnv))
{
  process.loadEnvFile(localEnv);
}

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000/cms/login', reuseExistingServer: true, timeout: 120000 },
});
