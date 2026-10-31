import { createHash } from 'node:crypto';
import type { AudioManifestEntry } from './seed-types';

export const EPISODE_MIN_SECONDS = 300;
export const EPISODE_MAX_SECONDS = 600;
export const EPISODE_MAX_BYTES = 4_500_000;
export const SCRIPT_MIN_WORDS = 750;
export const SCRIPT_MAX_WORDS = 1500;
export const SILENCE_WARN_SECONDS = 3;
export const CLIP_WARN_DB = -0.1;

export interface NarrationVariant
{
  kokoroVoice: string;
  kokoroLang: string;
  voiceLabel: string;
  accentLabel: string;
  suffix: string;
}

export const PRIMARY_VARIANT: NarrationVariant = { kokoroVoice: 'bm_george', kokoroLang: 'b', voiceLabel: 'Male', accentLabel: 'British', suffix: 'gb' };
export const SECONDARY_VARIANT: NarrationVariant = { kokoroVoice: 'af_heart', kokoroLang: 'a', voiceLabel: 'Female', accentLabel: 'American', suffix: 'us' };
export const SECONDARY_VARIANT_PARK = 'civic-district';

export function variantsFor(parkSlug: string): NarrationVariant[]
{
  return parkSlug === SECONDARY_VARIANT_PARK ? [PRIMARY_VARIANT, SECONDARY_VARIANT] : [PRIMARY_VARIANT];
}

export interface EpisodeScript
{
  title: string;
  sources: string[];
  verify: string[];
  paragraphs: string[];
}

