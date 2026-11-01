import { describe, expect, it } from 'vitest';
import {
  applyPronunciations,
  cacheKey,
  durationProblem,
  episodeFileName,
  lintScript,
  mergeManifest,
  normaliseText,
  numberToWords,
  parseLoudnorm,
  parseMaxVolume,
  parseScript,
  parseSilences,
  planPodcastSync,
  podcastRow,
  type PodcastRow,
  PRIMARY_VARIANT,
  scriptFreshnessProblems,
  SECONDARY_VARIANT,
  sizeProblem,
  spokenParagraphs,
  variantsFor,
  NARRATION_SETTINGS,
  yearToWords,
} from '../podcast-lib';
import type { AudioManifestEntry } from '../seed-types';

const SCRIPT = `---
title: "Raffles Hotel: the grand old lady"
sources:
  - https://en.wikipedia.org/wiki/Raffles_Hotel
  - https://www.roots.gov.sg/places/raffles-hotel
verify:
  - Opened on 1 December 1887
---

First paragraph
runs over two lines.

Second paragraph.
`;

function words(count: number): string
{
  return Array.from({ length: count }, () => 'word').join(' ');
}

describe('parseScript', () =>
{
  it('reads the title, lists and paragraphs', () =>
  {
    const script = parseScript(SCRIPT);
    expect(script.title).toBe('Raffles Hotel: the grand old lady');
    expect(script.sources).toEqual(['https://en.wikipedia.org/wiki/Raffles_Hotel', 'https://www.roots.gov.sg/places/raffles-hotel']);
    expect(script.verify).toEqual(['Opened on 1 December 1887']);
    expect(script.paragraphs).toEqual(['First paragraph runs over two lines.', 'Second paragraph.']);
  });

  it('rejects a script without frontmatter or title', () =>
  {
    expect(() => parseScript('Just text')).toThrow(/frontmatter/);
    expect(() => parseScript('---\nsources:\n  - a\n---\nBody')).toThrow(/title/);
  });

  it('rejects unknown fields', () =>
  {
    expect(() => parseScript('---\ntitle: A\nauthor: B\n---\nBody')).toThrow(/Unknown/);
  });
});

describe('lintScript', () =>
{
  const base = { title: 'T', sources: ['https://example.org'], verify: [] };

  it('accepts plain spoken text of the right length', () =>
  {
    expect(lintScript({ ...base, paragraphs: [words(900)] })).toEqual([]);
  });

  it('flags markdown, stage directions, dashes and length', () =>
  {
    const dash = String.fromCharCode(0x2014);
    const problems = lintScript({ ...base, sources: [], paragraphs: ['**Bold** text', '(music fades)', `a ${dash} b`] });
    expect(problems.some((problem) => problem.includes('markdown'))).toBe(true);
    expect(problems.some((problem) => problem.includes('brackets'))).toBe(true);
    expect(problems.some((problem) => problem.includes('dash'))).toBe(true);
    expect(problems.some((problem) => problem.includes('words'))).toBe(true);
    expect(problems).toContain('no sources listed');
  });

  it('allows hyphenated words', () =>
  {
    expect(lintScript({ ...base, paragraphs: [`well-known ${words(900)}`] })).toEqual([]);
  });
});

describe('numbers and years', () =>
{
  it('spells cardinals', () =>
  {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(42)).toBe('forty two');
    expect(numberToWords(105)).toBe('one hundred and five');
    expect(numberToWords(1500)).toBe('one thousand five hundred');
    expect(numberToWords(2003)).toBe('two thousand and three');
    expect(numberToWords(1_250_000)).toBe('one million two hundred and fifty thousand');
  });

  it('spells years the way they are spoken', () =>
  {
    expect(yearToWords(1821)).toBe('eighteen twenty one');
    expect(yearToWords(1900)).toBe('nineteen hundred');
    expect(yearToWords(1905)).toBe('nineteen oh five');
    expect(yearToWords(2000)).toBe('two thousand');
    expect(yearToWords(2008)).toBe('two thousand and eight');
    expect(yearToWords(2019)).toBe('twenty nineteen');
  });
});

describe('normaliseText', () =>
{
  it('expands years, including before a comma or full stop', () =>
  {
    expect(normaliseText('In 1887, the hotel opened. It closed in 1989.')).toBe('In eighteen eighty seven, the hotel opened. It closed in nineteen eighty nine.');
  });

  it('expands decades', () =>
  {
    expect(normaliseText('the 1920s and the 1900s')).toBe('the nineteen twenties and the nineteen hundreds');
  });

  it('expands ordinals, counts with commas and decimals', () =>
  {
    expect(normaliseText('the 19th century, 1,500 people, 2.5 hectares')).toBe('the nineteenth century, one thousand five hundred people, two point five hectares');
    expect(normaliseText('the 21st and 22nd')).toBe('the twenty first and twenty second');
  });

  it('expands Saint and other abbreviations only before a name', () =>
  {
    expect(normaliseText('St Andrew\'s Cathedral and Mr Sarkies')).toBe('Saint Andrew\'s Cathedral and Mister Sarkies');
    expect(normaliseText('Beach St.')).toBe('Beach St.');
  });

  it('expands units', () =>
  {
    expect(normaliseText('about 30 m away, 2 km in all, 40%')).toBe('about thirty metres away, two kilometres in all, forty percent');
  });
});

