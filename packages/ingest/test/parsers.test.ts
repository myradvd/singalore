import { describe, expect, it } from 'vitest';
import {
  buildAttribution,
  buildHeritageQuery,
  buildLandmarkDraft,
  buildWikidataLookupQuery,
  bufferedHullPolygon,
  categoryFromOsmTags,
  categoryFromWikidata,
  cleanExtract,
  convexHull,
  firstSentences,
  parseCommonsImageInfo,
  parseOverpassResponse,
  parseWikidataEntity,
  parseWikipediaSummary,
  placeFromOsmApiResponse,
  slugify,
  stripHtml,
} from '../src';
import { GeoJsonPolygon, distanceBetween } from '@singalore/shared';

const wikidataEntity = {
  id: 'Q1072593',
  labels: { en: { value: 'CHIJMES' } },
  descriptions: { en: { value: 'convent and shopping district in Singapore' } },
  aliases: { en: [{ value: 'Convent of the Holy Infant Jesus' }] },
  sitelinks: { enwiki: { title: 'CHIJMES' } },
  claims: {
    P625: [{ mainsnak: { snaktype: 'value', datavalue: { type: 'globecoordinate', value: { latitude: 1.2951, longitude: 103.8520 } } } }],
    P571: [{ mainsnak: { snaktype: 'value', datavalue: { type: 'time', value: { time: '+1904-00-00T00:00:00Z' } } } }],
    P31: [
      { mainsnak: { snaktype: 'value', datavalue: { type: 'wikibase-entityid', value: { id: 'Q1128397' } } } },
      { rank: 'deprecated', mainsnak: { snaktype: 'value', datavalue: { type: 'wikibase-entityid', value: { id: 'Q27686' } } } },
    ],
    P149: [{ mainsnak: { snaktype: 'value', datavalue: { type: 'wikibase-entityid', value: { id: 'Q186363' } } } }],
    P18: [{ mainsnak: { snaktype: 'value', datavalue: { type: 'string', value: 'CHIJMES Hall.jpg' } } }],
  },
};

describe('parseWikidataEntity', () =>
{
  it('extracts coordinates, year, classes, style, image and article', () =>
  {
    const summary = parseWikidataEntity(wikidataEntity);
    expect(summary).toEqual({
      qid: 'Q1072593',
      label: 'CHIJMES',
      description: 'convent and shopping district in Singapore',
      aliases: ['Convent of the Holy Infant Jesus'],
      latitude: 1.2951,
      longitude: 103.852,
      inceptionYear: 1904,
      instanceOfQids: ['Q1128397'],
      architecturalStyleQids: ['Q186363'],
      imageFileName: 'CHIJMES Hall.jpg',
      englishWikipediaTitle: 'CHIJMES',
    });
  });

  it('returns null for missing entities and tolerates absent claims', () =>
  {
    expect(parseWikidataEntity({ id: 'Q1', missing: '' })).toBeNull();
    const bare = parseWikidataEntity({ id: 'Q2' });
    expect(bare?.latitude).toBeNull();
    expect(bare?.label).toBe('Q2');
  });
});

describe('parseOverpassResponse', () =>
{
  it('keeps named elements with coordinates and reads way centres', () =>
  {
    const places = parseOverpassResponse({
      elements: [
        { type: 'node', id: 1, lat: 1.28, lon: 103.84, tags: { name: 'Thian Hock Keng', wikidata: 'Q2158122', amenity: 'place_of_worship' } },
        { type: 'way', id: 2, center: { lat: 1.29, lon: 103.85 }, tags: { name: 'Old Hall', 'name:en': 'Old Hall (English)', wikidata: 'not-a-qid' } },
        { type: 'node', id: 3, lat: 1.3, lon: 103.86, tags: {} },
        { type: 'way', id: 4, tags: { name: 'No geometry' } },
        { type: 'area', id: 5 },
      ],
    });
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ osmType: 'node', osmId: 1, wikidataId: 'Q2158122', latitude: 1.28 });
    expect(places[1]).toMatchObject({ name: 'Old Hall (English)', wikidataId: null, latitude: 1.29 });
  });

  it('builds bounded queries', () =>
  {
    const box = { minLat: 1.2, minLng: 103.8, maxLat: 1.3, maxLng: 103.9 };
    expect(buildHeritageQuery(box)).toContain('nwr["historic"]["name"](1.2,103.8,1.3,103.9);');
    expect(buildWikidataLookupQuery(['Q1', 'Q22; drop'], box)).toContain('^(Q1|Q22)$');
  });
});

describe('placeFromOsmApiResponse', () =>
{
  it('averages way node positions', () =>
  {
    const place = placeFromOsmApiResponse({
      elements: [
        { type: 'node', id: 10, lat: 1.0, lon: 103.0 },
        { type: 'node', id: 11, lat: 1.2, lon: 103.2 },
        { type: 'way', id: 99, tags: { name: 'Giok Hong Tian Temple', building: 'temple' } },
      ],
    }, 'way', 99);
    expect(place?.latitude).toBeCloseTo(1.1);
    expect(place?.longitude).toBeCloseTo(103.1);
    expect(place?.name).toBe('Giok Hong Tian Temple');
  });

  it('returns null when the element or its name is missing', () =>
  {
    expect(placeFromOsmApiResponse({ elements: [] }, 'node', 1)).toBeNull();
    expect(placeFromOsmApiResponse({ elements: [{ type: 'node', id: 1, lat: 1, lon: 2 }] }, 'node', 1)).toBeNull();
  });
});

