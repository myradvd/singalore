import { act, render } from '@testing-library/react-native';
import { createRef } from 'react';
import { cameraCalls, sourceRenders } from '@test/mocks/maplibre';
import { HeritageMap, accuracyCircle, type HeritageMapProps } from './HeritageMap';
import { INITIAL_ZOOM, NORTH_RESET_ANIMATION_MS, ZOOM_ANIMATION_MS, ZOOM_STEP } from './mapCamera';
import type { HeritageMapHandle, UserLocationFix } from './mapTypes';

const LANDMARK_ID = 'landmark-1';
const LANDMARK_COORDINATES = [103.85, 1.29];

// Builds a pin collection with the given selection state.
function pinsWith(selected: boolean): HeritageMapProps['pins']
{
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: LANDMARK_ID,
      properties: { landmarkId: LANDMARK_ID, name: 'Chijmes', category: 'heritage', hasPodcast: true, inItinerary: false, selected, itineraryIndex: 0 },
      geometry: { type: 'Point', coordinates: LANDMARK_COORDINATES },
    }],
  };
}

const PINS_UNSELECTED = pinsWith(false);
const PINS_SELECTED = pinsWith(true);
const BOUNDARIES: HeritageMapProps['boundaries'] = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { parkId: 'park-1', name: 'Civic' },
    geometry: { type: 'Polygon', coordinates: [[[103.8, 1.2], [103.9, 1.2], [103.9, 1.3], [103.8, 1.2]]] },
  }],
};
const PARK_MARKERS: HeritageMapProps['parkMarkers'] = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { parkId: 'park-1', name: 'Civic' }, geometry: { type: 'Point', coordinates: [103.85, 1.25] } }],
};
const ROUTE_LINE: NonNullable<HeritageMapProps['routeLine']> = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[103.8, 1.2], [103.9, 1.3]] } }],
};
const GEOFENCES: NonNullable<HeritageMapProps['debugGeofences']> = BOUNDARIES as NonNullable<HeritageMapProps['debugGeofences']>;
const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };
const STATIC_SOURCE_IDS = ['park-boundaries', 'park-centers', 'debug-geofences', 'route', 'landmarks'];

// Builds a full prop set for the map with stable data references.
function baseProps(overrides: Partial<HeritageMapProps> = {}): HeritageMapProps
{
  return {
    styleUrl: 'https://tiles.test/style.json',
    satelliteTileUrl: null,
    layers: { baseLayer: 'standard', showHeritageBoundaries: true },
    pins: PINS_UNSELECTED,
    boundaries: BOUNDARIES,
    parkMarkers: PARK_MARKERS,
    userLocation: null,
    routeLine: ROUTE_LINE,
    debugGeofences: GEOFENCES,
    onLandmarkPress: jest.fn(),
    ...overrides,
  };
}

// Counts how many times the named source has rendered.
function rendersOf(sourceId: string): number
{
  return sourceRenders.filter((source) => source.id === sourceId).length;
}

// Lists how many extra renders each source gets while the action runs.
async function extraRendersDuring(action: () => Promise<unknown>): Promise<Record<string, number>>
{
  const sourceIds = [...STATIC_SOURCE_IDS, 'user-location', 'user-accuracy'];
  const before = sourceIds.map(rendersOf);
  await action();
  return Object.fromEntries(sourceIds.map((sourceId, index) => [sourceId, rendersOf(sourceId) - (before[index] ?? 0)]));
}

// Reads the props of the named source's most recent render.
function latestSource(sourceId: string)
{
  const source = sourceRenders.filter((candidate) => candidate.id === sourceId).at(-1);
  if (source === undefined)
  {
    throw new Error(`source ${sourceId} never rendered`);
  }
  return source;
}

// Fires the landmark source press handler with the given features.
async function pressLandmarkSource(features: unknown[])
{
  const stopPropagation = jest.fn();
  await act(async () => latestSource('landmarks').onPress?.({ stopPropagation, nativeEvent: { features } }));
  return stopPropagation;
}

// Builds a location fix a given number of steps from the first one.
function fixAt(step: number): UserLocationFix
{
  return { latitude: 1.29 + step * 0.0001, longitude: 103.85, accuracyMeters: 10 };
}