describe('applyPronunciations', () =>
{
  const map = { 'Telok Ayer': 'Teh lock Ah yer', Telok: 'Teh lock', Chijmes: 'Chimes' };

  it('prefers the longest match and keeps word boundaries', () =>
  {
    expect(applyPronunciations('Telok Ayer Street and Telok Blangah, Chijmes', map)).toBe('Teh lock Ah yer Street and Teh lock Blangah, Chimes');
    expect(applyPronunciations('Teloks', map)).toBe('Teloks');
  });

  it('leaves text alone with an empty map', () =>
  {
    expect(applyPronunciations('Chijmes', {})).toBe('Chijmes');
  });
});

describe('variants, cache keys and file names', () =>
{
  it('gives only civic-district the second voice', () =>
  {
    expect(variantsFor('civic-district')).toEqual([PRIMARY_VARIANT, SECONDARY_VARIANT]);
    expect(variantsFor('tiong-bahru')).toEqual([PRIMARY_VARIANT]);
  });

  it('changes the cache key when text, voice or map change, not when map order changes', () =>
  {
    const key = cacheKey(['a'], PRIMARY_VARIANT, { x: '1', y: '2' }, { bitrate: '48k' });
    expect(cacheKey(['a'], PRIMARY_VARIANT, { y: '2', x: '1' }, { bitrate: '48k' })).toBe(key);
    expect(cacheKey(['b'], PRIMARY_VARIANT, { x: '1', y: '2' }, { bitrate: '48k' })).not.toBe(key);
    expect(cacheKey(['a'], SECONDARY_VARIANT, { x: '1', y: '2' }, { bitrate: '48k' })).not.toBe(key);
    expect(cacheKey(['a'], PRIMARY_VARIANT, { x: '1', y: '3' }, { bitrate: '48k' })).not.toBe(key);
  });

  it('puts the first 8 hash characters in the file name', () =>
  {
    expect(episodeFileName('raffles-hotel', 'gb', 'abcdef0123456789')).toBe('raffles-hotel-gb-abcdef01.m4a');
  });
});

describe('scriptFreshnessProblems', () =>
{
  const script = parseScript(SCRIPT);
  const map = { Raffles: 'Raffuls' };
  const current: AudioManifestEntry = {
    landmarkSlug: 'raffles-hotel',
    fileName: 'raffles-hotel-gb-12345678.m4a',
    title: script.title,
    transcript: script.paragraphs.join('\n\n'),
    voice: PRIMARY_VARIANT.voiceLabel,
    accent: PRIMARY_VARIANT.accentLabel,
    sourceHash: cacheKey(spokenParagraphs(script, map), PRIMARY_VARIANT, map, NARRATION_SETTINGS),
  };

  it('accepts an entry that matches the script', () =>
  {
    expect(scriptFreshnessProblems(script, [PRIMARY_VARIANT], [current], map)).toEqual([]);
  });

  it('flags changed narration, pronunciations, title and transcript', () =>
  {
    const edited = { ...script, paragraphs: ['Rewritten paragraph.'] };
    expect(scriptFreshnessProblems(edited, [PRIMARY_VARIANT], [current], map)).toEqual(['gb episode is out of date, run npm run seed:audio']);
    expect(scriptFreshnessProblems(script, [PRIMARY_VARIANT], [current], { Raffles: 'Raffles' })).toHaveLength(1);
    expect(scriptFreshnessProblems({ ...script, title: 'New title' }, [PRIMARY_VARIANT], [current], map)).toHaveLength(1);
    expect(scriptFreshnessProblems(script, [PRIMARY_VARIANT], [{ ...current, transcript: 'Old.' }], map)).toHaveLength(1);
  });

  it('flags a voice with no entry', () =>
  {
    expect(scriptFreshnessProblems(script, [PRIMARY_VARIANT, SECONDARY_VARIANT], [current], map)).toEqual(['no manifest entry for the us voice']);
  });
});

