import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

const VERTICAL_HIT_SLOP = spacing.xs;

export function Chip({ label, selected = false, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; testID?: string })
{
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress === undefined ? 'text' : 'button'}
      accessibilityState={{ selected }}
      disabled={onPress === undefined}
      onPress={onPress}
      hitSlop={onPress === undefined ? undefined : { top: VERTICAL_HIT_SLOP, bottom: VERTICAL_HIT_SLOP }}
      style={[styles.chip, selected && styles.selected]}
    >
      {icon !== undefined && <Icon name={icon} size={16} color={selected ? colors.onAccent : colors.primary} />}
      <Text style={[styles.label, { color: selected ? colors.onAccent : colors.text }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTargets.minimum - 2 * VERTICAL_HIT_SLOP,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { ...typography.captionStrong, flexShrink: 1 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
