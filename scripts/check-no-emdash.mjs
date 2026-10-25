import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const forbidden = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
const ignoredPrefixes = ['docs/SRS.md', 'docs/design/', 'SWE Document'];

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((path) => path.length > 0)
  .filter((path) => !ignoredPrefixes.some((prefix) => path.startsWith(prefix)))
  .filter((path) => /\.(ts|tsx|js|mjs|cjs|json|md|sql|yml|yaml|toml|css|html|sh)$/.test(path))
  .filter((path) => !path.endsWith('package-lock.json'));

const offenders = [];
for (const path of tracked)
{
  let text;
  try
  {
    text = readFileSync(path, 'utf8');
  }
  catch
  {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, index) =>
  {
    if (forbidden.some((character) => line.includes(character)))
    {
      offenders.push(`${path}:${index + 1}`);
    }
  });
}

if (offenders.length > 0)
{
  console.error('Em or en dashes found (not allowed):');
  for (const offender of offenders)
  {
    console.error(`  ${offender}`);
  }
  process.exit(1);
}
console.log(`No em or en dashes in ${tracked.length} files.`);
