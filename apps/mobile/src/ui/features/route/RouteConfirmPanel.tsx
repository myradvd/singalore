import { formatDistance, formatDurationShort, type DistanceUnit } from '@singalore/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, SecondaryButton, TextButton } from '../../primitives/Buttons';
import { Card } from '../../primitives/Card';
import { StatTile } from '../../primitives/StatTile';
import { Toggle } from '../../primitives/Toggle';
import { colors, spacing, typography } from '../../theme/tokens';
import type { RouteEstimate } from './routeEstimates';

export interface RouteConfirmPanelProps
{
  status: 'idle' | 'planning' | 'ready' | 'failed';
  estimate: RouteEstimate | null;
  unit: DistanceUnit;
  failureMessage: string | null;
  hasFallback: boolean;
  waitingForGps: boolean;
  autodetect: boolean;
  onAutodetectChange: (value: boolean) => void;
  onStart: () => void;
  onBack: () => void;
  onRetry: () => void;
  onUseFallback: () => void;
}

export function RouteConfirmPanel(props: RouteConfirmPanelProps)
{
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.host, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
      <Card testID="route-confirm" style={styles.card}>
        {props.waitingForGps && <Text style={[typography.body, { color: colors.warning }]}>Waiting for GPS signal... The route starts from your location.</Text>}
        {props.status === 'planning' && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[typography.body, { color: colors.textMuted }]}>Calculating walking route...</Text>
          </View>
        )}
        {props.status === 'failed' && (
          <View style={{ gap: spacing.xs }}>
            <Text testID="route-error" style={[typography.body, { color: colors.danger }]}>{props.failureMessage}</Text>
            <View style={styles.row}>
              <TextButton testID="route-retry" label="Try again" onPress={props.onRetry} />
              {props.hasFallback && <TextButton testID="route-fallback" label="Use approximate straight line guide" onPress={props.onUseFallback} />}
            </View>
          </View>
        )}
        {props.estimate !== null && (
          <View style={styles.stats}>
            <StatTile testID="confirm-distance" value={formatDistance(props.estimate.distanceM, props.unit)} label={props.estimate.approximate ? 'Approx. distance' : 'Distance'} />
            <StatTile testID="confirm-walk" value={formatDurationShort(props.estimate.walkSeconds)} label="Walk" />
            <StatTile testID="confirm-total" value={formatDurationShort(props.estimate.totalSeconds)} label="With podcasts" />
          </View>
        )}
        <Toggle testID="confirm-autodetect" label="Autodetect location and start" description="Start navigation automatically when you reach the first stop" value={props.autodetect} onValueChange={props.onAutodetectChange} />
        <PrimaryButton testID="confirm-start" label="Start Navigation" icon="navigation-variant" onPress={props.onStart} disabled={props.status !== 'ready'} />
        <SecondaryButton testID="confirm-back" label="Back" onPress={props.onBack} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 0 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  stats: { flexDirection: 'row' },
});
