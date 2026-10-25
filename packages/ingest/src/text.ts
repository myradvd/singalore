export function slugify(value: string): string
{
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function stripHtml(value: string): string
{
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function replaceDashes(value: string): string
{
  return value.replace(/\s*[\u2014\u2013]\s*/g, ', ');
}

export function firstSentences(value: string, maxLength: number): string
{
  const clean = value.trim();
  if (clean.length <= maxLength)
  {
    return clean;
  }
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let result = '';
  for (const sentence of sentences)
  {
    if ((result + sentence).trim().length > maxLength)
    {
      break;
    }
    result += sentence;
  }
  if (result.trim().length > 0)
  {
    return result.trim();
  }
  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}

export function cleanExtract(value: string): string
{
  let result = value;
  let previous = '';
  while (previous !== result)
  {
    previous = result;
    result = result.replace(/\s*\([^()]*(pronunciation|IPA|listen|\[)[^()]*\)/gi, '');
  }
  return replaceDashes(result)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
}
