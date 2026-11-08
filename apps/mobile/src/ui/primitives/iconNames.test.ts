import fs from 'node:fs';
import path from 'node:path';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

const SRC = path.resolve(__dirname, '../..');
const ICON_EXPRESSION = /\b(?:icon|[A-Za-z]*Icon)\s*[=:]\s*(\{[^}\n]*\}|'[^'\n]*'|"[^"\n]*"|[^,;\n]*)/g;
const ICON_ELEMENT_NAME = /<(?:Icon|MaterialCommunityIcons)\b[^>]*?\bname=(\{[^}\n]*\}|"[^"\n]*")/g;
const ICON_RECORD = /Record<[^>]+,\s*IconName>\s*=\s*\{([^}]*)\}/g;
const COMPARED = /[!=]==?\s*('[^'\n]*'|"[^"\n]*")/g;
const QUOTED = /'([^'\n]+)'|"([^"\n]+)"/g;

function sourceFiles(dir: string): string[]
{
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
    {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function quotedValues(fragment: string): string[]
{
  return [...fragment.replace(COMPARED, '').matchAll(QUOTED)].map((match) => match[1] ?? match[2] ?? '');
}

// Collects every string literal used as an icon name: icon props and fields, Icon name props and IconName records.
function iconNamesIn(source: string): string[]
{
  const names = [
    ...[...source.matchAll(ICON_EXPRESSION)].flatMap((match) => quotedValues(match[1] ?? '')),
    ...[...source.matchAll(ICON_ELEMENT_NAME)].flatMap((match) => quotedValues(match[1] ?? '')),
    ...[...source.matchAll(ICON_RECORD)].flatMap((match) => (match[1] ?? '').split(',').map((entry) => quotedValues(entry.split(':')[1] ?? '')[0] ?? '')),
  ];
  return names.filter((name) => /^[a-z0-9-]+$/.test(name));
}

describe('icon names', () =>
{
  const used = new Map<string, string[]>();
  for (const file of sourceFiles(SRC))
  {
    for (const name of iconNamesIn(fs.readFileSync(file, 'utf8')))
    {
      used.set(name, [...(used.get(name) ?? []), path.relative(SRC, file)]);
    }
  }

  it('finds the icons the app uses', () =>
  {
    expect(used.size).toBeGreaterThan(60);
    expect(used.has('bookmark-outline')).toBe(true);
    expect(used.has('arrow-u-down-left')).toBe(true);
  });

  it('uses only names in the MaterialCommunityIcons glyph map', () =>
  {
    const missing = [...used.entries()].filter(([name]) => !(name in glyphMap)).map(([name, files]) => `${name} (${files.join(', ')})`);
    expect(missing).toEqual([]);
  });

  it('flags a name that is not in the icon set', () =>
  {
    const names = iconNamesIn('<IconButton icon="bell-ringing-sideways" />\n<Icon name={state === \'on\' ? \'play\' : \'pauze-circle\'} />');
    expect(names.filter((name) => !(name in glyphMap))).toEqual(['bell-ringing-sideways', 'pauze-circle']);
  });
});
