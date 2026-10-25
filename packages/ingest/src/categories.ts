import type { LandmarkCategory } from '@singalore/shared';

const WIKIDATA_CATEGORY_HINTS: Record<string, LandmarkCategory> = {
  Q16970: 'religious',
  Q2977: 'religious',
  Q32815: 'religious',
  Q44539: 'religious',
  Q1370598: 'religious',
  Q697295: 'religious',
  Q842402: 'religious',
  Q1128397: 'religious',
  Q33506: 'museum',
  Q207694: 'museum',
  Q1007870: 'museum',
  Q55488: 'transport',
  Q1339195: 'transport',
  Q27686: 'commercial',
  Q330284: 'commercial',
  Q11315: 'commercial',
  Q1021645: 'commercial',
  Q16831714: 'civic',
  Q24354: 'civic',
  Q153562: 'civic',
  Q1060829: 'civic',
  Q57821: 'military',
  Q1785071: 'military',
  Q11303: 'commercial',
  Q1307276: 'residential',
  Q123705: 'residential',
};

export function categoryFromWikidata(instanceOfQids: readonly string[]): LandmarkCategory | null
{
  for (const qid of instanceOfQids)
  {
    const category = WIKIDATA_CATEGORY_HINTS[qid];
    if (category !== undefined)
    {
      return category;
    }
  }
  return null;
}

export function categoryFromOsmTags(tags: Readonly<Record<string, string>>): LandmarkCategory
{
  const amenity = tags.amenity ?? '';
  const building = tags.building ?? '';
  const historic = tags.historic ?? '';
  const tourism = tags.tourism ?? '';
  if (amenity === 'place_of_worship' || ['temple', 'mosque', 'church', 'cathedral', 'shrine', 'chapel'].includes(building))
  {
    return 'religious';
  }
  if (tourism === 'museum' || tourism === 'gallery')
  {
    return 'museum';
  }
  if (['railway', 'station', 'train_station'].includes(building) || historic === 'railway_station' || tags.railway !== undefined)
  {
    return 'transport';
  }
  if (['fort', 'bunker', 'battlefield', 'military'].includes(historic) || tags.military !== undefined)
  {
    return 'military';
  }
  if (['residential', 'apartments', 'house'].includes(building))
  {
    return 'residential';
  }
  if (['retail', 'commercial', 'hotel'].includes(building) || tourism === 'hotel' || amenity === 'marketplace')
  {
    return 'commercial';
  }
  if (['civic', 'government', 'public'].includes(building) || amenity === 'townhall' || amenity === 'theatre' || amenity === 'courthouse')
  {
    return 'civic';
  }
  return 'other';
}
