import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mobileDirectory = path.resolve(import.meta.dirname, '..', 'apps', 'mobile');
const releaseEnvironment = { APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://api.singalore.invalid', EXPO_PUBLIC_DEBUG_TOOLS: '1' };
const developmentEnvironment = { APP_VARIANT: 'development', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000', EXPO_PUBLIC_DEBUG_TOOLS: '1' };

function run(label, command, args, options = {})
{
  console.log(`\n> ${label}`);
  execFileSync(command, args, { stdio: 'inherit', cwd: mobileDirectory, ...options, env: { ...process.env, ...options.env } });
}

function expectConfigFailure(label, environment)
{
  try
  {
    execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], { cwd: mobileDirectory, env: { ...process.env, ...environment }, stdio: 'pipe' });
  }
  catch
  {
    console.log(`  ok: ${label} is rejected`);
    return;
  }
  throw new Error(`Config guard failed: ${label} was accepted`);
}

function readConfig(environment)
{
  return JSON.parse(execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], { cwd: mobileDirectory, env: { ...process.env, ...environment }, encoding: 'utf8' }));
}

const MACHINE_ONLY_DOCTOR_CHECKS = ['Check native tooling versions'];

function runDoctor()
{
  console.log('\n> expo-doctor');
  let output = '';
  try
  {
    output = execFileSync('npx', ['expo-doctor'], { cwd: mobileDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(output);
    return;
  }
  catch (error)
  {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
  console.log(output);
  const failedChecks = output.split('\n').filter((line) => line.startsWith('\u2716 ')).map((line) => line.slice(2).trim());
  const projectFailures = failedChecks.filter((check) => !MACHINE_ONLY_DOCTOR_CHECKS.includes(check));
  if (failedChecks.length === 0 || projectFailures.length > 0)
  {
    throw new Error(`expo-doctor failed: ${projectFailures.join(', ') || 'unknown failure'}`);
  }
  console.log(`  warning: machine tooling only (${failedChecks.join(', ')}). Not a project problem, see docs/HUMAN_TASKS.md.`);
}

runDoctor();

console.log('\n> build profile guards');
expectConfigFailure('preview pointing at localhost', { APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://localhost:3000' });
expectConfigFailure('preview pointing at a LAN address', { APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'https://192.168.1.20:3000' });
expectConfigFailure('preview over cleartext http', { APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com' });
expectConfigFailure('preview without an API URL', { APP_VARIANT: 'preview', EXPO_PUBLIC_API_BASE_URL: '' });
expectConfigFailure('production with debug tools on', { APP_VARIANT: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com', EXPO_PUBLIC_DEBUG_TOOLS: '1' });
const preview = readConfig(releaseEnvironment);
if (preview.extra.appVariant !== 'preview' || preview.android.package !== 'com.singalore.app.preview')
{
  throw new Error('Preview config did not resolve to the preview variant');
}
console.log('  ok: preview resolves to a public https API');

const exportDirectory = mkdtempSync(path.join(tmpdir(), 'singalore-export-'));
try
{
  run('expo export (android, ios)', 'npx', ['expo', 'export', '--platform', 'android', '--platform', 'ios', '--output-dir', exportDirectory], { env: releaseEnvironment });
}
finally
{
  rmSync(exportDirectory, { recursive: true, force: true });
}

const prebuildDirectory = mkdtempSync(path.join(tmpdir(), 'singalore-prebuild-'));
try
{
  const copyTarget = path.join(prebuildDirectory, 'mobile');
  cpSync(mobileDirectory, copyTarget, {
    recursive: true,
    filter: (source) => !/\/(android|ios|node_modules|dist|\.expo)(\/|$)/.test(source.slice(mobileDirectory.length)),
  });
  symlinkSync(path.resolve(mobileDirectory, '..', '..', 'node_modules'), path.join(copyTarget, 'node_modules'));
  for (const [variant, environment] of [['preview', releaseEnvironment], ['development', developmentEnvironment]])
  {
    run(`expo prebuild (${variant}, no install)`, 'npx', ['expo', 'prebuild', '--no-install', '--clean', '--platform', 'all'], { cwd: copyTarget, env: environment });
    const manifest = readFileSync(path.join(copyTarget, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    const cleartext = /usesCleartextTraffic="true"/.test(manifest);
    if (variant === 'preview' && cleartext)
    {
      throw new Error('Preview manifest allows cleartext traffic');
    }
    if (variant === 'development' && !cleartext)
    {
      throw new Error('Development manifest should allow cleartext traffic for LAN development');
    }
    for (const permission of ['ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS'])
    {
      if (!manifest.includes(`android.permission.${permission}`))
      {
        throw new Error(`Manifest is missing ${permission}`);
      }
    }
    if (!existsSync(path.join(copyTarget, 'ios')))
    {
      throw new Error('iOS project was not generated');
    }
    console.log(`  ok: ${variant} manifest and iOS project`);
  }
}
finally
{
  rmSync(prebuildDirectory, { recursive: true, force: true });
}
console.log('\nMobile checks passed.');
