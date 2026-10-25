import { StyleSheet, Text, View } from 'react-native';
import type { LocationFix } from '@/core/location';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface DebugOverlayProps
{
  fix: LocationFix | null;
  refreshRateHz: number | null;
  insideNames: string[];
  sourceKind: 'device' | 'spoof';
}

export function formatOverlayLines({ fix, refreshRateHz, insideNames, sourceKind }: DebugOverlayProps): string[]
{
  if (fix === null)
  {
    return ['lat Searching...', 'lng Searching...', 'acc Searching...', `geofence ${insideNames.length > 0 ? insideNames.join(', ') : 'none'}`, `source ${sourceKind}`];
  }
  return [
    `lat ${fix.latitude.toFixed(6)}`,
    `lng ${fix.longitude.toFixed(6)}`,
    `acc ${fix.accuracyMeters === null ? 'unknown' : `${Math.round(fix.accuracyMeters)} m`}`,
    `geofence ${insideNames.length > 0 ? `Inside: ${insideNames.join(', ')}` : 'none'}`,
    `rate ${refreshRateHz === null ? 'n/a' : `${refreshRateHz.toFixed(1)} Hz`}  source ${sourceKind}`,
  ];
}

export function DebugOverlay(props: DebugOverlayProps)
{
  return (
    <View testID="debug-overlay" pointerEvents="none" style={styles.overlay}>
      {formatOverlayLines(props).map((line) => <Text key={line} style={styles.line}>{line}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.inverseSurface, opacity: 0.9, padding: spacing.sm, borderRadius: radii.sm },
  line: { ...typography.mono, color: colors.onInverse },
});
