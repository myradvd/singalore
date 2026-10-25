import { z } from 'zod';
import { fetchJson, type FetchJsonOptions } from './http';

const Summary = z.object({
  title: z.string(),
  extract: z.string().default(''),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
});

export interface WikipediaSummary
{
  title: string;
  extract: string;
  pageUrl: string;
}

export function parseWikipediaSummary(raw: unknown): WikipediaSummary | null
{
  const parsed = Summary.safeParse(raw);
  if (!parsed.success)
  {
    return null;
  }
  const pageUrl = parsed.data.content_urls?.desktop.page
    ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(parsed.data.title.replace(/ /g, '_'))}`;
  return { title: parsed.data.title, extract: parsed.data.extract, pageUrl };
}

export async function fetchWikipediaSummary(title: string, options: FetchJsonOptions = {}): Promise<WikipediaSummary | null>
{
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return parseWikipediaSummary(await fetchJson(url, options));
}