describe('planPodcastSync', () =>
{
  function row(voice: string, accent: string): PodcastRow
  {
    return podcastRow({ landmarkSlug: 'chijmes', fileName: `chijmes-${voice}.m4a`, title: 'T', transcript: '', voice, accent }, 'Chijmes', Buffer.from('audio'), 400);
  }

  it('reuses the seeded row with the same voice and accent, and inserts the rest', () =>
  {
    const existing = [{ id: 'old-gb', audio_path: 'audio/chijmes-gb.m4a', voice: 'Male', accent: 'British' }];
    const plan = planPodcastSync('chijmes', existing, [row('Male', 'British'), row('Female', 'American')]);
    expect(plan.writes.map((write) => write.id)).toEqual(['old-gb', null]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('deletes seeded rows no longer in the manifest, including duplicates', () =>
  {
    const existing = [
      { id: 'first', audio_path: 'audio/chijmes-gb.m4a', voice: 'Male', accent: 'British' },
      { id: 'second', audio_path: 'audio/chijmes-gb-1.m4a', voice: 'Male', accent: 'British' },
      { id: 'retired', audio_path: 'audio/chijmes-us.m4a', voice: 'Female', accent: 'American' },
    ];
    const plan = planPodcastSync('chijmes', existing, [row('Male', 'British')]);
    expect(plan.writes.map((write) => write.id)).toEqual(['first']);
    expect(plan.deleteIds).toEqual(['second', 'retired']);
  });

  it('never touches podcasts added through the CMS', () =>
  {
    const existing = [
      { id: 'cms', audio_path: 'audio/cms-id-abc123.m4a', voice: 'Male', accent: 'British' },
      { id: 'draft', audio_path: null, voice: null, accent: null },
    ];
    const plan = planPodcastSync('chijmes', existing, [row('Male', 'British')]);
    expect(plan.writes.map((write) => write.id)).toEqual([null]);
    expect(plan.deleteIds).toEqual([]);
  });
});

describe('mergeManifest', () =>
{
  function entry(landmarkSlug: string, fileName: string): AudioManifestEntry
  {
    return { landmarkSlug, fileName, transcript: '', voice: 'Male', accent: 'British' };
  }

  it('replaces scripted landmarks and keeps demo entries for the rest', () =>
  {
    const existing = [entry('a', 'a-gb.m4a'), entry('b', 'b-gb.m4a'), entry('b', 'b-us.m4a'), entry('c', 'c-gb.m4a')];
    const generated = new Map([['b', [{ ...entry('b', 'b-gb-12345678.m4a'), title: 'B' }]]]);
    expect(mergeManifest(existing, generated, ['a', 'b', 'c', 'd']).map((item) => item.fileName)).toEqual(['a-gb.m4a', 'b-gb-12345678.m4a', 'c-gb.m4a']);
  });

  it('follows the landmark order and keeps entries for unknown slugs', () =>
  {
    const existing = [entry('c', 'c.m4a'), entry('gone', 'gone.m4a'), entry('a', 'a.m4a')];
    expect(mergeManifest(existing, new Map(), ['a', 'c']).map((item) => item.fileName)).toEqual(['a.m4a', 'c.m4a', 'gone.m4a']);
  });
});

describe('checks', () =>
{
  it('accepts 300 to 600 seconds only', () =>
  {
    expect(durationProblem(299.9)).toMatch(/outside/);
    expect(durationProblem(300)).toBeNull();
    expect(durationProblem(600)).toBeNull();
    expect(durationProblem(600.1)).toMatch(/outside/);
  });

  it('rejects files over the upload limit', () =>
  {
    expect(sizeProblem(4_500_000)).toBeNull();
    expect(sizeProblem(4_500_001)).toMatch(/limit/);
  });

  it('reports only silences longer than 3 seconds', () =>
  {
    const output = [
      '[silencedetect @ 0x1] silence_start: 12.5',
      '[silencedetect @ 0x1] silence_end: 13.4 | silence_duration: 0.9',
      '[silencedetect @ 0x1] silence_start: 200.25',
      '[silencedetect @ 0x1] silence_end: 204.0 | silence_duration: 3.75',
    ].join('\n');
    expect(parseSilences(output, 3)).toEqual([{ start: 200.25, duration: 3.75 }]);
  });

  it('reads the peak level', () =>
  {
    expect(parseMaxVolume('[Parsed_volumedetect_0 @ 0x1] max_volume: -1.6 dB')).toBe(-1.6);
    expect(parseMaxVolume('[Parsed_volumedetect_0 @ 0x1] max_volume: 0.0 dB')).toBe(0);
    expect(parseMaxVolume('nothing')).toBeNull();
  });

  it('reads the loudnorm measurement block', () =>
  {
    const output = 'Input #0\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-23.10",\n\t"input_tp" : "-4.20",\n\t"input_lra" : "5.10",\n\t"input_thresh" : "-33.40",\n\t"target_offset" : "0.30"\n}\n';
    expect(parseLoudnorm(output)).toEqual({ input_i: '-23.10', input_tp: '-4.20', input_lra: '5.10', input_thresh: '-33.40', target_offset: '0.30' });
    expect(() => parseLoudnorm('no json')).toThrow();
  });

  it('builds a published podcast row from a manifest entry', () =>
  {
    const entry: AudioManifestEntry = { landmarkSlug: 'raffles-hotel', fileName: 'raffles-hotel-gb-12345678.m4a', transcript: 'Hello.', voice: 'Male', accent: 'British' };
    const row = podcastRow(entry, 'Raffles Hotel', Buffer.from('audio'), 412.6);
    expect(row).toMatchObject({ title: 'Raffles Hotel: a short history', audio_path: 'audio/raffles-hotel-gb-12345678.m4a', duration_seconds: 413, file_size_bytes: 5, length_class: 'long', status: 'published' });
    expect(row.checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.checksum_md5).toMatch(/^[0-9a-f]{32}$/);
  });
});
