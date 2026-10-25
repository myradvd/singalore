import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const repoRoot = path.resolve(import.meta.dirname, '..');
const mobileDirectory = path.join(repoRoot, 'apps', 'mobile');

// Files that feed the fingerprint, used only to point at the likely cause of a mismatch.
const NATIVE_INPUT_PATHS = ['apps/mobile/app.config.ts', 'apps/mobile/eas.json', 'apps/mobile/package.json', 'apps/mobile/config', 'apps/mobile/assets', 'apps/mobile/.gitignore', 'package-lock.json'];

const ResolvedRuntime = z.object({ runtimeVersion: z.string().min(1) });

const BuildList = z.array(z.object({
  id: z.string(),
  runtime: z.object({ version: z.string() }).nullable().optional(),
  gitCommitHash: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
}));

type BuildSummary = z.infer<typeof BuildList>[number];

interface AppTarget
{
  appName: string;
  buildProfile: 'preview' | 'development';
  rebuildCommand: string;
  whatMismatchMeans: string;
}

const TARGETS: AppTarget[] = [
  {
    appName: 'Singalore Preview (demo app)',
    buildProfile: 'preview',
    rebuildCommand: 'npm run app:build:demo',
    whatMismatchMeans: 'over-the-air updates will NOT reach the installed demo app',
  },
  {
    appName: 'Singalore Dev',
    buildProfile: 'development',
    rebuildCommand: 'npm run app:build:dev',
    whatMismatchMeans: 'the installed dev app may crash or miss native features with this code',
  },
];

const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const summaryLines: string[] = [];

// Prints a line and keeps it for the GitHub job summary.
function say(line: string): void
{
  console.log(line);
  summaryLines.push(line);
}

// Works out the fingerprint of the code in this folder, the same way Expo does for builds and updates.
function currentFingerprint(): string
{
  const output = execFileSync('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'android'], { cwd: mobileDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return ResolvedRuntime.parse(JSON.parse(output)).runtimeVersion;
}

// Asks Expo for the newest finished Android build of one profile, or null if there is none.
function latestBuild(buildProfile: string): BuildSummary | null
{
  const output = execFileSync('npx', ['eas', 'build:list', '--platform', 'android', '--build-profile', buildProfile, '--status', 'finished', '--limit', '1', '--json', '--non-interactive'], { cwd: mobileDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return BuildList.parse(JSON.parse(output))[0] ?? null;
}

// Lists native input files changed since a build's commit, when that commit is available locally.
function nativeChangesSince(commit: string | null | undefined): string[]
{
  if (commit === null || commit === undefined)
  {
    return [];
  }
  try
  {
    const output = execFileSync('git', ['diff', '--name-only', commit, 'HEAD', '--', ...NATIVE_INPUT_PATHS], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split('\n').filter((line) => line.length > 0);
  }
  catch
  {
    return [];
  }
}

// Compares the code with the latest build of each app and says what to do.
function main(): void
{
  say('## Do the apps need a new build?');
  say('');
  let fingerprint: string;
  try
  {
    fingerprint = currentFingerprint();
  }
  catch (error)
  {
    say(`Could not work out the app fingerprint: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
    finish();
    return;
  }
  say(`Fingerprint of this code: \`${fingerprint}\``);
  say('');

  for (const target of TARGETS)
  {
    let build: BuildSummary | null;
    try
    {
      build = latestBuild(target.buildProfile);
    }
    catch
    {
      say(`- **${target.appName}**: could not ask Expo (run \`npx eas login\` first, or set EXPO_TOKEN).`);
      continue;
    }
    if (build === null)
    {
      say(`- **${target.appName}**: no finished build yet. Run \`${target.rebuildCommand}\`.`);
      continue;
    }
    const builtFingerprint = build.runtime?.version ?? null;
    const builtOn = build.completedAt?.slice(0, 10) ?? 'unknown date';
    if (builtFingerprint === fingerprint)
    {
      say(`- **${target.appName}**: OK. The build from ${builtOn} matches, so no rebuild is needed.`);
      continue;
    }
    say(`- **${target.appName}**: **NEEDS A NEW BUILD.** The build from ${builtOn} has fingerprint \`${builtFingerprint ?? 'none'}\`, so ${target.whatMismatchMeans}. Run \`${target.rebuildCommand}\`, then reinstall.`);
    const changed = nativeChangesSince(build.gitCommitHash);
    if (changed.length > 0)
    {
      say(`  Likely cause, changed since that build: ${changed.map((file) => `\`${file}\``).join(', ')}`);
    }
    if (inGitHubActions)
    {
      console.log(`::warning title=${target.appName} needs a new build::Native code or app config changed, so ${target.whatMismatchMeans}. Run ${target.rebuildCommand}.`);
    }
  }
  finish();
}

// Writes the GitHub job summary when running in GitHub Actions.
function finish(): void
{
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (inGitHubActions && summaryFile !== undefined)
  {
    appendFileSync(summaryFile, `${summaryLines.join('\n')}\n`);
  }
}

main();
