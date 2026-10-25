import { z } from 'zod';
import { fetchJson, type FetchJsonOptions } from './http';
import { stripHtml } from './text';

const MetadataEntry = z.object({ value: z.union([z.string(), z.number()]) }).optional();
const ImageInfo = z.object({
  url: z.string(),
  thumburl: z.string().optional(),
  descriptionurl: z.string(),
  mime: z.string().optional(),
  extmetadata: z.object({
    Artist: MetadataEntry,
    LicenseShortName: MetadataEntry,
    LicenseUrl: MetadataEntry,
  }).partial().optional(),
});
const QueryResponse = z.object({
  query: z.object({
    pages: z.record(z.string(), z.object({ title: z.string(), imageinfo: z.array(ImageInfo).optional(), missing: z.string().optional() })),
  }),
});

export interface CommonsImage
{
  fileName: string;
  originalUrl: string;
  thumbnailUrl: string;
  descriptionUrl: string;
  artist: string;
  license: string;
  licenseUrl: string | null;
  mime: string | null;
}

export function parseCommonsImageInfo(raw: unknown, fileName: string): CommonsImage | null
{
  const parsed = QueryResponse.safeParse(raw);
  if (!parsed.success)
  {
    return null;
  }
  const page = Object.values(parsed.data.query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (page === undefined || page.missing !== undefined || info === undefined)
  {
    return null;
  }
  const metadataText = (entry: { value: string | number } | undefined): string => (entry === undefined ? '' : stripHtml(String(entry.value)));
  const licenseUrl = metadataText(info.extmetadata?.LicenseUrl);
  return {
    fileName,
    originalUrl: info.url,
    thumbnailUrl: info.thumburl ?? info.url,
    descriptionUrl: info.descriptionurl,
    artist: metadataText(info.extmetadata?.Artist) || 'Unknown author',
    license: metadataText(info.extmetadata?.LicenseShortName) || 'See source',
    licenseUrl: licenseUrl.length > 0 ? licenseUrl : null,
    mime: info.mime ?? null,
  };
}

export async function fetchCommonsImage(fileName: string, width: number, options: FetchJsonOptions = {}): Promise<CommonsImage | null>
{
  const title = `File:${fileName}`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=${width}&titles=${encodeURIComponent(title)}`;
  return parseCommonsImageInfo(await fetchJson(url, options), fileName);
}