function unquote(value: string): string
{
  const trimmed = value.trim();
  if (trimmed.length >= 2 && (trimmed.startsWith('"') || trimmed.startsWith('\'')) && trimmed.endsWith(trimmed[0] ?? ''))
  {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseScript(source: string): EpisodeScript
{
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (match === null)
  {
    throw new Error('Script has no frontmatter block between --- lines.');
  }
  const [, header = '', body = ''] = match;
  let title = '';
  const lists: Record<string, string[]> = { sources: [], verify: [] };
  let currentList: string[] | null = null;
  for (const line of header.split(/\r?\n/))
  {
    if (line.trim().length === 0)
    {
      continue;
    }
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item !== null)
    {
      if (currentList === null)
      {
        throw new Error(`List item outside a list: ${line}`);
      }
      currentList.push(unquote(item[1] ?? ''));
      continue;
    }
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (field === null)
    {
      throw new Error(`Unreadable frontmatter line: ${line}`);
    }
    const [, key = '', value = ''] = field;
    if (key === 'title')
    {
      title = unquote(value);
      currentList = null;
    }
    else if (key in lists && value.trim().length === 0)
    {
      currentList = lists[key] ?? null;
    }
    else
    {
      throw new Error(`Unknown frontmatter field: ${key}`);
    }
  }
  if (title.length === 0)
  {
    throw new Error('Script frontmatter needs a title.');
  }
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
  return { title, sources: lists.sources ?? [], verify: lists.verify ?? [], paragraphs };
}

export function wordCount(paragraphs: string[]): number
{
  return paragraphs.reduce((total, paragraph) => total + (paragraph.match(/\S+/g)?.length ?? 0), 0);
}

export function lintScript(script: EpisodeScript): string[]
{
  const problems: string[] = [];
  const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
  script.paragraphs.forEach((paragraph, index) =>
  {
    const where = `paragraph ${index + 1}`;
    if (/[#*_`|<>]/.test(paragraph))
    {
      problems.push(`${where}: markdown characters are not spoken text`);
    }
    if (/[()[\]{}]/.test(paragraph))
    {
      problems.push(`${where}: brackets usually mean stage directions or asides, rewrite as spoken text`);
    }
    if (dashes.some((dash) => paragraph.includes(dash)))
    {
      problems.push(`${where}: em or en dash`);
    }
  });
  const words = wordCount(script.paragraphs);
  if (words < SCRIPT_MIN_WORDS || words > SCRIPT_MAX_WORDS)
  {
    problems.push(`${words} words, expected ${SCRIPT_MIN_WORDS} to ${SCRIPT_MAX_WORDS}`);
  }
  if (script.sources.length === 0)
  {
    problems.push('no sources listed');
  }
  return problems;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowHundred(value: number): string
{
  if (value < 20)
  {
    return ONES[value] ?? '';
  }
  const unit = value % 10;
  return unit === 0 ? TENS[Math.floor(value / 10)] ?? '' : `${TENS[Math.floor(value / 10)]} ${ONES[unit]}`;
}

function belowThousand(value: number): string
{
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds === 0)
  {
    return belowHundred(rest);
  }
  return rest === 0 ? `${ONES[hundreds]} hundred` : `${ONES[hundreds]} hundred and ${belowHundred(rest)}`;
}

export function numberToWords(value: number): string
{
  if (!Number.isInteger(value) || value < 0 || value >= 1_000_000_000)
  {
    throw new Error(`Cannot spell ${value}`);
  }
  if (value < 1000)
  {
    return belowThousand(value);
  }
  const groups: [number, string][] = [[1_000_000, 'million'], [1000, 'thousand']];
  const words: string[] = [];
  let rest = value;
  for (const [size, name] of groups)
  {
    if (rest >= size)
    {
      words.push(`${belowThousand(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0)
  {
    words.push(rest < 100 ? `and ${belowHundred(rest)}` : belowThousand(rest));
  }
  return words.join(' ');
}

export function yearToWords(year: number): string
{
  if (year >= 2000 && year < 2010)
  {
    return year === 2000 ? 'two thousand' : `two thousand and ${ONES[year - 2000]}`;
  }
  const century = Math.floor(year / 100);
  const rest = year % 100;
  if (rest === 0)
  {
    return `${belowHundred(century)} hundred`;
  }
  return rest < 10 ? `${belowHundred(century)} oh ${ONES[rest]}` : `${belowHundred(century)} ${belowHundred(rest)}`;
}

function pluralNumberWord(words: string): string
{
  if (words.endsWith('y'))
  {
    return `${words.slice(0, -1)}ies`;
  }
  return words.endsWith('x') ? `${words}es` : `${words}s`;
}

const ORDINAL_WORDS: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };

function ordinalWords(value: number): string
{
  const words = numberToWords(value).split(' ');
  const last = words.pop() ?? '';
  const ordinal = ORDINAL_WORDS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words, ordinal].join(' ');
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bSt\.?(?= [A-Z])/g, 'Saint'],
  [/\bMt\.?(?= [A-Z])/g, 'Mount'],
  [/\bMr\.?(?= [A-Z])/g, 'Mister'],
  [/\bMrs\.?(?= [A-Z])/g, 'Missus'],
  [/\bDr\.?(?= [A-Z])/g, 'Doctor'],
  [/\be\.g\.,?/g, 'for example'],
  [/\bi\.e\.,?/g, 'that is'],
  [/\betc\./g, 'and so on'],
  [/\bc\. ?(?=\d{4})/g, 'around '],
];

export function normaliseText(text: string): string
{
  let result = text;
  for (const [pattern, replacement] of ABBREVIATIONS)
  {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/\b(\d+)\s?(km|m)\b/g, (_, digits: string, unit: string) => `${digits} ${unit === 'km' ? 'kilometres' : 'metres'}`);
  result = result.replace(/\b(\d+(?:\.\d+)?)\s?%/g, '$1 percent');
  result = result.replace(/\b(1[0-9]|20)(\d)0s\b/g, (_, century: string, decade: string) =>
  {
    const year = Number(`${century}${decade}0`);
    return pluralNumberWord(decade === '0' && year !== 2000 ? `${belowHundred(Number(century))} hundred` : yearToWords(year));
  });
  result = result.replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(st|nd|rd|th)\b/g, (_, digits: string) => ordinalWords(Number(digits.replace(/,/g, ''))));
  result = result.replace(/(?<!\d|\d[,.])(\d+)\.(\d+)(?!\d)/g, (_, whole: string, fraction: string) => `${numberToWords(Number(whole))} point ${fraction.split('').map((digit) => ONES[Number(digit)]).join(' ')}`);
  result = result.replace(/(?<!\d|\d[,.])(1[0-9]\d\d|20\d\d)(?!\d|[,.]\d)/g, (_, digits: string) => yearToWords(Number(digits)));
  result = result.replace(/(?<!\d|\d[,.])(\d{1,3}(?:,\d{3})+|\d+)(?!\d|[,.]\d)/g, (_, digits: string) => numberToWords(Number(digits.replace(/,/g, ''))));
  return result;
}

function escapeRegExp(value: string): string
{
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPronunciations(text: string, map: Record<string, string>): string
{
  const keys = Object.keys(map).sort((left, right) => right.length - left.length);
  if (keys.length === 0)
  {
    return text;
  }
  const pattern = new RegExp(`\\b(?:${keys.map(escapeRegExp).join('|')})\\b`, 'g');
  return text.replace(pattern, (word) => map[word] ?? word);
}

export function spokenParagraphs(script: EpisodeScript, pronunciations: Record<string, string>): string[]
{
  return script.paragraphs.map((paragraph) => applyPronunciations(normaliseText(paragraph), pronunciations));
}

export function cacheKey(spoken: string[], variant: NarrationVariant, pronunciations: Record<string, string>, settings: Record<string, string | number>): string
{
  const sortedMap = Object.fromEntries(Object.entries(pronunciations).sort(([left], [right]) => left.localeCompare(right)));
  const payload = JSON.stringify({ spoken, voice: variant.kokoroVoice, lang: variant.kokoroLang, pronunciations: sortedMap, settings });
  return createHash('sha256').update(payload).digest('hex');
}

export function episodeFileName(landmarkSlug: string, suffix: string, fileSha256: string): string
{
  return `${landmarkSlug}-${suffix}-${fileSha256.slice(0, 8)}.m4a`;
}

export function mergeManifest(existing: AudioManifestEntry[], generated: Map<string, AudioManifestEntry[]>, landmarkOrder: string[]): AudioManifestEntry[]
{
  const merged: AudioManifestEntry[] = [];
  const seen = new Set<string>();
  for (const slug of [...landmarkOrder, ...existing.map((entry) => entry.landmarkSlug)])
  {
    if (seen.has(slug))
    {
      continue;
    }
    seen.add(slug);
    merged.push(...(generated.get(slug) ?? existing.filter((entry) => entry.landmarkSlug === slug)));
  }
  return merged;
}

export function durationProblem(durationSeconds: number): string | null
{
  if (durationSeconds < EPISODE_MIN_SECONDS || durationSeconds > EPISODE_MAX_SECONDS)
  {
    return `duration ${durationSeconds.toFixed(1)} s is outside ${EPISODE_MIN_SECONDS} to ${EPISODE_MAX_SECONDS} s`;
  }
  return null;
}

export function sizeProblem(bytes: number): string | null
{
  return bytes > EPISODE_MAX_BYTES ? `size ${bytes} bytes is over the ${EPISODE_MAX_BYTES} byte upload limit` : null;
}

export interface PodcastRow
{
  title: string;
  audio_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  checksum_sha256: string;
  checksum_md5: string;
  transcript: string;
  voice: string;
  accent: string;
  length_class: 'short' | 'standard' | 'long';
  status: 'published';
}

export function podcastRow(entry: AudioManifestEntry, landmarkName: string, bytes: Buffer, rawDurationSeconds: number): PodcastRow
{
  const durationSeconds = Math.max(1, Math.round(rawDurationSeconds));
  return {
    title: entry.title ?? `${landmarkName}: a short history`,
    audio_path: `audio/${entry.fileName}`,
    duration_seconds: durationSeconds,
    file_size_bytes: bytes.byteLength,
    checksum_sha256: createHash('sha256').update(bytes).digest('hex'),
    checksum_md5: createHash('md5').update(bytes).digest('hex'),
    transcript: entry.transcript,
    voice: entry.voice,
    accent: entry.accent,
    length_class: durationSeconds < 60 ? 'short' : durationSeconds < 300 ? 'standard' : 'long',
    status: 'published',
  };
}

// Mirrors the podcasts checks in supabase/migrations.
export function podcastRowProblems(row: PodcastRow): string[]
{
  const problems: string[] = [];
  if (row.title.length === 0)
  {
    problems.push('title is empty');
  }
  if (row.audio_path.length === 0)
  {
    problems.push('audio path is empty');
  }
  if (!Number.isInteger(row.duration_seconds) || row.duration_seconds <= 0)
  {
    problems.push(`duration ${row.duration_seconds} is not a positive whole number of seconds`);
  }
  if (!Number.isInteger(row.file_size_bytes) || row.file_size_bytes <= 0)
  {
    problems.push(`size ${row.file_size_bytes} is not a positive number of bytes`);
  }
  if (!/^[0-9a-f]{64}$/.test(row.checksum_sha256))
  {
    problems.push('sha256 is not 64 lowercase hex characters');
  }
  if (!/^[0-9a-f]{32}$/.test(row.checksum_md5))
  {
    problems.push('md5 is not 32 lowercase hex characters');
  }
  return problems;
}

export interface SilenceGap
{
  start: number;
  duration: number;
}

export function parseSilences(ffmpegOutput: string, minSeconds = SILENCE_WARN_SECONDS): SilenceGap[]
{
  const gaps: SilenceGap[] = [];
  let start: number | null = null;
  for (const line of ffmpegOutput.split('\n'))
  {
    const startMatch = /silence_start: (-?[\d.]+)/.exec(line);
    if (startMatch !== null)
    {
      start = Number(startMatch[1]);
    }
    const endMatch = /silence_duration: ([\d.]+)/.exec(line);
    if (endMatch !== null && start !== null)
    {
      const duration = Number(endMatch[1]);
      if (duration > minSeconds)
      {
        gaps.push({ start, duration });
      }
      start = null;
    }
  }
  return gaps;
}

export function parseMaxVolume(ffmpegOutput: string): number | null
{
  const match = /max_volume: (-?[\d.]+|-inf) dB/.exec(ffmpegOutput);
  if (match === null)
  {
    return null;
  }
  return match[1] === '-inf' ? Number.NEGATIVE_INFINITY : Number(match[1]);
}

export interface LoudnessMeasurement
{
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

export function parseLoudnorm(ffmpegOutput: string): LoudnessMeasurement
{
  const start = ffmpegOutput.lastIndexOf('{');
  const end = ffmpegOutput.lastIndexOf('}');
  if (start === -1 || end < start)
  {
    throw new Error('ffmpeg loudnorm printed no measurement.');
  }
  const parsed = JSON.parse(ffmpegOutput.slice(start, end + 1)) as Partial<LoudnessMeasurement>;
  const { input_i, input_tp, input_lra, input_thresh, target_offset } = parsed;
  if (input_i === undefined || input_tp === undefined || input_lra === undefined || input_thresh === undefined || target_offset === undefined)
  {
    throw new Error('ffmpeg loudnorm measurement is incomplete.');
  }
  return { input_i, input_tp, input_lra, input_thresh, target_offset };
}