beforeEach(() =>
{
  cameraCalls.length = 0;
  sourceRenders.length = 0;
});

describe('HeritageMap pin press', () =>
{
  it('pin feature: calls onLandmarkPress once with its id and stops propagation', async () =>
  {
    const onLandmarkPress = jest.fn();
    await render(<HeritageMap {...baseProps({ onLandmarkPress })} />);
    const stopPropagation = await pressLandmarkSource([{ properties: { landmarkId: LANDMARK_ID }, geometry: { type: 'Point', coordinates: LANDMARK_COORDINATES } }]);
    expect(onLandmarkPress.mock.calls).toEqual([[LANDMARK_ID]]);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(cameraCalls).toEqual([]);
  });

  it('cluster feature: eases the camera to the cluster at its expansion zoom', async () =>
  {
    const onLandmarkPress = jest.fn();
    await render(<HeritageMap {...baseProps({ onLandmarkPress })} />);
    await pressLandmarkSource([{ properties: { cluster_id: 7 }, geometry: { type: 'Point', coordinates: [103.9, 1.3] } }]);
    expect(onLandmarkPress).not.toHaveBeenCalled();
    expect(cameraCalls).toEqual([{ method: 'easeTo', args: [{ center: [103.9, 1.3], zoom: 16, duration: 500 }] }]);
  });

  it.each([
    ['no features', []],
    ['null properties', [{ properties: null, geometry: { type: 'Point', coordinates: [103.9, 1.3] } }]],
    ['properties without an id', [{ properties: { name: 'x' }, geometry: { type: 'Point', coordinates: [103.9, 1.3] } }]],
    ['cluster that is not a point', [{ properties: { cluster_id: 7 }, geometry: { type: 'LineString', coordinates: [] } }]],
    ['cluster point without coordinates', [{ properties: { cluster_id: 7 }, geometry: { type: 'Point', coordinates: [] } }]],
  ])('valid EC, no action: %s does nothing', async (_name, features) =>
  {
    const onLandmarkPress = jest.fn();
    await render(<HeritageMap {...baseProps({ onLandmarkPress })} />);
    await pressLandmarkSource(features);
    expect(onLandmarkPress).not.toHaveBeenCalled();
    expect(cameraCalls).toEqual([]);
  });

  it('new onLandmarkPress after a render: press calls the new handler, not the old one', async () =>
  {
    const oldHandler = jest.fn();
    const newHandler = jest.fn();
    const view = await render(<HeritageMap {...baseProps({ onLandmarkPress: oldHandler })} />);
    await view.rerender(<HeritageMap {...baseProps({ onLandmarkPress: newHandler })} />);
    await pressLandmarkSource([{ properties: { landmarkId: LANDMARK_ID }, geometry: { type: 'Point', coordinates: LANDMARK_COORDINATES } }]);
    expect(oldHandler).not.toHaveBeenCalled();
    expect(newHandler.mock.calls).toEqual([[LANDMARK_ID]]);
  });
});

