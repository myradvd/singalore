import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../primitives/Icon';
import { IconButton } from '../../primitives/IconButton';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../../theme/tokens';

export interface BottomBarAction
{
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}

export interface BottomBarProps
{
  left?: BottomBarAction;
  right: BottomBarAction;
  centerIcon: IconName;
  centerLabel: string;
  onCenterPress: () => void;
  bottomInset: number;
}

function SideAction({ action }: { action: BottomBarAction })
{
  return (
    <Pressable testID={action.testID} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.side}>
      <Icon name={action.icon} size={22} color={colors.primary} />
      <Text style={[typography.captionStrong, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>{action.label}</Text>
    </Pressable>
  );
}

export function BottomBar({ left, right, centerIcon, centerLabel, onCenterPress, bottomInset }: BottomBarProps)
{
  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + spacing.sm }]}>
      <View style={styles.slot}>{left !== undefined && <SideAction action={left} />}</View>
      <IconButton testID="center-map-button" icon={centerIcon} accessibilityLabel={centerLabel} onPress={onCenterPress} variant="accent" size="playerPrimary" style={styles.center} />
      <View style={styles.slot}><SideAction action={right} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    ...shadows.sheet,
  },
  slot: { flex: 1, alignItems: 'center' },
  side: { minHeight: touchTargets.minimum, minWidth: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, borderRadius: radii.sm },
  center: { marginTop: -spacing.xxl, borderWidth: 4, borderColor: colors.surface },
});
