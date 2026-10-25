import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../../primitives/Icon';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../../theme/tokens';
import { COPY } from '../../copy';

export function SearchBarButton({ onPress }: { onPress: () => void })
{
  return (
    <Pressable testID="open-search" accessibilityRole="search" accessibilityLabel="Search heritage sites" onPress={onPress} style={styles.bar}>
      <Icon name="magnify" size={20} color={colors.textMuted} />
      <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>{COPY.searchPlaceholder}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: touchTargets.minimum,
    marginHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadows.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
