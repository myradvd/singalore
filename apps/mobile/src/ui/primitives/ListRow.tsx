import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, touchTargets, typography } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

export interface ListRowProps
{
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  trailing?: ReactNode;
  showChevron?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({ title, subtitle, icon, onPress, trailing, showChevron = onPress !== undefined, disabled = false, accessibilityHint, testID }: ListRowProps)
{
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityLabel={subtitle === undefined ? title : `${title}. ${subtitle}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled || onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon !== undefined && <Icon name={icon} size={22} color={disabled ? colors.textDisabled : colors.primary} />}
      <View style={styles.text}>
        <Text style={[typography.bodyStrong, { color: disabled ? colors.textDisabled : colors.text }]}>{title}</Text>
        {subtitle !== undefined && <Text style={[typography.caption, { color: disabled ? colors.textDisabled : colors.textMuted }]}>{subtitle}</Text>}
      </View>
      {trailing}
      {showChevron && <Icon name="chevron-right" size={22} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTargets.minimum + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceSunken },
  text: { flex: 1, gap: spacing.xxs },
});
