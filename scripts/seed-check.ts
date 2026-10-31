import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';
import { durationProblem, podcastRow, podcastRowProblems, sizeProblem } from './podcast-lib';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_DIRECTORY, type AudioManifestEntry, type SeedContent } from './seed-types';

const SCRIPTS_DIRECTORY = path.join(SEED_DIRECTORY, 'scripts');

async function readAudio(fileName: string): Promise<Buffer | null>
{
  try
  {
    return await readFile(path.join(SEED_AUDIO_DIRECTORY, fileName));
  }
  catch (error)
  {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
    {
      return null;
    }
    throw error;
  }
}

async function main(): Promise<void>
{
  const content = JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  const manifest = JSON.parse(await readFile(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), 'utf8')) as AudioManifestEntry[];
  const problems: string[] = [];

  const landmarkNames = new Map<string, string>();
  for (const park of content.parks)
  {
    for (const landmark of park.landmarks)
    {
      landmarkNames.set(landmark.slug, landmark.name);
    }
  }

  const seenFiles = new Set<string>();
  for (const entry of manifest)
  {
    const where = `manifest entry ${entry.fileName}`;
    if (seenFiles.has(entry.fileName))
    {
      problems.push(`${where}: file name appears more than once`);
      continue;
    }
    seenFiles.add(entry.fileName);
    const landmarkName = landmarkNames.get(entry.landmarkSlug);
    if (landmarkName === undefined)
    {
      problems.push(`${where}: landmark slug ${entry.landmarkSlug} is not in seed-content.json`);
      continue;
    }
    const bytes = await readAudio(entry.fileName);
    if (bytes === null)
    {
      problems.push(`${where}: file is missing from ${SEED_AUDIO_DIRECTORY}`);
      continue;
    }
    const metadata = await parseBuffer(bytes, { mimeType: 'audio/mp4' }, { duration: true });
    const durationSeconds = metadata.format.duration ?? 0;
    const row = podcastRow(entry, landmarkName, bytes, durationSeconds);
    for (const problem of [sizeProblem(bytes.byteLength), durationProblem(durationSeconds), ...podcastRowProblems(row)])
    {
      if (problem !== null)
      {
        problems.push(`${where}: ${problem}`);
      }
    }
  }

  const manifestSlugs = new Set(manifest.map((entry) => entry.landmarkSlug));
  for (const scriptFile of (await readdir(SCRIPTS_DIRECTORY)).filter((name) => name.endsWith('.md')))
  {
    if (!manifestSlugs.has(path.basename(scriptFile, '.md')))
    {
      problems.push(`script ${scriptFile}: no manifest entry`);
    }
  }

  for (const park of content.parks)
  {
    const podcasts = manifest.filter((entry) => park.landmarks.some((landmark) => landmark.slug === entry.landmarkSlug)).length;
    console.log(`${park.name}: ${park.landmarks.length} landmarks, ${podcasts} podcasts`);
  }

  if (problems.length > 0)
  {
    console.error(`\nSeed check failed with ${problems.length} problems:`);
    for (const problem of problems)
    {
      console.error(`  ${problem}`);
    }
    process.exit(1);
  }
  console.log(`\nSeed check passed for ${manifest.length} podcasts`);
}

await main();
