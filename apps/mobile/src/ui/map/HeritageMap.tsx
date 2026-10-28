import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  RasterSource,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import { SINGAPORE_CENTER, circlePolygonRing } from '@singalore/shared';
import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';
import type { LandmarkPinProperties, ParkFeatureProperties } from '@/modules/catalog/mapFeatures';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { INITIAL_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM, NORTH_RESET_ANIMATION_MS, ZOOM_ANIMATION_MS, isRotatedFromNorth, steppedZoom } from './mapCamera';
import type { HeritageMapHandle, MapLayerSettings, UserLocationFix } from './mapTypes';

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors, © OpenMapTiles, OpenFreeMap';

/** Data and callbacks for the map: pins, park boundaries, user location, route line and tap handlers. */
export interface HeritageMapProps
{
  styleUrl: string;
  satelliteTileUrl: string | null;
  layers: MapLayerSettings;
  pins: GeoJSON.FeatureCollection<GeoJSON.Point, LandmarkPinProperties>;
  boundaries: GeoJSON.FeatureCollection<GeoJSON.Polygon, ParkFeatureProperties>;
  parkMarkers: GeoJSON.FeatureCollection<GeoJSON.Point, ParkFeatureProperties>;
  userLocation: UserLocationFix | null;
  routeLine?: GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
  debugGeofences?: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null;
  onLandmarkPress: (landmarkId: string) => void;
  onMapPress?: () => void;
  onLongPress?: (latitude: number, longitude: number) => void;
  onRotationChange?: (rotated: boolean) => void;
  topInset?: number;
  bottomInset?: number;
  children?: ReactNode;
}

interface CameraChange
{
  zoom: number;
  bearing: number;
}

/** @returns A circle around the user's position sized to the GPS accuracy, drawn under the blue dot. */
export function accuracyCircle(fix: UserLocationFix | null): GeoJSON.FeatureCollection<GeoJSON.Polygon>
{
  if (fix === null || fix.accuracyMeters === null || fix.accuracyMeters < 5)
  {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [circlePolygonRing({ lat: fix.latitude, lng: fix.longitude }, Math.min(fix.accuracyMeters, 500), 32)] },
    }],
  };
}

function userPoint(fix: UserLocationFix | null): GeoJSON.FeatureCollection<GeoJSON.Point>
{
  return {
    type: 'FeatureCollection',
    features: fix === null ? [] : [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [fix.longitude, fix.latitude] } }],
  };
}

const EMPTY_LINES: GeoJSON.FeatureCollection<GeoJSON.LineString> = { type: 'FeatureCollection', features: [] };
const EMPTY_POLYGONS: GeoJSON.FeatureCollection<GeoJSON.Polygon> = { type: 'FeatureCollection', features: [] };

/**
 * MapLibre map of Singapore with OpenFreeMap tiles.
 * Landmarks are drawn as GeoJSON layers (not one view per pin) to keep the map smooth.
 * Shows map attribution as the tile licence requires.
 */
