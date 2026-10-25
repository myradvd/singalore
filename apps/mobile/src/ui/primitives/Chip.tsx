import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

export function Chip({ label, selected = false, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; testID?: string })
{
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress === undefined ? 'text' : 'button'}
      accessibilityState={{ selected }}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      {icon !== undefined && <Icon name={icon} size={16} color={selected ? colors.onAccent : colors.primary} />}
      <Text style={[typography.captionStrong, { color: selected ? colors.onAccent : colors.text }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTargets.minimum - 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
