import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, type SeedContent } from './seed-types';

export interface NarrationVariant
{
  voiceName: string;
  voiceLabel: string;
  accentLabel: string;
  suffix: string;
}

export const PRIMARY_VARIANT: NarrationVariant = { voiceName: 'Daniel', voiceLabel: 'Male', accentLabel: 'British', suffix: 'gb' };
export const SECONDARY_VARIANT: NarrationVariant = { voiceName: 'Samantha', voiceLabel: 'Female', accentLabel: 'American', suffix: 'us' };
export const SECONDARY_VARIANT_PARK = 'civic-district';

export interface AudioManifestEntry
{
  landmarkSlug: string;
  fileName: string;
  transcript: string;
  voice: string;
  accent: string;
}

export function narrationText(name: string, description: string): string
{
  return `${name}. ${description} This narration is a computer generated demo. Real episodes are recorded by the Singalore content team.`;
}

function synthesize(text: string, voice: string, target: string): void
{
  const aiff = `${target}.aiff`;
  execFileSync('say', ['-v', voice, '-r', '175', '-o', aiff, text]);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '40000', '-c', '1', aiff, target]);
  execFileSync('rm', [aiff]);
}

async function main(): Promise<void>
{
  const content = JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  await rm(SEED_AUDIO_DIRECTORY, { recursive: true, force: true });
  await mkdir(SEED_AUDIO_DIRECTORY, { recursive: true });
  const manifest: AudioManifestEntry[] = [];
  for (const park of content.parks)
  {
    for (const landmark of park.landmarks)
    {
      if (landmark.description.trim().length === 0)
      {
        console.log(`  skip ${landmark.slug}: no description, so no podcast`);
        continue;
      }
      const variants = park.slug === SECONDARY_VARIANT_PARK ? [PRIMARY_VARIANT, SECONDARY_VARIANT] : [PRIMARY_VARIANT];
      for (const variant of variants)
      {
        const text = narrationText(landmark.name, landmark.description);
        const fileName = `${landmark.slug}-${variant.suffix}.m4a`;
        synthesize(text, variant.voiceName, path.join(SEED_AUDIO_DIRECTORY, fileName));
        manifest.push({ landmarkSlug: landmark.slug, fileName, transcript: text, voice: variant.voiceLabel, accent: variant.accentLabel });
        console.log(`  ${fileName}`);
      }
    }
  }
  await writeFile(path.join(SEED_AUDIO_DIRECTORY, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