describe('HeritageMap source data', () =>
{
  it('boundaries layer on, off, on: both park sources show data, empty, data', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    expect(latestSource('park-boundaries').data).toBe(BOUNDARIES);
    expect(latestSource('park-centers').data).toBe(PARK_MARKERS);

    await view.rerender(<HeritageMap {...baseProps({ layers: { baseLayer: 'standard', showHeritageBoundaries: false } })} />);
    expect(latestSource('park-boundaries').data).toEqual(EMPTY_COLLECTION);
    expect(latestSource('park-centers').data).toEqual(EMPTY_COLLECTION);

    await view.rerender(<HeritageMap {...baseProps()} />);
    expect(latestSource('park-boundaries').data).toBe(BOUNDARIES);
    expect(latestSource('park-centers').data).toBe(PARK_MARKERS);
  });

  it('route line null, set, null: route source shows empty, the line, empty', async () =>
  {
    const view = await render(<HeritageMap {...baseProps({ routeLine: null })} />);
    expect(latestSource('route').data).toEqual(EMPTY_COLLECTION);
    await view.rerender(<HeritageMap {...baseProps({ routeLine: ROUTE_LINE })} />);
    expect(latestSource('route').data).toBe(ROUTE_LINE);
    await view.rerender(<HeritageMap {...baseProps({ routeLine: null })} />);
    expect(latestSource('route').data).toEqual(EMPTY_COLLECTION);
  });

  it('debug geofences set, null: debug source shows the rings, then empty', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    expect(latestSource('debug-geofences').data).toBe(GEOFENCES);
    await view.rerender(<HeritageMap {...baseProps({ debugGeofences: null })} />);
    expect(latestSource('debug-geofences').data).toEqual(EMPTY_COLLECTION);
  });

  it('selection changes: landmarks source shows the highlighted pin, then the plain pin', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    expect(latestSource('landmarks').data).toBe(PINS_UNSELECTED);
    await view.rerender(<HeritageMap {...baseProps({ pins: PINS_SELECTED })} />);
    expect(latestSource('landmarks').data).toBe(PINS_SELECTED);
    await view.rerender(<HeritageMap {...baseProps({ pins: PINS_UNSELECTED })} />);
    expect(latestSource('landmarks').data).toBe(PINS_UNSELECTED);
  });

  it('fix, new fix, no fix: user sources follow the location', async () =>
  {
    const view = await render(<HeritageMap {...baseProps({ userLocation: fixAt(0) })} />);
    await view.rerender(<HeritageMap {...baseProps({ userLocation: fixAt(1) })} />);
    expect(latestSource('user-location').data).toMatchObject({ features: [{ geometry: { type: 'Point', coordinates: [fixAt(1).longitude, fixAt(1).latitude] } }] });
    expect(latestSource('user-accuracy').data).toEqual(accuracyCircle(fixAt(1)));
    await view.rerender(<HeritageMap {...baseProps({ userLocation: null })} />);
    expect(latestSource('user-location').data).toEqual(EMPTY_COLLECTION);
    expect(latestSource('user-accuracy').data).toEqual(EMPTY_COLLECTION);
  });
});

describe('HeritageMap source render counts', () =>
{
  const NO_EXTRA_RENDERS = { 'park-boundaries': 0, 'park-centers': 0, 'debug-geofences': 0, route: 0, landmarks: 0, 'user-location': 0, 'user-accuracy': 0 };

  it('10 location changes: static sources get 0 extra renders, user sources get 10', async () =>
  {
    const view = await render(<HeritageMap {...baseProps({ userLocation: fixAt(0) })} />);
    const extra = await extraRendersDuring(async () =>
    {
      for (let step = 1; step <= 10; step += 1)
      {
        await view.rerender(<HeritageMap {...baseProps({ userLocation: fixAt(step) })} />);
      }
    });
    expect(extra).toEqual({ ...NO_EXTRA_RENDERS, 'user-location': 10, 'user-accuracy': 10 });
  });

  it('same data, new insets and a new onLandmarkPress: no source renders again', async () =>
  {
    const fix = fixAt(0);
    const view = await render(<HeritageMap {...baseProps({ userLocation: fix })} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ userLocation: fix, topInset: 50 })} />));
    expect(extra).toEqual(NO_EXTRA_RENDERS);
  });

  it('selection changes: only the landmarks source renders, once', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ pins: PINS_SELECTED })} />));
    expect(extra).toEqual({ ...NO_EXTRA_RENDERS, landmarks: 1 });
    expect(latestSource('landmarks').data).toBe(PINS_SELECTED);
  });

  it('boundaries turned off: only the two park sources render, once, with empty data', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ layers: { baseLayer: 'standard', showHeritageBoundaries: false } })} />));
    expect(extra).toEqual({ ...NO_EXTRA_RENDERS, 'park-boundaries': 1, 'park-centers': 1 });
    expect(latestSource('park-boundaries').data).toEqual(EMPTY_COLLECTION);
    expect(latestSource('park-centers').data).toEqual(EMPTY_COLLECTION);
  });

  it('base layer changes with boundaries still on: no source renders again', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ layers: { baseLayer: 'satellite', showHeritageBoundaries: true } })} />));
    expect(extra).toEqual(NO_EXTRA_RENDERS);
  });

  it('route line cleared: only the route source renders, once', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ routeLine: null })} />));
    expect(extra).toEqual({ ...NO_EXTRA_RENDERS, route: 1 });
  });

  it('debug geofences cleared: only the debug source renders, once', async () =>
  {
    const view = await render(<HeritageMap {...baseProps()} />);
    const extra = await extraRendersDuring(() => view.rerender(<HeritageMap {...baseProps({ debugGeofences: null })} />));
    expect(extra).toEqual({ ...NO_EXTRA_RENDERS, 'debug-geofences': 1 });
  });

  it('cluster press after 3 location changes: memoised source still reaches the camera', async () =>
  {
    const view = await render(<HeritageMap {...baseProps({ userLocation: fixAt(0) })} />);
    for (let step = 1; step <= 3; step += 1)
    {
      await view.rerender(<HeritageMap {...baseProps({ userLocation: fixAt(step) })} />);
    }
    await pressLandmarkSource([{ properties: { cluster_id: 7 }, geometry: { type: 'Point', coordinates: [103.9, 1.3] } }]);
    expect(cameraCalls).toEqual([{ method: 'easeTo', args: [{ center: [103.9, 1.3], zoom: 16, duration: 500 }] }]);
  });
});

