import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  cacheKey,
  CLIP_WARN_DB,
  durationProblem,
  episodeFileName,
  lintScript,
  mergeManifest,
  NARRATION_SETTINGS,
  parseLoudnorm,
  parseMaxVolume,
  parseScript,
  parseSilences,
  type NarrationVariant,
  sizeProblem,
  spokenParagraphs,
  variantsFor,
} from './podcast-lib';
import { type AudioManifestEntry, SEED_AUDIO_DIRECTORY, SEED_CONTENT_PATH, SEED_PRONUNCIATIONS_PATH, SEED_SCRIPTS_DIRECTORY, type SeedContent } from './seed-types';

const MANIFEST_PATH = path.join(SEED_AUDIO_DIRECTORY, 'manifest.json');
const TTS_DIRECTORY = path.resolve(import.meta.dirname, 'tts');
const PYTHON = process.env.KOKORO_PYTHON ?? path.join(TTS_DIRECTORY, '.venv', 'bin', 'python');
const SETTINGS = NARRATION_SETTINGS;
const LOUDNORM = `loudnorm=I=${SETTINGS.loudness}:TP=${SETTINGS.truePeak}:LRA=${SETTINGS.range}`;

function ffmpeg(args: string[]): string
{
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0)
  {
    throw new Error(`ffmpeg ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stderr;
}

function requireTools(): void
{
  for (const tool of ['ffmpeg', 'ffprobe'])
  {
    if (spawnSync(tool, ['-version']).status !== 0)
    {
      throw new Error(`${tool} is missing. Install it with "brew install ffmpeg" (macOS) or "sudo apt install ffmpeg" (Linux, WSL).`);
    }
  }
  if (!existsSync(PYTHON))
  {
    throw new Error(`No Kokoro Python at ${PYTHON}. Set it up as described in scripts/tts/README.md, or set KOKORO_PYTHON.`);
  }
}

async function synthesize(spoken: string[], variant: NarrationVariant, target: string): Promise<void>
{
  const work = await mkdtemp(path.join(os.tmpdir(), 'singalore-tts-'));
  try
  {
    const jobPath = path.join(work, 'job.json');
    await writeFile(jobPath, JSON.stringify({ voice: variant.kokoroVoice, lang: variant.kokoroLang, speed: SETTINGS.speed, paragraphs: spoken, outDir: work }));
    execFileSync(PYTHON, [path.join(TTS_DIRECTORY, 'synth.py'), jobPath], { stdio: 'inherit' });
    const pause = path.join(work, 'pause.wav');
    ffmpeg(['-f', 'lavfi', '-i', `anullsrc=r=${SETTINGS.sampleRate}:cl=mono`, '-t', String(SETTINGS.pauseSeconds), '-c:a', 'pcm_s16le', pause]);
    const parts = spoken.map((_, index) => `file '${path.join(work, `para-${String(index).padStart(3, '0')}.wav`)}'`);
    const list = path.join(work, 'list.txt');
    await writeFile(list, `${parts.join(`\nfile '${pause}'\n`)}\n`);
    const joined = path.join(work, 'joined.wav');
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', joined]);
    const measured = parseLoudnorm(ffmpeg(['-i', joined, '-af', `${LOUDNORM}:print_format=json`, '-f', 'null', '-']));
    const secondPass = `${LOUDNORM}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
    ffmpeg(['-y', '-i', joined, '-af', secondPass, '-ar', String(SETTINGS.sampleRate), '-ac', '1', '-c:a', 'aac', '-b:a', SETTINGS.bitrate, '-movflags', '+faststart', target]);
  }
  finally
  {
    await rm(work, { recursive: true, force: true });
  }
}

interface EpisodeReport
{
  durationSeconds: number;
  bytes: number;
  bitrate: number;
  loudness: string;
  warnings: string[];
}