describe('Wikipedia and Commons parsing', () =>
{
  it('parses a summary and falls back to a built page URL', () =>
  {
    expect(parseWikipediaSummary({ title: 'Tiong Bahru', extract: 'Housing estate.' })?.pageUrl).toBe('https://en.wikipedia.org/wiki/Tiong_Bahru');
    expect(parseWikipediaSummary({ nope: true })).toBeNull();
  });

  it('parses image info with licence and strips HTML from the artist', () =>
  {
    const image = parseCommonsImageInfo({
      query: { pages: { '1': { title: 'File:A.jpg', imageinfo: [{
        url: 'https://upload.wikimedia.org/a.jpg',
        thumburl: 'https://upload.wikimedia.org/thumb/a.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
        mime: 'image/jpeg',
        extmetadata: { Artist: { value: '<a href="x">Jane Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' } },
      }] } } },
    }, 'A.jpg');
    expect(image).toMatchObject({ artist: 'Jane Doe', license: 'CC BY-SA 4.0', thumbnailUrl: 'https://upload.wikimedia.org/thumb/a.jpg' });
    expect(parseCommonsImageInfo({ query: { pages: { '-1': { title: 'File:B.jpg', missing: '' } } } }, 'B.jpg')).toBeNull();
  });
});

describe('categories', () =>
{
  it('maps Wikidata classes first', () =>
  {
    expect(categoryFromWikidata(['Q999', 'Q33506'])).toBe('museum');
    expect(categoryFromWikidata(['Q999'])).toBeNull();
  });

  it('maps OSM tags', () =>
  {
    expect(categoryFromOsmTags({ amenity: 'place_of_worship' })).toBe('religious');
    expect(categoryFromOsmTags({ tourism: 'museum' })).toBe('museum');
    expect(categoryFromOsmTags({ historic: 'railway_station' })).toBe('transport');
    expect(categoryFromOsmTags({ historic: 'fort' })).toBe('military');
    expect(categoryFromOsmTags({ building: 'apartments' })).toBe('residential');
    expect(categoryFromOsmTags({ amenity: 'marketplace' })).toBe('commercial');
    expect(categoryFromOsmTags({ amenity: 'theatre' })).toBe('civic');
    expect(categoryFromOsmTags({ historic: 'memorial' })).toBe('other');
  });
});

describe('text helpers', () =>
{
  it('slugifies names', () =>
  {
    expect(slugify("St Andrew's Cathedral")).toBe('st-andrew-s-cathedral');
    expect(slugify('Telok Ayer & Tanjong Pagar')).toBe('telok-ayer-and-tanjong-pagar');
    expect(slugify('Café Été')).toBe('cafe-ete');
  });

  it('strips HTML and decodes entities', () =>
  {
    expect(stripHtml('<b>Tom&nbsp;&amp;&nbsp;Jerry</b>')).toBe('Tom & Jerry');
  });

  it('removes pronunciation guides and dashes from extracts', () =>
  {
    const raw = 'Telok Ayer Street \n(Singapore English pronunciation:, Malay pronunciation: [teloq aje]) is a street \u2014 in Chinatown.';
    expect(cleanExtract(raw)).toBe('Telok Ayer Street is a street, in Chinatown.');
  });

  it('cuts at sentence boundaries', () =>
  {
    expect(firstSentences('One. Two. Three.', 9)).toBe('One. Two.');
    expect(firstSentences('Short.', 50)).toBe('Short.');
    expect(firstSentences('A very long sentence without an end', 10)).toBe('A very...');
  });
});

describe('drafts and boundaries', () =>
{
  it('builds a draft from Wikidata, Wikipedia, OSM and Commons with attribution', () =>
  {
    const wikidata = parseWikidataEntity(wikidataEntity);
    const draft = buildLandmarkDraft({
      wikidata,
      wikipedia: { title: 'CHIJMES', extract: 'CHIJMES is a historic building complex. It began as a convent.', pageUrl: 'https://en.wikipedia.org/wiki/CHIJMES' },
      osm: { osmType: 'way', osmId: 172999759, name: 'Chijmes', latitude: 1.2952, longitude: 103.8521, wikidataId: 'Q1072593', tags: {} },
      image: null,
      styleLabels: ['Gothic Revival'],
    });
    expect(draft).toMatchObject({
      slug: 'chijmes',
      name: 'CHIJMES',
      category: 'religious',
      lat: 1.2951,
      builtYear: 1904,
      architecturalStyle: 'Gothic Revival',
      osmType: 'way',
      geofenceRadiusM: 30,
    });
    expect(draft?.aliases).toContain('Chijmes');
    expect(draft?.attribution).toContain('CC BY-SA 4.0');
    expect(draft?.attribution).toContain('OpenStreetMap way 172999759');
  });

  it('returns null without coordinates or a name', () =>
  {
    expect(buildLandmarkDraft({ wikidata: null, wikipedia: null, osm: null, image: null, styleLabels: [] })).toBeNull();
  });

  it('attribution is empty without sources', () =>
  {
    expect(buildAttribution({ wikidata: null, wikipedia: null, osm: null, image: null, styleLabels: [] })).toBe('');
  });

  it('computes a convex hull and a closed buffered polygon around points', () =>
  {
    const square = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }, { lat: 0, lng: 1 }, { lat: 0.5, lng: 0.5 }];
    expect(convexHull(square)).toHaveLength(4);
    const points = [{ lat: 1.29, lng: 103.85 }, { lat: 1.295, lng: 103.852 }];
    const polygon = bufferedHullPolygon(points, 60);
    expect(GeoJsonPolygon.safeParse(polygon).success).toBe(true);
    const ring = polygon?.coordinates[0] ?? [];
    const nearest = Math.min(...ring.map(([lng, lat]) => distanceBetween({ lat, lng }, points[0] ?? { lat: 0, lng: 0 })));
    expect(nearest).toBeGreaterThan(55);
    expect(bufferedHullPolygon([], 60)).toBeNull();
  });
});