describe('HeritageMap imperative camera', () =>
{
  it('zoomStep in then out: zooms from the initial zoom by one step each way', async () =>
  {
    const mapRef = createRef<HeritageMapHandle>();
    await render(<HeritageMap ref={mapRef} {...baseProps()} />);
    await act(async () => mapRef.current?.zoomStep('in'));
    await act(async () => mapRef.current?.zoomStep('out'));
    expect(cameraCalls).toEqual([
      { method: 'zoomTo', args: [INITIAL_ZOOM + ZOOM_STEP, { duration: ZOOM_ANIMATION_MS, easing: 'ease' }] },
      { method: 'zoomTo', args: [INITIAL_ZOOM, { duration: ZOOM_ANIMATION_MS, easing: 'ease' }] },
    ]);
  });

  it('resetNorth: sets bearing and pitch to zero', async () =>
  {
    const mapRef = createRef<HeritageMapHandle>();
    await render(<HeritageMap ref={mapRef} {...baseProps()} />);
    await act(async () => mapRef.current?.resetNorth());
    expect(cameraCalls).toEqual([{ method: 'setStop', args: [{ bearing: 0, pitch: 0, duration: NORTH_RESET_ANIMATION_MS, easing: 'ease' }] }]);
  });

  it('centerOn after an inset change: uses the zoom given and the latest insets', async () =>
  {
    const mapRef = createRef<HeritageMapHandle>();
    const view = await render(<HeritageMap ref={mapRef} {...baseProps({ topInset: 10, bottomInset: 20 })} />);
    await view.rerender(<HeritageMap ref={mapRef} {...baseProps({ topInset: 30, bottomInset: 40 })} />);
    await act(async () => mapRef.current?.centerOn(1.3, 103.9, 16.5));
    await act(async () => mapRef.current?.centerOn(1.3, 103.9));
    const padding = { top: 30, bottom: 40, left: 0, right: 0 };
    expect(cameraCalls).toEqual([
      { method: 'easeTo', args: [{ center: [103.9, 1.3], duration: 600, zoom: 16.5, padding }] },
      { method: 'easeTo', args: [{ center: [103.9, 1.3], duration: 600, padding }] },
    ]);
  });

  it('fitTo zero points does nothing; fitTo two points fits their bounds', async () =>
  {
    const mapRef = createRef<HeritageMapHandle>();
    await render(<HeritageMap ref={mapRef} {...baseProps({ topInset: 10, bottomInset: 20 })} />);
    await act(async () => mapRef.current?.fitTo([]));
    expect(cameraCalls).toEqual([]);
    await act(async () => mapRef.current?.fitTo([{ latitude: 1.2, longitude: 103.9 }, { latitude: 1.3, longitude: 103.8 }]));
    expect(cameraCalls).toEqual([{ method: 'fitBounds', args: [[103.8, 1.2, 103.9, 1.3], { padding: { top: 70, bottom: 80, left: 48, right: 48 }, duration: 600 }] }]);
  });
});
