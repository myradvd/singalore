export type BaseLayer = 'standard' | 'satellite';

export interface MapLayerSettings
{
  baseLayer: BaseLayer;
  showHeritageBoundaries: boolean;
}

export interface UserLocationFix
{
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export interface HeritageMapHandle
{
  centerOn(latitude: number, longitude: number, zoom?: number): void;
  fitTo(points: { latitude: number; longitude: number }[]): void;
  resetNorth(): void;
  zoomStep(direction: 'in' | 'out'): void;
}
