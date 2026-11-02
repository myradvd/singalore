import { forwardRef, memo, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

interface ChildrenProps
{
  children?: ReactNode;
  testID?: string;
}

export const cameraCalls: { method: string; args: unknown[] }[] = [];

interface MapMockProps extends ChildrenProps
{
  touchRotate?: boolean;
  touchPitch?: boolean;
  onRegionDidChange?: (event: { nativeEvent: { zoom: number; bearing: number } }) => void;
}

export const latestMapPropsRef: { current: MapMockProps | null } = { current: null };

export function Map(props: MapMockProps)
{
  useEffect(() =>
  {
    latestMapPropsRef.current = props;
  });
  return <View testID="maplibre-map">{props.children}</View>;
}

export const Camera = forwardRef(function Camera(_props: unknown, ref)
{
  useImperativeHandle(ref, () => ({
    easeTo: (...args: unknown[]) => cameraCalls.push({ method: 'easeTo', args }),
    jumpTo: (...args: unknown[]) => cameraCalls.push({ method: 'jumpTo', args }),
    flyTo: (...args: unknown[]) => cameraCalls.push({ method: 'flyTo', args }),
    fitBounds: (...args: unknown[]) => cameraCalls.push({ method: 'fitBounds', args }),
    zoomTo: (...args: unknown[]) => cameraCalls.push({ method: 'zoomTo', args }),
    setStop: async (...args: unknown[]) =>
    {
      cameraCalls.push({ method: 'setStop', args });
    },
  }));
  return null;
});

interface SourceMockProps extends ChildrenProps
{
  id?: string;
  data?: unknown;
  onPress?: (event: unknown) => void;
}

export const sourceRenders: SourceMockProps[] = [];

// Wrapped in memo like the real source, and each logged render stands for one JSON.stringify of its data.
export const GeoJSONSource = memo(forwardRef(function GeoJSONSource(props: SourceMockProps, ref)
{
  sourceRenders.push(props);
  useImperativeHandle(ref, () => ({ getClusterExpansionZoom: async () => 16 }));
  return <View testID={`source-${props.id ?? 'unknown'}`}>{props.children}</View>;
}));

export function RasterSource({ children }: ChildrenProps)
{
  return <View>{children}</View>;
}

export function Layer()
{
  return null;
}
