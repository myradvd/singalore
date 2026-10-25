import { z } from 'zod';
import { fetchJson, type FetchJsonOptions } from './http';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

const Snak = z.object({
  snaktype: z.string(),
  datavalue: z.object({ value: z.unknown(), type: z.string() }).optional(),
});
const Claim = z.object({ mainsnak: Snak, rank: z.string().optional() });
const Entity = z.object({
  id: z.string(),
  missing: z.string().optional(),
  labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  descriptions: z.record(z.string(), z.object({ value: z.string() })).optional(),
  aliases: z.record(z.string(), z.array(z.object({ value: z.string() }))).optional(),
  claims: z.record(z.string(), z.array(Claim)).optional(),
  sitelinks: z.record(z.string(), z.object({ title: z.string() })).optional(),
});
const EntitiesResponse = z.object({ entities: z.record(z.string(), Entity) });
const SearchResponse = z.object({
  search: z.array(z.object({ id: z.string(), label: z.string().optional(), description: z.string().optional() })),
});

const CoordinateValue = z.object({ latitude: z.number(), longitude: z.number() });
const TimeValue = z.object({ time: z.string() });
const EntityIdValue = z.object({ id: z.string() });

export interface WikidataEntitySummary
{
  qid: string;
  label: string;
  description: string;
  aliases: string[];
  latitude: number | null;
  longitude: number | null;
  inceptionYear: number | null;
  instanceOfQids: string[];
  architecturalStyleQids: string[];
  imageFileName: string | null;
  englishWikipediaTitle: string | null;
}

function claimValues(entity: z.infer<typeof Entity>, property: string): unknown[]
{
  const claims = entity.claims?.[property] ?? [];
  return claims
    .filter((claim) => claim.rank !== 'deprecated' && claim.mainsnak.snaktype === 'value')
    .map((claim) => claim.mainsnak.datavalue?.value)
    .filter((value) => value !== undefined);
}

export function parseWikidataEntity(raw: unknown): WikidataEntitySummary | null
{
  const parsed = Entity.safeParse(raw);
  if (!parsed.success || parsed.data.missing !== undefined)
  {
    return null;
  }
  const entity = parsed.data;
  const coordinate = claimValues(entity, 'P625').map((value) => CoordinateValue.safeParse(value)).find((result) => result.success);
  const inception = claimValues(entity, 'P571').map((value) => TimeValue.safeParse(value)).find((result) => result.success);
  const inceptionMatch = inception?.success === true ? /^[+-](\d{1,4})-/.exec(inception.data.time) : null;
  const entityIds = (property: string): string[] => claimValues(entity, property)
    .map((value) => EntityIdValue.safeParse(value))
    .flatMap((result) => (result.success ? [result.data.id] : []));
  const image = claimValues(entity, 'P18').find((value): value is string => typeof value === 'string');
  return {
    qid: entity.id,
    label: entity.labels?.en?.value ?? entity.id,
    description: entity.descriptions?.en?.value ?? '',
    aliases: (entity.aliases?.en ?? []).map((alias) => alias.value),
    latitude: coordinate?.success === true ? coordinate.data.latitude : null,
    longitude: coordinate?.success === true ? coordinate.data.longitude : null,
    inceptionYear: inceptionMatch?.[1] !== undefined ? Number.parseInt(inceptionMatch[1], 10) : null,
    instanceOfQids: entityIds('P31'),
    architecturalStyleQids: entityIds('P149'),
    imageFileName: image ?? null,
    englishWikipediaTitle: entity.sitelinks?.enwiki?.title ?? null,
  };
}

export async function fetchWikidataEntities(qids: readonly string[], options: FetchJsonOptions = {}): Promise<Map<string, WikidataEntitySummary>>
{
  const result = new Map<string, WikidataEntitySummary>();
  for (let index = 0; index < qids.length; index += 50)
  {
    const batch = qids.slice(index, index + 50);
    const url = `${WIKIDATA_API}?action=wbgetentities&format=json&languages=en&props=labels|descriptions|aliases|claims|sitelinks&sitefilter=enwiki&ids=${batch.join('|')}`;
    const response = EntitiesResponse.parse(await fetchJson(url, options));
    for (const raw of Object.values(response.entities))
    {
      const summary = parseWikidataEntity(raw);
      if (summary !== null)
      {
        result.set(summary.qid, summary);
      }
    }
  }
  return result;
}

export async function fetchWikidataLabels(qids: readonly string[], options: FetchJsonOptions = {}): Promise<Map<string, string>>
{
  const labels = new Map<string, string>();
  if (qids.length === 0)
  {
    return labels;
  }
  for (let index = 0; index < qids.length; index += 50)
  {
    const batch = qids.slice(index, index + 50);
    const url = `${WIKIDATA_API}?action=wbgetentities&format=json&languages=en&props=labels&ids=${batch.join('|')}`;
    const response = EntitiesResponse.parse(await fetchJson(url, options));
    for (const entity of Object.values(response.entities))
    {
      const label = entity.labels?.en?.value;
      if (label !== undefined)
      {
        labels.set(entity.id, label);
      }
    }
  }
  return labels;
}

export async function searchWikidata(term: string, options: FetchJsonOptions = {}): Promise<{ id: string; label: string; description: string }[]>
{
  const url = `${WIKIDATA_API}?action=wbsearchentities&format=json&language=en&type=item&limit=10&search=${encodeURIComponent(term)}`;
  const response = SearchResponse.parse(await fetchJson(url, options));
  return response.search.map((item) => ({ id: item.id, label: item.label ?? item.id, description: item.description ?? '' }));
}