async function inspect(file: string): Promise<EpisodeReport>
{
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,bit_rate', '-of', 'json', file], { encoding: 'utf8' })) as { format: { duration: string; bit_rate: string } };
  const bytes = (await stat(file)).size;
  const warnings = parseSilences(ffmpeg(['-i', file, '-af', 'silencedetect=noise=-50dB:d=3', '-f', 'null', '-'])).map((gap) => `silence of ${gap.duration.toFixed(1)} s at ${gap.start.toFixed(1)} s`);
  const maxVolume = parseMaxVolume(ffmpeg(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']));
  if (maxVolume !== null && maxVolume >= CLIP_WARN_DB)
  {
    warnings.push(`possible clipping, peak ${maxVolume} dB`);
  }
  const loudness = parseLoudnorm(ffmpeg(['-i', file, '-af', `${LOUDNORM}:print_format=json`, '-f', 'null', '-'])).input_i;
  return { durationSeconds: Number(probe.format.duration), bytes, bitrate: Number(probe.format.bit_rate), loudness, warnings };
}

async function main(): Promise<void>
{
  const { values } = parseArgs({ options: { only: { type: 'string' }, force: { type: 'boolean', default: false } } });
  const only = values.only === undefined ? null : new Set(values.only.split(',').map((slug) => slug.trim()));
  requireTools();
  const content = JSON.parse(await readFile(SEED_CONTENT_PATH, 'utf8')) as SeedContent;
  const existing = existsSync(MANIFEST_PATH) ? JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as AudioManifestEntry[] : [];
  const pronunciations = JSON.parse(await readFile(SEED_PRONUNCIATIONS_PATH, 'utf8')) as Record<string, string>;
  await mkdir(SEED_AUDIO_DIRECTORY, { recursive: true });
  const order = content.parks.flatMap((park) => park.landmarks.map((landmark) => landmark.slug));
  const generated = new Map<string, AudioManifestEntry[]>();
  const failures: string[] = [];

  for (const park of content.parks)
  {
    for (const landmark of park.landmarks)
    {
      const scriptPath = path.join(SEED_SCRIPTS_DIRECTORY, `${landmark.slug}.md`);
      if (!existsSync(scriptPath) || (only !== null && !only.has(landmark.slug)))
      {
        continue;
      }
      const script = parseScript(await readFile(scriptPath, 'utf8'));
      const problems = lintScript(script);
      if (problems.length > 0)
      {
        failures.push(...problems.map((problem) => `${landmark.slug}.md: ${problem}`));
        continue;
      }
      const spoken = spokenParagraphs(script, pronunciations);
      const entries: AudioManifestEntry[] = [];
      const episodeFailures: string[] = [];
      for (const variant of variantsFor(park.slug))
      {
        const sourceHash = cacheKey(spoken, variant, pronunciations, SETTINGS);
        const cached = existing.find((entry) => entry.landmarkSlug === landmark.slug && entry.sourceHash === sourceHash && entry.voice === variant.voiceLabel);
        let fileName: string;
        if (!values.force && cached !== undefined && existsSync(path.join(SEED_AUDIO_DIRECTORY, cached.fileName)))
        {
          fileName = cached.fileName;
          console.log(`  cached ${fileName}`);
        }
        else
        {
          console.log(`  synthesising ${landmark.slug} (${variant.kokoroVoice})`);
          const work = path.join(os.tmpdir(), `singalore-${landmark.slug}-${variant.suffix}.m4a`);
          await synthesize(spoken, variant, work);
          const digest = createHash('sha256').update(await readFile(work)).digest('hex');
          fileName = episodeFileName(landmark.slug, variant.suffix, digest);
          await copyFile(work, path.join(SEED_AUDIO_DIRECTORY, fileName));
          await rm(work, { force: true });
        }
        const report = await inspect(path.join(SEED_AUDIO_DIRECTORY, fileName));
        console.log(`    ${report.durationSeconds.toFixed(1)} s, ${(report.bytes / 1_000_000).toFixed(2)} MB, ${Math.round(report.bitrate / 1000)} kbps, ${report.loudness} LUFS`);
        for (const warning of report.warnings)
        {
          console.warn(`    warning: ${warning}`);
        }
        for (const problem of [durationProblem(report.durationSeconds), sizeProblem(report.bytes)])
        {
          if (problem !== null)
          {
            episodeFailures.push(`${fileName}: ${problem}`);
          }
        }
        entries.push({ landmarkSlug: landmark.slug, fileName, title: script.title, transcript: script.paragraphs.join('\n\n'), voice: variant.voiceLabel, accent: variant.accentLabel, sourceHash });
      }
      if (episodeFailures.length > 0)
      {
        failures.push(...episodeFailures);
        continue;
      }
      generated.set(landmark.slug, entries);
      // Saved per landmark so a crash later in the run keeps the finished episodes in the cache.
      await writeFile(MANIFEST_PATH, `${JSON.stringify(mergeManifest(existing, generated, order), null, 2)}\n`);
    }
  }

  console.log(`Updated the manifest for ${generated.size} scripted landmarks`);
  if (failures.length > 0)
  {
    throw new Error(`Podcast checks failed, these landmarks keep their old manifest entries:\n  ${failures.join('\n  ')}`);
  }
}

await main();
