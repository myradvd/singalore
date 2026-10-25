import { buildManeuverWithDistance, formatDistance, formatDurationShort, maneuverArrow, type DistanceUnit, type ManeuverArrow } from '@singalore/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteProgress } from '@/modules/routing/progress';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { Card } from '../../primitives/Card';
import { Icon, type IconName } from '../../primitives/Icon';
import { StatTile } from '../../primitives/StatTile';
import { colors, spacing, typography } from '../../theme/tokens';

const ARROW_ICONS: Record<ManeuverArrow, IconName> = {
  'straight': 'arrow-up',
  'left': 'arrow-left-top',
  'right': 'arrow-right-top',
  'slight-left': 'arrow-top-left',
  'slight-right': 'arrow-top-right',
  'sharp-left': 'arrow-left-bottom',
  'sharp-right': 'arrow-right-bottom',
  'uturn': 'arrow-u-down-left',
  'arrive': 'map-marker-check',
  'roundabout': 'rotate-right',
};

export interface NavigationPanelProps
{
  progress: RouteProgress | null;
  approximate: boolean;
  unit: DistanceUnit;
  remainingSeconds: number | null;
  nextStopName: string | null;
  nextStopDistanceM: number | null;
  visitedCount: number;
  stopCount: number;
  onPause: () => void;
  onExit: () => void;
  onEditRoute: () => void;
}

export function NavigationPanel(props: NavigationPanelProps)
{
  const insets = useSafeAreaInsets();
  const step = props.progress?.nextStep ?? null;
  const instruction = props.approximate
    ? `Head towards ${props.nextStopName ?? 'your next stop'}. Approximate guide, no turn by turn directions.`
    : step === null
      ? (props.nextStopName === null ? 'Follow the gold line' : `Continue to ${props.nextStopName}`)
      : buildManeuverWithDistance({ type: step.maneuver.type, modifier: step.maneuver.modifier, name: step.name, exit: step.maneuver.exit }, props.progress?.distanceToNextManeuverM ?? 0, props.unit);
  const arrow: ManeuverArrow = step === null || props.approximate ? 'straight' : maneuverArrow({ type: step.maneuver.type, modifier: step.maneuver.modifier, name: step.name });
  return (
    <>
      <View style={[styles.top, { top: insets.top + spacing.sm }]}>
        <Card testID="turn-card" style={styles.turnCard}>
          <View style={styles.turnRow}>
            <Icon name={ARROW_ICONS[arrow]} size={36} color={colors.accent} />
            <Text testID="turn-instruction" style={[typography.heading, { color: colors.text, flex: 1 }]} accessibilityLiveRegion="polite">{instruction}</Text>
          </View>
          <View style={styles.stats}>
            <StatTile value={props.remainingSeconds === null ? '--' : formatDurationShort(props.remainingSeconds)} label="Remaining" />
            <StatTile value={props.nextStopDistanceM === null ? '--' : formatDistance(props.nextStopDistanceM, props.unit)} label="Next stop" />
            <StatTile value={props.progress === null ? '--' : formatDistance(props.progress.remainingM, props.unit)} label="Total left" />
          </View>
          <View style={styles.buttons}>
            <SecondaryButton testID="nav-pause" label="Pause Nav" icon="pause" onPress={props.onPause} style={{ flex: 1 }} />
            <SecondaryButton testID="nav-exit" label="Exit" icon="exit-to-app" tone="danger" onPress={props.onExit} style={{ flex: 1 }} />
          </View>
        </Card>
      </View>
      <View style={[styles.bottom, { bottom: insets.bottom + spacing.md }]}>
        <Card style={styles.nextCard}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>{`STOP ${Math.min(props.visitedCount + 1, props.stopCount)} OF ${props.stopCount}`}</Text>
          <Text style={[typography.heading, { color: colors.text }]}>{props.nextStopName ?? 'All stops visited'}</Text>
          <PrimaryButton testID="nav-edit" label="Edit Route" icon="pencil" onPress={props.onEditRoute} />
        </Card>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: spacing.md, right: spacing.md },
  turnCard: { gap: spacing.md },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stats: { flexDirection: 'row' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  bottom: { position: 'absolute', left: spacing.md, right: spacing.md },
  nextCard: { gap: spacing.xs },
});