export const HeritageMap = forwardRef<HeritageMapHandle, HeritageMapProps>(function HeritageMap(props, ref)
{
  const cameraRef = useRef<CameraRef>(null);
  const pinSourceRef = useRef<GeoJSONSourceRef>(null);
  const rotatedRef = useRef(false);
  const zoomRef = useRef(INITIAL_ZOOM);
  const userDot = useMemo(() => userPoint(props.userLocation), [props.userLocation]);
  const accuracy = useMemo(() => accuracyCircle(props.userLocation), [props.userLocation]);
  const padding = { top: props.topInset ?? 0, bottom: props.bottomInset ?? 0, left: 0, right: 0 };

  const onCameraChange = (event: NativeSyntheticEvent<CameraChange>) =>
  {
    zoomRef.current = event.nativeEvent.zoom;
    const rotated = isRotatedFromNorth(event.nativeEvent.bearing);
    if (rotated !== rotatedRef.current)
    {
      rotatedRef.current = rotated;
      props.onRotationChange?.(rotated);
    }
  };

  useImperativeHandle(ref, () => ({
    zoomStep: (direction) =>
    {
      const target = steppedZoom(zoomRef.current, direction);
      zoomRef.current = target;
      cameraRef.current?.zoomTo(target, { duration: ZOOM_ANIMATION_MS, easing: 'ease' });
    },
    resetNorth: () =>
    {
      void cameraRef.current?.setStop({ bearing: 0, pitch: 0, duration: NORTH_RESET_ANIMATION_MS, easing: 'ease' });
    },
    centerOn: (latitude, longitude, zoom) =>
    {
      cameraRef.current?.easeTo({ center: [longitude, latitude], duration: 600, ...(zoom === undefined ? {} : { zoom }), padding });
    },
    fitTo: (points) =>
    {
      if (points.length === 0)
      {
        return;
      }
      const longitudes = points.map((point) => point.longitude);
      const latitudes = points.map((point) => point.latitude);
      cameraRef.current?.fitBounds(
        [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
        { padding: { top: padding.top + 60, bottom: padding.bottom + 60, left: 48, right: 48 }, duration: 600 },
      );
    },
  }));

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={props.styleUrl}
        attribution={false}
        logo={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onRegionIsChanging={onCameraChange}
        onRegionDidChange={onCameraChange}
        onPress={() => props.onMapPress?.()}
        onLongPress={(event) => props.onLongPress?.(event.nativeEvent.lngLat[1], event.nativeEvent.lngLat[0])}
      >
        <Camera ref={cameraRef} initialViewState={{ center: [SINGAPORE_CENTER.lng, SINGAPORE_CENTER.lat], zoom: INITIAL_ZOOM, bearing: 0, pitch: 0 }} minZoom={MAP_MIN_ZOOM} maxZoom={MAP_MAX_ZOOM} />
        {props.layers.baseLayer === 'satellite' && props.satelliteTileUrl !== null && (
          <RasterSource id="satellite" tiles={[props.satelliteTileUrl]} tileSize={256}>
            <Layer id="satellite-layer" type="raster" />
          </RasterSource>
        )}
        <GeoJSONSource id="park-boundaries" data={props.layers.showHeritageBoundaries ? props.boundaries : EMPTY_POLYGONS}>
          <Layer id="park-boundary-fill" type="fill" paint={{ 'fill-color': colors.mapBoundaryFill }} />
          <Layer id="park-boundary-line" type="line" paint={{ 'line-color': colors.mapBoundaryLine, 'line-width': 2, 'line-dasharray': [2, 1] }} />
        </GeoJSONSource>
        <GeoJSONSource id="park-centers" data={props.layers.showHeritageBoundaries ? props.parkMarkers : { type: 'FeatureCollection', features: [] }}>
          <Layer id="park-center" type="circle" paint={{ 'circle-radius': 10, 'circle-color': colors.mapBoundaryFill, 'circle-stroke-color': colors.mapBoundaryLine, 'circle-stroke-width': 2 }} />
        </GeoJSONSource>
        <GeoJSONSource id="debug-geofences" data={props.debugGeofences ?? EMPTY_POLYGONS}>
          <Layer id="debug-geofence-line" type="line" paint={{ 'line-color': colors.mapGeofenceDebug, 'line-width': 1.5 }} />
        </GeoJSONSource>
        <GeoJSONSource id="route" data={props.routeLine ?? EMPTY_LINES}>
          <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': colors.mapRouteCasing, 'line-width': 9 }} />
          <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': colors.mapRoute, 'line-width': 5 }} />
        </GeoJSONSource>
        <GeoJSONSource
          ref={pinSourceRef}
          id="landmarks"
          data={props.pins}
          cluster
          clusterRadius={44}
          clusterMaxZoom={15}
          onPress={(event) =>
          {
            event.stopPropagation();
            const feature = event.nativeEvent.features[0];
            const properties = feature?.properties ?? null;
            if (properties !== null && typeof properties.landmarkId === 'string')
            {
              props.onLandmarkPress(properties.landmarkId);
              return;
            }
            if (properties !== null && typeof properties.cluster_id === 'number' && feature?.geometry.type === 'Point')
            {
              const [longitude, latitude] = feature.geometry.coordinates;
              const clusterId = properties.cluster_id;
              void pinSourceRef.current?.getClusterExpansionZoom(clusterId).then((zoom) =>
              {
                if (longitude !== undefined && latitude !== undefined)
                {
                  cameraRef.current?.easeTo({ center: [longitude, latitude], zoom, duration: 500 });
                }
              });
            }
          }}
        >
          <Layer id="landmark-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': colors.mapCluster, 'circle-radius': 18, 'circle-stroke-color': colors.mapPinStroke, 'circle-stroke-width': 2 }} />
          <Layer id="landmark-cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold'] }} paint={{ 'text-color': colors.mapPinLabel }} />
          <Layer
            id="landmark-pins"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['case', ['get', 'hasPodcast'], colors.mapPin, colors.mapPinNoPodcast],
              'circle-radius': ['case', ['get', 'selected'], 13, ['get', 'inItinerary'], 11, 9],
              'circle-stroke-color': ['case', ['get', 'selected'], colors.text, colors.mapPinStroke],
              'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
            }}
          />
          <Layer
            id="landmark-itinerary-index"
            type="symbol"
            filter={['all', ['!', ['has', 'point_count']], ['get', 'inItinerary']]}
            layout={{ 'text-field': ['to-string', ['get', 'itineraryIndex']], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }}
            paint={{ 'text-color': colors.mapPinLabel }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="user-accuracy" data={accuracy}>
          <Layer id="user-accuracy-fill" type="fill" paint={{ 'fill-color': colors.mapUserHalo }} />
        </GeoJSONSource>
        <GeoJSONSource id="user-location" data={userDot}>
          <Layer id="user-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': colors.mapUserDot, 'circle-stroke-color': colors.mapUserDotStroke, 'circle-stroke-width': 3 }} />
        </GeoJSONSource>
      </Map>
      <View pointerEvents="none" style={[styles.attribution, { bottom: (props.bottomInset ?? 0) + 2 }]}>
        <Text style={[typography.caption, styles.attributionText]} maxFontSizeMultiplier={1.2}>{MAP_ATTRIBUTION}</Text>
      </View>
      {props.children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mapCanvas },
  map: { flex: 1 },
  attribution: { position: 'absolute', left: spacing.sm, backgroundColor: colors.mapAttribution, paddingHorizontal: spacing.xs, borderRadius: radii.xs },
  attributionText: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
});
