import { formatDistance, formatDurationShort, type CatalogLandmark, type DistanceUnit } from '@singalore/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryLabel } from '../../copy';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { IconButton } from '../../primitives/IconButton';
import { StatTile } from '../../primitives/StatTile';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';
import type { RouteEstimate } from './routeEstimates';

export interface RouteEditorPanelProps
{
  title: string;
  stops: CatalogLandmark[];
  estimate: RouteEstimate;
  unit: DistanceUnit;
  canRestore: boolean;
  autoOrdering: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onClearAll: () => void;
  onRestore: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (landmarkId: string) => void;
  onAddSite: () => void;
  onAutoOrder: () => void;
  onSaveAndContinue: () => void;
}

export function RouteEditorPanel(props: RouteEditorPanelProps)
{
  const insets = useSafeAreaInsets();
  const { estimate, unit } = props;
  return (
    <View testID="route-editor" style={[styles.panel, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.header}>
        <IconButton testID="editor-minimize" icon="chevron-down" accessibilityLabel="Minimise route editor" onPress={props.onMinimize} variant="plain" />
        <View style={{ flex: 1 }}>
          <Text style={[typography.title, { color: colors.text }]} accessibilityRole="header">{props.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{estimate.approximate ? 'Estimates are approximate until the route is calculated' : 'Walking route'}</Text>
        </View>
        <IconButton testID="editor-close" icon="close" accessibilityLabel="Close route" onPress={props.onClose} variant="plain" />
      </View>
      <View style={styles.stats}>
        <StatTile testID="stat-stops" value={String(estimate.stops)} label="Stops" />
        <StatTile testID="stat-distance" value={formatDistance(estimate.distanceM, unit)} label="Distance" />
        <StatTile testID="stat-walk" value={formatDurationShort(estimate.walkSeconds)} label="Walk" />
        <StatTile testID="stat-total" value={formatDurationShort(estimate.totalSeconds)} label="Total" />
      </View>
      <View style={styles.row}>
        <SecondaryButton testID="editor-clear" label="Clear All" icon="delete-sweep-outline" tone="danger" onPress={props.onClearAll} disabled={props.stops.length === 0} />
        <SecondaryButton testID="editor-restore" label="Restore" icon="undo" onPress={props.onRestore} disabled={!props.canRestore} />
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {props.stops.length === 0 && <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', padding: spacing.lg }]}>No stops yet. Add a site to build your walk.</Text>}
        {props.stops.map((stop, index) => (
          <View key={stop.id} testID={`editor-stop-${stop.slug}`} style={styles.stop}>
            <Text style={[typography.heading, { color: colors.accent, minWidth: 24 }]}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>{stop.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{categoryLabel(stop.category)}</Text>
            </View>
            <IconButton testID={`editor-up-${stop.slug}`} icon="arrow-up" accessibilityLabel={`Move ${stop.name} earlier`} onPress={() => props.onMove(index, index - 1)} disabled={index === 0} variant="plain" />
            <IconButton testID={`editor-down-${stop.slug}`} icon="arrow-down" accessibilityLabel={`Move ${stop.name} later`} onPress={() => props.onMove(index, index + 1)} disabled={index === props.stops.length - 1} variant="plain" />
            <IconButton testID={`editor-remove-${stop.slug}`} icon="minus-circle-outline" accessibilityLabel={`Remove ${stop.name}`} onPress={() => props.onRemove(stop.id)} variant="plain" />
          </View>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <SecondaryButton testID="editor-add" label="Add site" icon="plus" onPress={props.onAddSite} />
        <SecondaryButton testID="editor-auto-order" label={props.autoOrdering ? 'Ordering...' : 'Auto-Order'} icon="sort" onPress={props.onAutoOrder} disabled={props.stops.length < 2 || props.autoOrdering} />
      </View>
      <PrimaryButton testID="editor-continue" label="Save and Continue" icon="arrow-right" onPress={props.onSaveAndContinue} disabled={props.stops.length === 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  list: { flex: 1, marginHorizontal: -spacing.xs },
  listContent: { gap: spacing.sm, padding: spacing.xs },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, paddingLeft: spacing.lg, paddingVertical: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
});
